import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInLeft,
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
import SRMAcademicReportScraper from '../components/SRMAcademicReportScraper';
import SRMTimeTableScraper from '../components/SRMTimeTableScraper';

const { width } = Dimensions.get('window');

// ─── Extracted Helper Methods ──────────────────────────────────────────

function findCalendarMonthIndex(calendarData: any, date: Date): number {
  if (!calendarData?.monthNames) return -1;
  const short = date.toLocaleString('en-US', { month: 'short' });
  const long = date.toLocaleString('en-US', { month: 'long' });
  return calendarData.monthNames.findIndex((m: string) => m.includes(short) || m.includes(long));
}

function processHolidayNextDay(monthData: any[], startIndex: number, result: any, today: Date) {
  result.isFreeDay = true;
  if (!result.event) {
    const wd = today.getDay();
    if (wd === 0) result.event = "Sunday";
    if (wd === 6) result.event = "Saturday";
  }
  for (let i = startIndex + 1; i < monthData.length; i++) {
    if (monthData[i].dayOrder && monthData[i].dayOrder !== "-") {
      const nextNum = Number.parseInt(monthData[i].dayOrder.replaceAll(/\D/g, ""), 10);
      if (!Number.isNaN(nextNum) && nextNum >= 1 && nextNum <= 5) {
        result.nextDayOrder = nextNum;
        break;
      }
    }
  }
}

function processCalendarDay(monthData: any[], todayItemIdx: number, result: any, today: Date) {
  const todayItem = monthData[todayItemIdx];
  result.event = todayItem.event || null;
  if (todayItem.dayOrder && todayItem.dayOrder !== "-") {
     const doNum = Number.parseInt(todayItem.dayOrder.replaceAll(/\D/g, ""), 10);
     if (!Number.isNaN(doNum) && doNum >= 1 && doNum <= 5) result.index = doNum - 1;
  } else {
     processHolidayNextDay(monthData, todayItemIdx, result, today);
  }
}

function computeTodayContext(calendarData: any) {
  const result = { index: -1, event: null as string | null, isFreeDay: false, nextDayOrder: null as number | null };
  const today = new Date();
  if (calendarData) {
    const mIndex = findCalendarMonthIndex(calendarData, today);
    if (mIndex !== -1 && calendarData.monthsData[mIndex]) {
      const monthData = calendarData.monthsData[mIndex];
      const todayDateStr = today.getDate().toString();
      const todayItemIdx = monthData.findIndex((d: any) => d.date === todayDateStr);
      if (todayItemIdx !== -1) processCalendarDay(monthData, todayItemIdx, result, today);
    }
  }
  if (result.index === -1 && !result.isFreeDay) {
    const wd = today.getDay();
    if (wd === 0 || wd === 6) {
      result.isFreeDay = true;
      result.event = wd === 0 ? "Sunday" : "Saturday";
    } else {
      result.index = wd - 1;
    }
  }
  return result;
}

function getCourseForSlot(courses: any[], slot: string) {
  return courses.find((c: any) => {
    if (!c.slot || c.slot === "TBD") return false;
    const scrapedSlots = c.slot.replaceAll(/[^a-zA-Z0-9]/g, " ").split(/\s+/);
    return scrapedSlots.some((scraped: string) => scraped === slot || (slot.length === 1 && scraped.startsWith(slot)));
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Base palette — warm light
  bg:           '#F5F3EF',       // warm off-white canvas
  surface:      '#FFFFFF',
  surfaceWarm:  '#FDFAF6',
  border:       '#EAE6DF',
  borderLight:  '#F0EDE8',

  // Primary — deep indigo with slate undertone
  primary:      '#3D52A0',
  primaryLight: '#EEF1FB',
  primaryMid:   '#8697C4',

  // Class type accents
  theory:       '#3D52A0',   theoryBg:   '#EEF1FB',
  lab:          '#D4760A',   labBg:      '#FEF4E6',
  practical:    '#0E7C63',   practicalBg:'#E8F7F3',
  library:      '#7C3D8F',   libraryBg:  '#F6EEF9',

  // Semantic
  now:          '#E8472A',   nowBg:      '#FFF0ED',
  next:         '#0E7C63',   nextBg:     '#E8F7F3',
  free:         '#94A3B8',   freeBg:     '#F8FAFC',
  success:      '#0E7A4A', // Added for the sync indicator

  // Text
  textDark:     '#1A1614',
  textMid:      '#5C5754',
  textLight:    '#8E8B87',
  textOnDark:   '#FFFFFF',

  // Shadows
  shadow:       '#B8B0A8',
};

const FONT = {
  display:  Platform.OS === 'ios' ? 'Georgia' : 'serif',
  body:     Platform.OS === 'ios' ? 'System'  : 'sans-serif',
};

// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL DATA (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────
const DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
// 24-hour format — toMinutes() parses these directly without any AM/PM hack
const TIMES = ['08:00','08:50','09:45','10:40','11:35','12:30','13:25','14:20','15:10','16:00','16:50','17:30'];

const BATCH1_SCHEDULE = [
  ['A','A','F','F','G','P6','P7','P8','P9','P10','L11','L12'],
  ['P11','P12','P13','P14','P15','B','B','G','G','A','L21','L22'],
  ['C','C','A','D','B','P26','P27','P28','P29','P30','L31','L32'],
  ['P31','P32','P33','P34','P35','D','D','B','E','C','L41','L42'],
  ['E','E','C','F','D','P46','P47','P48','P49','P50','L51','L52'],
];

const BATCH2_SCHEDULE = [
  ['P1','P2','P3','P4','P5','A','A','F','F','G','L11','L12'],
  ['B','B','G','G','A','P16','P17','P18','P19','P20','L21','L22'],
  ['P21','P22','P23','P24','P25','C','C','A','D','B','L31','L32'],
  ['D','D','B','E','C','P36','P37','P38','P39','P40','L41','L42'],
  ['P41','P42','P43','P44','P45','E','E','C','F','D','L51','L52'],
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function slotType(slot: string): 'theory' | 'lab' | 'practical' | 'library' {
  if (slot.startsWith('L'))  return 'library';
  if (slot.startsWith('P') && slot.length > 1) return 'practical';
  return 'theory';
}

const TYPE_META = {
  theory:    { label: 'Theory',    color: T.theory,    bg: T.theoryBg,    icon: 'book-outline' as const },
  practical: { label: 'Practical', color: T.practical, bg: T.practicalBg, icon: 'flask-outline' as const },
  library:   { label: 'Library',   color: T.library,   bg: T.libraryBg,   icon: 'library-outline' as const },
  lab:       { label: 'Lab',       color: T.lab,       bg: T.labBg,       icon: 'construct-outline' as const },
};

// Parses a 24-hour HH:MM string → total minutes. No AM/PM correction needed.
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getSlotTimes(t: string) {
  let startMins = toMinutes(t);
  let endMins = startMins + 50;
  
  const getParts = (mins: number) => {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return { h: pad(h12), m: pad(m), ampm };
  };
  return {
    startParts: getParts(startMins),
    endParts: getParts(endMins)
  };
}

function nowStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function slotProgress(time: string, nextTime?: string): number {
  const now  = toMinutes(nowStr());
  const start = toMinutes(time);
  const end   = nextTime ? toMinutes(nextTime) : start + 50;
  if (now < start || now >= end) return -1;
  return (now - start) / (end - start);
}

const formatTime = (isoString?: string) => {
  if (!isoString) return "Unknown";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const DaySelector = ({ days, active, onChange }: { days: string[]; active: number; onChange: (i: number) => void }) => {
  const pillWidth = (width - 32 - (days.length - 1) * 8) / days.length;
  const slideX    = useSharedValue(active * (pillWidth + 8));

  useEffect(() => {
    slideX.value = withSpring(active * (pillWidth + 8), { damping: 18, stiffness: 200 });
  }, [active, pillWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  return (
    <View style={[styles.daySelectorWrap, { paddingHorizontal: 16 }]}>
      <Animated.View style={[styles.daySlidingPill, { width: pillWidth }, indicatorStyle]} />
      {days.map((day, i) => {
        const isActive = active === i;
        return (
          <Pressable
            key={`${day}-${i}`}
            onPress={() => onChange(i)}
            style={[styles.dayItem, { width: pillWidth }]}
            hitSlop={4}
          >
            <Text style={[styles.dayNum, isActive && styles.dayNumActive]}>{i + 1}</Text>
            <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>
              {Platform.OS === 'ios' ? 'Day' : 'D'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const StatsBadge = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
  <View style={[styles.statPill, { borderColor: color + '30', backgroundColor: color + '10' }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const TypeChip = ({ type }: { type: keyof typeof TYPE_META }) => {
  const meta = TYPE_META[type];
  return (
    <View style={[styles.typeChip, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={10} color={meta.color} />
      <Text style={[styles.typeChipText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
};

const ProgressBar = ({ progress, color }: { progress: number; color: string }) => {
  const width_ = useSharedValue(progress);
  useEffect(() => {
    width_.value = withTiming(progress, { duration: 800 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(width_.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%` as any,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { backgroundColor: color }, barStyle]} />
    </View>
  );
};

const StatusMarker = ({ status }: { status: 'now' | 'next' }) => (
  <View style={[styles.statusMarker, { backgroundColor: status === 'now' ? T.nowBg : T.nextBg }]}>
    <View style={[styles.statusDot, { backgroundColor: status === 'now' ? T.now : T.next }]} />
    <Text style={[styles.statusText, { color: status === 'now' ? T.now : T.next }]}>
      {status === 'now' ? 'NOW' : 'NEXT'}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE CARD
// ─────────────────────────────────────────────────────────────────────────────
const ClassCard = ({ item, index, isNow, isNext, progress, isLast }: any) => {
  const type = slotType(item.slot);
  const meta = TYPE_META[type];
  const scale = useSharedValue(1);

  let dotColor = meta.color;
  if (isNow) dotColor = T.now;
  else if (isNext) dotColor = T.next;

  let dotBorder = meta.color + '20';
  if (isNow) dotBorder = T.now + '30';
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).springify().damping(18)}>
      <Animated.View style={pressStyle}>
        <View style={styles.timelineRow}>
          <View style={[styles.timeCol, { width: 55 }]}>
            <Text style={[styles.timeHour, isNow && { color: T.now }]}>{item.startParts.h}</Text>
            <Text style={[styles.timeMin, isNow && { color: T.now }]}>:{item.startParts.m}</Text>
            <Text style={[styles.timeMin, { fontSize: 9, marginTop: -2 }, isNow && { color: T.now }]}>{item.startParts.ampm}</Text>
            
            <View style={{ marginVertical: 4 }}>
               <Ionicons name="chevron-down" size={14} color={T.textLight} />
            </View>

            <Text style={[styles.timeHour, { fontSize: 13, color: T.textMid }, isNow && { color: T.now }]}>{item.endParts.h}</Text>
            <Text style={[styles.timeMin, { fontSize: 10, color: T.textLight }, isNow && { color: T.now }]}>:{item.endParts.m}</Text>
            <Text style={[styles.timeMin, { fontSize: 8, marginTop: -2, color: T.textLight }, isNow && { color: T.now }]}>{item.endParts.ampm}</Text>

            {!isLast && <View style={[styles.connector, { backgroundColor: isNow ? T.now + '30' : T.border, marginTop: 4, minHeight: 12 }]} />}
          </View>

          <View style={[
            styles.timelineDot,
            {
              backgroundColor: dotColor,
              borderColor:     dotBorder,
              borderWidth:     isNow || isNext ? 3 : 2,
            }
          ]}>
            {isNow && <Animated.View entering={FadeIn} style={styles.dotPulse} />}
          </View>

          <Pressable
            onPressIn={() => { scale.value = withSpring(0.97); }}
            onPressOut={() => { scale.value = withSpring(1); }}
            style={[styles.card, isNow && styles.cardNow, isNext && styles.cardNext]}
          >
            <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
            <View style={styles.cardInner}>
              <View style={styles.cardTopRow}>
                <TypeChip type={type} />
                {isNow  && <StatusMarker status="now" />}
                {isNext && <StatusMarker status="next" />}
                <View style={{ flex: 1 }} />
                <View style={[styles.slotChip, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.slotChipText, { color: meta.color }]}>{item.slot}</Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, isNow && { color: T.textDark }]} numberOfLines={2}>
                {item.title}
              </Text>

              <View style={styles.cardBottomRow}>
                <View style={styles.cardMeta}>
                  <Ionicons name="location-outline" size={12} color={T.textLight} />
                  <Text style={styles.cardMetaText}>{item.room}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Ionicons name="pricetag-outline" size={12} color={T.textLight} />
                  <Text style={styles.cardMetaText}>Slot {item.actualSlot}</Text>
                </View>
              </View>

              {isNow && progress >= 0 && (
                <View style={styles.progressWrap}>
                  <ProgressBar progress={progress} color={meta.color} />
                  <Text style={[styles.progressLabel, { color: meta.color }]}>
                    {Math.round(progress * 100)}% complete
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE (Changed from ScrollView to View so it lives cleanly inside FlatList)
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ courses }: { courses: any[] }) => (
  <View style={styles.emptyWrap}>
    <Animated.View entering={FadeInDown.springify()} style={styles.emptyHero}>
      <View style={styles.emptyIconRing}>
        <View style={styles.emptyIconInner}>
          <Ionicons name="sunny-outline" size={34} color={T.lab} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>Free Day!</Text>
      <Text style={styles.emptySub}>
        No classes scheduled today. Here's a quick look at all your courses.
      </Text>
    </Animated.View>

    <View style={styles.fallbackGrid}>
      {courses.map((c: any, i: number) => {
        const type = slotType(c.slot?.replaceAll(/[^a-zA-Z]/g, '') || '');
        const meta = TYPE_META[type];
        return (
          <Animated.View key={`${c.title}-${i}`} entering={FadeInLeft.delay(i * 40).springify()} style={styles.fallbackCard}>
            <View style={[styles.fallbackAccent, { backgroundColor: meta.color }]} />
            <View style={styles.fallbackBody}>
              <Text style={styles.fallbackTitle} numberOfLines={2}>{c.title}</Text>
              <View style={styles.fallbackMeta}>
                <View style={styles.cardMeta}>
                  <Ionicons name="location-outline" size={11} color={T.textLight} />
                  <Text style={styles.cardMetaText}>{c.room}</Text>
                </View>
                <TypeChip type={type} />
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  </View>
);

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
      <Animated.View entering={FadeIn.duration(400)} style={styles.waveDotWrap}>
        <Animated.View style={[styles.waveDot, { backgroundColor: T.primary }, s1]} />
        <Animated.View style={[styles.waveDot, { backgroundColor: T.primaryMid }, s2]} />
        <Animated.View style={[styles.waveDot, { backgroundColor: T.theory }, s3]} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.loadingWaveText}>
        Syncing Schedule...
      </Animated.Text>
    </View>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function TimetableScreen() {
  const [timetableData, setTimetableData] = useState<any>(null);
  const [calendarData, setCalendarData]   = useState<any>(null); 
  const [activeDay, setActiveDay]         = useState(0);
  const [, forceUpdate]                   = React.useReducer((x) => x + 1, 0);
  const [isDayInitialized, setIsDayInitialized] = useState(false);
  
  // New States for Sync Indicator
  const [isSyncing, setIsSyncing] = useState(true);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>("Checking...");

  useEffect(() => {
    const id = setInterval(() => forceUpdate(), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── NEW HOLIDAY & NEXT DAY AWARE LOGIC ─────────────────────────────
  const todayContext = useMemo(() => computeTodayContext(calendarData), [calendarData]);

  const actualTodayIndex = todayContext.index;

  const jumpToTodayOrder = useCallback(() => {
    const { index, nextDayOrder } = todayContext;
    if (index >= 0) {
      setActiveDay(index);
    } else if (nextDayOrder) {
      setActiveDay(nextDayOrder - 1);
    } else {
      const wd = new Date().getDay();
      setActiveDay(wd >= 1 && wd <= 5 ? wd - 1 : 0);
    }
  }, [todayContext]);
  // ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (timetableData && calendarData && !isDayInitialized) {
      jumpToTodayOrder();
      setIsDayInitialized(true);
    }
  }, [timetableData, calendarData, isDayInitialized, jumpToTodayOrder]);

  const handleTimetableComplete = (data: any) => {
    setTimetableData(data);
    if (data.lastUpdated) {
        const ageInMs = Date.now() - new Date(data.lastUpdated).getTime();
        if (ageInMs < 5000) {
            setLastUpdatedLabel("Just now");
            setIsSyncing(false); 
        } else {
            setLastUpdatedLabel(formatTime(data.lastUpdated));
            setIsSyncing(true); 
        }
    }
  };

  const dailyRoutine = useMemo(() => {
    if (!timetableData?.courses) return [];
    const schedule = timetableData.batch === 2 ? BATCH2_SCHEDULE : BATCH1_SCHEDULE;
    const daySlots = schedule[activeDay];

    return daySlots.map((slot: string, index: number) => {
      const course = getCourseForSlot(timetableData.courses, slot);

      if (course) {
        const times = getSlotTimes(TIMES[index]);
        return {
          time:       TIMES[index],
          startParts: times.startParts,
          endParts:   times.endParts,
          title:      course.title,
          room:       course.room,
          slot,
          actualSlot: course.slot,
        };
      }
      return null;
    }).filter(Boolean) as any[];
  }, [timetableData, activeDay]);

  const isViewingToday = activeDay === actualTodayIndex;
  
  let nowIdx  = -1;
  let nextIdx = -1;
  
  if (isViewingToday) {
    const nowMinutes = toMinutes(nowStr());
    dailyRoutine.forEach((item: any, i: number) => {
      const start = toMinutes(item.time);
      // Each slot is 50 min; use the next slot's start as the end of this one
      const end   = i < dailyRoutine.length - 1 ? toMinutes(dailyRoutine[i + 1].time) : start + 50;
      // 'now' only if we are strictly inside the slot window [start, end)
      if (nowMinutes >= start && nowMinutes < end) nowIdx  = i;
      // 'next' is the first slot that hasn't started yet
      if (nowMinutes <  start && nextIdx === -1)   nextIdx = i;
    });
    // If all classes are done, clear both markers — day is complete
    if (nowIdx === -1 && nextIdx === -1) {
      // every class is in the past — no current, no next
    }
  }

  const stats = useMemo(() => {
    const theory    = dailyRoutine.filter((i: any) => slotType(i.slot) === 'theory').length;
    const practical = dailyRoutine.filter((i: any) => slotType(i.slot) === 'practical').length;
    return { total: dailyRoutine.length, theory, practical };
  }, [dailyRoutine]);

  const handleDayChange = useCallback((i: number) => {
    setActiveDay(i);
  }, []);

  const renderClassItem = ({ item, index }: { item: any; index: number }) => {
    const isNow  = index === nowIdx;
    const isNext = index === nextIdx;
    const nextItem = dailyRoutine[index + 1];
    const prog   = isNow ? slotProgress(item.time, nextItem?.time) : -1;

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <ClassCard
          item={item}
          index={index}
          isNow={isNow}
          isNext={isNext}
          progress={prog}
          isLast={index === dailyRoutine.length - 1}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}>
        <SRMTimeTableScraper backgroundMode={true} onScrapeComplete={handleTimetableComplete} />
        <SRMAcademicReportScraper backgroundMode={true} onScrapeComplete={setCalendarData} />
      </View>

      {(!timetableData || !calendarData) ? (
        <LoadingWave />
      ) : (
        /* ── ENTIRE SCREEN AS A SINGLE FLATLIST ──────────────────────────────── */
        <FlatList
          data={dailyRoutine}
          keyExtractor={(item: any, i) => `${item.slot}-${i}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ paddingBottom: 8 }}>
              {/* ── HEADER ── */}
              <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
                <Pressable
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => router.back()}
                >
                  <Ionicons name="chevron-back" size={20} color={T.textDark} />
                </Pressable>

                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>Schedule</Text>
                  
                  <View style={styles.syncPill}>
                    {isSyncing ? (
                      <>
                        <ActivityIndicator size="small" color={T.textLight} style={{ transform: [{ scale: 0.7 }] }} />
                        <Text style={styles.syncText}>
                          Syncing... (Last: {lastUpdatedLabel})
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={12} color={T.success} />
                        <Text style={[styles.syncText, { color: T.success }]}>
                          Up to date
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={styles.batchBadge}>
                    <View style={styles.batchDot} />
                    <Text style={styles.batchLabel}>Batch {timetableData.batch}</Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.todayBtn, pressed && { opacity: 0.7 }]}
                  onPress={jumpToTodayOrder}
                >
                  <Ionicons name="today-outline" size={16} color={T.primary} />
                  <Text style={styles.todayBtnText}>Today</Text>
                </Pressable>
              </Animated.View>

              {/* ── STATS ROW ── */}
              <Animated.View entering={FadeIn.delay(100)} style={styles.statsRow}>
                <StatsBadge label="Total"    value={stats.total}     color={T.primary}    />
                <StatsBadge label="Theory"   value={stats.theory}    color={T.theory}     />
                <StatsBadge label="Practical" value={stats.practical} color={T.practical} />
              </Animated.View>

              {/* ── DAY SELECTOR ── */}
              <Animated.View entering={FadeIn.delay(150)}>
                <DaySelector days={DAYS} active={activeDay} onChange={handleDayChange} />
              </Animated.View>

              {/* ── DIVIDER ── */}
              <View style={styles.divider} />

              {/* ── HOLIDAY/WEEKEND BANNER ── */}
              {todayContext.isFreeDay && (
                <Animated.View entering={FadeInDown} style={styles.holidayBanner}>
                  <View style={styles.holidayIconRing}>
                    <Ionicons name="calendar-clear" size={18} color={T.lab} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayBannerTitle}>Holiday</Text>
                    <Text style={styles.holidayBannerSub}>
                      {todayContext.event ? todayContext.event : 'No classes today.'}
                      {todayContext.nextDayOrder ? ` Showing schedule for next working day (Day ${todayContext.nextDayOrder}).` : ''}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* ── NOW BANNER ── */}
              {dailyRoutine.length > 0 && nowIdx >= 0 && (
                <Animated.View entering={FadeInDown} style={styles.nowBanner}>
                  <View style={styles.nowBannerDot} />
                  <Text style={styles.nowBannerText}>
                    Class in progress · {dailyRoutine[nowIdx].title}
                  </Text>
                </Animated.View>
              )}
            </View>
          }
          ListEmptyComponent={<EmptyState courses={timetableData.courses} />}
          renderItem={renderClassItem}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: T.bg,
  },

  // ── LOADING WAVE STYLES ───────────────────────────────────────────────────
  loadingWaveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
  },
  waveDotWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  waveDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  loadingWaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: T.textMid,
    fontFamily: FONT.display,
    letterSpacing: 0.5,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: T.textDark,
    fontFamily: FONT.display,
    letterSpacing: -0.5,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '600',
    color: T.textLight,
  },
  batchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  batchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.primary,
  },
  batchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: T.primary,
    letterSpacing: 0.3,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: T.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.primary + '25',
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.primary,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    fontFamily: FONT.display,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: T.textLight,
    marginTop: 1,
    letterSpacing: 0.3,
  },

  // ── Day Selector ──────────────────────────────────────────────────────────
  daySelectorWrap: {
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
    marginBottom: 4,
  },
  daySlidingPill: {
    position: 'absolute',
    top: 0,
    left: 16,
    height: '100%',
    borderRadius: 14,
    backgroundColor: T.primary,
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  dayItem: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    zIndex: 1,
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '800',
    color: T.textMid,
    lineHeight: 22,
    fontFamily: FONT.display,
  },
  dayNumActive: {
    color: T.textOnDark,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: T.textLight,
    letterSpacing: 0.5,
  },
  dayLabelActive: {
    color: T.textOnDark,
    opacity: 0.75,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: T.border,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },

  // ── HOLIDAY BANNER STYLES ─────────────────────────────────────────────────
  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.labBg,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.lab + '30',
    gap: 12,
  },
  holidayIconRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.lab + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  holidayBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: T.lab,
    marginBottom: 2,
  },
  holidayBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: T.textMid,
    lineHeight: 16,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 48,
  },

  // ── Now banner ────────────────────────────────────────────────────────────
  nowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.nowBg,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.now + '20',
    gap: 8,
  },
  nowBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.now,
  },
  nowBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.now,
    flex: 1,
  },

  // ── Timeline ──────────────────────────────────────────────────────────────
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  timeCol: {
    width: 52,
    alignItems: 'center',
    paddingTop: 14,
  },
  timeHour: {
    fontSize: 16,
    fontWeight: '800',
    color: T.textDark,
    fontFamily: FONT.display,
    lineHeight: 20,
  },
  timeMin: {
    fontSize: 12,
    fontWeight: '600',
    color: T.textLight,
    lineHeight: 16,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 30,
    marginTop: 8,
    borderRadius: 1,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 18,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotPulse: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.now + '25',
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: T.borderLight,
  },
  cardNow: {
    borderColor: T.now + '30',
    shadowColor: T.now,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },
  cardNext: {
    borderColor: T.next + '25',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.textDark,
    lineHeight: 21,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    gap: 14,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: T.textLight,
    fontWeight: '600',
  },

  // ── Chips & Badges ────────────────────────────────────────────────────────
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    gap: 3,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  slotChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  slotChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Progress ──────────────────────────────────────────────────────────────
  progressWrap: {
    marginTop: 10,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: T.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Empty State ───────────────────────────────────────────────────────────
  emptyWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
  },
  emptyHero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: T.labBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: T.lab + '25',
  },
  emptyIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.lab + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: T.textDark,
    marginBottom: 8,
    fontFamily: FONT.display,
    letterSpacing: -0.5,
  },
  emptySub: {
    fontSize: 14,
    color: T.textMid,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  fallbackGrid: {
    gap: 10,
  },
  fallbackCard: {
    backgroundColor: T.surface,
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.borderLight,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  fallbackAccent: {
    width: 4,
  },
  fallbackBody: {
    flex: 1,
    padding: 12,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: T.textDark,
    marginBottom: 8,
    lineHeight: 20,
  },
  fallbackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});