import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';
// runOnJS imported from react-native-reanimated (correct for v4 + New Architecture)


// ==========================================
// 1. CONSTANTS & THEME
// ==========================================
const { width, height } = Dimensions.get('window');

// ── Deep navy-on-cream palette (matches upgraded dashboard) ──────────────────
const COLORS = {
  white:        '#FFFFFF',
  bg:           '#F7F4EF',

  // Brand
  brand:        '#1E2D6B',
  brandMid:     '#2A3E96',
  brandLight:   '#3348B0',
  brandGlow:    'rgba(30,45,107,0.28)',

  // Text
  textDark:     '#12141C',
  textMuted:    '#5A5E6B',
  textFaint:    '#9299A8',

  // Semantic
  danger:       '#C0290A',
  dangerMid:    '#E84422',
  dangerGlow:   'rgba(192,41,10,0.35)',

  // Surface
  surface:      '#FFFFFF',
  surfaceWarm:  '#FEFCF9',
  border:       '#E6E1D6',
  overlay:      'rgba(12,16,36,0.88)',

  // Accent beam
  beam:         '#60A5FA',
  beamGlow:     'rgba(96,165,250,0.8)',
} as const;

const FAB_SIZE   = 58;
const RING_SIZE  = FAB_SIZE + 28;
const MENU_R     = width * 0.33;

// ==========================================
// 2. MENU CONFIGURATION & PUNCHLINES
// ==========================================
interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  isDanger?: boolean;
  color?: string;
  tint?: string;
}

const COMBINED_MENU: MenuItemProps[] = [
  { icon: 'calendar',    label: 'Calendar',   route: '/calendar',   color: '#3348B0', tint: '#E8ECFB' },
  { icon: 'time',        label: 'Timetable',  route: '/Timetable',  color: '#0E7A4A', tint: '#E5F5EE' },
  { icon: 'calculator',  label: 'Grades',     route: '/grades',     color: '#A05C00', tint: '#FEF3E2' },
  { icon: 'library',     label: 'Resources',  route: '/resources',  color: '#6B21A8', tint: '#F3E8FF' },
  { icon: 'mail',        label: 'Gmail',      route: '/gmail',      color: '#C0290A', tint: '#FDECEA' },
  { icon: 'restaurant',  label: 'Mess',       route: '/mess',       color: '#0369A1', tint: '#E0F2FE' },
];

const CRAZY_MESSAGES = [
  "M-block girls out here paying luxury tax just to get treated like inmates fr. 💅",
  "Mess biryani day? Only valid reason to show up early.",
  "Your outing pass expired before your motivation did. 📉",
  "Mess announcing 'special' today like we haven't seen the same dal 47 times. 💀",
  "Day scholar entering mess like it's a heist movie.",
  "Have you seen that one Oori video? 🤨",
  "Fun fact: Seniors say that getting hit by lightning is more common than getting a buggy in the morning.",
  "May the Lord bless Dr. E. Suresh. 🙏✨",
  "No good decision is made in Pondi. 🍻",
  "A moment of silence for Raptors! 🫡",
  "Petition to diversify Tascmac menu.",
  "The only STEP I like is stepsister. 😏",
  "STEP hatwado koi! 😭",
  "Shawty said she was from Estancia; turns out Mini Matrix ki thi. 🤡",
  "Sirf hostel wali akka hi mujhe dekh ke seeti marti hai. 😙🎶",
  "Forest vs. Blackfilter—which side are you on?",
  "HR05 shutting down is my biggest nightmare."
];

// ==========================================
// 3. RADIAL MENU ITEM
// ==========================================
const RadialMenuItem = memo(({
  item, index, totalItems, expansion, onPress,
}: {
  item: MenuItemProps;
  index: number;
  totalItems: number;
  expansion: SharedValue<number>;
  onPress: () => void;
}) => {
  const angle   = Math.PI - (index * (Math.PI / (totalItems - 1)));
  const targetX = Math.cos(angle) * MENU_R;
  const targetY = -Math.sin(angle) * MENU_R;

  const animatedStyle = useAnimatedStyle(() => {
    const staggerStart   = index * (0.25 / totalItems);
    const itemProgress   = interpolate(
      expansion.value,
      [staggerStart, staggerStart + 0.75],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: itemProgress * targetX },
        { translateY: itemProgress * targetY },
        { scale: interpolate(itemProgress, [0, 0.6, 1], [0.4, 1.08, 1], Extrapolation.CLAMP) },
        { rotate: `${interpolate(itemProgress, [0, 1], [45, 0])}deg` },
      ],
      opacity: interpolate(itemProgress, [0, 0.6, 1], [0, 1, 1]),
    };
  });

  const color = item.isDanger ? COLORS.danger : (item.color ?? COLORS.brand);
  const tint  = item.tint ?? '#F0F0F0';

  return (
    <Animated.View style={[styles.radialItemWrap, animatedStyle]}>
      <Pressable
        style={({ pressed }) => [styles.radialItem, pressed && styles.radialItemPressed, { shadowColor: color }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        {/* Tinted background disc */}
        <View style={[styles.radialIconDisc, { backgroundColor: tint }]}>
          <Ionicons name={item.icon} size={20} color={color} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ==========================================
// 4. PROGRESS RING  (scans while holding)
// ==========================================
const ProgressRing = memo(({ progress }: { progress: SharedValue<number> }) => {
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.95, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ rotate: '-90deg' }],
  }));

  // We fake a stroke-dashoffset via scaleX on a half-arc view
  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <Animated.View style={[styles.progressRingOuter, ringStyle]} pointerEvents="none">
      <View style={styles.progressRingTrack} />
      <Animated.View style={[styles.progressRingFill, arcStyle]} />
    </Animated.View>
  );
});

// ==========================================
// 5. MAIN COMPONENT
// ==========================================
export default function FingerprintMenu({ onClose, onScanStart }: { readonly onClose: () => void, readonly onScanStart: () => void }) {
  const [isScanning, setIsScanning]   = useState(false);
  const [isOpen, setIsOpen]           = useState(false);
  const hapticInterval                = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanSuccess                   = useRef(false);

  // Chat state
  const [isThinking, setIsThinking]   = useState(false);
  const [fullMessage, setFullMessage] = useState('Where to?');
  const [agentMessage, setAgentMessage] = useState('');
  const [thinkingDots, setThinkingDots] = useState('');

  // Toast State
  const [toastFeature, setToastFeature] = useState('');
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastAnim                       = useSharedValue(0);

  // Shared values
  const scanProgress  = useSharedValue(0);
  const expansion     = useSharedValue(0);
  const laserPos      = useSharedValue(0);
  const hoverAnim     = useSharedValue(0);
  const pulseRing     = useSharedValue(0);

  // ── Thinking dots ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isThinking) return;
    let d = 0;
    const id = setInterval(() => {
      d = (d + 1) % 4;
      setThinkingDots('.'.repeat(d));
    }, 280);
    return () => clearInterval(id);
  }, [isThinking]);

  // ── Typing effect + hover ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      hoverAnim.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
      // Pulse ring on open
      pulseRing.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
        3, false
      );

      setIsThinking(true);
      setAgentMessage('');
      const thinkTimer = setTimeout(() => {
        setIsThinking(false);
        let i = 0;
        const id = setInterval(() => {
          setAgentMessage(fullMessage.substring(0, i + 1));
          i++;
          if (i >= fullMessage.length) clearInterval(id);
        }, 28);
        return () => clearInterval(id);
      }, 1100);
      return () => clearTimeout(thinkTimer);
    } else {
      setAgentMessage('');
      setIsThinking(false);
      hoverAnim.value = withTiming(0, { duration: 400 });
    }
  }, [isOpen, fullMessage]);

  // ── Animated styles ──────────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scanProgress.value, [0, 0.5, 1], [1, 0.9, 1], Extrapolation.CLAMP) },
    ],
    backgroundColor: isOpen
      ? COLORS.danger
      : interpolateColor(scanProgress.value, [0, 1], [COLORS.brand, COLORS.brandMid]),
  }));

  const laserStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(laserPos.value, [0, 1], [-16, 16]) },
      { scaleX:     interpolate(laserPos.value, [0, 0.5, 1], [0.5, 1, 0.5]) },
    ],
    opacity: isScanning && !isOpen ? interpolate(laserPos.value, [0, 0.5, 1], [0.4, 1, 0.4]) : 0,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(scanProgress.value, [0, 1], [0, 380])}deg` },
      { scale:   interpolate(scanProgress.value, [0, 0.1, 1], [0.7, 1.25, 1.35], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scanProgress.value, [0, 0.08, 1], [0, 1, 0]),
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseRing.value, [0, 1], [1, 1.8]) }],
    opacity:   interpolate(pulseRing.value, [0, 0.5, 1], [0.6, 0.2, 0]),
  }));

  const chatStyle = useAnimatedStyle(() => {
    const hover = interpolate(hoverAnim.value, [0, 1], [0, -7]);
    return {
      opacity:   interpolate(expansion.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(expansion.value, [0, 1], [50, 0], Extrapolation.CLAMP) + hover },
        { scale:      interpolate(expansion.value, [0.4, 1], [0.88, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const toastStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(toastAnim.value, [0, 1], [-120, 60], Extrapolation.CLAMP) },
      { scale: interpolate(toastAnim.value, [0, 1], [0.9, 1], Extrapolation.CLAMP) }
    ],
    opacity: toastAnim.value,
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const triggerOpenMenu = useCallback(() => {
    if (hapticInterval.current) clearInterval(hapticInterval.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsScanning(false);
    const msg = CRAZY_MESSAGES[Math.floor(Math.random() * CRAZY_MESSAGES.length)];
    setFullMessage(msg);
    setIsOpen(true);
    scanSuccess.current = true;
    expansion.value = withSpring(1, { damping: 13, stiffness: 95, mass: 0.65 });
  }, [expansion]);

  const handlePressIn = () => {
    if (isOpen) return;
    onScanStart();
    scanSuccess.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsScanning(true);
    let ticks = 0;
    hapticInterval.current = setInterval(() => {
      ticks++;
      if (ticks % 2 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 140);
    laserPos.value     = withRepeat(withTiming(1, { duration: 340 }), -1, true);
    scanProgress.value = withTiming(1, { duration: 800 }, (done) => {
      if (done) {
        runOnJS(triggerOpenMenu)(); // NOSONAR
      }
    });
  };

  const handlePressOut = () => {
    if (isOpen) return;
    if (hapticInterval.current) clearInterval(hapticInterval.current);
    if (scanProgress.value < 1) {
      cancelAnimation(scanProgress);
      cancelAnimation(laserPos);
      scanProgress.value = withTiming(0, { duration: 300 });
      laserPos.value     = withTiming(0, { duration: 300 });
      setIsScanning(false);
      onClose();
    }
  };

  const handlePress = () => {
    if (scanSuccess.current) { scanSuccess.current = false; return; }
    if (isOpen) handleClose();
  };

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    expansion.value    = withTiming(0, { duration: 240 });
    scanProgress.value = withTiming(0, { duration: 240 });
    setTimeout(() => { setIsOpen(false); onClose(); }, 240);
  }, [expansion, scanProgress, onClose]);

  const showToast = useCallback((feature: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setToastFeature(feature);
    toastAnim.value = withSpring(1, { damping: 14, stiffness: 100 });
    
    toastTimer.current = setTimeout(() => {
      toastAnim.value = withTiming(0, { duration: 300 });
    }, 3500);
  }, [toastAnim]);

  const handleNavigation = useCallback((route?: string, label?: string) => {
    if (!route) return;

    if (route === '/calendar' || route === '/Timetable') {
      handleClose();
      setTimeout(() => router.push(route as any), 280);
    } else {
      handleClose();
      setTimeout(() => showToast(label || 'This feature'), 250);
    }
  }, [handleClose, showToast]);

  let fabIcon: keyof typeof Ionicons.glyphMap = 'apps-outline';
  if (isOpen) fabIcon = 'close';
  else if (isScanning) fabIcon = 'finger-print';

  let fabIconSize = 26;
  if (isScanning && !isOpen) fabIconSize = 30;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── CUSTOM TOAST (Coming Soon) ───────────────────────────────────── */}
      <Animated.View style={[styles.toastContainer, toastStyle]} pointerEvents="none">
        <View style={styles.toastIconBg}>
          <Ionicons name="hammer" size={18} color={COLORS.brandMid} />
        </View>
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastTitle}>{toastFeature} coming soon!</Text>
          <Text style={styles.toastSub}>We're polishing this feature for you.</Text>
        </View>
      </Animated.View>

      {/* ── BOTTOM BAR MASK (Hides the bottom white tab bar) ── */}
      <Animated.View style={[styles.bottomMask, backdropStyle]} pointerEvents="none" />

      {/* ── BACKDROP ─────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* ── CHAT BUBBLE ──────────────────────────────────────────────────── */}
      <Animated.View style={[styles.chatOuter, chatStyle]} pointerEvents="none">
        <View style={styles.chatCard}>
          {/* Status bar */}
          <View style={styles.chatStatusBar}>
            <View style={styles.chatStatusDot} />
            <Text style={styles.chatStatusText}>SRM Assistant • Online</Text>
          </View>

          <View style={styles.chatRow}>
            {/* Avatar */}
            <View style={styles.avatarRing}>
              <Image
                source={{ uri: 'https://api.dicebear.com/7.x/bottts/png?seed=SRMAgent&backgroundColor=1E2D6B' }}
                style={styles.avatarImg}
              />
            </View>

            {/* Message */}
            <View style={styles.chatMsgBox}>
              {isThinking ? (
                <View style={styles.thinkingRow}>
                  <View style={[styles.thinkingDot, { animationDelay: '0ms' }]} />
                  <View style={[styles.thinkingDot, { animationDelay: '150ms' }]} />
                  <View style={[styles.thinkingDot, { animationDelay: '300ms' }]} />
                  <Text style={styles.thinkingLabel}>typing{thinkingDots}</Text>
                </View>
              ) : (
                <Text style={styles.chatMsg}>
                  {agentMessage}
                  {isOpen && agentMessage.length < fullMessage.length && (
                    <Text style={{ color: COLORS.brandLight }}>▌</Text>
                  )}
                </Text>
              )}
            </View>
          </View>

          {/* Triangle tail */}
          <View style={styles.chatTail} />
        </View>
      </Animated.View>

      {/* ── ANCHOR ───────────────────────────────────────────────────────── */}
      <View style={styles.anchor} pointerEvents="box-none">

        {/* Radial items */}
        {COMBINED_MENU.map((item, index) => (
          <RadialMenuItem
            key={item.label}
            item={item}
            index={index}
            totalItems={COMBINED_MENU.length}
            expansion={expansion}
            onPress={() => handleNavigation(item.route, item.label)}
          />
        ))}

        {/* Pulse ring on open */}
        <Animated.View style={[styles.pulseRing, pulseRingStyle]} pointerEvents="none" />

        {/* Dashed scan spinner */}
        <Animated.View style={[styles.spinner, spinnerStyle]} pointerEvents="none" />

        {/* Progress arc ring */}
        <ProgressRing progress={scanProgress} />

        {/* FAB */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={styles.fabPressable}
        >
          <Animated.View style={[styles.fab, fabStyle]}>
            {/* Inner glow ring */}
            <View style={styles.fabInnerRing} />

            <Ionicons
              name={fabIcon}
              size={fabIconSize}
              color={COLORS.white}
            />

            {/* Laser beam */}
            <Animated.View style={[styles.laser, laserStyle]} />
          </Animated.View>
        </Pressable>

        {/* Helper text */}
        {!isOpen && (
          <Animated.View
            entering={FadeIn.delay(400)}
            exiting={FadeOut.duration(180)}
            style={styles.helperPill}
          >
            <Text style={styles.helperText}>
              {isScanning ? 'SCANNING…' : 'HOLD TO OPEN'}
            </Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ==========================================
// 6. STYLES
// ==========================================
const styles = StyleSheet.create({

  // ── CUSTOM TOAST
  toastContainer: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 100,
    width: width * 0.85,
    borderWidth: 1,
    borderColor: 'rgba(30,45,107,0.06)',
  },
  toastIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8ECFB', // Matches brandTint
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  toastSub: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // ── BOTTOM BAR MASK (Hides the bottom white tab bar)
  bottomMask: {
    position: 'absolute',
    bottom: -100,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: COLORS.bg,
    zIndex: 5,
  },

  // ── BACKDROP
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    zIndex: 10,
  },

  // ── CHAT BUBBLE
  chatOuter: {
    position: 'absolute',
    top: height * 0.14,
    width: width,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 25,
  },
  chatCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    width: '100%',
    position: 'relative',
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(30,45,107,0.08)',
    overflow: 'hidden',
  },
  // Top accent stripe
  chatStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(30,45,107,0.05)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,45,107,0.06)',
  },
  chatStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  chatStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: COLORS.brand,
    overflow: 'hidden',
    backgroundColor: '#E0E7FF',
    flexShrink: 0,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%' },
  chatMsgBox: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.brandMid,
    opacity: 0.5,
  },
  thinkingLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  chatMsg: {
    color: COLORS.textDark,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  chatTail: {
    position: 'absolute',
    bottom: -11,
    left: '50%',
    marginLeft: -11,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 12,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.surface,
  },

  // ── ANCHOR
  anchor: {
    position: 'absolute',
    bottom: 76,
    left: width / 2,
    width: 0,
    height: 0,
    zIndex: 20,
  },

  // ── PULSE RING  (burst on open)
  pulseRing: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    left: -FAB_SIZE / 2,
    top: -FAB_SIZE / 2,
    backgroundColor: COLORS.brand,
    opacity: 0,
  },

  // ── SCAN SPINNER
  spinner: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    left: -RING_SIZE / 2,
    top: -RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: COLORS.beam,
    borderStyle: 'dashed',
    opacity: 0,
  },

  // ── PROGRESS RING  (simple approximation)
  progressRingOuter: {
    position: 'absolute',
    width: RING_SIZE + 6,
    height: RING_SIZE + 6,
    borderRadius: (RING_SIZE + 6) / 2,
    left: -(RING_SIZE + 6) / 2,
    top: -(RING_SIZE + 6) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingTrack: {
    position: 'absolute',
    width: RING_SIZE + 6,
    height: RING_SIZE + 6,
    borderRadius: (RING_SIZE + 6) / 2,
    borderWidth: 2,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  progressRingFill: {
    position: 'absolute',
    width: RING_SIZE + 6,
    height: RING_SIZE + 6,
    borderRadius: (RING_SIZE + 6) / 2,
    borderWidth: 2.5,
    borderColor: COLORS.beam,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    shadowColor: COLORS.beam,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── FAB
  fabPressable: {
    position: 'absolute',
    left: -FAB_SIZE / 2,
    top: -FAB_SIZE / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 30,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
    overflow: 'hidden',
  },
  fabInnerRing: {
    position: 'absolute',
    width: FAB_SIZE - 10,
    height: FAB_SIZE - 10,
    borderRadius: (FAB_SIZE - 10) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  laser: {
    position: 'absolute',
    width: FAB_SIZE * 0.72,
    height: 2.5,
    backgroundColor: COLORS.beam,
    borderRadius: 2,
    shadowColor: COLORS.beamGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },

  // ── HELPER PILL
  helperPill: {
    position: 'absolute',
    top: FAB_SIZE / 2 + 14,
    left: -55,
    width: 110,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  helperText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },

  // ── RADIAL ITEMS
  radialItemWrap: {
    position: 'absolute',
    width: 78,
    height: 92,
    left: -39,
    top: -46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialItem: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  radialItemPressed: {
    transform: [{ scale: 0.93 }],
    opacity: 0.85,
  },
  radialIconDisc: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});