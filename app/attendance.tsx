import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  G,
} from 'react-native-svg';

// Import the scraper component (Adjust the path if necessary based on your folder structure)
import SRMAttendanceScraper from '../components/SRMAttendanceScraper';

// --- ANIMATED SVG COMPONENTS ---
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedText = Animated.createAnimatedComponent(Text);

// ─── THEME — matches Marks screen warm light palette ─────────────────────────
const THEME = {
  bg:          '#F5F2ED',
  card:        '#FFFFFF',
  surfaceWarm: '#FDFBF8',
  navBg:       '#F5F2ED',
  textMain:    '#1A1E2E',
  textSec:     '#5C6070',
  textLight:   '#9CA3AF',
  accent:      '#2D3A8C',
  accentLight: '#EEF0FB',
  accentMid:   '#6B7AC4',
  success:     '#1A7A4A',
  successBg:   '#E6F7F0',
  danger:      '#C0392B',
  dangerBg:    '#FDF3F2',
  warning:     '#B45309',
  warningBg:   '#FEF4E6',
  neutral:     '#9CA3AF',
  neutralBg:   '#F0EDE8',
  border:      '#E5E1D8',
  borderLight: '#F0EDE8',
  safeZone:    '#E6F7F0',
  dangerZone:  '#FDF3F2',
  grid:        '#EEF0FB',
  graphLine:   '#2D3A8C',
  graphDot:    '#1E2A7A',
  shadow:      '#A89F97',
};

const FONT = {
  display: Platform.OS === 'ios' ? 'Georgia'     : 'serif',
  mono:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

// --- HELPER: CIRCULAR PROGRESS HERO ---
const CircularProgress = ({ size, strokeWidth, progress, color }: any) => {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: withTiming(circumference - (progress / 100) * circumference, { duration: 1500, easing: Easing.out(Easing.exp) }),
  }));

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={THEME.border} strokeWidth={strokeWidth} fill="transparent" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            fill="transparent"
          />
        </G>
      </Svg>
      <View style={styles.absoluteCenter}>
        <AnimatedText style={[styles.heroVal, { color, fontFamily: FONT.mono }]}>
            {progress}%
        </AnimatedText>
        <Text style={styles.heroLabel}>Total</Text>
      </View>
    </View>
  );
};

// --- COMPONENT: STATS PILL ---
const StatBadge = ({ label, value, icon, color }: any) => (
    <View style={styles.statBadge}>
        <View style={[styles.statIconBox, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={14} color={color} />
        </View>
        <View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statVal}>{value}</Text>
        </View>
    </View>
);

const WaveLoader = ({ title, subtitle, color }: { title: string; subtitle: string; color: string }) => {
  const w1 = useSharedValue(0);
  const w2 = useSharedValue(0);
  const w3 = useSharedValue(0);

  useEffect(() => {
    w1.value = withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })), -1, true);
    w2.value = withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })), -1, true);
    w3.value = withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })), -1, true);
  }, [w1, w2, w3]);

  const a1 = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(w1.value, [0, 1], [0, -10]) }] }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(w2.value, [0, 1], [0, -10]) }] }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(w3.value, [0, 1], [0, -10]) }] }));

  return (
    <View style={styles.waveLoaderWrap}>
      <View style={styles.waveDotsRow}>
        <Animated.View style={[styles.waveDot, { backgroundColor: color }, a1]} />
        <Animated.View style={[styles.waveDot, { backgroundColor: THEME.accentMid }, a2]} />
        <Animated.View style={[styles.waveDot, { backgroundColor: THEME.textLight }, a3]} />
      </View>
      <Text style={styles.waveLoaderTitle}>{title}</Text>
      <Text style={styles.waveLoaderSub}>{subtitle}</Text>
    </View>
  );
};

// --- COMPONENT: SUBJECT CARD ---
// --- HELPER: ATTENDANCE METRICS ---
const getAttendanceMetrics = (item: any) => {
    const percentage = Number.parseFloat(item.attendance) || 0;
    const isSafe = percentage >= 75;
    const isLab = item.subject.toLowerCase().includes('lab') || item.subject.toLowerCase().includes('practical');

    const totalHours = Number.parseInt(item.totalHours) || 0;
    const absent = Number.parseInt(item.totalAbsent) || 0;
    const present = Math.max(0, totalHours - absent);

    const threshold = 75;
    const isNotStarted = totalHours === 0;

    let actionTitle: string;
    let actionDesc: string;
    let badgeValue: string;
    let badgeLabel: string;

    let statusColor = THEME.danger;
    let statusBg = THEME.dangerBg;

    if (isNotStarted) {
      statusColor = THEME.neutral;
      statusBg = THEME.neutralBg;
    } else if (isSafe) {
      statusColor = THEME.success;
      statusBg = THEME.successBg;
    }

    if (isNotStarted) {
        actionTitle = "Not Started";
        actionDesc = "No classes conducted yet.";
        badgeValue = "-";
        badgeLabel = "Wait";
    } else if (percentage >= threshold) {
        const margin = Math.floor(((100 * present) - (threshold * totalHours)) / threshold);
        const safeMargin = Math.max(0, margin);
        actionTitle = "On Track";
        actionDesc = `You can skip ${safeMargin} classes.`;
        badgeValue = `${safeMargin}`;
        badgeLabel = "Buffer";
    } else {
        const required = Math.ceil(((threshold * totalHours) - (100 * present)) / (100 - threshold));
        const safeRequired = Math.max(0, required);
        actionTitle = "Critical";
        actionDesc = `Attend next ${safeRequired} classes.`;
        badgeValue = `${safeRequired}`;
        badgeLabel = "Required";
    }

    return {
        displayPercentage: isNotStarted ? "N/A" : `${percentage}%`,
        isSafe,
        isLab,
        totalHours,
        absent,
        present,
        actionTitle,
        actionDesc,
        badgeValue,
        badgeLabel,
        isNotStarted,
        statusColor,
        statusBg,
    };
};

// --- COMPONENT: SUBJECT CARD ---
const SubjectCard = React.memo(({ item, index }: any) => {
  const {
    displayPercentage,
    isSafe,
    isLab,
    totalHours,
    absent,
    present,
    actionTitle,
    actionDesc,
    badgeValue,
    badgeLabel,
    isNotStarted,
    statusColor,
    statusBg,
  } = getAttendanceMetrics(item);

  let iconBg = THEME.dangerZone;
  let iconColor = THEME.danger;
  let statusIcon: React.ComponentProps<typeof Ionicons>['name'] = "alert-circle";

  if (isNotStarted) {
    iconBg = THEME.neutralBg;
    iconColor = THEME.neutral;
    statusIcon = "time-outline";
  } else if (isSafe) {
    iconBg = THEME.safeZone;
    iconColor = THEME.success;
    statusIcon = "shield-checkmark";
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 150).springify()}
      layout={LinearTransition.springify()}
      style={styles.card}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: statusColor }]} />

      <View style={styles.cardInner}>
        {/* HEADER */}
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
            <Text style={[styles.iconText, { color: iconColor }]}>
              {item.subject.charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.subjectTitle} numberOfLines={1}>{item.subject}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.subjectCode}>{item.code} • {isLab ? 'Lab' : 'Theory'}</Text>
            </View>
          </View>
          <Text style={[styles.percentBig, { color: statusColor, fontFamily: FONT.mono }]}>
            {displayPercentage}
          </Text>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
            <StatBadge label="Total Hours" value={totalHours} icon="time-outline"       color={THEME.textMain} />
            <View style={styles.statDivider} />
            <StatBadge label="Absent"      value={absent}       icon="close-circle"        color={isNotStarted ? THEME.neutral : THEME.danger} />
            <View style={styles.statDivider} />
            <StatBadge label="Present"     value={present}      icon="checkmark-circle"    color={isNotStarted ? THEME.neutral : THEME.success} />
        </View>

        {/* STATUS ACTION BAR */}
        <View style={[styles.statusBar, { backgroundColor: statusBg, borderColor: statusColor + '35' }]}>
            <View style={styles.statusContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Ionicons name={statusIcon} size={16} color={statusColor} style={{ marginRight: 6 }} />
                    <Text style={[styles.statusTitle, { color: statusColor }]}>{actionTitle}</Text>
                </View>
                <Text style={styles.statusDescText}>{actionDesc}</Text>
            </View>

            <View style={[styles.actionBadge, { backgroundColor: THEME.card, borderColor: statusColor + '50' }]}>
                <Text style={[styles.actionBadgeValue, { color: statusColor, fontFamily: FONT.mono }]}>{badgeValue}</Text>
                <Text style={[styles.actionBadgeLabel, { color: statusColor }]}>{badgeLabel}</Text>
            </View>
        </View>
      </View>
    </Animated.View>
  );
});
SubjectCard.displayName = 'SubjectCard';

const AttendanceBody = ({ loading, attData }: { loading: boolean; attData: any[] }) => {
  if (loading) {
    return (
      <WaveLoader
        title="Syncing attendance"
        subtitle="Fetching your latest attendance summary from Academia."
        color={THEME.accent}
      />
    );
  }

  if (attData.length > 0) {
    return (
      <>
        {attData.map((item, index) => (
          <SubjectCard key={`${item.code || item.subject}-${index}`} item={item} index={index} />
        ))}
      </>
    );
  }

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="stats-chart-outline" size={36} color={THEME.accent} />
      </View>
      <Text style={styles.emptyTitle}>No Attendance Data</Text>
      <Text style={styles.emptyText}>Pull down to refresh and fetch your latest data.</Text>
    </View>
  );
};

// --- MAIN SCREEN ---
export default function AttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attData, setAttData] = useState<any[]>([]);
  
  // NEW STATE FOR SYNCING & TIME
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<string>("");
  const [scraperKey, setScraperKey] = useState(0);

  const loadData = useCallback(async () => {
    try {
      // Check v2 cache (written by fixed scraper)
      const stored = await AsyncStorage.getItem('attendance_data_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAttData(parsed.data || parsed.attendance || []);
        if (parsed.lastUpdated) setLastUpdated(parsed.lastUpdated);
        return;
      }
      // Fallback: v1 cache (old scraper — may contain garbage, still try)
      const storedV1 = await AsyncStorage.getItem('attendance_data');
      if (storedV1) {
        const parsed = JSON.parse(storedV1);
        setAttData(parsed.data || parsed.attendance || []);
        if (parsed.lastUpdated) setLastUpdated(parsed.lastUpdated);
        return;
      }
      // Final fallback: academic_data merged cache
      const oldStored = await AsyncStorage.getItem('academic_data');
      if (oldStored) {
        const parsed = JSON.parse(oldStored);
        setAttData(parsed.attendance || []);
      }
    } catch (e) {
      console.error('Error loading attendance:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScraperKey(prev => prev + 1); // Trigger the scraper to restart and fetch fresh data
  }, []);

  const overallAvg = useMemo(() => {
    if (!attData.length) return 0;
    const startedSubjects = attData.filter(item => (Number.parseInt(item.totalHours) || 0) > 0);
    if (startedSubjects.length === 0) return 0;
    const total = startedSubjects.reduce((acc, curr) => acc + (Number.parseFloat(curr.attendance) || 0), 0);
    return Number.parseFloat((total / startedSubjects.length).toFixed(1));
  }, [attData]);

  // Handle successful data extraction from the scraper
  const handleScrapeComplete = useCallback((data: any) => {
    setAttData(data);
    if (data.lastUpdated) {
      setLastUpdated(data.lastUpdated);
    }
    setRefreshing(false);
    setLoading(false);
    
    // Clear the sync message shortly after success
    setTimeout(() => setSyncStep(""), 2500);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={THEME.navBg} />

      {/* BACKGROUND SCRAPER */}
      <SRMAttendanceScraper
        key={`scraper-${scraperKey}`}
        backgroundMode={true}
        onScrapeComplete={handleScrapeComplete}
        onStepChange={(step) => {
          // Filter out generic starting steps so UI doesn't look stuck when just checking cache
          if (step !== "Checking saved attendance..." && step !== "Opening Attendance...") {
            setSyncStep(step);
          }
        }}
      />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={THEME.textMain} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Attendance</Text>
            {/* Displaying Sync status or Last Updated Time */}
            <Text style={[
              styles.headerSubtitle, 
              syncStep ? { color: THEME.accent } : {}
            ]}>
              {(() => {
                if (syncStep) return syncStep;
                if (lastUpdated) {
                  return `UPDATED: ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
                return 'OVERVIEW & ANALYSIS';
              })()}
            </Text>
        </View>

        <TouchableOpacity style={styles.iconBtn}>
            <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={26} color={THEME.textMain} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 50 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.accent}
            colors={[THEME.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        overScrollMode="never"
      >
        {!loading && (
          <View style={styles.heroContainer}>
            <View style={styles.heroCard}>
               <View style={styles.heroTextSection}>
                  <Text style={styles.heroTitle}>Overall Status</Text>
                  <Text style={styles.heroSubtitle}>
                    {overallAvg >= 75 ? "Excellent! You are maintaining a safe buffer." : "Critical! Immediate attention needed."}
                  </Text>
                  <View style={styles.statRow}>
                    <View style={styles.statBadgeMain}>
                        <Ionicons name="layers-outline" size={14} color={THEME.textSec} />
                        <Text style={styles.statValMain}>{attData.length} Subjects</Text>
                    </View>
                  </View>
               </View>
               <CircularProgress
                  size={90} strokeWidth={8} progress={overallAvg}
                  color={overallAvg >= 75 ? THEME.success : THEME.danger}
                />
            </View>
          </View>
        )}

        <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Detailed Performance</Text>
            <AttendanceBody loading={loading} attData={attData} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: THEME.bg },
  absoluteCenter:{ position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: THEME.navBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 10,
  },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: THEME.textMain,
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerSubtitle: {
    fontSize: 10, fontWeight: '700', color: THEME.textSec,
    marginTop: 2, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: THEME.card,
    borderWidth: 1, borderColor: THEME.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  iconBtn: { padding: 4 },

  // HERO
  heroContainer: { padding: 16, marginTop: 12 },
  heroCard: {
    backgroundColor: THEME.card,
    borderRadius: 20, padding: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4,
    borderWidth: 1, borderColor: THEME.border,
  },
  heroTextSection: { flex: 1, paddingRight: 12 },
  heroTitle:    {
    fontSize: 17, fontWeight: '800', color: THEME.textMain,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  heroSubtitle: { fontSize: 13, color: THEME.textSec, marginTop: 4, marginBottom: 14, lineHeight: 19 },
  statRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statBadgeMain:{
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: THEME.accentLight,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  statValMain:  { fontSize: 12, fontWeight: '700', color: THEME.accent },
  heroVal:      { fontSize: 20, fontWeight: '800' },
  heroLabel:    { fontSize: 10, color: THEME.textSec, fontWeight: '600', marginTop: 2 },

  // LIST
  listContainer: { paddingHorizontal: 16 },
  sectionTitle:  {
    fontSize: 16, fontWeight: '800', color: THEME.textMain,
    marginBottom: 14, marginLeft: 2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  waveLoaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 28,
    gap: 10,
  },
  waveDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  waveDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  waveLoaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textMain,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  waveLoaderSub: {
    fontSize: 13,
    color: THEME.textSec,
    textAlign: 'center',
    lineHeight: 20,
  },

  // CARD — left accent bar layout
  card: {
    backgroundColor: THEME.card,
    borderRadius: 20, marginBottom: 16,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: THEME.border,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  accentBar:  { width: 4 },
  cardInner:  { flex: 1, padding: 16 },

  cardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconBox:      { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  iconText:     { fontSize: 18, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  subjectTitle: { fontSize: 15, fontWeight: '700', color: THEME.textMain, marginBottom: 4, letterSpacing: -0.3 },
  codeBadge:    {
    alignSelf: 'flex-start', backgroundColor: THEME.accentLight,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  subjectCode:  { fontSize: 11, color: THEME.accent, fontWeight: '700', letterSpacing: 0.3 },
  percentBig:   { fontSize: 18, fontWeight: '800' },

  // STATS GRID
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: THEME.surfaceWarm,
    borderRadius: 12, padding: 12,
    justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1, borderColor: THEME.borderLight,
  },
  statBadge:   { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  statIconBox: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statLabel:   { fontSize: 10, color: THEME.textSec, fontWeight: '600' },
  statVal:     { fontSize: 13, fontWeight: '700', color: THEME.textMain },
  statDivider: { width: 1, height: 24, backgroundColor: THEME.border },

  // GRAPH 
  graphSection:   { marginVertical: 0, alignItems: 'center' },
  graphContainer: { width: '100%', alignItems: 'center' },

  // STATUS BAR
  statusBar: {
    marginTop: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  statusContent:     { flex: 1 },
  statusTitle:       { fontSize: 13, fontWeight: '700' },
  statusDescText:    { fontSize: 12, color: THEME.textSec },
  actionBadge: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, minWidth: 58,
  },
  actionBadgeValue:  { fontSize: 16, fontWeight: '800' },
  actionBadgeLabel:  { fontSize: 9,  fontWeight: '700', textTransform: 'uppercase' },

  // EMPTY
  emptyState:  { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon:   {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: THEME.accentLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1, borderColor: THEME.accent + '25',
  },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: THEME.textMain, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  emptyText:   { color: THEME.textSec, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});
