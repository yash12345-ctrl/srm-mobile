import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface SRMTimeTableScraperProps {
  onScrapeComplete: (data: { batch: number, courses: any[], lastUpdated?: string }) => void;
  backgroundMode?: boolean;
}

const SRMTimeTableScraper: React.FC<SRMTimeTableScraperProps> = ({ onScrapeComplete, backgroundMode = false }) => {
  const [currentStep, setCurrentStep] = useState("Checking saved timetable...");
  const [isCheckingCache, setIsCheckingCache] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const [scraperKey, setScraperKey] = useState(0);

  // 1. INITIAL MOUNT CACHE CHECK (FIXED DEPENDENCY ARRAY)
  useEffect(() => {
    const checkCacheAndScrape = async () => {
      try {
        const cachedData = await AsyncStorage.getItem('timetable_data');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          onScrapeComplete(parsed);
          
          if (parsed.lastUpdated) {
            const hoursSinceLastUpdate =
              (Date.now() - new Date(parsed.lastUpdated).getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastUpdate < 2) {
              console.log(`Initial load: Scrape skipped. Last updated ${hoursSinceLastUpdate.toFixed(2)}h ago.`);
              setIsDone(true); // Stops the WebView from mounting/scraping
            } else {
              setCurrentStep("Refreshing timetable in background...");
            }
          } else {
            setCurrentStep("Refreshing timetable in background...");
          }
        } else {
          setCurrentStep("Please log in to Academia...");
        }
      } catch (error) {
        console.warn('[Timetable] Cache read failed:', error);
        setCurrentStep("Please log in to Academia...");
      } finally {
        setIsCheckingCache(false);
      }
    };
    checkCacheAndScrape();
  }, []); // <--- Empty array prevents the infinite render loop

  // 2. APP STATE CHANGE CACHE CHECK (BACKGROUND TO FOREGROUND)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          const cachedData = await AsyncStorage.getItem('timetable_data');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed.lastUpdated) {
              const hoursSinceLastUpdate =
                (Date.now() - new Date(parsed.lastUpdated).getTime()) / (1000 * 60 * 60);
              if (hoursSinceLastUpdate < 2) {
                console.log(`App Resumed: Scrape skipped. Last updated ${hoursSinceLastUpdate.toFixed(2)}h ago.`);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('[Timetable] Cooldown check failed, proceeding with scrape:', e);
        }
        console.log("App opened: Restarting timetable scraper...");
        setIsDone(false);
        setScraperKey(prev => prev + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const handleScrapeSuccess = async (data: any) => {
    const finalData = { ...data, lastUpdated: new Date().toISOString() };
    try {
      await AsyncStorage.setItem('timetable_data', JSON.stringify(finalData));
    } catch (error) {
      console.error("Failed to save timetable data", error);
    }
    onScrapeComplete(finalData);
    setIsDone(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // IMPROVED INJECTION SCRIPT
  // ─────────────────────────────────────────────────────────────────────────────
  const injectionScript = String.raw`
    (function() {
      if (window.__TT_SCRAPER__) return;
      window.__TT_SCRAPER__ = true;

      // ── Messaging helpers ────────────────────────────────────────────────────
      function post(type, payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
      }
      function log(msg)    { post('LOG',     { message: msg }); }
      function success(d)  { post('SUCCESS', { data: d });      }
      function stuck(msg)  { post('STUCK',   { message: msg }); }

      // ── Shared state ─────────────────────────────────────────────────────────
      var state = {
        done:          false,   // SUCCESS sent — stop everything
        navAttempted:  false,   // clicked the menu link at least once
        navStrategy:   0,       // 0 = getElementById, 1 = querySelector, 2 = hash
        retryCount:    0,       // how many times watchdog has had to retry nav
        MAX_RETRIES:   5,       // give up after this many watchdog nav retries
        lastNavTime:   0,       // timestamp of last nav attempt
        NAV_TIMEOUT:   8000,    // ms to wait before watchdog considers nav "stuck"
      };

      // ── Human-like click ─────────────────────────────────────────────────────
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

      function unique(values) {
        return Array.from(new Set(values.filter(Boolean)));
      }

      function timetableHashes() {
        var discovered = [];
        try {
          document.querySelectorAll('a, [id], [data-menu-id]').forEach(function(el) {
            var href = (el.getAttribute('href') || '').trim();
            var id = (el.getAttribute('id') || '').trim();
            var menu = (el.getAttribute('data-menu-id') || '').trim();
            [href, id, menu].forEach(function(value) {
              if (!value) return;
              if (/time[_\s-]*table|timetable/i.test(value)) {
                discovered.push(value.replace(/^.*#/, '').replace(/^#/, ''));
              }
            });
          });
        } catch (e) {}

        return unique(discovered.concat([
          'Page:My_Time_Table_2026_27',
          'Page:My_Time_Table_2025_26',
          'Page:My_Time_Table_2024_25',
          'Page:My_Time_Table_2023_24',
          'Page:My_Time_Table',
        ]));
      }

      function findTimetableElement() {
        var candidates = Array.from(document.querySelectorAll('a, li, button, span, div'));
        return candidates.find(function(e) {
          var t = (e.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
          var h = (e.getAttribute('href') || '').toLowerCase();
          var id = (e.getAttribute('id') || '').toLowerCase();
          var visible = !!(e.offsetParent !== null);
          return visible && (
            t.includes('time table') ||
            t.includes('timetable') ||
            h.includes('time_table') ||
            h.includes('timetable') ||
            id.includes('time_table') ||
            id.includes('timetable')
          );
        });
      }

      // ── Navigation strategies (tried in order on each retry) ─────────────────
      function attemptNav() {
        state.navAttempted = true;
        state.lastNavTime  = Date.now();
        var s = state.navStrategy;
        var discoveredHashes = timetableHashes();

        if (s === 0) {
          var exact = document.getElementById('My_Time_Table_2026_27') ||
                      document.getElementById('My_Time_Table_2025_26') ||
                      document.getElementById('My_Time_Table_2024_25') ||
                      document.getElementById('My_Time_Table_2023_24');
          if (exact) { log('🚀 Nav (strategy 0): clicking exact timetable item…'); humanClick(exact); return true; }
        }

        if (s <= 1) {
          var el = findTimetableElement();
          if (el) { log('connecting'); humanClick(el); return true; }
        }

        // Strategy 2: force hash navigation
        log('connecting');
        window.location.hash = '#' + (discoveredHashes[Math.min(state.retryCount, discoveredHashes.length - 1)] || 'Page:My_Time_Table');
        return true;
      }

      // ── Batch detection ───────────────────────────────────────────────────────
      function getBatch(doc) {
        if (doc && doc.body && doc.body.innerText.match(/Batch\s*:\s*2/i)) return 2;
        var frames = doc.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          try {
            var res = getBatch(frames[i].contentDocument || frames[i].contentWindow.document);
            if (res) return res;
          } catch(e) { /* cross-origin iframe */ }
        }
        return 1;
      }

      // ── Course extraction (recursive iframes) ────────────────────────────────
      function extractCourses(doc) {
        var courses  = [];
        var allRows  = doc.querySelectorAll('tr');
        var codeIdx  = -1, titleIdx = -1, slotIdx = -1, roomIdx = -1;
        var gotHeader = false;

        for (var i = 0; i < allRows.length; i++) {
          var cells = Array.from(allRows[i].children);
          if (cells.length < 3) continue;
          var texts = cells.map(function(c) {
            return c.innerText.toLowerCase().replace(/\s+/g, ' ').trim();
          });

          if (!gotHeader) {
            codeIdx = texts.findIndex(function(t) { return t.includes('course code') && t.length < 30; });
            if (codeIdx !== -1) {
              titleIdx = texts.findIndex(function(t) { return (t.includes('title') || t.includes('name')) && t.length < 30; });
              slotIdx  = texts.findIndex(function(t) { return (t.includes('slot') || t.includes('sec')) && t.length < 30; });
              roomIdx  = texts.findIndex(function(t) { return (t.includes('room') || t.includes('venue')) && t.length < 30; });
              gotHeader = true;
            }
          } else if (codeIdx !== -1 && cells.length > codeIdx) {
            var code = texts[codeIdx];
            if (code.includes('course code')) continue;
            if (code.length > 3 && /[a-z]/i.test(code) && /[0-9]/.test(code)) {
              courses.push({
                code:  cells[codeIdx].innerText.replace(/\s+/g, ' ').trim(),
                title: titleIdx !== -1 && cells[titleIdx] ? cells[titleIdx].innerText.replace(/\s+/g, ' ').trim() : 'Unknown',
                slot:  slotIdx  !== -1 && cells[slotIdx]  ? cells[slotIdx].innerText.replace(/\s+/g, ' ').trim().toUpperCase() : 'TBD',
                room:  roomIdx  !== -1 && cells[roomIdx]  ? cells[roomIdx].innerText.replace(/\s+/g, ' ').trim()               : 'TBD',
              });
            }
          }
        }

        if (courses.length > 0) return courses;

        // Recurse into iframes
        var frames = doc.querySelectorAll('iframe');
        for (var j = 0; j < frames.length; j++) {
          try {
            var inner = frames[j].contentDocument || frames[j].contentWindow.document;
            var res = extractCourses(inner);
            if (res.length > 0) return res;
          } catch(e) { /* cross-origin iframe */ }
        }
        return [];
      }

      // ── Core scrape attempt ───────────────────────────────────────────────────
      function tryScrape() {
        if (state.done) return true;

        var bodyText = (document.body ? document.body.innerText : '').toLowerCase().replace(/\s+/g, ' ');

        // Not logged in at all yet — wait
        if (bodyText.length < 100) return false;

        // Timetable page not open yet — navigate
        if (!bodyText.includes('course code')) {
          if (!state.navAttempted) {
            attemptNav();
          }
          return false;
        }

        // Page has course data — extract
        log('📊 Course table detected, extracting…');
        var courses = extractCourses(document);

        if (courses.length > 0) {
          state.done = true;
          success({ batch: getBatch(document), courses: courses });
          return true;
        }

        log('⏳ Table present but rows empty — waiting…');
        return false;
      }

      // ── Watchdog — runs every 8 s ─────────────────────────────────────────────
      var watchdogInterval = setInterval(function() {
        if (state.done) { clearInterval(watchdogInterval); return; }

        var bodyText = (document.body ? document.body.innerText : '').toLowerCase();

        // Already showing course content — let normal flow handle it
        if (bodyText.includes('course code')) return;

        var timeSinceNav = state.navAttempted ? (Date.now() - state.lastNavTime) : Infinity;

        if (state.retryCount >= state.MAX_RETRIES) {
          clearInterval(watchdogInterval);
          stuck('⚠️ Could not load timetable after ' + state.MAX_RETRIES + ' retries. Please open the Timetable page manually.');
          return;
        }

        if (timeSinceNav > state.NAV_TIMEOUT || !state.navAttempted) {
          state.retryCount++;
          state.navAttempted = false;          // reset so tryScrape will nav again
          state.navStrategy  = Math.min(state.navStrategy + 1, 2); // escalate strategy
          log('🔄 Watchdog retry #' + state.retryCount + ' (strategy ' + state.navStrategy + ')…');
          tryScrape();
        }
      }, 8000);

      // ── Interval poll — safety net every 2 s ─────────────────────────────────
      var pollInterval = setInterval(function() {
        if (state.done) { clearInterval(pollInterval); return; }
        tryScrape();
      }, 2000);

      // ── MutationObserver — reacts immediately to DOM changes ──────────────────
      var observer = new MutationObserver(function(mutations, obs) {
        if (state.done) { obs.disconnect(); return; }
        // Small random delay to mimic human reaction and let DOM settle
        setTimeout(function() {
          if (tryScrape()) obs.disconnect();
        }, 300 + Math.floor(Math.random() * 400));
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // ── Dedicated iframe content poller ───────────────────────────────────────
      var iframeInterval = setInterval(function() {
        if (state.done) { clearInterval(iframeInterval); return; }
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          try {
            var inner = frames[i].contentDocument || frames[i].contentWindow.document;
            var innerText = (inner.body ? inner.body.innerText : '').toLowerCase();
            if (innerText.includes('course code')) {
              // iframe has the data — let tryScrape recurse into it
              tryScrape();
              break;
            }
          } catch(e) { /* cross-origin iframe */ }
        }
      }, 3000);

      // ── Initial kick ──────────────────────────────────────────────────────────
      var initialDelay = 2000 + Math.floor(Math.random() * 1500);
      setTimeout(tryScrape, initialDelay);

      true;
    })();
  `;

  if (isDone) return null;

  if (isCheckingCache) {
    if (backgroundMode) return null;
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.debugText}>{currentStep}</Text>
      </View>
    );
  }

  return (
    <View style={backgroundMode ? styles.hiddenContainer : styles.container}>
      <WebView
        key={scraperKey}
        source={{ uri: 'https://academia.srmist.edu.in/' }}
        injectedJavaScript={injectionScript}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload.type === 'LOG')   setCurrentStep(payload.message);
            if (payload.type === 'SUCCESS') handleScrapeSuccess(payload.data);
            if (payload.type === 'STUCK')   setCurrentStep(payload.message);
          } catch (e) {
            console.debug('[Timetable] Ignored unparseable WebView message:', e);
          }
        }}
        style={backgroundMode ? { width: 1, height: 1 } : { flex: 1, marginBottom: 60 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        startInLoadingState={!backgroundMode}
      />
      {!backgroundMode && (
        <View style={styles.debugBanner}>
          <ActivityIndicator color="#3B82F6" size="small" />
          <Text style={styles.debugText}>{currentStep}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F9FAFB' },
  hiddenContainer: { position: 'absolute', width: 1, height: 1, opacity: 0, zIndex: -1 },
  loadingCenter:   { justifyContent: 'center', alignItems: 'center' },
  debugBanner: {
    position: 'absolute', bottom: 0, width: '100%', height: 60,
    backgroundColor: '#FFFFFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1, borderColor: '#E5E7EB', elevation: 10,
  },
  debugText: { color: '#111827', marginLeft: 10, fontWeight: '600', fontSize: 14 },
});

export default SRMTimeTableScraper;
