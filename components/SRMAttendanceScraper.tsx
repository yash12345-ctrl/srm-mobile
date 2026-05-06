import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Dimensions, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface SRMAttendanceScraperProps {
  onScrapeComplete: (attendanceData: any) => void;
  onStepChange?: (step: string) => void;
  backgroundMode?: boolean;
  onSessionExpired?: () => void;
}

const COOLDOWN_HOURS = 2;
const CACHE_KEY      = 'attendance_data_v2'; // bumped: clears old corrupted cache


const SRMAttendanceScraper: React.FC<SRMAttendanceScraperProps> = ({
  onScrapeComplete,
  onStepChange,
  backgroundMode = false,
  onSessionExpired,
}) => {
  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => { onSessionExpiredRef.current = onSessionExpired; }, [onSessionExpired]);
  const webViewRef = useRef<WebView>(null);
  const onScrapeCompleteRef = useRef(onScrapeComplete);

  const [currentStep,      setCurrentStep]      = useState("Checking saved attendance...");
  const [isCheckingCache, setIsCheckingCache]  = useState(true);
  const [isDone,           setIsDone]           = useState(false);
  const [scraperKey,       setScraperKey]       = useState(0);

  // Ref-based mirror of isDone so the AppState handler always sees the latest
  // value without needing it as a dependency (avoids re-registering listener).
  const isDoneRef = useRef(false);

  useEffect(() => {
    onScrapeCompleteRef.current = onScrapeComplete;
  }, [onScrapeComplete]);

  // ── Helper: load cache and push to caller ──────────────────────────────────
  const loadCache = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        const arr       = parsed.data;
        arr.lastUpdated = parsed.lastUpdated;
        onScrapeCompleteRef.current(arr);
      } else {
        onScrapeCompleteRef.current(parsed);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Helper: has the 2-hour cooldown elapsed? ───────────────────────────────
  const isCooledDown = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      if (!parsed.lastUpdated) return true;
      const hoursSince = (Date.now() - new Date(parsed.lastUpdated).getTime()) / 3_600_000;
      return hoursSince >= COOLDOWN_HOURS;
    } catch {
      return true; // on error always allow scrape
    }
  }, []);

  // ── 1. Mount: load cache first, check cooldown, then reveal WebView ────────
  useEffect(() => {
    (async () => {
      const hadCache = await loadCache();
      const cooledDown = await isCooledDown();

      if (hadCache && !cooledDown) {
        // If within 2 hours and we have cached data, DO NOT scrape.
        console.log(`[Attendance] Initial app open skipped scrape — within ${COOLDOWN_HOURS}h cooldown.`);
        isDoneRef.current = true;
        setIsDone(true);
        setCurrentStep("Showing attendance.");
      } else {
        // Cooldown elapsed or no cache -> Start scraping
        setCurrentStep(hadCache ? "Refreshing attendance in background..." : "Opening Attendance...");
      }
      
      setIsCheckingCache(false);
    })();
  }, [loadCache, isCooledDown]);

  const incrementScraperKey = useCallback(() => {
    setScraperKey(prev => prev + 1);
  }, []);

  const handleAppState = useCallback(async (nextState: AppStateStatus) => {
    if (nextState !== 'active') return;

    const cooledDown = await isCooledDown();
    if (!cooledDown) {
      console.log(`[Attendance] App foreground skipped scrape — within ${COOLDOWN_HOURS}h cooldown.`);
      return;
    }

    console.log('[Attendance] Cooldown elapsed → restarting scraper.');

    // Show cached data while refreshing
    const hadCache = await loadCache();
    setCurrentStep(hadCache ? "Refreshing attendance in background..." : "Opening Attendance...");

    // Step 1: clear done flag so the WebView container stops being hidden
    isDoneRef.current = false;
    setIsDone(false);

    // Step 2: after the above render flushes, remount the WebView with a
    //         new key so the injection script runs fresh from scratch.
    setTimeout(incrementScraperKey, 0);
  }, [isCooledDown, loadCache, incrementScraperKey]);

  // ── 2. App-open 2-hour refresh ─────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [handleAppState]);

  // ── 3. Save + notify on successful scrape ─────────────────────────────────
  const handleScrapeSuccess = useCallback(async (data: any[]) => {
    if (isDoneRef.current) return; // guard against double SUCCESS messages
    isDoneRef.current = true;

    const timestamp = new Date().toISOString();
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, lastUpdated: timestamp }));
    } catch (err) {
      console.error("[Attendance] Failed to save:", err);
    }

    (data as any).lastUpdated = timestamp;
    onScrapeCompleteRef.current(data);
    setIsDone(true);
  }, []);

  useEffect(() => {
    if (onStepChange) onStepChange(currentStep);
  }, [currentStep, onStepChange]);

  // ─────────────────────────────────────────────────────────────────────────────
  // INJECTION SCRIPT
  // ─────────────────────────────────────────────────────────────────────────────
  const injectionScript = String.raw`
    (function() {
      if (window.__ATT_SCRAPER__) return;
      window.__ATT_SCRAPER__ = true;

      function post(type, extra) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
      }
      function log(msg)   { post('LOG',     { message: msg }); }
      function success(d) { post('SUCCESS', { data: d });      }
      function stuck(msg) { post('STUCK',   { message: msg }); }

      var S = {
        done:            false,
        navAttempted:    false,
        navStrategy:     0,
        navRetries:      0,
        MAX_NAV_RETRIES: 5,
        lastNavTime:     0,
        NAV_TIMEOUT:     7000,
      };

      function humanClick(el) {
        if (!el) return false;
        ['pointerover','pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t) {
          el.dispatchEvent(new MouseEvent(t, {
            bubbles: true, cancelable: true, view: window,
            buttons: t.includes('down') ? 1 : 0
          }));
        });
        return true;
      }

      function navigateToAttendance() {
        S.navAttempted = true;
        S.lastNavTime  = Date.now();
        var str = S.navStrategy;

        if (str === 0) {
          var el = document.querySelector('#My_Attendance') ||
                   document.querySelector("a[href*='My_Attendance']") ||
                   document.querySelector("li[id*='Attendance'] a");
          if (el) { log('Connecting'); humanClick(el); return; }
        }
        if (str <= 1) {
          var all = Array.from(document.querySelectorAll('a, li, span, div[onclick]'));
          var el  = all.find(function(e) {
            var t = (e.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return t === 'my attendance' || t === 'attendance';
          });
          if (el) { log('connecting'); humanClick(el); return; }
        }

        log('connecting');
        window.location.hash = '#Page:My_Attendance';
      }

      function isLoggedIn() {
        return !!(
          document.querySelector('.zc-app-brand-appname') ||
          document.querySelector('#mainmenu') ||
          document.querySelector('#topnav') ||
          document.querySelector('.academiaHeader') ||
          window.location.href.includes('Home.do')
        );
      }

      // Detects if the WebView has been redirected back to the login page,
      // meaning the user's college session was terminated from another device/browser.
      function isOnLoginPage() {
        var url = window.location.href;
        return (
          url.includes('accounts.zoho') ||
          url.includes('/login') ||
          url.includes('signin') ||
          !!document.querySelector('#login_id') ||
          !!document.querySelector('iframe#signinFrame') ||
          !!document.querySelector('input[type="password"][id="password"]')
        );
      }

      function hasAttendanceTable(doc) {
        var txt = (doc.body ? doc.body.innerText : '').toLowerCase();
        if (txt.includes('course code') && (txt.includes('conducted') || txt.includes('attended'))) return true;
        var frames = doc.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          try { if (hasAttendanceTable(frames[i].contentDocument || frames[i].contentWindow.document)) return true; }
          catch(e) { /* ignore cross-origin frames */ }
        }
        return false;
      }

      function extractFromDoc(doc) {
        // Helper: extract the FIRST clean integer/float from a string.
        // e.g. "100\n09\n00" → "100", "5.005%" → "5.00" (first match)
        function firstNum(str, allowDecimal) {
          if (!str) return '0';
          var s = str.replace(/\s+/g, ' ').trim();
          var m = allowDecimal
            ? s.match(/(\d+(?:\.\d+)?)/)
            : s.match(/(\d+)/);
          return m ? m[1] : '0';
        }

        var tables = doc.querySelectorAll('table');
        for (var ti = 0; ti < tables.length; ti++) {
          var tbl = tables[ti], txt = tbl.innerText || '';
          if (!txt.includes('Course Code') && !txt.includes('course code')) continue;
          if (!txt.includes('Conducted') && !txt.includes('conducted') &&
              !txt.includes('Attended')  && !txt.includes('attended'))  continue;

          // ── Detect column indices from the header row ──────────────────────
          var headerRow = null;
          var allRows = Array.from(tbl.querySelectorAll('tr'));
          for (var ri = 0; ri < allRows.length; ri++) {
            var rowText = (allRows[ri].innerText || '').toLowerCase();
            if (rowText.includes('course code') && (rowText.includes('conducted') || rowText.includes('attended'))) {
              headerRow = allRows[ri];
              break;
            }
          }

          var colCode = 0, colSubject = 1, colCategory = 2;
          var colConducted = -1, colAbsent = -1, colPercent = -1;

          if (headerRow) {
            var hCells = Array.from(headerRow.querySelectorAll('th, td')).map(function(c) {
              return (c.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
            });
            hCells.forEach(function(h, i) {
              if (h.includes('course code') || h === 'course') colCode = i;
              if (h.includes('course title') || h === 'title' || h.includes('subject')) colSubject = i;
              if (h === 'category' || h.includes('type')) colCategory = i;
              if (h.includes('conducted') || h.includes('total hour')) colConducted = i;
              if (h.includes('absent'))   colAbsent   = i;
              if (h.includes('attend') && !h.includes('total') && !h.includes('absent')) colPercent = i;
              if (h.includes('%') || h.includes('percent')) colPercent = i;
            });
          }

          // Fallback: use last 3 columns (old behaviour but safer)
          var useHeaderCols = colConducted !== -1 && colAbsent !== -1 && colPercent !== -1;

          var attData = [], seen = {};

          allRows.forEach(function(row) {
            var cells = Array.from(row.querySelectorAll('td')).map(function(td) {
              // Take only the first line of text to avoid merged-cell bleed
              var raw = (td.innerText || '').trim();
              // Split on newlines and take first non-empty segment
              var lines = raw.split(/[\r\n]+/).map(function(l) { return l.trim(); }).filter(Boolean);
              return lines[0] || '';
            });

            if (cells.length < 5) return;
            var code = cells[colCode] || '';
            if (!code || code.length <= 1) return;
            if (/course\s*code/i.test(code)) return;

            var subject  = cells[colSubject]  || 'Unknown';
            var category = cells[colCategory] || '';

            var totalHours, totalAbsent, percent;

            if (useHeaderCols) {
              totalHours  = firstNum(cells[colConducted], false);
              totalAbsent = firstNum(cells[colAbsent],    false);
              percent     = firstNum(cells[colPercent],   true);
            } else {
              // Fallback: scan from the end, find first numeric columns
              totalHours  = firstNum(cells[cells.length - 3], false);
              totalAbsent = firstNum(cells[cells.length - 2], false);
              percent     = firstNum(cells[cells.length - 1], true);
            }

            // Sanity check — values above 10000 are clearly garbage
            var h = parseInt(totalHours, 10);
            var a = parseInt(totalAbsent, 10);
            var p = parseFloat(percent);
            if (h > 10000 || a > 10000 || p > 100) return; // skip bad row

            var totalPresent = Math.max(0, h - a).toString();
            var key = code + '_' + subject + '_' + category;
            if (seen[key]) return;
            seen[key] = true;

            var displaySubject = (category && category !== '-') ? subject + ' - ' + category : subject;
            attData.push({
              code: code,
              subject: displaySubject,
              attendance: percent,
              totalHours: totalHours,
              totalAbsent: totalAbsent,
              totalPresent: totalPresent,
            });
          });

          if (attData.length > 0) return attData;
        }

        var frames = doc.querySelectorAll('iframe');
        for (var fi = 0; fi < frames.length; fi++) {
          try {
            var res = extractFromDoc(frames[fi].contentDocument || frames[fi].contentWindow.document);
            if (res && res.length > 0) return res;
          } catch(e) { /* ignore security errors on external iframes */ }
        }
        return null;
      }


      function tryScrape() {
        if (S.done) return true;
        try {
          if (!isLoggedIn()) return false;

          if (hasAttendanceTable(document)) {
            log('📊 Extracting attendance…');
            var data = extractFromDoc(document);
            if (data && data.length > 0) {
              S.done = true;
              log('✅ Attendance updated!');
              success(data);
              return true;
            }
            log('⏳ Table found but rows empty — waiting…');
            return false;
          }

          if (!S.navAttempted) { log('🔗 Opening Attendance…'); navigateToAttendance(); }
        } catch(e) { log('Error in tryScrape: ' + String(e)); }
        return false;
      }

      // Watchdog — escalates nav strategy every 6 s
      var watchdog = setInterval(function() {
        if (S.done) { clearInterval(watchdog); return; }

        // ── Session expiry check: if we are on the login page, the college
        // session was killed from another browser/device. Notify RN immediately.
        if (!isLoggedIn() && isOnLoginPage()) {
          clearInterval(watchdog);
          clearInterval(poll);
          clearInterval(iframePoll);
          post('SESSION_EXPIRED', {});
          return;
        }

        if (hasAttendanceTable(document)) return;
        if (S.navRetries >= S.MAX_NAV_RETRIES) {
          clearInterval(watchdog);
          stuck('⚠️ Could not open Attendance after ' + S.MAX_NAV_RETRIES + ' retries. Please tap it manually.');
          return;
        }
        var timeSinceNav = S.navAttempted ? (Date.now() - S.lastNavTime) : Infinity;
        if (timeSinceNav > S.NAV_TIMEOUT || !S.navAttempted) {
          S.navRetries++;
          S.navAttempted = false;
          S.navStrategy  = Math.min(S.navStrategy + 1, 2);
          log('🔄 Watchdog retry #' + S.navRetries + ' (strategy ' + S.navStrategy + ')…');
          tryScrape();
        }
      }, 6000);

      // 1 s interval poll — safety net for missed mutations
      var poll = setInterval(function() {
        if (S.done) { clearInterval(poll); return; }
        tryScrape();
      }, 1000);

      // 3 s iframe-specific poll
      var iframePoll = setInterval(function() {
        if (S.done) { clearInterval(iframePoll); return; }
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          try {
            var inner = frames[i].contentDocument || frames[i].contentWindow.document;
            var txt   = (inner.body ? inner.body.innerText : '').toLowerCase();
            if (txt.includes('course code') && (txt.includes('conducted') || txt.includes('attended'))) {
              tryScrape(); break;
            }
          } catch(e) { /* unreadable frame */ }
        }
      }, 3000);

      // MutationObserver — 80-180 ms reaction (was 500-1500 ms)
      var observer = new MutationObserver(function(_, obs) {
        if (S.done) { obs.disconnect(); return; }
        setTimeout(function() { if (tryScrape()) obs.disconnect(); },
                   80 + Math.floor(Math.random() * 100));
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Initial kick — 400-700 ms (was 2000-4000 ms)
      setTimeout(tryScrape, 400 + Math.floor(Math.random() * 300));

      true;
    })();
  `;

  // ── Render ────────────────────────────────────────────────────────────────
  if (isCheckingCache) {
    if (backgroundMode) return null;
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.debugText}>{currentStep}</Text>
      </View>
    );
  }

  // IMPORTANT: We never return null for the WebView.
  // When done or in backgroundMode we move it fully offscreen instead.
  // This keeps the JS context alive so AppState can restart via scraperKey.
  return (
    <View style={(backgroundMode || isDone) ? styles.hiddenContainer : styles.container}>
      <WebView
        key={scraperKey}
        ref={webViewRef}
        source={{ uri: 'https://academia.srmist.edu.in/' }}
        injectedJavaScript={injectionScript}
        sharedCookiesEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload.type === 'LOG')     setCurrentStep(payload.message);
            if (payload.type === 'SUCCESS') handleScrapeSuccess(payload.data);
            if (payload.type === 'STUCK')   setCurrentStep(payload.message);
            if (payload.type === 'SESSION_EXPIRED') {
              console.warn('[Attendance] Session expired — user logged out from another device.');
              if (onSessionExpiredRef.current) onSessionExpiredRef.current();
            }
          } catch (err) {
            console.debug('[Attendance] Ignored unparseable message or logic error:', err);
          }
        }}
        style={styles.offScreenWebView}
        startInLoadingState={!backgroundMode && !isDone}
      />

      {!backgroundMode && !isDone && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.overlayText}>{currentStep}</Text>
        </View>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, width, height: 500, marginTop: 20 },
  // Full-size offscreen — two purposes:
  //  1. Prevents Android from throttling JS in tiny/hidden WebViews.
  //  2. Keeps the WebView mounted when isDone=true so AppState can
  //     restart it via scraperKey without a remount race condition.
  hiddenContainer: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width,
    height: 1000,
  },
  offScreenWebView: { width, height: 1000 },
  loadingCenter: { justifyContent: 'center', alignItems: 'center' },
  webview:       { flex: 1, opacity: 1 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  overlayText: { color: '#fff',    marginLeft: 10, fontWeight: '600', fontSize: 14 },
  debugText:   { color: '#111827', marginLeft: 10, fontWeight: '600', fontSize: 14 },
});

export default SRMAttendanceScraper;
