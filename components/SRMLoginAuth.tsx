import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface SRMLoginAuthProps {
  netId: string;
  password: string;
  manualCaptcha?: string;
  onLoginSuccess: () => void;
  onLoginError?: (errorMsg: string) => void;
  onStepChange?: (step: string) => void;
  onCaptchaRequired?: (base64Image: string | null) => void;
  backgroundMode?: boolean;
}

const SRMLoginAuth: React.FC<SRMLoginAuthProps> = ({
  netId,
  password,
  manualCaptcha,
  onLoginSuccess,
  onLoginError,
  onStepChange,
  onCaptchaRequired,
  backgroundMode = false,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [currentStep, setCurrentStep] = useState("Connecting to SRM...");

  const hasAlerted = useRef(false);

  useEffect(() => {
    if (onStepChange) onStepChange(currentStep);
  }, [currentStep, onStepChange]);

  // Inject manual captcha into the WebView as soon as it arrives
  useEffect(() => {
    if (manualCaptcha && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.__MANUAL_CAPTCHA__ = "${manualCaptcha}"; true;`
      );
    }
  }, [manualCaptcha]);

  const injectionScript = String.raw`
    (function() {
      if (window.__BULLDOZER_ACTIVE__) return;
      window.__BULLDOZER_ACTIVE__ = true;

      // ── Credentials ──────────────────────────────────────────────────────────
      var CREDS = {
        netId:    decodeURIComponent("${encodeURIComponent(netId)}"),
        password: decodeURIComponent("${encodeURIComponent(password)}")
      };

      // ── State machine ────────────────────────────────────────────────────────
      // Phases: INIT → EMAIL_DONE → WAITING → DONE
      var S = {
        phase:          'INIT',
        halted:         false,
        phaseStartedAt: Date.now(),
        lastRunAt:      0,
        lastCaptcha:    null,
        captchaAlerted: false,
        terminateClicked: false,  // FIX: guard to prevent double-clicking terminate

        // Per-phase max wait times (ms)
        TIMEOUTS: {
          EMAIL_DONE: 6000,
          WAITING:    12000,
        }
      };

      // ── Messaging ────────────────────────────────────────────────────────────
      function post(type, extra) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
      }
      function log(msg)       { post('LOG',     { message: msg }); }
      function succeed()      { post('SUCCESS', {}); }
      function sendError(msg) {
        if (S.halted) return;
        S.halted = true;
        S.phase  = 'DONE';
        localStorage.removeItem('__srm_attempted');
        post('ERROR', { message: msg });
      }

      // ── Transition helper ────────────────────────────────────────────────────
      function setPhase(p) {
        S.phase          = p;
        S.phaseStartedAt = Date.now();
      }

      // ── Delay (minimal) ──────────────────────────────────────────────────────
      var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

      // ── Human-like click ─────────────────────────────────────────────────────
      function humanClick(el) {
        if (!el) return;
        ['pointerover','pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t) {
          el.dispatchEvent(new MouseEvent(t, {
            bubbles: true, cancelable: true, view: window,
            buttons: t.includes('down') ? 1 : 0
          }));
        });
      }

      // ── Force-type into a React-controlled input ─────────────────────────────
      async function forceType(el, text) {
        el.focus();
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (nativeSetter && nativeSetter.set) nativeSetter.set.call(el, text);
        else el.value = text;
        var tracker = el._valueTracker;
        if (tracker) tracker.setValue('');
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(60 + Math.floor(Math.random() * 40));
      }

      // ── Get the effective login document (parent or iframe) ──────────────────
      function getLoginDoc() {
        var selectors = ['iframe#signinFrame', 'iframe.siginiframe', 'iframe[src*="accounts.zoho"]'];
        for (var i = 0; i < selectors.length; i++) {
          var f = document.querySelector(selectors[i]);
          if (!f) continue;
          try {
            var d = f.contentDocument || f.contentWindow.document;
            if (d && d.body && d.body.innerHTML.length > 100) return d;
          } catch(e) {}
        }
        return document;
      }

      // ── Visible error text on the login page ─────────────────────────────────
      function getLoginError(doc) {
        var selectors = [
          '.error_text', '#fielderror', '.error', '.field-msg.error',
          '.errorMessage', '.login-error', '[role="alert"]',
          '.disp-err', '#err_msg'
        ];
        for (var i = 0; i < selectors.length; i++) {
          var el = doc.querySelector(selectors[i]);
          if (el && el.offsetParent !== null) {
            var txt = (el.innerText || '').trim().toLowerCase();
            if (/incorrect|invalid|does not exist|failed|try again|match|wrong|no account/.test(txt)) {
              return el.innerText.trim();
            }
          }
        }
        return null;
      }

      // ── Success detection ─────────────────────────────────────────────────────
      function isLoggedIn() {
        var url = window.location.href;
        if (url.includes('Home.do') || url.includes('/academia/') || url.includes('portal')) return true;
        if (document.querySelector('.zc-app-brand-appname')) return true;
        if (document.querySelector('#mainmenu, #topnav, .academiaHeader')) return true;
        return false;
      }

      // ────────────────────────────────────────────────────────────────────────
      // FIX: findTerminateButton
      // Zoho's "Terminate all other sessions" dialog has a blue confirm button.
      // It may appear as:
      //   • <button> with text like "Terminate", "Yes, Terminate", "Confirm"
      //   • <a> or <div role="button"> styled in blue
      //   • Inside a modal/dialog container
      // We search ALL documents (main + iframes), check visibility,
      // and match against an exhaustive keyword list.
      // ────────────────────────────────────────────────────────────────────────
      function findTerminateButton() {
        var TERMINATE_KEYWORDS = [
          'terminate all sessions',
          'terminate all',
          'terminate',
          'yes, terminate',
          'sign out others',
          'sign out all',
          'sign out other sessions',
          'force sign in',
          'proceed',
          'confirm',
        ];

        // Documents to search: main doc + all accessible iframes
        var docs = [document];
        document.querySelectorAll('iframe').forEach(function(f) {
          try {
            var d = f.contentDocument || f.contentWindow.document;
            if (d && d.body) docs.push(d);
          } catch(e) {}
        });

        for (var di = 0; di < docs.length; di++) {
          var d = docs[di];

          // Cast wide net — Added general .btn/.button classes to catch generic divs
          var candidates = Array.from(d.querySelectorAll(
            'button, a, input[type="button"], input[type="submit"], div[role="button"], span[role="button"], [class*="btn"], [class*="button"]'
          ));

          var best = null;
          var bestScore = 0;

          for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];

            // Skip hidden elements
            var rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (el.offsetParent === null && el.tagName !== 'BODY') continue;

            // Added regex replacement to normalize any non-breaking spaces
            var rawText = (el.innerText || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!rawText) continue;

            var score = 0;

            // Exact match on known Zoho label scores highest
            if (rawText === 'terminate all sessions') score += 100;
            else {
              TERMINATE_KEYWORDS.forEach(function(kw) {
                if (rawText === kw) score += 50;
                else if (rawText.includes(kw)) score += 20;
              });
            }

            if (score === 0) continue;

            // Boost for blue/primary styling (Zoho's button has inline style or class)
            var cls   = (el.className   || '').toLowerCase();
            var style = (el.getAttribute('style') || '').toLowerCase();
            if (/primary|blue|zb-btn-primary|zm-btn|btn-confirm/.test(cls))   score += 30;
            if (/background.*#(1a73e8|0d6efd|1976d2|2962ff|4285f4)|blue/.test(style)) score += 30;

            // Boost for <button> or <a> over generic divs
            if (el.tagName === 'BUTTON' || el.tagName === 'A') score += 10;

            if (score > bestScore) {
              bestScore = score;
              best = el;
            }
          }

          if (best) return best;
        }

        return null;
      }

      // ── Zoho-safe click: tries native click(), then humanClick(), then focus+Enter ──
      function zohoClick(el) {
        if (!el) return;
        try { el.scrollIntoView({ block: 'center' }); } catch(e) {}
        // 1. Native click (most reliable for Zoho's React-rendered buttons)
        try { el.click(); } catch(e) {}
        // 2. Synthetic mouse events as backup
        humanClick(el);
        // 3. If it's a link with href, follow it directly
        if (el.tagName === 'A' && el.href && el.href !== '#') {
          try { window.location.href = el.href; } catch(e) {}
        }
      }

      // ── Main login logic ──────────────────────────────────────────────────────
      async function attemptLogin() {
        if (S.halted) return true;

        var now = Date.now();
        if (now - S.lastRunAt < 80) return false;
        S.lastRunAt = now;

        try {
          // ── Already logged in? ─────────────────────────────────────────────
          if (isLoggedIn()) {
            log('✅ Login Successful! Dashboard reached.');
            localStorage.removeItem('__srm_attempted');
            S.halted = true;
            setPhase('DONE');
            succeed();
            return true;
          }

          var doc = getLoginDoc();

          // ── Per-phase timeout guard ────────────────────────────────────────
          if (S.phase !== 'INIT' && S.phase !== 'DONE') {
            var elapsed = now - S.phaseStartedAt;
            var limit   = S.TIMEOUTS[S.phase] || 12000;

            if (elapsed > 1500) {
              var earlyErr = getLoginError(doc);
              if (earlyErr) { sendError(earlyErr); return true; }
            }

            if (elapsed > limit) {
              if (S.phase === 'EMAIL_DONE') {
                log('🔄 Email step timeout, retrying…');
                setPhase('INIT');
              } else {
                localStorage.removeItem('__srm_attempted');
                sendError('Connection timeout. Please check your network and try again.');
                return true;
              }
            }
          }

          // ── Fallback wrong-password check via localStorage ─────────────────
          if (localStorage.getItem('__srm_attempted') === 'true' && S.phase === 'INIT') {
            var doc2 = getLoginDoc();
            var passField = doc2.querySelector("input[id='password'], input[type='password']");
            if (passField && passField.offsetParent !== null) {
              var lsErr = getLoginError(doc2) || 'Incorrect password or invalid credentials.';
              localStorage.removeItem('__srm_attempted');
              sendError(lsErr);
              return true;
            }
          }

          var emailInput = doc.querySelector("input[id='login_id'], input[type='email'], input[name='LOGIN_ID']");
          var passInput  = doc.querySelector("input[id='password'], input[type='password']");
          var nextBtn    = doc.querySelector("button[id='nextbtn'], button.btn.login, button[type='submit']");

          // ────────────────────────────────────────────────────────────────────
          // FIX: Changed this condition from !== 'INIT' to just !== 'DONE'.
          // Sometimes Zoho blocks the pipeline immediately upon page load without 
          // even showing the password screen. This ensures we click Terminate 
          // even if the block appears instantly.
          // ────────────────────────────────────────────────────────────────────
          if (S.phase !== 'DONE') {

            // "I understand" prompt (shown before terminate on some accounts)
            var allBtns = doc.querySelectorAll('button, a, div[role="button"]');
            for (var bi = 0; bi < allBtns.length; bi++) {
              var b = allBtns[bi];
              if (!b.offsetParent) continue;
              var bTxt = (b.innerText || '').trim().toLowerCase();
              if (bTxt.includes('i understand')) {
                log("⚠️ Handling 'I understand' prompt…");
                humanClick(b);
                await delay(400);
                setPhase('WAITING');
                S.terminateClicked = false; // reset so terminate can fire next
                return false;
              }
            }

            // Terminate session dialog — use robust finder
            if (!S.terminateClicked) {
              var terminateBtn = findTerminateButton();
              if (terminateBtn) {
                S.terminateClicked = true;
                log('🔄 Terminating all sessions…');
                zohoClick(terminateBtn);
                // Re-click once more after 800ms in case first click was swallowed
                setTimeout(function() {
                  if (!S.halted) {
                    var btn2 = findTerminateButton();
                    if (btn2) { zohoClick(btn2); }
                  }
                }, 800);
                await delay(1500);
                setPhase('WAITING');
                return false;
              }
            }
          }

          // ── CAPTCHA ────────────────────────────────────────────────────────
          var captchaInput = doc.querySelector("input[id*='captcha'], input[placeholder*='CAPTCHA'], input[name*='captcha']");
          if (captchaInput && captchaInput.offsetParent !== null) {
            if (window.__MANUAL_CAPTCHA__ && window.__MANUAL_CAPTCHA__ !== S.lastCaptcha) {
              S.lastCaptcha = window.__MANUAL_CAPTCHA__;
              log('🔑 Submitting CAPTCHA…');
              await forceType(captchaInput, window.__MANUAL_CAPTCHA__);
              localStorage.setItem('__srm_attempted', 'true');
              if (nextBtn) humanClick(nextBtn);
              setPhase('WAITING');
            } else if (!S.captchaAlerted) {
              S.captchaAlerted = true;
              log('🖼️ CAPTCHA detected — waiting for input…');
              var base64 = null;
              var captchaImg = doc.querySelector("img[id*='captcha'], img[src*='captcha']");
              if (captchaImg) {
                try {
                  var c = document.createElement('canvas');
                  c.width  = captchaImg.naturalWidth  || captchaImg.width  || 150;
                  c.height = captchaImg.naturalHeight || captchaImg.height || 50;
                  c.getContext('2d').drawImage(captchaImg, 0, 0);
                  base64 = c.toDataURL('image/png');
                } catch(e) {}
              }
              post('CAPTCHA_REQ', { image: base64 });
            }
            return false;
          }

          // ── INIT: email field visible ──────────────────────────────────────
          if (emailInput && emailInput.offsetParent !== null && S.phase === 'INIT') {
            log('📧 Entering NetID…');
            var email = CREDS.netId.includes('@') ? CREDS.netId : CREDS.netId + '@srmist.edu.in';
            await forceType(emailInput, email);
            if (nextBtn) humanClick(nextBtn);
            setPhase('EMAIL_DONE');
            return false;
          }

          // ── EMAIL_DONE: password field visible ─────────────────────────────
          if (passInput && passInput.offsetParent !== null &&
              (S.phase === 'EMAIL_DONE' || S.phase === 'INIT')) {
            log('🔒 Entering password…');
            await forceType(passInput, CREDS.password);
            localStorage.setItem('__srm_attempted', 'true');
            if (nextBtn) humanClick(nextBtn);
            setPhase('WAITING');
            S.terminateClicked = false; // reset so terminate dialog can be handled

            // Proactive error check 300 ms after submit
            setTimeout(async function() {
              if (S.halted) return;
              var d = getLoginDoc();
              var err = getLoginError(d);
              if (err) sendError(err);
            }, 300);

            return false;
          }

        } catch (err) {
          // Swallow — will retry on next tick
        }

        return false;
      }

      // ── Observers & polling ───────────────────────────────────────────────────

      var debounceTimer = null;

      function scheduleSafeAttempt(delay_ms) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          if (!S.halted) attemptLogin();
        }, delay_ms || 80);
      }

      // MutationObserver — reacts to every DOM change with 80 ms debounce
      var domObserver = new MutationObserver(function() {
        if (S.halted) { domObserver.disconnect(); return; }
        scheduleSafeAttempt(80);
      });
      domObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

      // Fast poll — 800 ms safety net for transitions the observer misses
      var pollInterval = setInterval(function() {
        if (S.halted) { clearInterval(pollInterval); return; }
        attemptLogin();
      }, 800);

      // Watchdog — every 6 s, independent of DOM events
      var watchdog = setInterval(function() {
        if (S.halted) { clearInterval(watchdog); return; }

        var elapsed = Date.now() - S.phaseStartedAt;

        if (S.phase === 'EMAIL_DONE' && elapsed > 7000) {
          log('🔄 Watchdog: email step stalled, resetting to INIT…');
          setPhase('INIT');
          return;
        }

        if (S.phase === 'WAITING' && elapsed > 13000) {
          localStorage.removeItem('__srm_attempted');
          S.terminateClicked = false; // allow retry if terminate dialog reappears
          sendError('Login timed out. Please check your network or credentials.');
          return;
        }

        // If still on INIT after 20 s, the page may not have loaded
        if (S.phase === 'INIT' && elapsed > 20000) {
          sendError('Page failed to load. Please check your network connection.');
        }
      }, 6000);

      // ── Initial kick ──────────────────────────────────────────────────────────
      setTimeout(function() { attemptLogin(); }, 50);

    })();
    true;
  `;

  return (
    <View style={backgroundMode ? styles.hiddenContainer : styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://academia.srmist.edu.in/' }}
        injectedJavaScript={injectionScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        injectedJavaScriptForMainFrameOnly={false}
        incognito={true}
        cacheEnabled={false}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);

            if (payload.type === 'LOG') setCurrentStep(payload.message);

            if (payload.type === 'SUCCESS') onLoginSuccess();

            if (payload.type === 'CAPTCHA_REQ' && onCaptchaRequired) {
              onCaptchaRequired(payload.image);
            }

            if (payload.type === 'ERROR') {
              if (hasAlerted.current) return;
              hasAlerted.current = true;
              setCurrentStep('Authentication Failed');

              if (onLoginError) {
                onLoginError(payload.message);
                setTimeout(() => { hasAlerted.current = false; }, 3000);
              } else {
                Alert.alert(
                  'Login Error',
                  payload.message || 'Invalid credentials. Please try again.',
                  [{ text: 'OK', onPress: () => { hasAlerted.current = false; } }]
                );
              }
            }
          } catch (e) {
            console.warn('WebView Message Error:', e);
          }
        }}
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        style={backgroundMode ? styles.offScreenWebView : styles.webview}
      />

      {!backgroundMode && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: 500,
    marginTop: 20,
  },
  hiddenContainer: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: Dimensions.get('window').width,
    height: 1000,
  },
  webview: {
    flex: 1,
    opacity: 1,
  },
  offScreenWebView: {
    width: Dimensions.get('window').width,
    height: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});

export default SRMLoginAuth;