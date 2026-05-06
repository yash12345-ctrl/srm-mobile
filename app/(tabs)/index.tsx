import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEvent } from 'expo';
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

import SRMLoginAuth from '../../components/SRMLoginAuth';

SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get('window');
const IS_COMPACT = width < 380;
const IS_SHORT = height < 780;

const C = {
  bg:           '#F5F2ED',
  bgDeep:       '#EDE9E2',
  surface:      '#FDFBF8',
  surfaceInset: '#F0EDE7',
  ink:          '#1A1E2E',
  inkMid:       '#3D4360',
  inkLight:     '#7C8099',
  inkFaint:     '#B8BBCA',
  accent:       '#2D3A8C',
  accentLight:  '#EEF0FB',
  accentMid:    '#6B7AC4',
  accentGlow:   'rgba(45,58,140,0.08)',
  border:       '#DDD9D0',
  borderFocus:  '#2D3A8C',
  borderInk:    '#C8C4BA',
  error:        '#C0392B',
  errorBg:      '#FDF3F2',
  success:      '#1A7A4A',
  orb1: 'rgba(45,58,140,0.04)',
  orb2: 'rgba(80,100,200,0.03)',
  orb3: 'rgba(180,160,100,0.05)',
};

const FONT = {
  display: Platform.OS === 'ios' ? 'Georgia'     : 'serif',
  mono:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

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
const bgS = StyleSheet.create({ orb: { position: 'absolute', borderRadius: 9999 } });

const LetterheadRules = ({ animated }: { animated: boolean }) => {
  const w1 = useSharedValue(animated ? 0 : 1);
  const w2 = useSharedValue(animated ? 0 : 1);
  useEffect(() => { if (!animated) return; w1.value = withDelay(500, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })); w2.value = withDelay(700, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })); }, []);
  const r1 = useAnimatedStyle(() => ({ width: `${interpolate(w1.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%` as any }));
  const r2 = useAnimatedStyle(() => ({ width: `${interpolate(w2.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%` as any }));
  return ( <View style={lhS.wrap}><Animated.View style={[lhS.thick, r1]} /><Animated.View style={[lhS.thin, r2]} /></View> );
};
const lhS = StyleSheet.create({ wrap: { marginBottom: 28, overflow: 'hidden' }, thick: { height: 2, backgroundColor: C.accent, borderRadius: 1, marginBottom: 3 }, thin: { height: 0.75, backgroundColor: C.border } });

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
const wmS = StyleSheet.create({ wrap: { alignItems: 'center', marginBottom: IS_COMPACT ? 20 : 24 }, crest: { width: 56, height: 56, borderRadius: 16, marginBottom: 14, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 4, backgroundColor: C.surface }, crestInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: C.accentLight, borderWidth: 1.5, borderColor: C.accent + '30' }, name: { fontSize: IS_COMPACT ? 24 : 28, fontWeight: '800', color: C.ink, letterSpacing: IS_COMPACT ? 5.2 : 7, fontFamily: FONT.display, textAlign: 'center' }, tagline: { fontSize: IS_COMPACT ? 10 : 11, color: C.inkLight, letterSpacing: IS_COMPACT ? 1.7 : 2.2, textTransform: 'uppercase', marginTop: 6, marginBottom: 20, textAlign: 'center' }, bottomRule: { width: 40, height: 2, backgroundColor: C.accent, borderRadius: 1, opacity: 0.4 } });

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
const lpS = StyleSheet.create({
  wrap: { marginBottom: 20 },
  panel: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(45,58,140,0.10)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8, marginBottom: 10 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(45,58,140,0.08)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  livePillText: { fontSize: 11, fontWeight: '800', color: C.accent, letterSpacing: 0.4, textTransform: 'uppercase' },
  timeLabel: { fontSize: IS_COMPACT ? 14 : 15, fontWeight: '800', color: C.ink, fontFamily: FONT.mono, letterSpacing: 0.2 },
  greeting: { fontSize: 19, fontWeight: '800', color: C.ink, marginBottom: 2, letterSpacing: -0.2 },
  dateLabel: { fontSize: 12, color: C.inkLight, fontWeight: '600', marginBottom: 12 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(45,58,140,0.08)',
  },
  metaChipText: { fontSize: 11, fontWeight: '700', color: C.inkMid },
});

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
        {secureTextEntry && ( <Pressable onPress={() => setHidden(h => !h)} hitSlop={10}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={17} color={C.inkFaint} /></Pressable> )}
      </Animated.View>
      {error && <Animated.Text entering={FadeIn.duration(200)} style={inS.errorText}>This field is required</Animated.Text>}
    </Animated.View>
  );
};
const inS = StyleSheet.create({ outer: { marginBottom: 18 }, label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }, wrap: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, shadowColor: C.accent, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, input: { flex: 1, color: C.ink, fontSize: 15, letterSpacing: 0.2 }, errorText: { fontSize: 11, color: C.error, marginTop: 6, marginLeft: 4, fontWeight: '600' } });

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
const btnS = StyleSheet.create({ outer: { borderRadius: 14, overflow: 'hidden', shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 }, gradient: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, label: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: FONT.display }, chip: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' } });

// ─── FIXED TRUST ROW ────────────────────────────────────────────────────────
const TrustRow = () => (
  <Animated.View entering={FadeIn.delay(600)} style={trS.wrap}>
    <Ionicons name="lock-closed" size={14} color={C.inkLight} />
    <Text style={trS.text}>
      Your ID and password are not stored. They are used only for securely fetching your data.
    </Text>
  </Animated.View>
);
const trS = StyleSheet.create({ 
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, paddingHorizontal: 4 }, 
  text: { flex: 1, fontSize: 11, color: C.inkLight, fontWeight: '600', letterSpacing: 0.2, lineHeight: 16, textAlign: 'center' } 
});
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
      
      {/* UPDATE: Added pointerEvents="none" and hidden styles to run scraper in background */}
      <View style={ldS.scraper} pointerEvents="none">
        <SRMLoginAuth
          netId={netId}
          password={password}
          manualCaptcha={captchaToSubmit}
          onStepChange={onStepChange}
          onLoginSuccess={handleLoginSuccess}
          onCaptchaRequired={onCaptchaRequired}
          onLoginError={onLoginError}
        />
      </View>

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
const ldS = StyleSheet.create({ 
  root: { flex: 1, backgroundColor: C.bg }, 
  // UPDATE: Hide the scrapers completely in the background again
  scraper: { position: 'absolute', top: -10000, left: -10000, width: 10, height: 10, opacity: 0, zIndex: -1 }, 
  safe: { flex: 1 }, body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, crestWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, ring: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: 'transparent', borderTopColor: C.accent, borderRightColor: C.accentMid }, crestInner: { width: 62, height: 62, borderRadius: 18, backgroundColor: C.accentLight, borderWidth: 1.5, borderColor: C.accent + '35', alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }, heading: { fontSize: 22, fontWeight: '800', color: C.ink, fontFamily: FONT.display, letterSpacing: -0.3 }, 
  sub: { fontSize: 13, color: C.inkLight, letterSpacing: 0.3, marginBottom: 16, textAlign: 'center' }, // Reduced marginBottom to fit the new box
  // NEW: Info Box Styles
  infoBox: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, marginBottom: 24, gap: 12, borderWidth: 1, borderColor: C.accent + '25' },
  infoText: { flex: 1, fontSize: 12, color: C.accent, fontWeight: '600', lineHeight: 18 },
  stepsCard: { alignSelf: 'stretch', backgroundColor: C.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }, stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.75, borderBottomColor: C.borderInk }, stepBubble: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.surfaceInset, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, stepDone: { backgroundColor: C.accent, borderColor: C.accent }, stepActive: { borderColor: C.accent, borderWidth: 2 }, stepDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.inkFaint }, stepDotActive: { backgroundColor: C.accent }, stepLabel: { flex: 1, fontSize: 13, color: C.inkLight, fontWeight: '600' }, activePip: { backgroundColor: C.accentLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }, activePipText: { fontSize: 10, color: C.accent, fontWeight: '700', letterSpacing: 0.3 }, captchaCard: { alignSelf: 'stretch', marginTop: 16, backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: C.accent + '35', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }, captchaHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, captchaIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' }, captchaTitle: { fontSize: 15, fontWeight: '800', color: C.ink }, captchaHint: { fontSize: 12, color: C.inkLight, lineHeight: 18, marginBottom: 14 }, captchaImg: { height: 50, width: 160, alignSelf: 'center', marginBottom: 14, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: '#FFF' }, captchaRow: { flexDirection: 'row', gap: 10 }, captchaInput: { flex: 1, height: 50, backgroundColor: C.surfaceInset, color: C.ink, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.border, fontSize: 18, letterSpacing: 4, fontFamily: FONT.mono, textAlign: 'center' }, captchaBtn: { borderRadius: 12, overflow: 'hidden' }, captchaBtnGrad: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' } 
});

const SplashVideo = ({ onFinished }: { onFinished: () => void }) => {
  const player = useVideoPlayer(require('../../assets/images/intro.mp4'), (p) => { p.loop = false; p.play(); });
  useEvent(player, 'playToEnd', onFinished);
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
      const [storedData, storedId] = await Promise.all([
        AsyncStorage.getItem('academic_data'),
        AsyncStorage.getItem('user_netid'),
      ]);
      
      // Auto-login only if academic data exists (session active)
      if (storedData) {
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

  const startScraping = () => {
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
    setTimeout(() => {
      setIsScraping(true);
      setStatusMsg('Connecting..');
    }, 350);
  };

  const handleLoginSuccess = async () => {
    try { 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
    } catch (_) {}

    try {
      setStatusMsg('Opening dashboard...');
      await AsyncStorage.setItem('user_netid', netId);
      setIsScraping(false);
      router.replace('/dashboard');
    } catch {
      // Trigger our custom error modal instead of Alert.alert
      setLoginErrorMsg("Failed to save data securely. Please try again.");
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

const s = StyleSheet.create({ 
  root: { flex: 1, backgroundColor: C.bg }, 
  safe: { flex: 1 }, 
  kav: { flex: 1 }, 
  scrollContent: { flexGrow: 1, justifyContent: IS_SHORT ? 'flex-start' : 'center', paddingHorizontal: 20, paddingTop: IS_SHORT ? 20 : 28, paddingBottom: 28 },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: C.surface, borderRadius: 26, paddingHorizontal: IS_COMPACT ? 20 : 28, paddingVertical: IS_COMPACT ? 22 : 28, borderWidth: 1, borderColor: C.border, shadowColor: '#8A7E6A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 32, elevation: 10, overflow: 'hidden' }, 
  cardTint: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  cardOrbTop: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -52, right: -42, backgroundColor: 'rgba(45,58,140,0.05)' },
  cardOrbBottom: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: -36, left: -26, backgroundColor: 'rgba(107,122,196,0.06)' },
  sectionLabel: { fontSize: 13, color: C.inkLight, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8, textAlign: 'center' }, 
  sectionSub: { fontSize: 12, color: C.inkMid, fontWeight: '500', lineHeight: 18, marginBottom: 20, textAlign: 'center', paddingHorizontal: 8 },
  fields: { marginBottom: 6 }, 
  footerWrap: { marginTop: 20 },
  footerRule: { height: 1, backgroundColor: C.border, opacity: 0.6 },
  
  // NEW STYLES FOR THE CUSTOM MODAL
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 30, 46, 0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { width: '100%', backgroundColor: C.surface, borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: C.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: C.border },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.errorBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(192, 57, 43, 0.2)' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: C.ink, fontFamily: FONT.display, marginBottom: 8 },
  modalText: { fontSize: 14, color: C.inkLight, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalBtn: { backgroundColor: C.accentLight, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(45, 58, 140, 0.1)' },
  modalBtnText: { color: C.accent, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 }
});
