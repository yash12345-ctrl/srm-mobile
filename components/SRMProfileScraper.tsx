import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface SRMProfileScraperProps {
  onScrapeComplete?: (data: { name: string; registerNumber: string; imageUrl: string, lastUpdated?: string }) => void;
  onSessionExpired?: () => void;
  backgroundMode?: boolean;
  showInternalAlert?: boolean;
  skipScrapeIfFresh?: boolean;
}

const PROFILE_CACHE_KEY = 'student_profile_data';
const PROFILE_REFRESH_HOURS = 2;
const SESSION_MONITOR_INTERVAL_MS = 30000;

const SRMProfileScraper: React.FC<SRMProfileScraperProps> = ({
  onScrapeComplete,
  onSessionExpired,
  backgroundMode = false,
  showInternalAlert = true,
  skipScrapeIfFresh = false,
}) => {
  const webviewRef = useRef<WebView>(null);
  const authRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestUrlRef = useRef('');
  const isDoneRef = useRef(false);
  const isDeadSessionRef = useRef(false);
  const shouldRevealWebViewRef = useRef(false);
  const [currentStep, setCurrentStep] = useState("Loading Academia...");
  const [isDone, setIsDone] = useState(false);
  const [scraperKey, setScraperKey] = useState(0);
  const [isCheckingCache, setIsCheckingCache] = useState(true);
  const [sessionCheckOnly, setSessionCheckOnly] = useState(false);

  const [isDeadSession, setIsDeadSession] = useState(false);
  const [shouldRevealWebView, setShouldRevealWebView] = useState(false);

  const [showCustomAlert, setShowCustomAlert] = useState(false);
  const hasAlerted = useRef(false);
  const hasNotifiedSessionExpired = useRef(false);

  const notifySessionExpired = useCallback(() => {
    if (hasNotifiedSessionExpired.current) return;
    hasNotifiedSessionExpired.current = true;
    if (onSessionExpired) onSessionExpired();
  }, [onSessionExpired]);

  const isAuthUrl = (url: string) => {
    const normalizedUrl = url.toLowerCase();
    return (
      normalizedUrl.includes('accounts.zoho') ||
      normalizedUrl.includes('zoho.in/signin') ||
      normalizedUrl.includes('zoho.com/signin')
    );
  };

  const clearAuthRedirectTimer = useCallback(() => {
    if (authRedirectTimerRef.current) {
      clearTimeout(authRedirectTimerRef.current);
      authRedirectTimerRef.current = null;
    }
  }, []);

  const handleSessionDead = useCallback(() => {
    if (isDeadSessionRef.current) return;
    clearAuthRedirectTimer();
    setCurrentStep("Please log in to Academia...");
    setIsDeadSession(true);
    setShouldRevealWebView(true);

    if (showInternalAlert && !hasAlerted.current) {
      hasAlerted.current = true;
      setShowCustomAlert(true);
    }

    notifySessionExpired();
  }, [clearAuthRedirectTimer, notifySessionExpired, showInternalAlert]);

  const probeCurrentSession = useCallback(() => {
    webviewRef.current?.injectJavaScript(String.raw`
      (function() {
        try {
          function collectDocs() {
            var docs = [{ doc: document, url: window.location.href || '', title: document.title || '' }];
            var frames = document.querySelectorAll('iframe');
            for (var i = 0; i < frames.length; i++) {
              var frame = frames[i];
              var frameUrl = frame.getAttribute('src') || '';
              try {
                var frameDoc = frame.contentDocument || frame.contentWindow.document;
                if (frameDoc) {
                  docs.push({
                    doc: frameDoc,
                    url: frameUrl || frameDoc.location.href || '',
                    title: frameDoc.title || ''
                  });
                } else if (frameUrl) {
                  docs.push({ doc: null, url: frameUrl, title: '' });
                }
              } catch (e) {
                if (frameUrl) {
                  docs.push({ doc: null, url: frameUrl, title: '' });
                }
              }
            }
            return docs;
          }

          function isDeadInContext(ctx) {
            var doc = ctx.doc;
            var bodyText = doc && doc.body ? (doc.body.innerText || '') : '';
            var normalizedBody = bodyText.toLowerCase();
            var url = (ctx.url || '').toLowerCase();
            var title = (ctx.title || '').toLowerCase();
            var hasEmailField = !!(
              doc && (
                doc.querySelector("input[type='email']") ||
                doc.querySelector("input[placeholder*='Email']") ||
                doc.querySelector("input[name*='login']") ||
                doc.querySelector("input[name*='user']")
              )
            );
            var hasPasswordField = !!(doc && doc.querySelector("input[type='password']"));
            var isAcademiaLoginPage = !!(
              title.includes('academia login') ||
              (
                normalizedBody.includes('academia - student portal') &&
                normalizedBody.includes('sign in') &&
                hasEmailField
              ) ||
              (
                normalizedBody.includes('application development centre') &&
                normalizedBody.includes('student portal') &&
                hasEmailField
              )
            );
            var isLoginFormVisible = !!(
              hasPasswordField &&
              (
                hasEmailField ||
                /sign\s*in|login/i.test(bodyText)
              )
            );

            return !!(
              isAcademiaLoginPage ||
              isLoginFormVisible ||
              url.includes('accounts.zoho') ||
              url.includes('zoho.in/signin') ||
              url.includes('zoho.com/signin') ||
              normalizedBody.includes('maximum concurrent sessions') ||
              normalizedBody.includes('session expired') ||
              normalizedBody.includes('continue with zoho') ||
              normalizedBody.includes('sign in to continue') ||
              normalizedBody.includes('academia login') ||
              (normalizedBody.includes('academia') && normalizedBody.includes('sign in'))
            );
          }

          function isLoggedInInContext(ctx) {
            var doc = ctx.doc;
            var url = (ctx.url || '').toLowerCase();
            return !!(
              doc && (
                doc.querySelector('.zc-app-brand-appname') ||
                doc.querySelector('#mainmenu') ||
                doc.querySelector('.academiaHeader')
              )
            ) || url.includes('home.do');
          }

          var contexts = collectDocs();
          var isDead = contexts.some(isDeadInContext);
          var isLoggedIn = contexts.some(isLoggedInInContext);

          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(
              isDead
                ? { type: 'SESSION_DEAD' }
                : {
                    type: 'SESSION_STATE',
                    state: isLoggedIn ? 'LOGGED_IN' : 'UNKNOWN',
                    message: isLoggedIn
                      ? 'Academia session active.'
                      : 'Still checking your Academia session...'
                  }
            ));
          }
        } catch (e) {}
      })();
      true;
    `);
  }, []);

  const resetScraperState = useCallback(() => {
    clearAuthRedirectTimer();
    latestUrlRef.current = '';
    setCurrentStep("Loading Academia...");
    setIsDone(false);
    setSessionCheckOnly(false);
    setIsDeadSession(false);
    setShouldRevealWebView(false);
    setShowCustomAlert(false);
    hasAlerted.current = false;
    hasNotifiedSessionExpired.current = false;
  }, [clearAuthRedirectTimer]);

  const loadCachedProfile = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const isCacheStale = useCallback((cached: any) => {
    if (!cached?.lastUpdated) return true;
    const ageHours = (Date.now() - new Date(cached.lastUpdated).getTime()) / 3_600_000;
    return ageHours >= PROFILE_REFRESH_HOURS;
  }, []);

  const serveCachedProfile = useCallback((cached: any) => {
    if (typeof onScrapeComplete === 'function') onScrapeComplete(cached);
  }, [onScrapeComplete]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await loadCachedProfile();
      if (cancelled) return;

      if (cached) {
        serveCachedProfile(cached);
      }

      if (cached && !isCacheStale(cached)) {
        if (skipScrapeIfFresh) {
          setCurrentStep('Checking existing Academia session...');
          setSessionCheckOnly(true);
        } else {
          setCurrentStep('Profile up to date');
          setIsDone(true);
        }
      }

      setIsCheckingCache(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isCacheStale, loadCachedProfile, serveCachedProfile, skipScrapeIfFresh]);

  const incrementScraperKey = useCallback(() => {
    setScraperKey(prev => prev + 1);
  }, []);

  const handleAppOpen = useCallback(async (nextAppState: AppStateStatus) => {
    if (nextAppState !== 'active') return;
    const cached = await loadCachedProfile();
    if (cached && !isCacheStale(cached)) {
      serveCachedProfile(cached);
      if (skipScrapeIfFresh) {
        resetScraperState();
        setCurrentStep('Checking existing Academia session...');
        setSessionCheckOnly(true);
        setIsCheckingCache(false);
        incrementScraperKey();
      }
      return;
    }
    console.log("[Profile] App opened, checking session...");
    resetScraperState();
    setIsCheckingCache(false);
    incrementScraperKey();
  }, [loadCachedProfile, isCacheStale, serveCachedProfile, skipScrapeIfFresh, resetScraperState, incrementScraperKey]);

  // ── Run ALWAYS on App Open ────────────────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppOpen);
    return () => subscription.remove();
  }, [handleAppOpen]);

  useEffect(() => {
    return () => clearAuthRedirectTimer();
  }, [clearAuthRedirectTimer]);

  useEffect(() => {
    isDoneRef.current = isDone;
  }, [isDone]);

  useEffect(() => {
    isDeadSessionRef.current = isDeadSession;
  }, [isDeadSession]);

  useEffect(() => {
    shouldRevealWebViewRef.current = shouldRevealWebView;
  }, [shouldRevealWebView]);

  // ── Silent background session probe ───────────────────────────────────────
  useEffect(() => {
    if (isDone || isCheckingCache || !backgroundMode) return;

    const probeTimer = setTimeout(() => {
      if (!isDone) {
        probeCurrentSession();
      }
    }, 12000); 

    return () => clearTimeout(probeTimer);
  }, [isDone, isCheckingCache, backgroundMode, scraperKey, probeCurrentSession]);

  useEffect(() => {
    if (!backgroundMode || !sessionCheckOnly || isCheckingCache || isDeadSession) return;

    const monitor = setInterval(() => {
      webviewRef.current?.reload();
    }, SESSION_MONITOR_INTERVAL_MS);

    return () => clearInterval(monitor);
  }, [backgroundMode, isCheckingCache, isDeadSession, sessionCheckOnly, scraperKey]);

  // ── Success Handler ───────────────────────────────────────────────────────
  const handleScrapeSuccess = async (data: any) => {
    const finalData = { ...data, lastUpdated: new Date().toISOString() };
    try { await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(finalData)); } catch {}
    if (typeof onScrapeComplete === 'function') onScrapeComplete(finalData);
    clearAuthRedirectTimer();
    setShowCustomAlert(false);
    setIsDeadSession(false);
    setShouldRevealWebView(false);
    setIsDone(true);
  };

  // ── Smart Injection Script ───────────────────────────────────────────────
  const scrapeScript = String.raw`
    (function() {
      if (window.__PROFILE_SCRAPER_ACTIVE__) return;
      window.__PROFILE_SCRAPER_ACTIVE__ = true;
      window.__PROFILE_SESSION_ONLY__ = ${sessionCheckOnly ? 'true' : 'false'};

      function post(type, msgOrData) {
        if (!window.ReactNativeWebView) return;
        if (type === 'SESSION_DEAD') {
           window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SESSION_DEAD' }));
           return;
        }
        if (type === 'SESSION_OK') {
           window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SESSION_OK' }));
           return;
        }
        window.ReactNativeWebView.postMessage(JSON.stringify(
          type === 'LOG' ? { type: 'LOG', message: msgOrData } : { type: 'SUCCESS', data: msgOrData }
        ));
      }

      let state = { phase: 'INIT', navAttempted: false };

      function isLoggedIn() {
        var contexts = collectContexts();
        for (var i = 0; i < contexts.length; i++) {
          var ctx = contexts[i];
          if (
            (ctx.doc && (
              ctx.doc.querySelector('.zc-app-brand-appname') ||
              ctx.doc.querySelector('#mainmenu') ||
              ctx.doc.querySelector('.academiaHeader')
            )) ||
            (ctx.url || '').toLowerCase().includes('home.do')
          ) {
            return true;
          }
        }
        return false;
      }

      function collectContexts() {
        var docs = [{ doc: document, url: window.location.href || '', title: document.title || '' }];
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          var frame = frames[i];
          var frameUrl = frame.getAttribute('src') || '';
          try {
            var frameDoc = frame.contentDocument || frame.contentWindow.document;
            if (frameDoc) {
              docs.push({
                doc: frameDoc,
                url: frameUrl || frameDoc.location.href || '',
                title: frameDoc.title || ''
              });
            } else if (frameUrl) {
              docs.push({ doc: null, url: frameUrl, title: '' });
            }
          } catch(e) {
            if (frameUrl) {
              docs.push({ doc: null, url: frameUrl, title: '' });
            }
          }
        }
        return docs;
      }

      function isDeadContext(ctx) {
        var doc = ctx.doc;
        var bodyText = doc && doc.body ? (doc.body.innerText || '') : '';
        var normalizedBody = bodyText.toLowerCase();
        var url = (ctx.url || '').toLowerCase();
        var title = (ctx.title || '').toLowerCase();
        var hasEmailField = !!(
          doc && (
            doc.querySelector("input[type='email']") ||
            doc.querySelector("input[placeholder*='Email']") ||
            doc.querySelector("input[name*='login']") ||
            doc.querySelector("input[name*='user']")
          )
        );
        var hasPasswordField = !!(doc && doc.querySelector("input[type='password']"));
        var isAcademiaLoginPage = !!(
          title.includes('academia login') ||
          (
            normalizedBody.includes('academia - student portal') &&
            normalizedBody.includes('sign in') &&
            hasEmailField
          ) ||
          (
            normalizedBody.includes('application development centre') &&
            normalizedBody.includes('student portal') &&
            hasEmailField
          )
        );
        var isLoginFormVisible = !!(
          hasPasswordField &&
          (
            hasEmailField ||
            /sign\\s*in|login/i.test(bodyText)
          )
        );

        return !!(
          isAcademiaLoginPage ||
          isLoginFormVisible ||
          url.includes('accounts.zoho') ||
          url.includes('zoho.in/signin') ||
          url.includes('zoho.com/signin') ||
          normalizedBody.includes('maximum concurrent sessions') ||
          normalizedBody.includes('session expired') ||
          normalizedBody.includes('continue with zoho') ||
          normalizedBody.includes('sign in to continue') ||
          normalizedBody.includes('academia login') ||
          (normalizedBody.includes('academia') && normalizedBody.includes('sign in'))
        );
      }

      function extractBasicData(doc) {
        let profile = { name: "Unknown", registerNumber: "Unknown", imageUrl: "" };
        const allElements = doc.querySelectorAll('td, div, span, p');
        for (let i = 0; i < allElements.length; i++) {
          const text = allElements[i].innerText || '';
          const match = text.match(/(RA[0-9]{10,})\s*-\s*([A-Za-z\s]+)/i);
          if (match && match[1] && match[2]) {
            profile.registerNumber = match[1].trim();
            profile.name = match[2].split('\n')[0].trim(); break; 
          }
        }
        const profileImg = doc.querySelector('img[src*="downloadImage"], img[src*="downloadPhoto"], img[src*="Image"], table img');
        if (profileImg && profileImg.src) profile.imageUrl = profileImg.src;
        return profile;
      }

      function attemptScrape() {
        if (state.phase === 'SCRAPED') return true;
        try {
          const bodyText = document.body ? document.body.innerText : '';
          const contexts = collectContexts();
          const isDead = contexts.some(isDeadContext);

          if (isDead) { 
            if (state.phase !== 'DEAD') {
              state.phase = 'DEAD';
              post('SESSION_DEAD'); 
            }
            return false; 
          }

          if (!isLoggedIn()) return false;

          if (state.phase === 'DEAD') {
             state.phase = 'INIT';
          }

          if (window.__PROFILE_SESSION_ONLY__) {
            state.phase = 'SCRAPED';
            post('SESSION_OK');
            return true;
          }

          if (bodyText.includes('You may only fill this form out one time') || bodyText.includes('Photo Upload Student')) {
             if (!state.navAttempted) { post('LOG', "Bypassing Photo Form..."); window.location.hash = '#Report:Student_Profile_Report'; state.navAttempted = true; }
             return false;
          }

          if (!window.location.hash.includes('Student_Profile_Report')) {
            if (!state.navAttempted) { post('LOG', "Navigating to Profile Report..."); window.location.hash = '#Report:Student_Profile_Report'; state.navAttempted = true; }
            return false; 
          }

          if (bodyText.includes('Registration Number') || /(RA[0-9]{10,})/i.test(bodyText)) {
            let profileData = extractBasicData(document);
            if (profileData.name === "Unknown") {
              const iframes = document.querySelectorAll('iframe');
              for (let i = 0; i < iframes.length; i++) {
                try {
                  const innerDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                  if (innerDoc) {
                    const innerData = extractBasicData(innerDoc);
                    if (innerData.name !== "Unknown") { profileData = innerData; break; }
                  }
                } catch(e) {}
              }
            }
            if (profileData.name !== "Unknown" && profileData.registerNumber !== "Unknown") {
              state.phase = 'SCRAPED';
              if (profileData.imageUrl && profileData.imageUrl.startsWith('http')) {
                post('LOG', "🖼️ Processing Profile Picture...");
                fetch(profileData.imageUrl, { credentials: 'include' })
                  .then(res => res.blob())
                  .then(blob => {
                    let reader = new FileReader();
                    reader.onloadend = function() { profileData.imageUrl = reader.result; post('SUCCESS', profileData); }
                    reader.readAsDataURL(blob);
                  }).catch(() => post('SUCCESS', profileData));
              } else { post('SUCCESS', profileData); }
              return true;
            }
          }
        } catch (error) {}
        return false;
      }

      const poll = setInterval(() => { if (state.phase === 'SCRAPED') clearInterval(poll); else attemptScrape(); }, 200);
      let debounce = null;
      const observer = new MutationObserver(() => {
        if (state.phase === 'SCRAPED') { observer.disconnect(); return; }
        clearTimeout(debounce); debounce = setTimeout(attemptScrape, 50);
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
      attemptScrape();
    })();
    true;
  `;

  // ── Render ────────────────────────────────────────────────────────────────
  const isHidden = (backgroundMode && !shouldRevealWebView && !isDeadSession) || isDone;

  if (isCheckingCache && backgroundMode) {
    return null;
  }

  return (
    <View style={isHidden ? styles.hiddenContainer : styles.container}>
      <WebView
        key={scraperKey}
        ref={webviewRef}
        source={{ uri: 'https://academia.srmist.edu.in/' }}
        injectedJavaScript={scrapeScript}
        onNavigationStateChange={(navState) => {
          const currentUrl = navState.url.toLowerCase();
          latestUrlRef.current = currentUrl;
          if (isAuthUrl(currentUrl)) {
            setCurrentStep("Checking your existing Academia session...");
            if (!authRedirectTimerRef.current) {
              authRedirectTimerRef.current = setTimeout(() => {
                authRedirectTimerRef.current = null;
                if (!isDone && isAuthUrl(latestUrlRef.current)) {
                  handleSessionDead();
                }
              }, 2500);
            }
          } else {
            clearAuthRedirectTimer();
          }
        }}
        onLoadEnd={() => {
          if (!isDone) {
            probeCurrentSession();
          }
        }}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload.type === 'LOG') setCurrentStep(payload.message);
            if (payload.type === 'SESSION_STATE') {
              setCurrentStep(payload.message);
              if (payload.state === 'LOGGED_IN') {
                setShouldRevealWebView(false);
              }
            }
            if (payload.type === 'SESSION_OK') {
              setCurrentStep('Academia session active');
              setShouldRevealWebView(false);
              setIsDeadSession(false);
              if (!sessionCheckOnly) {
                setIsDone(true);
              }
            }
            if (payload.type === 'SUCCESS') handleScrapeSuccess(payload.data);
            if (payload.type === 'SESSION_DEAD') handleSessionDead();
          } catch {}
        }}
        style={{ flex: 1, marginBottom: isHidden ? 0 : 60 }} 
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={true}
      />
      {!isHidden && (
        <View style={styles.debugBanner}>
          <ActivityIndicator color="#3B82F6" size="small" />
          <Text style={styles.debugText}>{currentStep}</Text>
        </View>
      )}

      {/* 🔥 BEAUTIFULLY DESIGNED CUSTOM ALERT OVERLAY 🔥 */}
      <Modal transparent={true} visible={showInternalAlert && showCustomAlert} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Text style={styles.modalIcon}>⚠️</Text>
            </View>
            <Text style={styles.modalTitle}>Session Expired</Text>
            <Text style={styles.modalMessage}>
              Your Academia session was logged out (likely from another device). Please sign in again so we can sync your profile.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton} 
              activeOpacity={0.8}
              onPress={() => setShowCustomAlert(false)}
            >
              <Text style={styles.modalButtonText}>Sign In Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  hiddenContainer: { position: 'absolute', top: -10000, left: -10000, width: 1000, height: 1000 }, 
  debugBanner: { 
    position: 'absolute', bottom: 0, width: '100%', height: 60,
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', 
    justifyContent: 'center', borderTopWidth: 1, borderColor: '#E5E7EB', elevation: 10,
  },
  debugText: { color: '#111827', marginLeft: 10, fontWeight: '600', fontSize: 14 },
  
  // Custom Alert Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)', // Sleek dark overlay
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2', // Soft red background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#1E2D6B', // SRM Brand color to match your app
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SRMProfileScraper;
