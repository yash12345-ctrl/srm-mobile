import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import ReAnimated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import SRMProfileScraper from '../components/SRMProfileScraper';

// ── Palette (unified across app) ─────────────────────────────────────────────
const C = {
  bg:           '#F7F4EF',
  surface:      '#FFFFFF',
  surfaceTint:  '#FEFCF9',

  brand:        '#141B3B',
  brandMid:     '#1E2D6B',
  brandLight:   '#3348B0',
  brandTint:    '#E8ECFB',
  brandSubtle:  '#C4CCEF',

  textPrimary:  '#12141C',
  textSecondary:'#5A5E6B',
  textTertiary: '#9299A8',
  textInverse:  '#FFFFFF',

  danger:       '#C0290A',
  dangerTint:   '#FDECEA',
  dangerBorder: 'rgba(192,41,10,0.25)',

  success:      '#0E7A4A',
  successTint:  '#E5F5EE',

  border:       'rgba(0,0,0,0.06)',
  divider:      '#EFEBE3',
  shadow:       '#8A8070',

  gradStart:    '#141B3B',
  gradMid:      '#1E2D6B',
  gradEnd:      '#0A1128',
};

// ── Custom Spring Config for smoother animations ─────────────────────────────
const springConfig = { damping: 14, stiffness: 100, mass: 0.8 };
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, color, tint }: Readonly<{
  icon: any; label: string; value: string; color: string; tint: string;
}>) {
  return (
    <View style={stat.tile}>
      <View style={[stat.iconBox, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={stat.value} numberOfLines={2}>{value}</Text>
      <Text style={stat.label} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const stat = StyleSheet.create({
  tile:    { flex: 1, alignItems: 'center', gap: 8 },
  iconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  value:   { fontSize: 17, fontWeight: '900', color: C.textPrimary, letterSpacing: -0.3 },
  label:   { fontSize: 11, fontWeight: '700', color: C.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, isLast }: Readonly<{
  icon: any; label: string; value: string; isLast?: boolean;
}>) {
  return (
    <>
      <View style={info.row}>
        <View style={info.iconWrap}>
          <Ionicons name={icon} size={18} color={C.brandLight} />
        </View>
        <View style={info.textWrap}>
          <Text style={info.label}>{label}</Text>
          <Text style={info.value}>{value}</Text>
        </View>
      </View>
      {!isLast && <View style={info.divider} />}
    </>
  );
}

const info = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 4 },
  iconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: C.brandTint, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.brandSubtle },
  textWrap: { flex: 1, justifyContent: 'center', paddingTop: 2 },
  label:    { fontSize: 12, fontWeight: '700', color: C.textTertiary, letterSpacing: 0.5, marginBottom: 4 },
  value:    { fontSize: 15, fontWeight: '700', color: C.textPrimary, lineHeight: 22, flexShrink: 1 },
  divider:  { height: 1, backgroundColor: C.divider, marginVertical: 16, marginLeft: 60 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LOADING WAVE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const LoadingWave = () => {
  const w1 = useSharedValue(0);
  const w2 = useSharedValue(0);
  const w3 = useSharedValue(0);

  useEffect(() => {
    w1.value = withRepeat(withSequence(withTiming(1, {duration: 400}), withTiming(0, {duration: 400})), -1, true);
    w2.value = withDelay(150, withRepeat(withSequence(withTiming(1, {duration: 400}), withTiming(0, {duration: 400})), -1, true));
    w3.value = withDelay(300, withRepeat(withSequence(withTiming(1, {duration: 400}), withTiming(0, {duration: 400})), -1, true));
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(w1.value, [0, 1], [0, -12]) }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(w2.value, [0, 1], [0, -12]) }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(w3.value, [0, 1], [0, -12]) }] }));

  return (
    <View style={styles.loadingWaveContainer}>
      <ReAnimated.View entering={FadeIn.duration(400)} style={styles.waveDotWrap}>
        <ReAnimated.View style={[styles.waveDot, { backgroundColor: C.brand }, s1]} />
        <ReAnimated.View style={[styles.waveDot, { backgroundColor: C.brandMid }, s2]} />
        <ReAnimated.View style={[styles.waveDot, { backgroundColor: C.brandLight }, s3]} />
      </ReAnimated.View>
      <ReAnimated.Text entering={FadeInDown.delay(200)} style={styles.loadingWaveText}>
        Syncing Profile...
      </ReAnimated.Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
// ── Layout Hook ──────────────────────────────────────────────────────────────
function useProfileLayout(width: number, height: number) {
  const isVerySmallDevice = width < 350;
  const isSmallDevice = width < 375;
  const isTablet = width >= 768;

  const COVER_H = clamp(height * (isTablet ? 0.33 : 0.38), isSmallDevice ? 300 : 320, isTablet ? 460 : 420);
  const avatarSize = clamp(width * (isTablet ? 0.18 : 0.28), 84, 130);
  const contentMaxWidth = isTablet ? 720 : 600;
  const hPadding = clamp(width * 0.05, 16, 28);

  let cardPadding = 24;
  if (isVerySmallDevice) cardPadding = 16;
  else if (isSmallDevice) cardPadding = 18;

  let bodyTopInsetOffset = 16;
  if (isVerySmallDevice) bodyTopInsetOffset = 8;
  else if (isSmallDevice) bodyTopInsetOffset = 12;
  const bodyTopInset = COVER_H + bodyTopInsetOffset;

  let heroTopInset = 20;
  if (isVerySmallDevice) heroTopInset = 12;
  else if (isSmallDevice) heroTopInset = 16;

  let heroNameFontSize = 26;
  if (isVerySmallDevice) heroNameFontSize = 21;
  else if (isSmallDevice) heroNameFontSize = 22;

  return {
    isVerySmallDevice,
    COVER_H,
    avatarSize,
    contentMaxWidth,
    hPadding,
    cardPadding,
    bodyTopInset,
    heroTopInset,
    heroNameFontSize
  };
}

// ── Scraper View ─────────────────────────────────────────────────────────────
// sessionDead prop removed: session expiry now redirects to login immediately
// via handleSessionExpired, so we never need to reveal the WebView for re-login.
// showInternalAlert={false}: parent owns all session-expiry UX — no double alert.
const ProfileScraperView = ({ onSessionExpired, onScrapeComplete }: Readonly<{
  onSessionExpired: () => void;
  onScrapeComplete: (data: any) => void;
}>) => (
  <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Stack.Screen options={{ title: 'Academia Login', headerBackTitle: 'Back' }} />
    <LoadingWave />
    <SRMProfileScraper
      backgroundMode={true}
      showInternalAlert={false}
      onSessionExpired={onSessionExpired}
      onScrapeComplete={onScrapeComplete}
    />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions(); 
  
  const {
    isVerySmallDevice,
    COVER_H,
    avatarSize,
    contentMaxWidth,
    hPadding,
    cardPadding,
    bodyTopInset,
    heroTopInset,
    heroNameFontSize
  } = useProfileLayout(width, height);

  const [loading, setLoading]             = useState(true);
  const [needsScraping, setNeedsScraping] = useState(false);
  const [netId, setNetId]                 = useState('User');
  const [profileData, setProfileData]     = useState<{
    name: string; registerNumber: string; imageUrl: string;
  } | null>(null);
  const [imageError, setImageError]       = useState(false);

  // ✅ Design Issue 1 Fix: guard ref prevents duplicate session-expired firings
  const hasHandledSessionExpired = useRef(false);

  // ✅ Design Issue 1 Fix: proper session expiry handler — clears cached
  // academic data and redirects to the app login screen
  const SESSION_DATA_KEYS = [
    'academic_data',
    'timetable_data',
    'academic_calendar_data',
    'student_profile_data',
    'attendance_data_v2',
  ] as const;

  const handleSessionExpired = useCallback(() => {
    if (hasHandledSessionExpired.current) return;
    hasHandledSessionExpired.current = true;
    // Wipe scraped data; keep user_netid so login screen can greet the user
    AsyncStorage.multiRemove([...SESSION_DATA_KEYS]).catch(() => {});
    router.replace('/');
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Only fetch the netId from storage
        const storedId = await AsyncStorage.getItem('user_netid');
        
        if (!alive) return;
        if (storedId) setNetId(storedId);
        
        // FORCING THE SCRAPE: Always set needsScraping to true on load
        setNeedsScraping(true);

      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={C.brandLight} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // THE SCRAPING BLOCK
  // ─────────────────────────────────────────────────────────────────────────────
  if (needsScraping) {
    return (
      <ProfileScraperView
        onSessionExpired={handleSessionExpired}
        onScrapeComplete={async (data) => {
          await AsyncStorage.setItem('student_profile_data', JSON.stringify(data));
          setProfileData(data);
          setNeedsScraping(false);
        }}
      />
    );
  }

  const displayName = profileData?.name    || 'Student Name';
  const displayReg  = profileData?.registerNumber || '—';
  const avatarUri   = profileData?.imageUrl && !imageError ? profileData.imageUrl : '';
  const avatarInitial = (displayName.trim().charAt(0) || 'S').toUpperCase();
  const displayEmail = netId.includes('@') ? netId : `${netId}@srmist.edu.in`;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={C.gradStart} />

      {/* ── HERO COVER ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[C.gradStart, C.gradMid, C.gradEnd]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={[styles.cover, { height: COVER_H }]}
      >
        <View style={[styles.decorCircle1, { width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, right: -width * 0.15 }]} />
        <View style={[styles.decorCircle2, { width: width * 0.4, height: width * 0.4, borderRadius: width * 0.2 }]} />

        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={[styles.navBar, { paddingHorizontal: hPadding, opacity: 0 }]} pointerEvents="none">
            <View style={styles.navBtn} />
            <Text style={styles.navTitle}>My Profile</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={[styles.heroContent, { paddingTop: heroTopInset }]}>
            <View style={[styles.avatarRingOuter, { width: avatarSize + 16, height: avatarSize + 16, borderRadius: (avatarSize + 16) / 2 }]}>
              <View style={[styles.avatarRingInner, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatar}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <LinearGradient colors={[C.brand, C.brandLight]} style={styles.avatarFallback}>
                    <Text style={[styles.avatarFallbackText, { fontSize: avatarSize * 0.38 }]}>{avatarInitial}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.onlineDot} />
            </View>

            <Text style={[styles.heroName, { fontSize: heroNameFontSize }]} numberOfLines={2}>{displayName}</Text>
            <Text style={styles.heroNetId}>{netId}</Text>

            <View style={styles.regPill}>
              <Ionicons name="id-card-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.regPillText}>{displayReg}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── SCROLLABLE BODY ────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: bodyTopInset, paddingHorizontal: hPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
          
          {/* ── STATS ROW ─────────────────────────────────────────────────── */}
          <ReAnimated.View entering={FadeInDown.delay(80).springify().damping(14).stiffness(100).mass(0.8)} style={[styles.statsCard, { padding: cardPadding }, isVerySmallDevice && styles.statsCardStack]}>
            <StatTile icon="star-outline"     label="Semester" value="Active"  color="#A05C00"     tint="#FEF3E2"       />
            <View style={[styles.statDivider, isVerySmallDevice && styles.statDividerStack]} />
            <StatTile icon="location-outline" label="Campus"   value="Kattankulathur" color={C.success} tint={C.successTint} />
          </ReAnimated.View>

          {/* ── INFO CARD ─────────────────────────────────────────────────── */}
          <ReAnimated.View entering={FadeInDown.delay(140).springify().damping(14).stiffness(100).mass(0.8)} style={[styles.card, { padding: cardPadding }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Student Details</Text>
              <View style={styles.cardBadge}>
                <View style={styles.cardBadgeDot} />
                <Text style={styles.cardBadgeText}>Verified</Text>
              </View>
            </View>

            <InfoRow icon="person-outline" label="Full Name" value={displayName} />
            <InfoRow icon="mail-outline" label="Email / Net ID" value={displayEmail} />
            <InfoRow icon="card-outline" label="Register Number" value={displayReg} />
            <InfoRow icon="business-outline" label="Institution" value="SRM Institute of Science and Technology" isLast />
          </ReAnimated.View>

          {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
          <ReAnimated.View entering={FadeInDown.delay(200).springify().damping(14).stiffness(100).mass(0.8)} style={[styles.card, { padding: cardPadding }]}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={{ gap: 12, marginTop: 18 }}>
              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/attendance')} activeOpacity={0.6}>
                <View style={[styles.actionIcon, { backgroundColor: C.brandTint }]}>
                  <Ionicons name="clipboard-outline" size={20} color={C.brandLight} />
                </View>
                <Text style={styles.actionLabel}>View Attendance</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/marks')} activeOpacity={0.6}>
                <View style={[styles.actionIcon, { backgroundColor: C.successTint }]}>
                  <Ionicons name="document-text-outline" size={20} color={C.success} />
                </View>
                <Text style={styles.actionLabel}>View Marks</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/Timetable')} activeOpacity={0.6}>
                <View style={[styles.actionIcon, { backgroundColor: '#FEF3E2' }]}>
                  <Ionicons name="time-outline" size={20} color="#A05C00" />
                </View>
                <Text style={styles.actionLabel}>View Timetable</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
              </TouchableOpacity>
            </View>
          </ReAnimated.View>

        </View>
      </ScrollView>

      {/* ── HEADER OVERLAY ── */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="box-none">
        <View style={[styles.navBar, { paddingHorizontal: hPadding }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.navTitle} pointerEvents="none">My Profile</Text>
          <View style={{ width: 44 }} pointerEvents="none" />
        </View>
      </SafeAreaView>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: C.bg },
  loadingScreen: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  loadingWaveContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
    zIndex: 10,
  },
  waveDotWrap: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  waveDot:     { width: 14, height: 14, borderRadius: 7 },
  loadingWaveText: { fontSize: 16, fontWeight: '700', color: C.textSecondary, letterSpacing: 0.5 },

  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },

  cover: {
    width: '100%',
    position: 'absolute',
    top: 0,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  decorCircle1: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.03)', top: -50 },
  decorCircle2: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.04)', bottom: -20, left: -40 },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, paddingBottom: 8,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  navTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  heroContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 36, paddingHorizontal: 18 },
  avatarRingOuter: {
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 16,
  },
  avatarRingInner: {
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden', backgroundColor: C.bg,
  },
  avatar:    { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#fff', fontWeight: '900', letterSpacing: -1 },
  onlineDot: {
    position: 'absolute', bottom: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#22C55E',
    borderWidth: 3, borderColor: C.gradMid,
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 8,
  },
  heroName:   { color: '#fff', fontWeight: '900', letterSpacing: -0.5, marginBottom: 4, textAlign: 'center', maxWidth: '88%' },
  heroNetId:  { color: 'rgba(255,255,255,0.72)', fontSize: 15, fontWeight: '600', marginBottom: 14, textAlign: 'center', maxWidth: '88%' },
  regPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, flexWrap: 'wrap', justifyContent: 'center',
  },
  regPillText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  body: { paddingBottom: 40 },
  contentWrapper: { width: '100%', alignSelf: 'center', gap: 18 },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 28,
    padding: 24,
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 6,
  },
  statsCardStack: { flexDirection: 'column' },
  statDivider: { width: 1, height: 50, backgroundColor: C.divider, marginHorizontal: 8 },
  statDividerStack: { width: '100%', height: 1, marginHorizontal: 0, marginVertical: 12 },

  card: {
    backgroundColor: C.surface, borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  cardBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.successTint, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.success + '20',
  },
  cardBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  cardBadgeText:{ fontSize: 11, fontWeight: '800', color: C.success, letterSpacing: 0.5 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.bg, borderRadius: 20, padding: 14, minHeight: 72,
    borderWidth: 1, borderColor: C.border,
  },
  actionIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionLabel:{ flex: 1, fontSize: 15, fontWeight: '700', color: C.textPrimary, lineHeight: 21 },
});
