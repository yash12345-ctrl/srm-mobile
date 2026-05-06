import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
// runOnJS is now imported from react-native-reanimated (correct for v4+)
// react-native-worklets is no longer imported — it conflicts with New Architecture
import { SafeAreaView } from 'react-native-safe-area-context';

// 1. IMPORT YOUR COMPONENTS & SCRAPERS
import FingerprintMenu from '../components/SideMenu';
import SRMAcademicReportScraper from '../components/SRMAcademicReportScraper';
import SRMAttendanceScraper from '../components/SRMAttendanceScraper';
import SRMMarksScraper from '../components/SRMMarksScraper';
import SRMProfileScraper from '../components/SRMProfileScraper';
import SRMTimeTableScraper from '../components/SRMTimeTableScraper';

// 2. UPDATE CHECK
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { CURRENT_VERSION } from '../constants/AppVersion';

const { width } = Dimensions.get('window');

// ─── TIME HELPERS ────────────────────────────────────────────────────────────
// NOTE: TIMES array uses 24-hour format strings (e.g. '13:25' for 1:25 PM).
// toMinutes must NOT apply any AM/PM correction — just parse directly.
const TIMES = ['08:00', '08:50', '09:45', '10:40', '11:35', '12:30', '13:25', '14:20', '15:10', '16:00', '16:50', '17:30'];

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const BATCH1_SCHEDULE = [
  ['A', 'A', 'F', 'F', 'G', 'P6', 'P7', 'P8', 'P9', 'P10', 'L11', 'L12'],
  ['P11', 'P12', 'P13', 'P14', 'P15', 'B', 'B', 'G', 'G', 'A', 'L21', 'L22'],
  ['C', 'C', 'A', 'D', 'B', 'P26', 'P27', 'P28', 'P29', 'P30', 'L31', 'L32'],
  ['P31', 'P32', 'P33', 'P34', 'P35', 'D', 'D', 'B', 'E', 'C', 'L41', 'L42'],
  ['E', 'E', 'C', 'F', 'D', 'P46', 'P47', 'P48', 'P49', 'P50', 'L51', 'L52'],
];

const BATCH2_SCHEDULE = [
  ['P1', 'P2', 'P3', 'P4', 'P5', 'A', 'A', 'F', 'F', 'G', 'L11', 'L12'],
  ['B', 'B', 'G', 'G', 'A', 'P16', 'P17', 'P18', 'P19', 'P20', 'L21', 'L22'],
  ['P21', 'P22', 'P23', 'P24', 'P25', 'C', 'C', 'A', 'D', 'B', 'L31', 'L32'],
  ['D', 'D', 'B', 'E', 'C', 'P36', 'P37', 'P38', 'P39', 'P40', 'L41', 'L42'],
  ['P41', 'P42', 'P43', 'P44', 'P45', 'E', 'E', 'C', 'F', 'D', 'L51', 'L52'],
];

const ATTENDANCE_PUNCHLINES = [
  "Staring at me won't magically fix your attendance percentage.",
  "The only thing more cooked than my hairline is your attendance.",
  "74.2%? One Akka one tea away from a year back.",
  "Your attendance looking redder than Epstein's basement.",
  "Treating TRS like Sunday church won't save your credits.",
  "74.8%… hope your please sir game is stronger than your attendance.",
  "Your seat is finally starting to recognize your face—cute milestone.",
  "At this rate, the security guard's gonna graduate before you do.",
  "Lowk, your attendance is so cooked even a legit medical cert can't save it.",
  "You dodge class like you dodge the Abode guards.",
  "Tere attendance se zyada to maine Abode mein brokerage di hai!",
  "They'll probably hand the degree to your empty seat's CCTV footage first.",
  "74.3%? Bro, you're on life support—one more bunk and they pull the plug.",
  "Your seat has more commitment issues than your situationship.",
  "The only thing lower than your attendance is your standards after 2 shots.",
  "Your attendance is so mid, even mess biryani has better stats.",
  "You dodge lectures harder than girls dodge your 2 AM DMs.",
  "Atp, the projector has more screen time in class than you do.",
  "Year back bharne ke paise hain bhai?",
  "Teri attendance se to compact bhi nahi aayegi."
];

// ─── REFINED DARK-ON-CREAM PALETTE ───────────────────────────────────────────
const COLORS = {
  background:      '#F7F4EF',
  surface:         '#FFFFFF',
  surfaceElevated: '#FEFCF9',
  surfaceTint:     '#F2EDE6',
  textPrimary:     '#12141C',
  textSecondary:   '#5A5E6B',
  textTertiary:    '#9299A8',
  textInverse:     '#FFFFFF',
  brandDark:       '#141B3B',
  brandMid:        '#1E2D6B',
  brandLight:      '#3348B0',
  brandTint:       '#E8ECFB',
  brandSubtle:     '#C4CCEF',
  success:         '#0E7A4A',
  successTint:     '#E5F5EE',
  danger:          '#C0290A',
  dangerTint:      '#FDECEA',
  dangerMid:       '#E84422',
  warning:         '#A05C00',
  warningTint:     '#FEF3E2',
  border:          '#E6E1D6',
  borderStrong:    '#D0C8BB',
  divider:         '#EFEBE3',
  shadow:          '#8A8070',
  overlay:         'rgba(12,16,36,0.65)',
  gradStart:       '#141B3B',
  gradMid:         '#1A2860',
  gradEnd:         '#0F1428',
  trackInactive:   '#C8C2B8',
  trackActive:     '#3348B0',
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CHIP
// ─────────────────────────────────────────────────────────────────────────────
const StatChip = React.memo(({ icon, value, label, accent }: any) => (
  <View style={styles.statChip}>
    <View style={[styles.statChipIcon, { backgroundColor: accent + '28' }]}>
      <Ionicons name={icon} size={14} color={accent} />
    </View>
    <View>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonBlock = React.memo(({ style }: { style?: any }) => {
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.85, { duration: 900 }), -1, true);
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.skeletonBase, style, anim]} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON RAIL NODE
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRailNode = React.memo(({ isFirst, isLast }: any) => (
  <View style={styles.railWrapper}>
    <SkeletonBlock style={{ width: 48, height: 18, borderRadius: 9, marginBottom: 10 }} />
    <View style={styles.trackRow}>
      <View style={styles.trackSeg}>
        {!isFirst && <View style={[styles.trackLine, { backgroundColor: COLORS.trackInactive }]} />}
      </View>
      <View style={[styles.trackDot, { borderColor: COLORS.trackInactive }]}>
        <View style={[styles.trackDotCore, { backgroundColor: COLORS.trackInactive }]} />
      </View>
      <View style={styles.trackSeg}>
        {!isLast && <View style={[styles.trackLine, { backgroundColor: COLORS.trackInactive }]} />}
      </View>
    </View>
    <View style={styles.trackConnector} />
    <SkeletonBlock style={styles.railCard} />
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// RAIL TRACK NODE
// ─────────────────────────────────────────────────────────────────────────────
const RailTrackNode = React.memo(({
  title, subtitle, time, index, isFirst, isLast, status, progress, icon = 'location-sharp'
}: any) => {
  const isPast    = status === 'past';
  const isCurrent = status === 'current';

  const bobY   = useSharedValue(0);
  const trainX = useSharedValue(isCurrent ? progress * 110 : 0);

  useEffect(() => {
    if (isCurrent) {
      bobY.value   = withRepeat(withSequence(withTiming(-5, { duration: 400 }), withTiming(0, { duration: 400 })), -1, true);
      trainX.value = withTiming(progress * 110, { duration: 1000 });
    }
  }, [isCurrent, progress]);

  const trainAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: trainX.value }, { translateY: bobY.value }],
  }));

  const dotColor  = isPast ? COLORS.trackInactive : COLORS.trackActive;
  const lineColor = isPast ? COLORS.trackInactive : COLORS.trackActive;

  return (
    <Animated.View entering={FadeInRight.delay(index * 100).springify()} style={styles.railWrapper}>
      <View style={[styles.timeBadge, isCurrent && styles.timeBadgeActive, isPast && styles.timeBadgePast]}>
        <Text style={[styles.timeBadgeText, isCurrent && styles.timeBadgeTextActive, isPast && styles.timeBadgeTextPast]}>{time}</Text>
      </View>

      <View style={styles.trackRow}>
        <View style={styles.trackSeg}>
          {!isFirst && <View style={[styles.trackLine, { backgroundColor: lineColor }]} />}
        </View>
        <View style={[styles.trackDot, { borderColor: dotColor }]}>
          <View style={[styles.trackDotCore, { backgroundColor: isCurrent ? COLORS.brandLight : dotColor }]} />
        </View>
        <View style={styles.trackSeg}>
          {!isLast && <View style={[styles.trackLine, { backgroundColor: isPast ? COLORS.trackInactive : COLORS.trackActive }]} />}
        </View>

        {isCurrent && (
          <Animated.View entering={FadeInLeft.delay(200).springify().damping(10)} style={styles.trainOuter}>
            <Animated.View style={trainAnim}>
              <LinearGradient colors={[COLORS.danger, COLORS.dangerMid]} style={styles.trainPill}>
                <Ionicons name="train" size={14} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      <View style={[styles.trackConnector, { backgroundColor: dotColor }]} />

      <View style={[styles.railCard, isCurrent && styles.railCardActive, isPast && styles.railCardPast]}>
        {isCurrent && <View style={styles.railCardLive}><Text style={styles.railCardLiveText}>LIVE</Text></View>}
        <Text style={[styles.railTitle, isPast && { color: COLORS.textTertiary }]} numberOfLines={2}>{title}</Text>
        <View style={styles.railMeta}>
          <Ionicons name={icon} size={10} color={isPast ? COLORS.textTertiary : COLORS.brandLight} />
          <Text style={[styles.railSub, isPast && { color: COLORS.textTertiary }]} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL ATTENDANCE CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────
const CriticalAttendanceCarousel = ({ items }: { items: any[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flip = useSharedValue(0);
  const CARD_W = width - 48;

  const go = (dir: 1 | -1) => {
    const next = currentIndex + dir;
    if (next < 0 || next >= items.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flip.value = withTiming(dir * -90, { duration: 180 }, () => {
      const updateIndex = (idx: number) => { setCurrentIndex(idx); };
      updateIndex(next); // NOSONAR
      flip.value = dir * 90;
      flip.value = withTiming(0, { duration: 180 });
    });
  };

  const flipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { translateX: -(CARD_W / 2) },
      { rotateY: `${flip.value}deg` },
      { translateX: CARD_W / 2 },
    ],
    opacity: interpolate(flip.value, [-90, 0, 90], [0.4, 1, 0.4], Extrapolation.CLAMP),
  }));

  const item = items[currentIndex];
  const val  = Number.parseFloat(item.attendance);
  const pct  = Math.min(val, 100);
  const gap  = 75 - val;
  const punchline = ATTENDANCE_PUNCHLINES[currentIndex % ATTENDANCE_PUNCHLINES.length];
  const compactAttendance = Number.isFinite(val) ? val.toFixed(1) : '0.0';
  const attendanceLabel = `${compactAttendance}%`;

  return (
    <Animated.View style={[styles.critCard, flipStyle]}>
      <LinearGradient colors={[COLORS.danger, COLORS.dangerMid]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.critStrip} />
      <View style={styles.critBody}>
        <View style={styles.critHeaderRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={styles.critBadge}>
              <Ionicons name="warning" size={10} color={COLORS.danger} />
              <Text style={styles.critBadgeText}>ACTION REQUIRED</Text>
            </View>
            <Text style={styles.critSubjectName} numberOfLines={2}>{item.subject}</Text>
          </View>
          <View style={styles.critCircle}>
            <View style={styles.critCircleValueRow}>
              <Text style={styles.critCirclePct}>{compactAttendance}</Text>
              <Text style={styles.critCirclePctSymbol}>%</Text>
            </View>
            <Text style={styles.critCircleLabel}>att.</Text>
          </View>
        </View>
        <View style={styles.critQuoteBox}>
          <Text style={styles.critQuoteMark}>"</Text>
          <Text style={styles.critQuoteText}>{punchline}</Text>
        </View>
        <View style={styles.critProgressSection}>
          <View style={styles.critBarTrack}>
            <LinearGradient colors={[COLORS.danger, '#FF6B4A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.critBarFill, { width: `${pct}%` }]} />
            <View style={styles.critMarker} />
          </View>
          <View style={styles.critBarLabels}>
            <Text style={styles.critBarPct}>{attendanceLabel}</Text>
            <Text style={styles.critBarTarget}>▲ 75% required</Text>
            <Text style={styles.critBarGap}>Need +{gap > 0 ? gap.toFixed(1) : '0'}%</Text>
          </View>
        </View>
        {items.length > 1 && (
          <View style={styles.critPagination}>
            <TouchableOpacity onPress={() => go(-1)} disabled={currentIndex === 0} style={styles.critPageBtn}>
              <Ionicons name="chevron-back" size={14} color={currentIndex === 0 ? COLORS.trackInactive : COLORS.danger} />
            </TouchableOpacity>
            <View style={styles.critDots}>
              {items.map((it, i) => <View key={`${it.subject}-${i}`} style={[styles.critDot, i === currentIndex && styles.critDotActive]} />)}
            </View>
            <TouchableOpacity onPress={() => go(1)} disabled={currentIndex === items.length - 1} style={styles.critPageBtn}>
              <Ionicons name="chevron-forward" size={14} color={currentIndex === items.length - 1 ? COLORS.trackInactive : COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTION BUTTON
// ─────────────────────────────────────────────────────────────────────────────
const QuickAction = React.memo(({ icon, label, color, tint, onPress }: any) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.quickActionIcon, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function getCourseForSlot(courses: any[], slot: string) {
  return courses.find((c: any) => {
    if (!c.slot || c.slot === 'TBD') return false;
    const scrapedSlots = c.slot.replaceAll(/[^a-zA-Z0-9]/g, ' ').split(/\s+/);
    return scrapedSlots.some((s: string) => s === slot || (slot.length === 1 && s.startsWith(slot)));
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [data, setData]               = useState<{ attendance: any[], marks: any[] } | null>(null);
  const [timetable, setTimetable]     = useState<any>(null);
  const [calendar, setCalendar]       = useState<any>(null);
  const [profileData, setProfileData] = useState<{ name: string, registerNumber: string, imageUrl: string } | null>(null);
  const [netId, setNetId]             = useState('User');
  const [refreshing, setRefreshing]   = useState(false);
  const [tick, setTick]               = useState(0);

  // ── Update check (production-safe, throttled, GitHub-based) ─────────────
  const {
    showUpdateModal,
    availableVersion,
    changelog: updateChangelog,
    forceUpdate,
    openStoreListing,
    dismissUpdate,
  } = useUpdateCheck();

  const [isMenuOpen, setIsMenuOpen]   = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const hasHandledSessionExpired = useRef(false);

  // ── FIX: scrapers only mount after dashboard is visible ──────────────────
  const [dashboardReady, setDashboardReady] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Load cached data first, show dashboard immediately,
    // then allow scrapers to start after 800ms
    loadSession().then(() => {
      setTimeout(() => setDashboardReady(true), 800);
    });
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentAppVersion = CURRENT_VERSION;

  const loadSession = useCallback(async () => {
    try {
      const [storedId, storedData, storedTimetable, storedCalendar, storedProfile] = await Promise.all([
        AsyncStorage.getItem('user_netid'),
        AsyncStorage.getItem('academic_data'),
        AsyncStorage.getItem('timetable_data'),
        AsyncStorage.getItem('academic_calendar_data'),
        AsyncStorage.getItem('student_profile_data'),
      ]);
      if (storedId)        setNetId(storedId);
      if (storedTimetable) setTimetable(JSON.parse(storedTimetable));
      if (storedCalendar)  setCalendar(JSON.parse(storedCalendar));
      if (storedData)      setData(JSON.parse(storedData));
      if (storedProfile)   setProfileData(JSON.parse(storedProfile));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(loadSession, 1000);
  }, [loadSession]);

  const mergeAcademicData = useCallback((partial: { attendance?: any[]; marks?: any[] }) => {
    setData(prev => {
      const next = {
        attendance: partial.attendance ?? prev?.attendance ?? [],
        marks: partial.marks ?? prev?.marks ?? [],
      };
      AsyncStorage.setItem('academic_data', JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const handleTimetableScrapeComplete = useCallback((scrapedTimetable: any) => {
    setTimetable(scrapedTimetable);
  }, []);

  const handleCalendarScrapeComplete = useCallback((scrapedCalendar: any) => {
    setCalendar(scrapedCalendar);
  }, []);

  const handleAttendanceScrapeComplete = useCallback((attendanceData: any[]) => {
    mergeAcademicData({ attendance: attendanceData });
  }, [mergeAcademicData]);

  const handleMarksScrapeComplete = useCallback((marksData: any[]) => {
    mergeAcademicData({ marks: marksData });
  }, [mergeAcademicData]);

  const handleProfileScrapeComplete = useCallback((scrapedProfile: any) => {
    setProfileData(scrapedProfile);
  }, []);

  const currentDateTime = useMemo(() => new Date(), [tick]);

  const greeting = useMemo(() => {
    const hour = currentDateTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  }, [currentDateTime]);

  const avgAtt = useMemo(() => {
    if (!data?.attendance.length) return '—';
    const total = data.attendance.reduce((s, i) => s + (Number.parseFloat(i.attendance) || 0), 0);
    return (total / data.attendance.length).toFixed(1);
  }, [data]);

  const criticalAttendance = useMemo(() =>
    data?.attendance.filter(i => Number.parseFloat(i.attendance) < 75) ?? [], [data]);

  const todayInfo = useMemo(() => {
    if (!calendar) return { dayOrderNum: null, eventName: null };
    const today = new Date();
    const todayDateStr       = today.getDate().toString();
    const currentMonthShort  = today.toLocaleString('en-US', { month: 'short' });
    const currentMonthLong   = today.toLocaleString('en-US', { month: 'long' });
    const mIndex = calendar.monthNames.findIndex((m: string) =>
      m.includes(currentMonthShort) || m.includes(currentMonthLong)
    );
    if (mIndex === -1) return { dayOrderNum: null, eventName: null };
    const dayData = calendar.monthsData[mIndex]?.find((d: any) => d.date === todayDateStr);
    if (!dayData) return { dayOrderNum: null, eventName: null };
    const dayOrderNum = dayData.dayOrder?.includes('DO -')
      ? Number.parseInt(dayData.dayOrder.replace('DO - ', '').trim(), 10)
      : null;
    return { dayOrderNum, eventName: dayData.event };
  }, [calendar]);

  const displayDayOrder = todayInfo.dayOrderNum;

  const todaysClasses = useMemo(() => {
    if (!timetable?.courses || !displayDayOrder) return [];
    const activeDayIndex = displayDayOrder - 1;
    if (activeDayIndex < 0 || activeDayIndex > 4) return [];
    const schedule   = timetable.batch === 2 ? BATCH2_SCHEDULE : BATCH1_SCHEDULE;
    const daySlots   = schedule[activeDayIndex];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const allClasses = daySlots.map((slot: string, index: number) => {
      const course = getCourseForSlot(timetable.courses, slot);
      if (course) return { time: TIMES[index], title: course.title, room: course.room, icon: 'location-sharp' };
      return null;
    }).filter(Boolean);

    let foundCurrent = false;
    const withStatus = allClasses.map((cls: any, idx: number, arr: any[]) => {
      const startMins = toMinutes(cls.time);
      // Each slot is 50 min; the next slot's start time is the end of this one
      const nextMins  = idx < arr.length - 1 ? toMinutes(arr[idx + 1].time) : startMins + 50;
      let status = 'future', progress = 0;
      if (nowMinutes >= nextMins) {
        // This slot has fully ended
        status = 'past'; progress = 1;
      } else if (nowMinutes >= startMins) {
        // Currently in this slot
        status = 'current';
        progress = (nowMinutes - startMins) / (nextMins - startMins);
        foundCurrent = true;
      }
      return { ...cls, status, progress };
    });

    // ── Add a terminal "Classes End" node ───────────────────────────────────
    if (withStatus.length > 0) {
      const last = withStatus.at(-1)!;
      const endMins = toMinutes(last.time) + 50;
      // Build the end time string in 24-hour format (toMinutes reads it directly)
      const endH = Math.floor(endMins / 60);
      const endM = endMins % 60;
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      // Mark as past if the day's last class has ended
      const dayDone = nowMinutes >= endMins;
      withStatus.push({
        time: endStr,
        title: 'Classes End',
        room: 'Enjoy your day!',
        status: dayDone ? 'past' : 'future',
        progress: 0,
        icon: 'happy-outline',
      });
      // If all classes are finished and nothing was current, mark the whole day done
      if (dayDone) foundCurrent = true; // suppress the fallback below
    }

    // ── Fallback: nothing is 'current' yet (before first class starts) ───────
    // ONLY fire when classes haven't started yet — NOT when they've all finished.
    if (!foundCurrent && withStatus.length > 0) {
      // All classes are in the future → first class is 'next up' (show as current with 0 progress)
      if (nowMinutes < toMinutes(withStatus[0].time)) {
        withStatus[0] = { ...withStatus[0], status: 'current', progress: 0 };
      }
      // If none of the above matched, every class was already past — do nothing;
      // leave every node as 'past' so the day correctly appears complete.
    }

    return withStatus;
  }, [timetable, displayDayOrder]);

  const handleLogoutClick = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLogoutModal(false);
    // ✅ Bug 1 Fix: reset the guard so session-expiry modal can fire again
    // if the user logs back in within the same app lifecycle
    hasHandledSessionExpired.current = false;
    AsyncStorage.clear().then(() => router.replace('/'));
  }, [router]);

  const cancelLogout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLogoutModal(false);
  }, []);

  // Keys that hold scraped academic data — cleared on session expiry so
  // the user sees fresh data after re-login (user_netid is kept so the
  // login screen can pre-fill / greet the user).
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
    setShowSessionAlert(true);
    // ✅ Design Issue 4 Fix: only wipe data keys, keep user_netid so login
    // screen can show who was previously logged in
    AsyncStorage.multiRemove([...SESSION_DATA_KEYS]).catch(() => {});
  }, []);

  const confirmSessionLogOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSessionAlert(false);
    hasHandledSessionExpired.current = false;
    router.replace('/');
  }, [router]);

  const firstName = useMemo(() => {
    const full = profileData?.name || netId;
    return full.split(' ')[0];
  }, [profileData, netId]);

  const headerDate = useMemo(() => currentDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }), [currentDateTime]);

  const headerTime = useMemo(() => currentDateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }), [currentDateTime]);

  // ── Render helpers (extracted to avoid nested ternaries in JSX) ────────────
  const renderPerformanceStats = () => {
    if (!data) {
      return <SkeletonBlock style={{ width: 110, height: 52, borderRadius: 8, marginTop: 4 }} />;
    }
    return (
      <View style={styles.heroStatRow}>
        <Text style={styles.heroStatBig}>{avgAtt}</Text>
        <Text style={styles.heroStatUnit}>%</Text>
        <View style={styles.heroStatMeta}>
          <Text style={styles.heroStatMetaText}>Overall</Text>
          <Text style={styles.heroStatMetaText}>Average</Text>
        </View>
      </View>
    );
  };

  const renderDayBadge = () => {
    if (loading || !calendar || !timetable) {
      return <SkeletonBlock style={{ width: 54, height: 22, borderRadius: 6, marginLeft: 8 }} />;
    }
    if (displayDayOrder) {
      return <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>Day {displayDayOrder}</Text></View>;
    }
    return null;
  };

  const renderClassesList = () => {
    if (loading || !timetable || !calendar) {
      return <><SkeletonRailNode isFirst /><SkeletonRailNode /><SkeletonRailNode isLast /></>;
    }
    if (todaysClasses.length > 0) {
      return todaysClasses.map((cls, i) => (
        <RailTrackNode key={`${cls.title}-${i}`} title={cls.title} subtitle={cls.room} time={cls.time} status={cls.status} progress={cls.progress} icon={cls.icon} index={i} isFirst={i === 0} isLast={i === todaysClasses.length - 1} />
      ));
    }
    return (
      <View style={styles.emptyTrack}>
        <Ionicons name={todayInfo.eventName?.toLowerCase().includes('holiday') ? 'sunny-outline' : 'calendar-clear-outline'} size={22} color={COLORS.textTertiary} />
        <Text style={styles.emptyTrackText}>{todayInfo.eventName ?? 'No classes scheduled today'}</Text>
      </View>
    );
  };

  const renderCriticalAttendance = () => {
    if (!data) {
      return <SkeletonBlock style={{ height: 170, borderRadius: 20, marginHorizontal: 24 }} />;
    }
    if (criticalAttendance.length > 0) {
      return <View style={{ paddingHorizontal: 24 }}><CriticalAttendanceCarousel items={criticalAttendance} /></View>;
    }
    return (
      <Animated.View entering={FadeInDown.springify()} style={styles.safeState}>
        <View style={styles.safeStateIcon}><Ionicons name="shield-checkmark" size={28} color={COLORS.success} /></View>
        <View>
          <Text style={styles.safeStateTitle}>All Clear!</Text>
          <Text style={styles.safeStateSub}>Every subject is above 75%</Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* ─── FORCE / SOFT UPDATE MODAL ──────────────────────────────── */}
      <Modal
        transparent
        visible={showUpdateModal}
        animationType="fade"
        onRequestClose={forceUpdate ? undefined : dismissUpdate}
        statusBarTranslucent
      >
        <View style={styles.updateOverlay}>
          <Animated.View entering={FadeInDown.duration(400).springify().damping(16)} style={styles.updateCard}>
            <LinearGradient colors={[COLORS.brandTint, COLORS.surface]} style={styles.updateCardTopGrad} />

            <View style={styles.updateIconRing}>
              <Ionicons name="rocket" size={32} color={COLORS.brandLight} />
            </View>

            <Text style={styles.updateVersion}>
              {availableVersion ? `v${availableVersion} AVAILABLE` : 'UPDATE AVAILABLE'}
            </Text>
            <Text style={styles.updateTitle}>
              {forceUpdate ? 'Required Update' : 'New Update Available'}
            </Text>

            <Text style={styles.updateSub}>
              {!availableVersion && 'A newer build is available on Google Play.'}
              {availableVersion && `You're on v${currentAppVersion}. v${availableVersion} is now live on Google Play.`}
              {availableVersion && forceUpdate && ' Please update to continue using the app.'}
            </Text>

            {/* Changelog items (dynamic from version.json) */}
            {updateChangelog.length > 0 && (
              <View style={styles.updateFeaturesWrap}>
                {updateChangelog.slice(0, 3).map((item, idx) => {
                  const icons: Array<'flash' | 'bug' | 'color-palette'> = ['flash', 'bug', 'color-palette'];
                  const tints = [COLORS.warningTint, COLORS.dangerTint, COLORS.brandTint];
                  const colors = [COLORS.warning, COLORS.danger, COLORS.brandLight];
                  return (
                    <View key={item} style={styles.updateFeatureItem}>
                      <View style={[styles.updateFeatureIconWrap, { backgroundColor: tints[idx % 3] }]}>
                        <Ionicons name={icons[idx % 3]} size={16} color={colors[idx % 3]} />
                      </View>
                      <View style={styles.updateFeatureTextWrap}>
                        <Text style={styles.updateFeatureDesc}>{item}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.updateBtn}
              onPress={openStoreListing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.brandDark, COLORS.brandMid]}
                style={styles.updateBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.updateBtnText}>Update Now</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 6, marginTop: 1 }} />
              </LinearGradient>
            </TouchableOpacity>

            {/* Only show dismiss option for non-forced updates */}
            {!forceUpdate && (
              <TouchableOpacity
                onPress={dismissUpdate}
                activeOpacity={0.7}
                style={styles.updateSkipBtn}
              >
                <Text style={styles.updateSkipText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 176 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandLight} colors={[COLORS.brandLight]} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
        >
        {/* ─── HEADER ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(350).springify()} style={styles.headerWrap}>
          <LinearGradient
            colors={['rgba(255,255,255,0.96)', 'rgba(254,252,249,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerTopRow}>
              <View style={styles.headerBadge}>
                <View style={styles.headerBadgeDot} />
                <Text style={styles.headerBadgeText}>Student Dashboard</Text>
              </View>
              <View style={styles.headerDateGroup}>
                <Text style={styles.headerDate}>{headerDate}</Text>
                <Text style={styles.headerTime}>{headerTime}</Text>
              </View>
            </View>

            <View style={styles.headerIdentityRow}>
              <View style={styles.headerAvatarWrap}>
                <LinearGradient colors={[COLORS.brandDark, COLORS.brandLight]} style={styles.headerAvatarFallback}>
                  <Ionicons name="person" size={28} color={COLORS.textInverse} />
                </LinearGradient>
              </View>

              <View style={styles.headerTextBlock}>
                <Text style={styles.greetText}>{greeting}</Text>
                <Text style={styles.userName} numberOfLines={1}>{firstName}</Text>
              </View>
            </View>

            <View style={styles.headerBottomRow}>
              <View style={styles.headerMetaGroup}>
                {profileData?.registerNumber && (
                  <View style={styles.regPill}>
                    <View style={styles.regPillDot} />
                    <Text style={styles.regPillText}>{profileData.registerNumber}</Text>
                  </View>
                )}
                <View style={styles.headerSyncPill}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
                  <Text style={styles.headerMetaText}>Academia synced</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/profile')}>
                  <Ionicons name="person-outline" size={19} color={COLORS.brandMid} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={handleLogoutClick}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.danger} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ─── SCROLLABLE CONTENT ──────────────────────────────── */}

          {/* HERO PERFORMANCE CARD */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.heroWrapper}>
            <LinearGradient colors={[COLORS.gradStart, COLORS.gradMid, COLORS.gradEnd]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.heroCard}>
              <View style={styles.heroDecorCircle1} />
              <View style={styles.heroDecorCircle2} />
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroEyebrow}>ACADEMIC PERFORMANCE</Text>
                  {renderPerformanceStats()}
                </View>
                <TouchableOpacity style={styles.heroMoreBtn} onPress={() => router.push('/attendance')}>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.textInverse} />
                </TouchableOpacity>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroChipsRow}>
                <StatChip icon="library-outline" value={data?.attendance.length || '—'} label="Subjects" accent="#A8B8FF" />
                <View style={styles.heroChipDivider} />
                <StatChip icon="shield-checkmark-outline" value={data ? `${(data.attendance.length ?? 0) - criticalAttendance.length}` : '—'} label="Safe" accent="#6DEBBF" />
                <View style={styles.heroChipDivider} />
                <StatChip icon="alert-circle-outline" value={data ? criticalAttendance.length : '—'} label="Alerts" accent="#FFAB7B" />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* QUICK ACTIONS */}
          <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.quickActionsRow}>
            <QuickAction icon="clipboard-outline" label="Attendance" color={COLORS.brandLight} tint={COLORS.brandTint} onPress={() => router.push('/attendance')} />
            <QuickAction icon="document-text-outline" label="Marks" color={COLORS.success} tint={COLORS.successTint} onPress={() => router.push('/marks')} />
            <QuickAction icon="calendar-outline" label="Timetable" color={COLORS.warning} tint={COLORS.warningTint} onPress={() => router.push('/Timetable')} />
            <QuickAction icon="person-outline" label="Profile" color={COLORS.textSecondary} tint={COLORS.divider} onPress={() => router.push('/profile')} />
          </Animated.View>

          {/* TODAY'S ROUTE */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.sectionWrapper}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadLeft}>
                  <View style={styles.sectionIcon}><Ionicons name="navigate-outline" size={16} color={COLORS.brandLight} /></View>
                  <Text style={styles.sectionTitle}>Today's Route</Text>
                  {renderDayBadge()}
                </View>
                <TouchableOpacity onPress={() => router.push('/Timetable')} style={styles.seeAllBtn}>
                  <Text style={styles.seeAllText}>Full →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}>
                {renderClassesList()}
              </ScrollView>
            </View>
          </Animated.View>

          {/* CRITICAL ATTENDANCE */}
          <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.sectionWrapper}>
            <View style={styles.sectionHead2}>
              <View style={styles.sectionHeadLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: COLORS.dangerTint }]}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
                </View>
                <Text style={styles.sectionTitle}>Critical Attendance</Text>
                {criticalAttendance.length > 0 && (
                  <View style={[styles.dayBadge, { backgroundColor: COLORS.dangerTint, borderColor: COLORS.danger + '30' }]}>
                    <Text style={[styles.dayBadgeText, { color: COLORS.danger }]}>{criticalAttendance.length}</Text>
                  </View>
                )}
              </View>
            </View>
            {renderCriticalAttendance()}
          </Animated.View>

          {/* FEATURE BANNER */}
          <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.bannerOuter}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop' }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
            <LinearGradient colors={['transparent', 'rgba(20,27,59,0.92)']} style={styles.bannerGrad}>
              <View>
                <View style={styles.bannerPill}><Text style={styles.bannerPillText}>NEW</Text></View>
                <Text style={styles.bannerTitle}>Study Groups</Text>
                <Text style={styles.bannerSub}>Connect with peers for finals.</Text>
              </View>
              <TouchableOpacity style={styles.bannerCTA} activeOpacity={0.85}>
                <Text style={styles.bannerCTAText}>Explore</Text>
                <Ionicons name="arrow-forward" size={14} color={COLORS.brandMid} />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </ScrollView>

        {/* ─── BOTTOM NAV ────────────────────────────────────── */}
        {!isMenuOpen && (
          <View style={styles.navOuter}>
            <View style={styles.navBar}>
              <TouchableOpacity style={styles.navItem}>
                <View style={styles.navActiveIndicator} />
                <Ionicons name="grid" size={22} color={COLORS.brandMid} />
                <Text style={styles.navLabelActive}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navItem} onPress={() => router.push('/attendance')}>
                <Ionicons name="clipboard-outline" size={22} color={COLORS.textTertiary} />
                <Text style={styles.navLabel}>Attend.</Text>
              </TouchableOpacity>
              <View style={{ width: 60 }} />
              <TouchableOpacity style={styles.navItem} onPress={() => router.push('/marks')}>
                <Ionicons name="document-text-outline" size={22} color={COLORS.textTertiary} />
                <Text style={styles.navLabel}>Marks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
                <Ionicons name="person-outline" size={22} color={COLORS.textTertiary} />
                <Text style={styles.navLabel}>Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── FLOATING MENU ───────────────────────────────────────── */}
        <FingerprintMenu onClose={() => setIsMenuOpen(false)} onScanStart={() => setIsMenuOpen(true)} />

        {/* ─── FIX: SCRAPERS ONLY START AFTER DASHBOARD IS VISIBLE ──── */}
        {dashboardReady && (
          <>
            <SRMTimeTableScraper
              backgroundMode
              onScrapeComplete={handleTimetableScrapeComplete}
              onSessionExpired={handleSessionExpired}
            />
            <SRMAcademicReportScraper
              backgroundMode
              onScrapeComplete={handleCalendarScrapeComplete}
            />
            <SRMAttendanceScraper
              backgroundMode
              onScrapeComplete={handleAttendanceScrapeComplete}
              onSessionExpired={handleSessionExpired}
            />
            <SRMMarksScraper
              backgroundMode
              onScrapeComplete={handleMarksScrapeComplete}
              onSessionExpired={handleSessionExpired}
            />
            <SRMProfileScraper
              backgroundMode
              showInternalAlert={false}
              skipScrapeIfFresh
              onScrapeComplete={handleProfileScrapeComplete}
              onSessionExpired={handleSessionExpired}
            />
          </>
        )}
        {/* ─────────────────────────────────────────────────────────── */}

      </SafeAreaView>

      {/* ─── CUSTOM LOGOUT MODAL ────────────────────────────────────────── */}
      {/* ✅ Design Issue 3 Fix: both custom modals now live outside SafeAreaView  */}
      {/* at the same JSX depth, guaranteeing consistent overlay behaviour.        */}
      {showLogoutModal && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.modalOverlay}>
          <View style={styles.modalBackdrop} />
          <Animated.View entering={FadeInDown.duration(300).springify().damping(16)} style={styles.modalCard}>
            <View style={styles.modalIconRing}>
              <Ionicons name="log-out" size={28} color={COLORS.danger} style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalSub}>Are you sure you want to disconnect your account?</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={cancelLogout}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={confirmLogout} activeOpacity={0.8}>
                <Text style={styles.modalBtnConfirmText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* ─── SESSION EXPIRED MODAL ─────────────────────────────────────── */}
      {showSessionAlert && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.modalOverlay}>
          <View style={styles.modalBackdrop} />
          <Animated.View entering={FadeInDown.duration(300).springify().damping(16)} style={styles.modalCard}>
            <View style={[styles.modalIconRing, { backgroundColor: COLORS.warningTint }]}>
              <Ionicons name="lock-closed-outline" size={28} color={COLORS.warning} />
            </View>
            <Text style={styles.modalTitle}>Session Expired</Text>
            <Text style={styles.modalSub}>You have been logged out because your portal was opened on another device.</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={confirmSessionLogOut} activeOpacity={0.8}>
                <Text style={styles.modalBtnConfirmText}>Log In Again</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  skeletonBase:{ backgroundColor: COLORS.divider },

  // ── CUSTOM MODALS (LOGOUT & SESSION)
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    width: width * 0.85,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.dangerTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceTint,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.brandMid,
    alignItems: 'center',
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textInverse,
  },

  // ── HEADER
  headerWrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14 },
  header: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(208,200,187,0.8)',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.surfaceTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.brandLight,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandMid,
    letterSpacing: 0.4,
  },
  headerDateGroup: {
    alignItems: 'flex-end',
  },
  headerDate: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTertiary,
  },
  headerTime: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerMetaGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingRight: 10,
  },
  headerAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    padding: 2.5,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12.5,
  },
  headerAvatarFallback: {
    flex: 1,
    borderRadius: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textInverse,
    letterSpacing: -0.6,
  },
  headerTextBlock: {
    flex: 1,
    marginLeft: 12,
  },
  greetText:  { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  userName:   { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.8 },
  headerMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  headerSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.successTint,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBEAD9',
  },
  regPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandTint, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.brandSubtle,
  },
  regPillDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.brandLight },
  regPillText: { fontSize: 10, fontWeight: '700', color: COLORS.brandMid, letterSpacing: 0.3 },

  headerActions:   { flexDirection: 'row', gap: 10, alignItems: 'center', flexShrink: 0 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  iconBtnDanger: { borderColor: '#FFD5CE', backgroundColor: '#FFF8F6' },

  // ── HERO CARD
  heroWrapper: { paddingHorizontal: 24, marginBottom: 22 },
  heroCard: {
    borderRadius: 28, padding: 24, overflow: 'hidden', minHeight: 195,
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 12,
  },
  heroDecorCircle1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)', top: -60, right: -40,
  },
  heroDecorCircle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.03)', bottom: -20, left: 20,
  },
  heroTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroEyebrow:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 8 },
  heroStatRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  heroStatBig:   { fontSize: 52, fontWeight: '900', color: COLORS.textInverse, letterSpacing: -2, lineHeight: 56 },
  heroStatUnit:  { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  heroStatMeta:  { marginBottom: 6, marginLeft: 4 },
  heroStatMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  heroMoreBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  heroChipsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
  },
  heroChipDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)' },
  statChip:        { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  statChipIcon:    { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  statChipValue:   { fontSize: 14, fontWeight: '800', color: COLORS.textInverse },
  statChipLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  // ── QUICK ACTIONS
  quickActionsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 24, marginBottom: 24,
  },
  quickAction:     { alignItems: 'center', gap: 8 },
  quickActionIcon: {
    width: 56, height: 56, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  quickActionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  // ── SECTION WRAPPERS
  sectionWrapper: { marginBottom: 20 },
  sectionCard: {
    marginHorizontal: 24, backgroundColor: COLORS.surface,
    borderRadius: 24, paddingTop: 20, paddingBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    overflow: 'hidden',
  },
  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 18 },
  sectionHead2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 14 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: COLORS.brandTint,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  dayBadge: {
    backgroundColor: COLORS.brandTint, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.brandSubtle,
  },
  dayBadgeText: { color: COLORS.brandMid, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  seeAllBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  seeAllText: { color: COLORS.brandLight, fontSize: 13, fontWeight: '700' },

  // ── EMPTY TRACK
  emptyTrack: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.surfaceTint, borderRadius: 14, marginHorizontal: 20,
  },
  emptyTrackText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13 },

  // ── RAIL TRACK NODES
  railWrapper:   { width: 120, alignItems: 'center' },
  timeBadge: {
    backgroundColor: COLORS.brandTint, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: COLORS.brandSubtle,
  },
  timeBadgeActive: { backgroundColor: COLORS.brandLight, borderColor: COLORS.brandMid },
  timeBadgePast:   { backgroundColor: COLORS.surfaceTint, borderColor: COLORS.border },
  timeBadgeText:     { fontSize: 10, fontWeight: '800', color: COLORS.brandMid },
  timeBadgeTextActive: { color: COLORS.textInverse },
  timeBadgeTextPast:   { color: COLORS.textTertiary },

  trackRow:    { flexDirection: 'row', alignItems: 'center', width: '100%', height: 40, position: 'relative', justifyContent: 'center' },
  trackSeg:    { flex: 1, height: '100%', justifyContent: 'center' },
  trackLine:   { width: '100%', height: 3, borderRadius: 2 },
  trackDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.surface,
    borderWidth: 3, borderColor: COLORS.trackActive,
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  trackDotCore: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.brandDark },
  trackConnector: { width: 2.5, height: 12, backgroundColor: COLORS.trackActive },

  trainOuter: { position: 'absolute', left: '50%', marginLeft: -18, top: -26, zIndex: 10 },
  trainPill: {
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 8,
  },

  railCard: {
    backgroundColor: COLORS.surfaceElevated, width: 108, padding: 10,
    borderRadius: 14, borderTopWidth: 3, borderTopColor: COLORS.trackInactive,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  railCardActive: { borderTopColor: COLORS.brandLight, borderColor: COLORS.brandSubtle, backgroundColor: COLORS.surface },
  railCardPast:   { opacity: 0.65 },
  railCardLive: {
    backgroundColor: COLORS.danger, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginBottom: 4,
  },
  railCardLiveText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  railTitle:   { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 5, lineHeight: 15 },
  railMeta:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  railSub:     { fontSize: 9, color: COLORS.textSecondary, fontWeight: '600' },

  // ── CRITICAL CARD
  critCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.danger + '25',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
  },
  critStrip: { width: 6 },
  critBody:  { flex: 1, padding: 18 },
  critHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  critBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.dangerTint, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6,
  },
  critBadgeText:    { fontSize: 9, fontWeight: '800', color: COLORS.danger, letterSpacing: 1 },
  critSubjectName:  { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 20 },
  critCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.dangerTint,
    borderWidth: 2.5, borderColor: COLORS.danger + '40',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  critCircleValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  critCirclePct:   { fontSize: 16, fontWeight: '900', color: COLORS.danger, lineHeight: 18 },
  critCirclePctSymbol: { fontSize: 10, fontWeight: '900', color: COLORS.danger, marginLeft: 1, marginTop: 2 },
  critCircleLabel: { fontSize: 8, fontWeight: '700', color: COLORS.danger, opacity: 0.7, marginTop: 1 },

  critQuoteBox: {
    backgroundColor: COLORS.dangerTint, borderRadius: 12, padding: 12,
    marginBottom: 14, flexDirection: 'row', gap: 4,
    borderWidth: 1, borderColor: COLORS.danger + '20',
  },
  critQuoteMark: { fontSize: 22, fontWeight: '900', color: COLORS.danger, opacity: 0.4, lineHeight: 22, marginTop: -4 },
  critQuoteText: { flex: 1, fontSize: 12, fontWeight: '500', color: COLORS.danger, fontStyle: 'italic', lineHeight: 17 },

  critProgressSection: { marginBottom: 12 },
  critBarTrack:  { height: 8, backgroundColor: COLORS.divider, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  critBarFill:   { height: '100%', borderRadius: 4 },
  critMarker: {
    position: 'absolute', left: '75%', width: 2.5, height: 14,
    backgroundColor: COLORS.textPrimary, top: -3, borderRadius: 1.5,
  },
  critBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  critBarPct:    { fontSize: 10, fontWeight: '800', color: COLORS.danger },
  critBarTarget: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  critBarGap:    { fontSize: 10, fontWeight: '700', color: COLORS.warning },

  critPagination: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.divider, paddingTop: 10,
  },
  critPageBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.dangerTint, justifyContent: 'center', alignItems: 'center',
  },
  critDots:    { flexDirection: 'row', gap: 5 },
  critDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.trackInactive },
  critDotActive:{ backgroundColor: COLORS.danger, width: 14 },

  // ── SAFE STATE
  safeState: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 24,
    backgroundColor: COLORS.successTint, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.success + '30',
  },
  safeStateIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#C6F0DD', justifyContent: 'center', alignItems: 'center',
  },
  safeStateTitle: { fontSize: 16, fontWeight: '800', color: COLORS.success, marginBottom: 2 },
  safeStateSub:   { fontSize: 12, fontWeight: '600', color: COLORS.success, opacity: 0.75 },

  // ── BANNER
  bannerOuter: {
    height: 140, marginHorizontal: 24, borderRadius: 24, overflow: 'hidden',
    marginBottom: 12,
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5,
  },
  bannerGrad: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 18,
  },
  bannerPill: {
    backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6,
  },
  bannerPillText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  bannerTitle:   { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  bannerSub:     { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  bannerCTA: {
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  bannerCTAText: { fontSize: 12, fontWeight: '800', color: COLORS.brandMid },

  // ── BOTTOM NAV
  navOuter: {
    position: 'absolute', bottom: 20, width: '100%',
    alignItems: 'center', zIndex: 20,
  },
  navBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    width: width - 48, borderRadius: 28,
    paddingVertical: 10, paddingHorizontal: 20,
    justifyContent: 'space-between', alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  navItem: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, position: 'relative' },
  navActiveIndicator: {
    position: 'absolute', top: 0, width: 20, height: 3,
    backgroundColor: COLORS.brandLight, borderRadius: 2,
  },
  navLabel:       { fontSize: 9, fontWeight: '700', color: COLORS.textTertiary, marginTop: 3 },
  navLabelActive: { fontSize: 9, fontWeight: '800', color: COLORS.brandMid, marginTop: 3 },

  // ── UPDATE MODAL
  updateOverlay: {
    flex: 1, backgroundColor: 'rgba(8,10,20,0.85)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  updateCard: {
    backgroundColor: COLORS.surface, width: '100%', borderRadius: 32,
    padding: 24, paddingBottom: 28, alignItems: 'center',
    shadowColor: COLORS.brandDark, shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.35, shadowRadius: 32, elevation: 12,
    overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
  },
  updateCardTopGrad: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
    opacity: 0.6,
  },
  updateIconRing: {
    width: 68, height: 68, borderRadius: 24, backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12, marginTop: 8,
    shadowColor: COLORS.brandLight, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  updateVersion: { fontSize: 11, fontWeight: '800', color: COLORS.brandLight, letterSpacing: 1.5, marginBottom: 6 },
  updateTitle: { fontSize: 26, fontWeight: '800', color: COLORS.brandDark, marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
  updateSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 24, paddingHorizontal: 8 },
  
  updateFeaturesWrap: { width: '100%', gap: 16, marginBottom: 30, paddingHorizontal: 4 },
  updateFeatureItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  updateFeatureIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  updateFeatureTextWrap: { flex: 1 },
  updateFeatureTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  updateFeatureDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  updateBtn: {
    width: '100%', borderRadius: 20, overflow: 'hidden',
    shadowColor: COLORS.brandMid, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  updateBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  updateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  updateSkipBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  updateSkipText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

