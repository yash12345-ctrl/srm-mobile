import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Dimensions, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkEntry {
  code: string;
  name: string;
  type: string;
  scores: string;
}

interface MarksData {
  data: MarkEntry[];
  lastUpdated: string;
}

interface SRMMarksScraperProps {
  onScrapeComplete: (marksData: any) => void;
  onStepChange?: (step: string) => void;
  backgroundMode?: boolean;
  refreshIntervalHours?: number; // default: 2
  maxRetries?: number;           // default: 3
  scrapeTimeoutMs?: number;      // default: 70000
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY          = 'marks_data_v3';
const DEFAULT_REFRESH_H  = 1;
const DEFAULT_RETRIES    = 3;
const DEFAULT_TIMEOUT_MS = 70_000;
const PING_SILENCE_MS    = 18_000;  // remount WebView if silent this long
const SRM_URL            = 'https://academia.srmist.edu.in/';

// ─── Injected JS ─────────────────────────────────────────────────────────────

const buildInjectionScript = (): string => String.raw`
(function () {
  if (window.__SRM_MARKS_V2__) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PING' }));
    return;
  }
  window.__SRM_MARKS_V2__ = true;

  /* ── messaging ─────────────────────────────────────────────────────────── */
  const send = (type, extra) =>
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...(extra || {}) }));
  const log  = msg  => send('LOG',     { message: msg });
  const ok   = data => send('SUCCESS', { data });
  const fail = msg  => send('ERROR',   { message: msg });
  const ping = ()   => send('PING');

  /* ── state ──────────────────────────────────────────────────────────────── */
  let done         = false;
  let navAttempts  = 0;
  let lastActivity = Date.now();

  /* ── heartbeat every 3 s so RN watchdog knows we are alive ──────────────── */
  const heartbeat = setInterval(() => {
    if (!done) ping(); else clearInterval(heartbeat);
  }, 3000);

  /* ── human-style click ───────────────────────────────────────────────────── */
  function click(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) {}
    try { el.click(); } catch (_) {}
    ['pointerover','pointerdown','mousedown','pointerup','mouseup','click'].forEach(type =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window,
        buttons: type.includes('down') ? 1 : 0 }))
    );
  }

  /* ── session check ───────────────────────────────────────────────────────── */
  function sessionExpired() {
    return !!(
      document.querySelector('#login_id') ||
      document.querySelector('input[type="password"]') ||
      (document.title || '').toLowerCase().includes('sign in')
    );
  }

  /* ── check if marks table is rendered ───────────────────────────────────── */
  function isMarksReady() {
    const txt = document.body.textContent || '';
    return txt.includes('Test Performance') && txt.includes('Course Code');
  }

  /* ── navigate to marks page ──────────────────────────────────────────────── */
  function tryNavigate() {
    if (done) return;
    navAttempts++;
    log('Nav #' + navAttempts + ' to marks page...');

    // strategy 1: direct link click
    const links = [
      document.querySelector('#My_Attendance'),
      document.querySelector("a[href*='My_Attendance']"),
      document.querySelector("a[href*='marks']"),
      document.querySelector("a[href*='Marks']"),
      document.querySelector("a[href*='Test_Performance']"),
    ];
    for (const el of links) {
      if (el && el.offsetParent !== null) { click(el); lastActivity = Date.now(); return; }
    }

    // strategy 2: menu toggle then retry
    const menuToggle = document.querySelector('#menuToggle');
    if (menuToggle && menuToggle.offsetParent !== null) {
      click(menuToggle);
      lastActivity = Date.now();
      // after menu opens, try clicking link again after short delay
      setTimeout(() => {
        const link = document.querySelector('#My_Attendance') ||
                     document.querySelector("a[href*='My_Attendance']");
        if (link) { click(link); lastActivity = Date.now(); }
      }, 600);
      return;
    }

    // strategy 3: hash navigation
    const hashes = ['#Page:My_Attendance', '#My_Attendance', '#Page:Test_Performance'];
    const hash = hashes[Math.min(navAttempts - 1, hashes.length - 1)];
    log('Hash nav: ' + hash);
    window.location.hash = hash;
    lastActivity = Date.now();

    // strategy 4: every 3rd attempt force full reload
    if (navAttempts % 3 === 0) {
      log('Force URL reload');
      window.location.replace(window.location.origin + window.location.pathname + hash);
    }
  }

  /* ── CORE: parse marks table ─────────────────────────────────────────────── */
  function tryScrape() {
    if (done) return true;

    if (sessionExpired()) { fail('SESSION_EXPIRED'); return true; }

    if (!isMarksReady()) return false;

    log('📊 Marks table found — parsing...');
    lastActivity = Date.now();

    try {
      const rawMarks = [];
      const allRows  = document.querySelectorAll('tr');

      allRows.forEach(row => {
        const cells = Array.from(row.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
        if (cells.length < 3) return;

        const code = (cells[0].textContent || '').replace(/[\u00a0\t]+/g, ' ').trim();
        if (!/^[0-9]{2}[A-Z]{2,}[0-9]+[A-Z]?$/.test(code)) return;

        const type      = (cells[1].textContent || '').trim();
        const testCell  = cells[cells.length - 1];
        const combinedScores = [];

        function hasExplicitZero(node, text) {
          const normalizedText = String(text || '').toLowerCase();
          if (/(^|[^0-9])0([^0-9]|$)/.test(normalizedText)) return true;

          const imgs = Array.from(node.querySelectorAll('img'));
          return imgs.some(img => {
            const hints = [
              img.getAttribute('alt') || '',
              img.getAttribute('title') || '',
              img.getAttribute('aria-label') || '',
              img.getAttribute('src') || '',
              img.className || '',
            ].join(' ').toLowerCase();
            return /(^|[^0-9])0([^0-9]|$)|\\bzero\\b/.test(hints);
          });
        }

        function normalizeScoreText(node, text) {
          let normalized = String(text || '').replace(/\s+/g, ' ').trim();
          if (!hasExplicitZero(node, normalized)) return normalized;

          if (!normalized) return '0';
          if (/(^|[^0-9])0([^0-9]|$)/.test(normalized)) return normalized;

          // SRM sometimes renders zero in a separate icon/image cell, so the
          // scraped text may end at the max mark like "CAT1 / 15".
          if (/\/\s*\d+\.?\d*\s*$/.test(normalized)) {
            return normalized + ' 0';
          }

          return normalized + ' 0';
        }

        const allTables   = Array.from(testCell.querySelectorAll('table'));
        const innerTables = allTables.filter(t => t.querySelectorAll('table').length === 0);

        if (innerTables.length > 0) {
          innerTables.forEach(t => {
            let htmlStr = t.innerHTML;
            htmlStr = htmlStr.replace(/<[/]?(hr|br|tr|td|th|div|p)[^>]*>/gi, ' ');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlStr;
            let cleanedText = normalizeScoreText(t, tempDiv.textContent);

            if (
              cleanedText &&
              cleanedText !== '-' &&
              (/\d/.test(cleanedText) || /\b(ab|abs|absent)\b/i.test(cleanedText))
            ) {
              combinedScores.push(cleanedText);
            }
          });
        } else {
          let text = normalizeScoreText(
            testCell,
            (testCell.textContent || '').replace(/[\u00a0\t\n\r]+/g, ' ').trim()
          );
          if (
            text &&
            text !== '-' &&
            (/\d/.test(text) || /\b(ab|abs|absent)\b/i.test(text))
          ) {
            combinedScores.push(text);
          }
        }

        rawMarks.push({
          code,
          name:   'Subject',
          type,
          scores: combinedScores.join('\n'),
        });
      });

      // Keep distinct assessment rows for the same subject.
      // Some subjects expose multiple rows/tests, and collapsing only by
      // course code can hide later zero-score entries entirely.
      const seen      = new Set();
      const marksData = [];
      for (const item of rawMarks) {
        if (!item.scores || !item.scores.trim()) continue;
        const key = [item.code, item.type, item.scores].join('::');
        if (!seen.has(key)) {
          seen.add(key);
          marksData.push(item);
        }
      }

      if (marksData.length === 0) {
        log('Table visible but no rows yet — waiting...');
        return false;
      }

      done = true;
      clearInterval(heartbeat);
      log('✅ Marks scraped — ' + marksData.length + ' courses');
      setTimeout(() => ok(marksData), 200);
      return true;

    } catch (e) {
      log('Parse error: ' + e.message);
      return false;
    }
  }

  /* ── start: observer + stuck-check ──────────────────────────────────────── */
  function start() {
    if (tryScrape()) return;

    const obs = new MutationObserver(() => {
      lastActivity = Date.now();
      if (done) { obs.disconnect(); return; }
      setTimeout(() => { if (tryScrape()) obs.disconnect(); }, 300 + Math.random() * 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // stuck-check: if DOM silent for 6 s → force nav
    const stuckCheck = setInterval(() => {
      if (done) { clearInterval(stuckCheck); return; }
      const silence = Date.now() - lastActivity;
      if (silence > 6000) {
        log('Stuck (' + Math.round(silence / 1000) + 's) — forcing nav');
        tryNavigate();
      }
    }, 4000);

    // initial kick
    setTimeout(tryNavigate, 800 + Math.random() * 600);
  }

  /* ── boot ────────────────────────────────────────────────────────────────── */
  const bootMs = 600 + Math.random() * 600;
  log('Marks scraper v2 boot (' + Math.round(bootMs) + 'ms)');
  setTimeout(start, bootMs);
})();
true;
`;

// ─── Component ────────────────────────────────────────────────────────────────

const SRMMarksScraper: React.FC<SRMMarksScraperProps> = ({
  onScrapeComplete,
  onStepChange,
  backgroundMode       = false,
  refreshIntervalHours = DEFAULT_REFRESH_H,
  maxRetries           = DEFAULT_RETRIES,
  scrapeTimeoutMs      = DEFAULT_TIMEOUT_MS,
}) => {
  const webViewRef   = useRef<WebView>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCount   = useRef(0);
  const lastPingAt   = useRef(Date.now());
  const isMounted    = useRef(true);

  const [step,            setStep]            = useState('Checking saved marks…');
  const [webViewKey,      setWebViewKey]      = useState(0);
  const [showWebView,     setShowWebView]     = useState(false);
  const [isDone,          setIsDone]          = useState(false);
  const [isCheckingCache, setIsCheckingCache] = useState(true);

  useEffect(() => { onStepChange?.(step); }, [step, onStepChange]);
  useEffect(() => () => { isMounted.current = false; }, []);

  /* ── cache helpers ────────────────────────────────────────────────────────── */
  const loadCache = useCallback(async (): Promise<MarksData | null> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // support both old and new cache shapes
      return parsed.data ? parsed : { data: parsed, lastUpdated: parsed.lastUpdated || '' };
    } catch { return null; }
  }, []);

  const saveCache = useCallback(async (data: MarkEntry[]) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (e) { console.warn('[SRM Marks] cache write failed', e); }
  }, []);

  const checkNeedsRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return true;
      const d = JSON.parse(raw);
      const ts = d.lastUpdated || d.data?.lastUpdated;
      if (!ts) return true;
      return (Date.now() - new Date(ts).getTime()) / 3_600_000 >= refreshIntervalHours;
    } catch { return true; }
  }, [refreshIntervalHours]);

  /* ── serve cache to parent ───────────────────────────────────────────────── */
  const serveCache = useCallback((cached: MarksData) => {
    const arr: any = cached.data || cached;
    arr.lastUpdated = cached.lastUpdated;
    onScrapeComplete(arr);
  }, [onScrapeComplete]);

  /* ── timer helpers ───────────────────────────────────────────────────────── */
  const clearTimers = useCallback(() => {
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (watchdogRef.current) clearInterval(watchdogRef.current);
  }, []);

  const remount = useCallback((reason: string) => {
    if (!isMounted.current) return;
    setStep(reason);
    lastPingAt.current = Date.now();
    setWebViewKey(k => k + 1);
  }, []);

  const armTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (!isMounted.current) return;
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        remount(`Timeout — retry ${retryCount.current}/${maxRetries}…`);
        armTimeout();
      } else {
        setStep('Failed after ' + maxRetries + ' retries — showing cached data');
        const cached = await loadCache();
        if (cached && isMounted.current) serveCache(cached);
        if (isMounted.current) setIsDone(true);
      }
    }, scrapeTimeoutMs);
  }, [maxRetries, scrapeTimeoutMs, loadCache, serveCache, remount]);

  const startWatchdog = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(() => {
      if (!isMounted.current) return;
      if (Date.now() - lastPingAt.current > PING_SILENCE_MS) {
        remount('WebView silent — remounting…');
      }
    }, 6000);
  }, [remount]);

  /* ── scrape success ──────────────────────────────────────────────────────── */
  const handleSuccess = useCallback(async (data: MarkEntry[]) => {
    clearTimers();
    await saveCache(data);
    if (isMounted.current) {
      const arr: any = [...data];
      arr.lastUpdated = new Date().toISOString();
      onScrapeComplete(arr);
      setStep('✅ Marks refreshed');
      setIsDone(true);
    }
  }, [clearTimers, saveCache, onScrapeComplete]);

  /* ── WebView messages ────────────────────────────────────────────────────── */
  const onMessage = useCallback((event: any) => {
    lastPingAt.current = Date.now();
    try {
      const p = JSON.parse(event.nativeEvent.data);
      switch (p.type) {
        case 'LOG':     setStep(p.message); break;
        case 'PING':    break;
        case 'SUCCESS': handleSuccess(p.data); break;
        case 'ERROR':
          if (p.message === 'SESSION_EXPIRED') {
            clearTimers();
            setStep('Session expired — please log in');
            setIsDone(true);
          }
          break;
      }
    } catch (error) {
       console.warn("Parse Error:", error);
    }
  }, [handleSuccess, clearTimers]);

  /* ── boot: serve cache instantly, decide whether to scrape ──────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadCache();
      if (cached) serveCache(cached);               // instant UI ✓

      if (cancelled || !isMounted.current) return;

      const refresh = await checkNeedsRefresh();
      if (refresh) {
        setStep(cached ? 'Refreshing marks in background…' : 'Loading Marks Page…');
        setShowWebView(true);
        retryCount.current = 0;
        lastPingAt.current  = Date.now();
      } else {
        const ageMin = cached?.lastUpdated
          ? Math.round((Date.now() - new Date(cached.lastUpdated).getTime()) / 60_000)
          : 0;
        setStep('Up to date (' + ageMin + 'm ago)');
        setIsDone(true);
      }
      if (isMounted.current) setIsCheckingCache(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── arm timers when WebView is live ─────────────────────────────────────── */
  useEffect(() => {
    if (!showWebView || isDone) return;
    armTimeout();
    startWatchdog();
    return clearTimers;
  }, [showWebView, isDone, webViewKey, armTimeout, startWatchdog, clearTimers]);

  /* ── app-foreground: refresh if stale ───────────────────────────────────── */
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state !== 'active' || !isMounted.current) return;
      if (!(await checkNeedsRefresh())) {
        console.log('[SRM Marks] Within cooldown — skipping scrape');
        return;
      }
      console.log('[SRM Marks] Stale — re-scraping marks');
      retryCount.current = 0;
      lastPingAt.current  = Date.now();
      setIsDone(false);
      setShowWebView(true);
      setWebViewKey(k => k + 1);
    });
    return () => sub.remove();
  }, [checkNeedsRefresh]);

  /* ── render ──────────────────────────────────────────────────────────────── */
  if (isDone || !showWebView) return null;

  if (isCheckingCache) {
    if (backgroundMode) return null;
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.debugText}>{step}</Text>
      </View>
    );
  }

  return (
    <View style={backgroundMode ? styles.hiddenContainer : styles.container}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: SRM_URL }}
        injectedJavaScript={buildInjectionScript()}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        cacheEnabled
        onMessage={onMessage}
        onError={e => {
          const code  = e.nativeEvent.code ?? 0;
          const delay = [-6, -1009, -1004, -1001].includes(code) ? 2000 : 4000;
          setStep('Network error (' + code + ') — retrying…');
          setTimeout(() => { if (isMounted.current) remount('Retrying after error…'); }, delay);
        }}
        onHttpError={e => {
          if (e.nativeEvent.statusCode >= 500) {
            setStep('Server ' + e.nativeEvent.statusCode + ' — retrying…');
            setTimeout(() => { if (isMounted.current) remount('Retrying…'); }, 3000);
          }
        }}
        startInLoadingState={!backgroundMode}
        style={backgroundMode ? styles.hiddenWV : styles.webview}
      />
      {!backgroundMode && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.overlayText}>{step}</Text>
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, width: Dimensions.get('window').width, height: 500, marginTop: 20 },
  center:          { justifyContent: 'center', alignItems: 'center' },
  hiddenContainer: { position: 'absolute', width: 1, height: 1, opacity: 0, zIndex: -1 },
  hiddenWV:        { width: 1, height: 1 },
  webview:         { flex: 1, opacity: 1 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  overlayText: { color: '#fff', marginLeft: 10, fontWeight: '600', fontSize: 14 },
  debugText:   { color: '#111827', marginLeft: 10, fontWeight: '600', fontSize: 14 },
});

export default SRMMarksScraper;
