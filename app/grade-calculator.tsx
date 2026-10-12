import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout, useAnimatedStyle, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const { width } = Dimensions.get('window');

// ─── GRADE DATA ─────────────────────────────────────────────────────────────
const GRADE_POINTS = {
  'O': { pt: 10, range: '91-100', clr: '#0E7A4A', bg: '#E5F5EE' },
  'A+': { pt: 9, range: '81-90', clr: '#1A8C55', bg: '#EAF8F1' },
  'A': { pt: 8, range: '71-80', clr: '#29A362', bg: '#EDFAF3' },
  'B+': { pt: 7, range: '61-70', clr: '#A05C00', bg: '#FEF3E2' },
  'B': { pt: 6, range: '56-60', clr: '#B86A00', bg: '#FFF6E8' },
  'C': { pt: 5, range: '50-55', clr: '#D17800', bg: '#FFF8ED' },
  'F': { pt: 0, range: '0-49', clr: '#C0290A', bg: '#FDECEA' },
  'Ab': { pt: 0, range: 'Absent', clr: '#8A8070', bg: '#F2EDE6' },
  'I': { pt: 0, range: 'Incomp', clr: '#5A5E6B', bg: '#E6E1D6' },
} as const;

type GradeKey = keyof typeof GRADE_POINTS;

interface CourseEntry {
  id: string;
  name: string;
  credits: number;
  grade: GradeKey;
  type: 'Theory' | 'Practical' | 'Project';
}

interface SemesterEntry {
  id: string;
  name: string;
  credits: string;
  sgpa: string;
}

const COLORS = {
  background: '#F7F4EF',
  surface: '#FFFFFF',
  textPrimary: '#12141C',
  textSecondary: '#5A5E6B',
  textTertiary: '#9299A8',
  brandMid: '#1E2D6B',
  brandDark: '#141B3B',
  brandLight: '#3348B0',
  brandTint: '#E8ECFB',
  border: '#E6E1D6',
  danger: '#C0290A',
  success: '#0E7A4A',
};

const FONT = {
  display: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  mono: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// ─── HELPER: PERFORMANCE CATEGORY ──────────────────────────────────────────
function getPerformanceCategory(val: number) {
  if (val === 0) return { label: 'No Data', color: COLORS.textTertiary };
  if (val >= 9.0) return { label: 'Outstanding', color: '#0E7A4A' };
  if (val >= 8.0) return { label: 'Excellent', color: '#1A8C55' };
  if (val >= 7.0) return { label: 'Very Good', color: '#29A362' };
  if (val >= 6.0) return { label: 'Good', color: '#A05C00' };
  if (val >= 5.0) return { label: 'Average', color: '#D17800' };
  return { label: 'Critical', color: '#C0290A' };
}

// ─── CIRCULAR GAUGE ───────────────────────────────────────────────────────
const CircularGauge = ({ value, label }: { value: number, label: string }) => {
  const size = 180;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  const progress = value / 10;
  const strokeDashoffset = circumference - (progress * circumference);

  const animatedVal = useSharedValue(circumference);
  React.useEffect(() => {
    animatedVal.value = withTiming(strokeDashoffset, { duration: 1200 });
  }, [strokeDashoffset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedVal.value,
  }));

  const cat = getPerformanceCategory(value);

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={COLORS.brandLight} />
            <Stop offset="1" stopColor={COLORS.brandDark} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={center} cy={center} r={radius}
          stroke={COLORS.brandTint}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center} cy={center} r={radius}
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.gaugeCenterContent}>
        <Text style={styles.gaugeLabel}>{label}</Text>
        <Text style={styles.gaugeValue}>{value.toFixed(2)}</Text>
        <Text style={[styles.gaugeCategory, { color: cat.color }]}>{cat.label}</Text>
      </View>
    </View>
  );
};
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── OPTIMIZED SGPA COURSE CARD ───────────────────────────────────────────
const CourseRow = React.memo(({ course, index, updateCourse, removeCourse }: any) => {
  const meta = GRADE_POINTS[course.grade as GradeKey];

  const incCredits = () => updateCourse(course.id, 'credits', Math.min(course.credits + 1, 10));
  const decCredits = () => updateCourse(course.id, 'credits', Math.max(course.credits - 1, 0));

  const toggleType = () => {
    const types: ('Theory' | 'Practical' | 'Project')[] = ['Theory', 'Practical', 'Project'];
    const nextIdx = (types.indexOf(course.type) + 1) % types.length;
    updateCourse(course.id, 'type', types[nextIdx]);
    Haptics.selectionAsync();
  };

  const getIconForType = () => {
    if (course.type === 'Practical') return 'flask';
    if (course.type === 'Project') return 'construct';
    return 'book';
  };

  return (
    <Animated.View layout={Layout.springify().damping(20)} entering={FadeInDown.delay(150 + index * 80).springify()} style={styles.courseCard}>
      <View style={styles.courseHead}>
        <View style={styles.courseHeadLeft}>
          <View style={[styles.iconBox, { backgroundColor: meta.clr + '1A' }]}>
            <Ionicons name={getIconForType() as any} size={20} color={meta.clr} />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.courseNameInput}
              value={course.name}
              onChangeText={(t) => updateCourse(course.id, 'name', t)}
              placeholder="Enter subject name"
              placeholderTextColor={COLORS.textTertiary}
              selectTextOnFocus
            />
            <TouchableOpacity onPress={toggleType} activeOpacity={0.7} style={styles.typeSelector}>
              <Text style={styles.typeText}>{course.type} • Tap to change</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => removeCourse(course.id)} style={styles.removeBtn} activeOpacity={0.6}>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.controlsGrid}>
        <View style={styles.creditsColumn}>
          <Text style={styles.sectionLabel}>CREDITS</Text>
          <View style={styles.stepperWrap}>
            <TouchableOpacity onPress={decCredits} style={styles.stepperBtn} activeOpacity={0.6}>
              <Ionicons name="remove" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <View style={styles.stepperValBox}>
              <Text style={styles.stepperVal}>{course.credits}</Text>
            </View>
            <TouchableOpacity onPress={incCredits} style={styles.stepperBtn} activeOpacity={0.6}>
              <Ionicons name="add" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.gradeColumn}>
          <Text style={styles.sectionLabel}>GRADE ACHIEVED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradeScroll}>
            {(Object.keys(GRADE_POINTS) as GradeKey[]).map(gk => {
              const isSelected = course.grade === gk;
              const gm = GRADE_POINTS[gk];
              return (
                <TouchableOpacity
                  key={gk}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    updateCourse(course.id, 'grade', gk);
                  }}
                  style={[styles.hugeGradeBox, isSelected ? { backgroundColor: gm.bg, borderColor: gm.clr } : null]}
                >
                  <Text style={[styles.hgLetter, isSelected ? { color: gm.clr } : null]}>{gk}</Text>
                  <Text style={[styles.hgPts, isSelected ? { color: gm.clr } : null]}>{gm.pt} PTS</Text>
                  <View style={[styles.hgBadge, isSelected ? { backgroundColor: gm.clr + '20' } : null]}>
                    <Text style={[styles.hgRange, isSelected ? { color: gm.clr } : null]}>{gm.range}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── OPTIMIZED CGPA SEMESTER CARD ─────────────────────────────────────────
const SemesterRow = React.memo(({ semester, index, updateSemester, removeSemester }: any) => {
  return (
    <Animated.View layout={Layout.springify().damping(20)} entering={FadeInDown.delay(150 + index * 80).springify()} style={styles.courseCard}>
      <View style={styles.courseHead}>
        <View style={styles.courseHeadLeft}>
          <View style={[styles.iconBox, { backgroundColor: COLORS.brandTint }]}>
            <Ionicons name="calendar" size={20} color={COLORS.brandMid} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TextInput
              style={styles.courseNameInput}
              value={semester.name}
              onChangeText={(t) => updateSemester(semester.id, 'name', t)}
              placeholder="Semester Name"
              placeholderTextColor={COLORS.textTertiary}
              selectTextOnFocus
            />
          </View>
        </View>
        <TouchableOpacity onPress={() => removeSemester(semester.id)} style={styles.removeBtn} activeOpacity={0.6}>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.controlsGrid}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>TOTAL CREDITS</Text>
          <View style={styles.creditsInputWrapper}>
            <TextInput
              style={styles.creditsInput}
              value={semester.credits}
              onChangeText={(t) => updateSemester(semester.id, 'credits', t)}
              keyboardType="numeric"
              maxLength={3}
              selectionColor={COLORS.brandMid}
              selectTextOnFocus
              placeholder="e.g. 22"
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>EARNED SGPA</Text>
          <View style={styles.creditsInputWrapper}>
            <TextInput
              style={styles.creditsInput}
              value={semester.sgpa}
              onChangeText={(t) => updateSemester(semester.id, 'sgpa', t)}
              keyboardType="numeric"
              maxLength={5}
              selectionColor={COLORS.brandMid}
              selectTextOnFocus
              placeholder="e.g. 8.75"
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
});


export default function GradeCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [calcMode, setCalcMode] = useState<'SGPA' | 'CGPA'>('SGPA');

  // SGPA State
  const [courses, setCourses] = useState<CourseEntry[]>([
    { id: generateId(), name: 'Subject Name', credits: 4, grade: 'O', type: 'Theory' },
    { id: generateId(), name: 'Subject Name', credits: 1, grade: 'A+', type: 'Practical' },
    { id: generateId(), name: 'Subject Name', credits: 3, grade: 'A', type: 'Theory' },
  ]);

  // CGPA State
  const [semesters, setSemesters] = useState<SemesterEntry[]>([
    { id: generateId(), name: 'Semester 1', credits: '20', sgpa: '8.5' },
    { id: generateId(), name: 'Semester 2', credits: '22', sgpa: '9.0' },
  ]);

  const addCourse = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCourses(prev => [...prev, { id: generateId(), name: `Subject ${prev.length + 1}`, credits: 3, grade: 'A', type: 'Theory' }]);
  }, []);

  const removeCourse = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCourses(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCourse = useCallback((id: string, field: keyof CourseEntry, value: any) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  const addSemester = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSemesters(prev => [...prev, { id: generateId(), name: `Semester ${prev.length + 1}`, credits: '22', sgpa: '8.0' }]);
  }, []);

  const removeSemester = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSemesters(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSemester = useCallback((id: string, field: keyof SemesterEntry, value: any) => {
    setSemesters(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const clearAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (calcMode === 'SGPA') setCourses([]);
    else setSemesters([]);
  }, [calcMode]);

  // ─── CALCULATION ───────────────────────────────────────────────────────────
  const sgpaResult = useMemo(() => {
    let totalCredits = 0;
    let totalPoints = 0;
    courses.forEach(c => {
      const cr = c.credits;
      const gp = GRADE_POINTS[c.grade].pt;
      totalCredits += cr;
      totalPoints += cr * gp;
    });
    const sgpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
    return { value: sgpa, totalCredits, totalPoints };
  }, [courses]);

  const cgpaResult = useMemo(() => {
    let totalCredits = 0;
    let totalPoints = 0;
    semesters.forEach(s => {
      const cr = parseFloat(s.credits) || 0;
      const sg = parseFloat(s.sgpa) || 0;
      totalCredits += cr;
      totalPoints += (cr * sg);
    });
    const cgpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
    return { value: cgpa, totalCredits, totalPoints };
  }, [semesters]);

  const activeResult = calcMode === 'SGPA' ? sgpaResult : cgpaResult;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* ── HEADER ── */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Grade Calculator</Text>
        <TouchableOpacity onPress={clearAll} style={styles.resetBtn}>
          <Ionicons name="refresh-outline" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── SEGMENTED CONTROL ── */}
      <View style={styles.segmentWrap}>
        <TouchableOpacity
          onPress={() => { setCalcMode('SGPA'); Haptics.selectionAsync(); }}
          style={[styles.segmentBtn, calcMode === 'SGPA' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, calcMode === 'SGPA' && styles.segmentTextActive]}>SGPA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setCalcMode('CGPA'); Haptics.selectionAsync(); }}
          style={[styles.segmentBtn, calcMode === 'CGPA' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, calcMode === 'CGPA' && styles.segmentTextActive]}>CGPA</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── MASSIVE HERO GAUGE ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.heroWidget}>
          <CircularGauge value={activeResult.value} label={calcMode === 'SGPA' ? 'EST. SGPA' : 'EST. CGPA'} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <View style={styles.hsIcon}><Ionicons name="layers-outline" size={16} color={COLORS.brandMid} /></View>
              <View>
                <Text style={styles.hsLabel}>CREDITS</Text>
                <Text style={styles.hsValue}>{activeResult.totalCredits}</Text>
              </View>
            </View>
            <View style={styles.hsDivider} />
            <View style={styles.heroStatBox}>
              <View style={[styles.hsIcon, { backgroundColor: '#E5F5EE' }]}>
                <Ionicons name={calcMode === 'SGPA' ? "star-outline" : "analytics-outline"} size={16} color={COLORS.success} />
              </View>
              <View>
                <Text style={styles.hsLabel}>{calcMode === 'SGPA' ? 'GRADE PTS' : 'TOTAL PTS'}</Text>
                <Text style={styles.hsValue}>{activeResult.totalPoints.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{calcMode === 'SGPA' ? 'Course Breakdown' : 'Semester History'}</Text>
          <Text style={styles.listCount}>
            {calcMode === 'SGPA' ? courses.length : semesters.length} {calcMode === 'SGPA' ? 'subjects' : 'semesters'}
          </Text>
        </View>

        {calcMode === 'SGPA' ? (
          <>
            {courses.map((course, index) => (
              <CourseRow key={course.id} course={course} index={index} updateCourse={updateCourse} removeCourse={removeCourse} />
            ))}
            <Animated.View entering={FadeIn.delay(300)}>
              <TouchableOpacity style={styles.addLargeBtn} onPress={addCourse} activeOpacity={0.8}>
                <LinearGradient colors={['rgba(30,45,107,0.05)', 'rgba(30,45,107,0.02)']} style={({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 })} />
                <Ionicons name="add-circle" size={28} color={COLORS.brandLight} />
                <Text style={styles.addLargeBtnText}>Add Another Subject</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        ) : (
          <>
            {semesters.map((semester, index) => (
              <SemesterRow key={semester.id} semester={semester} index={index} updateSemester={updateSemester} removeSemester={removeSemester} />
            ))}
            <Animated.View entering={FadeIn.delay(300)}>
              <TouchableOpacity style={styles.addLargeBtn} onPress={addSemester} activeOpacity={0.8}>
                <LinearGradient colors={['rgba(30,45,107,0.05)', 'rgba(30,45,107,0.02)']} style={({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 })} />
                <Ionicons name="add-circle" size={28} color={COLORS.brandLight} />
                <Text style={styles.addLargeBtnText}>Add Another Semester</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  resetBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  navTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, fontFamily: FONT.display },

  // SEGMENTED CONTROL
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#A89F97', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  segmentBtnActive: { backgroundColor: COLORS.brandTint },
  segmentText: { fontSize: 14, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.5 },
  segmentTextActive: { color: COLORS.brandMid },

  // HERO WIDGET
  heroWidget: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.brandDark, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 8,
  },
  gaugeContainer: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  gaugeCenterContent: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  gaugeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: COLORS.textTertiary, marginBottom: -4 },
  gaugeValue: { fontSize: 56, fontWeight: '900', color: COLORS.textPrimary, fontFamily: FONT.mono, letterSpacing: -2 },
  gaugeCategory: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 16,
    width: '100%',
  },
  heroStatBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  hsIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.brandTint, alignItems: 'center', justifyContent: 'center' },
  hsLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 1 },
  hsValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, fontFamily: FONT.mono },
  hsDivider: { width: 1, height: 30, backgroundColor: COLORS.border },

  listHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  listTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, fontFamily: FONT.display },
  listCount: { fontSize: 14, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 2 },

  // LARGE CARD
  courseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    marginBottom: 16,
    padding: 20,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#A89F97', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  courseHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  courseHeadLeft: { flexDirection: 'row', flex: 1, gap: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  courseNameInput: {
    fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3,
    padding: 0, margin: 0, marginBottom: 4,
  },
  typeSelector: { alignSelf: 'flex-start' },
  typeText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.danger + '10', alignItems: 'center', justifyContent: 'center' },

  cardDivider: { height: 1, backgroundColor: COLORS.background, marginVertical: 20 },
  controlsGrid: { flexDirection: 'row', gap: 24 },

  // STEPPER / INPUT BLOCK
  creditsColumn: { width: 85 },
  sectionLabel: { fontSize: 11, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '800', marginBottom: 12 },
  stepperWrap: {
    flexDirection: 'column', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  stepperBtn: { width: '100%', height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  stepperValBox: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  stepperVal: { fontSize: 24, fontWeight: '800', color: COLORS.brandMid, fontFamily: FONT.mono },

  creditsInputWrapper: {
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, height: 50,
    justifyContent: 'center',
  },
  creditsInput: {
    textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.brandMid, fontFamily: FONT.mono,
    padding: 0, margin: 0,
  },

  // HUGE GRADE BLOCKS
  gradeColumn: { flex: 1, overflow: 'hidden' },
  gradeScroll: { gap: 12, paddingRight: 20 },
  hugeGradeBox: {
    width: 90, backgroundColor: COLORS.background, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  hgLetter: { fontSize: 28, fontWeight: '900', color: COLORS.textTertiary, fontFamily: FONT.mono, marginBottom: 4 },
  hgPts: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 8 },
  hgBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: COLORS.border },
  hgRange: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary },

  // ADD BTN
  addLargeBtn: {
    height: 80, borderRadius: 24,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    marginTop: 8, overflow: 'hidden', backgroundColor: COLORS.surface,
  },
  addLargeBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.brandMid, letterSpacing: 0.5 },
});
