import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../utils/api';
import { useEvent, useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, FONT, IS_COMPACT, IS_SHORT, bgS, lhS, wmS, lpS, inS, btnS, trS, ldS, s } from '../../styles/login.styles';

const { width, height } = Dimensions.get('window');


// SRM Login Scraper Removed

SplashScreen.preventAutoHideAsync();







const ParchmentBg = () => {
  const o1 = useSharedValue(0);
  const o2 = useSharedValue(0);
  const o3 = useSharedValue(0);

  useEffect(() => {
    o1.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }), -1, true);
    o2.value = withDelay(5000, withRepeat(withTiming(1, { duration: 24000, easing: Easing.inOut(Easing.quad) }), -1, true));
    o3.value = withDelay(10000, withRepeat(withTiming(1, { duration: 28000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => { cancelAnimation(o1); cancelAnimation(o2); cancelAnimation(o3); };
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(o1.value, [0, 1], [-25, 25]) }, { translateY: interpolate(o1.value, [0, 1], [-15, 20]) }], opacity: interpolate(o1.value, [0, 0.5, 1], [0.7, 1, 0.7]) }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(o2.value, [0, 1], [15, -30]) }, { translateY: interpolate(o2.value, [0, 1], [10, -20]) }], opacity: interpolate(o2.value, [0, 0.5, 1], [0.6, 1, 0.6]) }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(o3.value, [0, 1], [-10, 25]) }], opacity: interpolate(o3.value, [0, 0.5, 1], [0.5, 0.9, 0.5]) }));

  const ORB = width * 1.2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[C.bg, '#F0ECE4', C.bgDeep]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[bgS.orb, { width: ORB, height: ORB, backgroundColor: C.orb1, top: -ORB * 0.45, left: -ORB * 0.25 }, s1]} />
      <Animated.View style={[bgS.orb, { width: ORB, height: ORB, backgroundColor: C.orb2, bottom: -ORB * 0.35, right: -ORB * 0.3 }, s2]} />
      <Animated.View style={[bgS.orb, { width: ORB * 0.55, height: ORB * 0.55, backgroundColor: C.orb3, top: height * 0.4, right: -ORB * 0.05 }, s3]} />
      <LinearGradient colors={[C.bg, 'transparent', C.bgDeep]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
};


const LetterheadRules = ({ animated }: { animated: boolean }) => {
  const w1 = useSharedValue(animated ? 0 : 1);
  const w2 = useSharedValue(animated ? 0 : 1);
  useEffect(() => { if (!animated) return; w1.value = withDelay(500, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })); w2.value = withDelay(700, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })); }, []);
  const r1 = useAnimatedStyle(() => ({ width: `${interpolate(w1.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%` as any }));
  const r2 = useAnimatedStyle(() => ({ width: `${interpolate(w2.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%` as any }));
  return ( <View style={lhS.wrap}><Animated.View style={[lhS.thick, r1]} /><Animated.View style={[lhS.thin, r2]} /></View> );
};


const Wordmark = () => {
  const glow = useSharedValue(0);
  useEffect(() => { glow.value = withDelay(800, withRepeat(withSequence(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), withTiming(0.3, { duration: 3000, easing: Easing.inOut(Easing.sin) })), -1, false)); }, []);
  const crestPulse = useAnimatedStyle(() => ({ shadowOpacity: interpolate(glow.value, [0.3, 1], [0.08, 0.22]) }));
  return (
    <Animated.View entering={FadeInDown.delay(150).duration(380)} style={wmS.wrap}>
      <Animated.View style={[wmS.crest, crestPulse]}><View style={wmS.crestInner}><Ionicons name="school" size={22} color={C.accent} /></View></Animated.View>
      <Text style={wmS.name}>COLLEGIUM</Text>
      <Text style={wmS.tagline}>Student Intelligence Platform</Text>
      <View style={wmS.bottomRule} />
    </Animated.View>
  );
};


const LiveStatusPanel = () => {
  const [now, setNow] = useState(() => new Date());
  const signal = useSharedValue(0.35);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    signal.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(signal);
  }, [signal]);

  const signalAnim = useAnimatedStyle(() => ({
    opacity: interpolate(signal.value, [0.35, 1], [0.55, 1]),
    transform: [{ scale: interpolate(signal.value, [0.35, 1], [0.92, 1.12]) }],
  }));

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const timeLabel = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <Animated.View entering={FadeInDown.delay(210).duration(320)} style={lpS.wrap}>
      <LinearGradient colors={['rgba(45,58,140,0.10)', 'rgba(45,58,140,0.03)', 'rgba(255,255,255,0.45)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={lpS.panel}>
        <View style={lpS.topRow}>
          <View style={lpS.livePill}>
            <Animated.View style={[lpS.liveDot, signalAnim]} />
            <Text style={lpS.livePillText}>Gateway Ready</Text>
          </View>
          <Text style={lpS.timeLabel}>{timeLabel}</Text>
        </View>
        <Text style={lpS.greeting}>{greeting}</Text>
        <Text style={lpS.dateLabel}>{dateLabel}</Text>
        <View style={lpS.metaRow}>
          <View style={lpS.metaChip}>
            <Ionicons name="shield-checkmark-outline" size={13} color={C.accent} />
            <Text style={lpS.metaChipText}>Encrypted session</Text>
          </View>
          <View style={lpS.metaChip}>
            <Ionicons name="flash-outline" size={13} color={C.accent} />
            <Text style={lpS.metaChipText}>Fast sync</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};


const InputField = ({ icon, label, placeholder, value, onChangeText, secureTextEntry, delay, error }: any) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const focus = useSharedValue(0);
  const shake = useSharedValue(0);
  const onFocus = () => { setFocused(true); focus.value = withTiming(1, { duration: 180 }); try { Haptics.selectionAsync(); } catch (_) {} };
  const onBlur = () => { setFocused(false); focus.value = withTiming(0, { duration: 220 }); };
  useEffect(() => { if (error) shake.value = withSequence(withTiming(-7, { duration: 50 }), withTiming(7, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(5, { duration: 50 }), withTiming(0, { duration: 50 })); }, [error]);
  const wrapAnim = useAnimatedStyle(() => ({ borderColor: error ? C.error : focus.value > 0.5 ? C.borderFocus : C.border, backgroundColor: error ? C.errorBg : focus.value > 0.5 ? C.accentGlow : C.surface, transform: [{ translateX: shake.value }], shadowOpacity: interpolate(focus.value, [0, 1], [0.04, 0.12]), shadowRadius: interpolate(focus.value, [0, 1], [3, 10]) }));
  const labelAnim = useAnimatedStyle(() => ({ color: error ? C.error : focus.value > 0.5 ? C.accent : C.inkLight }));
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(20)} style={inS.outer}>
      <Animated.Text style={[inS.label, labelAnim]}>{label}</Animated.Text>
      <Animated.View style={[inS.wrap, wrapAnim]}>
        <Ionicons name={icon} size={17} color={focused ? C.accent : C.inkFaint} style={{ marginRight: 12 }} />
        <TextInput style={inS.input} placeholder={placeholder} placeholderTextColor={C.inkFaint} value={value} onChangeText={onChangeText} secureTextEntry={hidden} onFocus={onFocus} onBlur={onBlur} autoCapitalize="none" autoCorrect={false} selectionColor={C.accent} />
        {secureTextEntry && ( <Pressable onPress={() => setHidden((h: boolean) => !h)} hitSlop={10}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={17} color={C.inkFaint} /></Pressable> )}
      </Animated.View>
      {error && <Animated.Text entering={FadeIn.duration(200)} style={inS.errorText}>This field is required</Animated.Text>}
    </Animated.View>
  );
};


const PrimaryButton = ({ label, onPress, delay }: any) => {
  const press = useSharedValue(1);
  const btnAnim = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ marginTop: 8 }}>
      <Animated.View style={btnAnim}>
        <Pressable onPressIn={() => { press.value = withSpring(0.97, { damping: 14 }); }} onPressOut={() => { press.value = withSpring(1.00, { damping: 12 }); }} onPress={onPress} style={btnS.outer}>
          <LinearGradient colors={[C.accent, '#1E2A7A', '#18245E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={btnS.gradient}>
            <Text style={btnS.label}>{label}</Text>
            <View style={btnS.chip}><Ionicons name="arrow-forward" size={15} color={C.accent} /></View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};


// ─── FIXED TRUST ROW ────────────────────────────────────────────────────────
const TrustRow = () => (
  <Animated.View entering={FadeIn.delay(600)} style={trS.wrap}>
    <Ionicons name="lock-closed" size={14} color={C.inkLight} />
    <Text style={trS.text}>
      Your credentials are stored securely on this device to sync with the backend.
    </Text>
  </Animated.View>
);

// ────────────────────────────────────────────────────────────────────────────

const LoadingScreen = ({
  statusMsg, showCaptchaUI, captchaInput, setCaptchaInput, submitCaptcha, netId, password, captchaToSubmit, 
  onStepChange, onCaptchaRequired, captchaImage,
  handleLoginSuccess, onLoginError
}: any) => {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withSequence(withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1);
    return () => { cancelAnimation(spin); cancelAnimation(pulse); };
  }, []);

  const ringAnim = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const pulseAnim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const STEPS = ['Authenticating', 'Opening Dashboard', 'Syncing In Background'];
  const TRIGGER = ['Connecting', 'Opening', 'Syncing'];
  const activeStep = TRIGGER.findIndex(s => statusMsg.toLowerCase().includes(s.toLowerCase()));

  return (
    <View style={ldS.root}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' }, href: null }} />
      <ParchmentBg />
      
      {/* UPDATE: Login Scraper removed, using backend API */}
      <SafeAreaView style={ldS.safe}>
        <View style={ldS.body}>
          <Animated.View style={[ldS.crestWrap, pulseAnim]}>
            <Animated.View style={[ldS.ring, ringAnim]} />
            <View style={ldS.crestInner}><Ionicons name="school" size={26} color={C.accent} /></View>
          </Animated.View>
          <Text style={ldS.heading}>Connecting to Portal</Text>
          <Text style={ldS.sub}>{statusMsg}</Text>

          {/* NEW: First Login Information Box */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={ldS.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={C.accent} />
            <Text style={ldS.infoText}>We will open your dashboard right after sign-in and continue syncing your data in the background.</Text>
          </Animated.View>

          <View style={ldS.stepsCard}>
            <LetterheadRules animated={false} />
            {STEPS.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep && !done;
              return (
                <View key={step} style={[ldS.stepRow, i === STEPS.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[ldS.stepBubble, done && ldS.stepDone, active && ldS.stepActive]}>
                    {done ? <Ionicons name="checkmark" size={11} color="#FFF" /> : <View style={[ldS.stepDot, active && ldS.stepDotActive]} />}
                  </View>
                  <Text style={[ldS.stepLabel, done && { color: C.accent, fontWeight: '700' }, active && { color: C.ink, fontWeight: '700' }]}>{step}</Text>
                  {active && <Animated.View entering={FadeIn} style={ldS.activePip}><Text style={ldS.activePipText}>In progress</Text></Animated.View>}
                </View>
              );
            })}
          </View>

          {showCaptchaUI && (
            <Animated.View entering={FadeInDown.springify()} style={ldS.captchaCard}>
              <View style={ldS.captchaHead}>
                <View style={ldS.captchaIconWrap}><Ionicons name="shield-checkmark-outline" size={16} color={C.accent} /></View>
                <Text style={ldS.captchaTitle}>Verification Required</Text>
              </View>
              <Text style={ldS.captchaHint}>Type the security code shown in the image to continue logging in.</Text>
              {captchaImage ? ( <Image source={{ uri: captchaImage }} style={ldS.captchaImg} resizeMode="contain" /> ) : ( <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} /> )}
              <View style={ldS.captchaRow}>
                <TextInput style={ldS.captchaInput} placeholder="Enter code" placeholderTextColor={C.inkFaint} value={captchaInput} onChangeText={setCaptchaInput} autoCapitalize="characters" selectionColor={C.accent} />
                <Pressable onPress={submitCaptcha} style={ldS.captchaBtn}>
                  <LinearGradient colors={[C.accent, '#1E2A7A']} style={ldS.captchaBtnGrad}><Ionicons name="key-outline" size={18} color="#FFF" /></LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};


const SplashVideo = ({ onFinished }: { onFinished: () => void }) => {
  const player = useVideoPlayer(require('../../assets/images/intro.mp4'), (p) => { p.loop = false; p.play(); });
  useEventListener(player, 'playToEnd', onFinished);
  return ( <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> );
};

export default function LoginScreen() {
  const router = useRouter();

  const [netId,           setNetId]           = useState('');
  const [password,        setPassword]        = useState('');
  const [isScraping,      setIsScraping]      = useState(false);
  const [statusMsg,       setStatusMsg]       = useState('');
  const [checkingAuth,    setCheckingAuth]    = useState(true);
  const [captchaInput,    setCaptchaInput]    = useState('');
  const [showCaptchaUI,   setShowCaptchaUI]   = useState(false);
  const [captchaImage,    setCaptchaImage]    = useState<string | null>(null);
  const [captchaToSubmit, setCaptchaToSubmit] = useState<string | undefined>(undefined);

  const [netIdError,    setNetIdError]    = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // NEW: Custom Error Modal State
  const [loginErrorMsg, setLoginErrorMsg] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);

  const uiOpacity = useSharedValue(1);
  const uiScale   = useSharedValue(1);
  const uiAnim    = useAnimatedStyle(() => ({ opacity: uiOpacity.value, transform: [{ scale: uiScale.value }] }));

  const [showSplashOverlay, setShowSplashOverlay] = useState(true);
  const [showLoginUI,       setShowLoginUI]       = useState(false);
  const customSplashOpacity = useSharedValue(1);

  useEffect(() => {
    const checkLogin = async () => {
      const [sessionActive, storedId] = await Promise.all([
        AsyncStorage.getItem('session_active'),
        AsyncStorage.getItem('user_netid'),
      ]);
      
      // Auto-login only if session_active is true
      if (sessionActive === 'true') {
        await SplashScreen.hideAsync();
        router.replace('/dashboard');
      } else {
        // If no data but ID exists (e.g., session expired), prefill the ID
        if (storedId) {
          setNetId(storedId);
        }
        setCheckingAuth(false);
        await SplashScreen.hideAsync();
      }
    };
    checkLogin();
  }, []);

  useEffect(() => {
    if (statusMsg.includes('CAPTCHA Detected')) {
      setShowCaptchaUI(true);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
    }
  }, [statusMsg]);

  const submitCaptcha = () => {
    if (!captchaInput.trim()) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    setCaptchaToSubmit(captchaInput);
    setShowCaptchaUI(false);
    setCaptchaInput('');
    setCaptchaImage(null);
    setStatusMsg('Connecting..'); // Restores connecting status immediately after submitting captcha
  };

  const startScraping = async () => {
    const noId = !netId.trim();
    const noPass = !password.trim();
    setNetIdError(noId);
    setPasswordError(noPass);
    if (noId || noPass) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
    Keyboard.dismiss();
    
    uiOpacity.value = withTiming(0, { duration: 300 });
    uiScale.value = withTiming(0.96, { duration: 300 });
    
    setIsScraping(true);
    setStatusMsg('Authenticating...');

    await handleLoginSuccess();
  };

  const handleLoginSuccess = async () => {
    try {
      setStatusMsg('Contacting server...');
      const response = await fetch(`${API_BASE_URL}/academia/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: netId, password, forceSync: true }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign in. Please check your credentials.');
      }

      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      setStatusMsg('Opening dashboard...');

      // Save credentials for subsequent API calls
      await AsyncStorage.setItem('user_netid', netId);
      await AsyncStorage.setItem('user_password', password); 
      await AsyncStorage.setItem('session_active', 'true');
      
      if (data.token || data.syncToken) {
        await AsyncStorage.setItem('session_token', data.token || data.syncToken);
      }
      
      // Save data directly if provided, avoiding extra dashboard fetch
      await AsyncStorage.setItem('academia_data', JSON.stringify(data));
      if (data.profile) {
        const reg = data.profile.registrationNumber || data.profile.registerNumber || '';
        const prof = {
          ...data.profile,
          name: data.profile.name || '',
          registerNumber: reg,
          registrationNumber: reg,
        };
        await AsyncStorage.setItem('student_profile_data', JSON.stringify(prof));
      }

      setIsScraping(false);
      router.replace('/dashboard');
    } catch (err: any) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}
      setLoginErrorMsg(err.message || "Failed to contact server. Please try again.");
      setShowErrorModal(true);
      setIsScraping(false);
      uiOpacity.value = withTiming(1);
      uiScale.value = withSpring(1);
    }
  };

  const handleVideoFinished = () => {
    customSplashOpacity.value = withTiming(0, { duration: 9000, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      setShowSplashOverlay(false);
      setShowLoginUI(true);
    }, 5000);
  };

  if (checkingAuth) return null;

  if (isScraping) {
    return (
      <LoadingScreen
        statusMsg={statusMsg}
        showCaptchaUI={showCaptchaUI}
        captchaInput={captchaInput}
        setCaptchaInput={setCaptchaInput}
        submitCaptcha={submitCaptcha}
        netId={netId}
        password={password}
        captchaToSubmit={captchaToSubmit}
        onStepChange={(msg: string) => {
          // Only update status string if it's the critical CAPTCHA step. 
          // Otherwise, silently ignore it so the UI stays locked on "Connecting.."
          if (msg.includes('CAPTCHA Detected')) {
            setStatusMsg(msg);
          } 
        }}
        onCaptchaRequired={setCaptchaImage}
        captchaImage={captchaImage}
        handleLoginSuccess={handleLoginSuccess}
        onLoginError={(msg: string) => {
          // Replace Alert.alert with our custom UI
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}
          setLoginErrorMsg(msg);
          setShowErrorModal(true);
          setIsScraping(false);
          uiOpacity.value = withTiming(1);
          uiScale.value = withSpring(1);
        }}
      />
    );
  }

  return (
    <View style={s.root}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' }, href: null }} />
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ParchmentBg />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={false}
          >
            {showLoginUI && (
            <Animated.View style={[s.card, uiAnim]}>
              <LinearGradient colors={['rgba(45,58,140,0.12)', 'rgba(45,58,140,0.03)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardTint} pointerEvents="none" />
              <View style={s.cardOrbTop} pointerEvents="none" />
              <View style={s.cardOrbBottom} pointerEvents="none" />
              <LetterheadRules animated />
              <Wordmark />
              <LiveStatusPanel />

              <Animated.Text entering={FadeInDown.delay(220).duration(300)} style={s.sectionLabel}>
                Continue with your SRM credentials
              </Animated.Text>

              <Animated.Text entering={FadeInDown.delay(260).duration(300)} style={s.sectionSub}>
                Live portal access, secure fetch, and a faster first-time sync.
              </Animated.Text>

              <View style={s.fields}>
                <InputField delay={300} icon="person-outline" label="NetID" placeholder="your.netid" value={netId} onChangeText={(t: string) => { setNetId(t); setNetIdError(false); }} error={netIdError} />
                <InputField delay={380} icon="lock-closed-outline" label="Password" placeholder="••••••••" value={password} onChangeText={(t: string) => { setPassword(t); setPasswordError(false); }} secureTextEntry error={passwordError} />
              </View>

              <PrimaryButton label="Access Portal" onPress={startScraping} delay={460} />
              <TrustRow />
              
              <Animated.View entering={FadeIn.delay(700)} style={s.footerWrap}>
                 <View style={s.footerRule} />
              </Animated.View>
            </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* NEW: Custom Animated Error Modal */}
      {showErrorModal && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <View style={s.modalBackdrop}>
            <Animated.View entering={FadeInDown.springify().damping(20)} style={s.modalCard}>
              <View style={s.modalIconWrap}>
                <Ionicons name="alert-circle" size={28} color={C.error} />
              </View>
              <Text style={s.modalTitle}>Login Failed</Text>
              <Text style={s.modalText}>{loginErrorMsg}</Text>

              <Pressable style={s.modalBtn} onPress={() => setShowErrorModal(false)}>
                <Text style={s.modalBtnText}>Try Again</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {showSplashOverlay && (
        <Animated.View style={[ StyleSheet.absoluteFill, { backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }, { opacity: customSplashOpacity } ]}>
          <SplashVideo onFinished={handleVideoFinished} />
        </Animated.View>
      )}
    </View>
  );
}


