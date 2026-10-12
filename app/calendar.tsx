import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchScrapedData } from '../utils/api';
import { isCalendarStale, recordCalendarFetched } from '../utils/cachePolicy';
import { SkeletonBlock } from '../components/Skeleton';
const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:           '#F7F5F2',
  surface:      '#FFFFFF',
  surfaceWarm:  '#FDFBF8',
  elevated:     '#FFFFFF',
  border:       '#EAE6DF',
  borderLight:  '#F0EDE8',
  primary:      '#2D6A8F',
  primaryLight: '#EAF3F9',
  primaryMid:   '#7AAFC5',
  regular:      '#2D6A8F',   regularBg:  '#EAF3F9',   regularBar: '#2D6A8F',
  holiday:      '#2A9D6A',   holidayBg:  '#E6F7F0',   holidayBar: '#2A9D6A',
  today:        '#1A5276',   todayBg:    '#D6EAF8',
  textDark:     '#1C1917',
  textMid:      '#57534E',
  textLight:    '#A8A29E',
  textOnAccent: '#FFFFFF',
  shadow:       '#A89F97',
  success:      '#0E7A4A',
};

const FONT = {
  display: Platform.OS === 'ios' ? 'Georgia'          : 'serif',
  mono:    Platform.OS === 'ios' ? 'Courier New'      : 'monospace',
  body:    Platform.OS === 'ios' ? 'System'           : 'sans-serif',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function eventType(event: string, day: string): 'holiday' | 'regular' {
  const e = (event || '').toLowerCase();
  const d = (day || '').toUpperCase().trim();
  if (d.includes('SUN') || d.includes('SAT') || e.includes('holiday') || e.includes('vacation') || e.includes('recess')) {
      return 'holiday';
  }
  return 'regular';
}

const TYPE_CFG = {
  regular: { color: T.regular, bg: T.regularBg, bar: T.regularBar, icon: 'book-outline'      as const, label: 'Class Day' },
  holiday: { color: T.holiday, bg: T.holidayBg, bar: T.holidayBar, icon: 'sunny-outline'     as const, label: 'Holiday'   },
};

const formatTime = (isoString?: string) => {
  if (!isoString) return "Unknown";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const LegendDot = ({ type }: { type: keyof typeof TYPE_CFG }) => (
  <View style={legendStyles.item}>
    <View style={[legendStyles.dot, { backgroundColor: TYPE_CFG[type].bar }]} />
    <Text style={legendStyles.text}>{TYPE_CFG[type].label}</Text>
  </View>
);
const legendStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, color: T.textLight, fontWeight: '600' },
});

const EventRow = ({ item, index, isToday, isHighlighted }: { item: any; index: number; isToday: boolean; isHighlighted: boolean; }) => {
  const type = eventType(item.event, item.day);
  const cfg  = TYPE_CFG[type];
  
  const isWeekend = (item.day || '').toUpperCase().includes('SUN') || (item.day || '').toUpperCase().includes('SAT');
  let displayEvent = item.event;
  if (isWeekend) displayEvent = 'Holiday';

  const highlight = useSharedValue(0);
  useEffect(() => {
    if (isHighlighted) {
      highlight.value = withTiming(1, { duration: 200 }, () => {
        highlight.value = withTiming(0, { duration: 1200 });
      });
    }
  }, [isHighlighted]);

    let dateColor = T.textDark;
    if (isToday) {
      dateColor = T.textOnAccent;
    } else if (type === 'holiday') {
      dateColor = T.holiday;
    }

  const rowStyle = useAnimatedStyle(() => {
    const isRowHighlighted = interpolate(highlight.value, [0, 1], [0, 1]) > 0.5;
    return {
      backgroundColor: isRowHighlighted ? cfg.bg : T.surface,
    };
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 25).springify().damping(20)} style={styles.rowWrap}>
      <View style={styles.dateCol}>
        <Text style={[styles.dayName, { color: type === 'holiday' ? T.holiday : T.textLight }]}>{item.day}</Text>
        <View style={[styles.dateBubble, isToday && { backgroundColor: T.primary }]}>
          <Text style={[styles.dateNum, { color: dateColor }, isToday && { fontFamily: FONT.display }, ]}>{item.date}</Text>
        </View>
      </View>

      <View style={[styles.connector, { backgroundColor: cfg.bar + '30' }]} />

      <Animated.View style={[styles.card, rowStyle, isToday && styles.cardToday, { borderLeftColor: cfg.bar }, ]}>
        <View style={[styles.cardIconWrap, { backgroundColor: cfg.bg }]}><Ionicons name={cfg.icon} size={15} color={cfg.color} /></View>
        <View style={styles.cardBody}>
          <Text style={[styles.eventText, { color: type === 'regular' ? T.textDark : cfg.color }]} numberOfLines={2}>{displayEvent}</Text>
          {isToday && (<View style={styles.todayPip}><Text style={styles.todayPipText}>TODAY</Text></View>)}
        </View>

        {type === 'regular' && item.dayOrder && item.dayOrder !== '-' && (
          <View style={[styles.doBadge, { backgroundColor: cfg.bg, borderColor: cfg.bar + '30' }]}>
            <Text style={[styles.doLabel, { color: cfg.color }]}>DO</Text>
            <Text style={[styles.doValue, { color: cfg.color, fontFamily: FONT.mono }]}>
              {item.dayOrder.replace('DO - ', '').replace('Day Order - ', '')}
            </Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};


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
        <Animated.View style={[styles.waveDot, { backgroundColor: T.today }, s3]} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.loadingWaveText}>
        Syncing Calendar...
      </Animated.Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const [calendarData, setCalendarData] = useState<{ monthNames: string[]; monthsData: any[][], lastUpdated?: string } | null>(null);
  const [hasPortalPassword, setHasPortalPassword] = useState(true);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  
  // Sync Indicator
  const [isSyncing, setIsSyncing] = useState(true);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>("Checking...");

  const todayDate         = new Date().getDate().toString();
  const currentMonthShort = new Date().toLocaleString('en-US', { month: 'short' });
  const currentMonthLong  = new Date().toLocaleString('en-US', { month: 'long' });

  const handleScrapeComplete = (data: any) => {
    let calendarData = data.calendar || data;
    
    // --- NEW FORMAT SUPPORT ---
    if (calendarData.rows && !calendarData.monthNames) {
      const monthMap = new Map<string, any[]>();
      calendarData.rows.forEach((row: any) => {
        if (!row.date) return;
        const parts = row.date.split('-');
        let d = NaN, m = NaN, y = NaN;
        if (parts.length === 3) {
            if (parts[0].length === 4) { // YYYY-MM-DD
                y = parseInt(parts[0], 10); m = parseInt(parts[1], 10) - 1; d = parseInt(parts[2], 10);
            } else { // DD-MM-YYYY
                d = parseInt(parts[0], 10); m = parseInt(parts[1], 10) - 1; y = parseInt(parts[2], 10);
            }
        } else {
            const dt = new Date(row.date);
            if (!isNaN(dt.getTime())) { y = dt.getFullYear(); m = dt.getMonth(); d = dt.getDate(); }
        }
        
        if (!isNaN(y)) {
           const dateObj = new Date(y, m, d);
           const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
           if (!monthMap.has(monthName)) monthMap.set(monthName, []);
           monthMap.get(monthName)!.push({
               date: d.toString(),
               day: row.day,
               event: (row.remarks && row.remarks !== '-') ? row.remarks : row.status,
               dayOrder: row.dayOrder
           });
        }
      });
      calendarData = {
          monthNames: Array.from(monthMap.keys()),
          monthsData: Array.from(monthMap.values()),
          lastUpdated: calendarData.lastUpdated
      };
    }
    
    if (!calendarData || !calendarData.monthNames) return;
    setCalendarData(calendarData);
    AsyncStorage.setItem('academic_calendar_data', JSON.stringify(data)).catch(() => {});
    const mIndex = calendarData.monthNames.findIndex((m: string) => m.includes(currentMonthShort) || m.includes(currentMonthLong));
    setCurrentMonthIndex(mIndex === -1 ? 0 : mIndex);
    
    if (data.lastUpdated) {
      setLastUpdatedLabel(formatTime(data.lastUpdated));
    }
    setIsSyncing(false);
  };

  const handlePrevMonth = () => {
    if (currentMonthIndex > 0) setCurrentMonthIndex(prev => prev - 1);
  };

  const handleNextMonth = () => {
    if (calendarData && currentMonthIndex < calendarData.monthsData.length - 1) {
      setCurrentMonthIndex(prev => prev + 1);
    }
  };

  const todayData = useMemo(() => {
    if (!calendarData) return null;
    const mIndex = calendarData.monthNames.findIndex(m => m.includes(currentMonthShort) || m.includes(currentMonthLong));
    if (mIndex !== -1) {
      return calendarData.monthsData[mIndex]?.find((d: any) => d.date === todayDate) || null;
    }
    return null;
  }, [calendarData, todayDate, currentMonthShort, currentMonthLong]);

  const scrollViewRef = useRef<ScrollView>(null);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [monthKey, setMonthKey] = useState(0); 
  const [refreshing, setRefreshing] = useState(false);

  const fetchCalendar = useCallback(async (force: boolean = false) => {
    try {
      const portalPass = await AsyncStorage.getItem('portal_password');
      if (!portalPass) {
        setHasPortalPassword(false);
        setIsSyncing(false);
        setRefreshing(false);
        return;
      }
      setHasPortalPassword(true);
      setIsSyncing(true);
      const data = await fetchScrapedData('calendar/login', { forceSync: force });
      handleScrapeComplete(data);
      recordCalendarFetched();
    } catch (e: any) {
      if (e.message !== 'PORTAL_PASSWORD_REQUIRED') {
        console.error(e);
      }
    } finally {
      setIsSyncing(false);
      setRefreshing(false);
    }
  }, []);

  const loadCachedCalendar = useCallback(async () => {
    try {
      const portalPass = await AsyncStorage.getItem('portal_password');
      setHasPortalPassword(Boolean(portalPass));

      const cached = await AsyncStorage.getItem('academic_calendar_data');
      const hasCached = !!cached;
      if (cached) {
        try {
          handleScrapeComplete(JSON.parse(cached));
        } catch {}
      }

      // Only call backend if cache missing OR not yet fetched today (morning sync)
      if (portalPass) {
        const isStale = await isCalendarStale();
        if (!hasCached || isStale) {
          fetchCalendar(false);
        } else {
          setIsSyncing(false);
        }
      } else {
        setIsSyncing(false);
      }
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
    }
  }, [fetchCalendar]);

  useEffect(() => {
    loadCachedCalendar();
  }, [loadCachedCalendar]);

  useFocusEffect(
    useCallback(() => {
      loadCachedCalendar();
    }, [loadCachedCalendar])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCalendar(true);
  }, [fetchCalendar]);

  const goToMonth = useCallback((dir: 'prev' | 'next') => {
    setSlideDir(dir === 'next' ? 'left' : 'right');
    setMonthKey(k => k + 1);
    if (dir === 'prev') handlePrevMonth();
    else handleNextMonth();
  }, [handlePrevMonth, handleNextMonth]);

  const jumpToToday = useCallback(() => {
    if (!calendarData) return;
    const mIndex = calendarData.monthNames.findIndex(
      m => m.includes(currentMonthShort) || m.includes(currentMonthLong)
    );
    if (mIndex !== -1) setCurrentMonthIndex(mIndex);
  }, [calendarData, currentMonthShort, currentMonthLong]);

  const currentData   = calendarData?.monthsData[currentMonthIndex] || [];
  const currentName   = calendarData?.monthNames[currentMonthIndex] || '';
  const isCurrentMonth = currentName.includes(currentMonthShort) || currentName.includes(currentMonthLong);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* Scraper moved to backend */}

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={T.textDark} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>Academic Calendar</Text>
          <View style={styles.syncPill}>
            {isSyncing ? (
              <>
                <ActivityIndicator size="small" color={T.textLight} style={{ transform: [{ scale: 0.7 }] }} />
                <Text style={styles.syncText}>
                  Syncing... (Last: {lastUpdatedLabel})
                </Text>
              </>
            ) : hasPortalPassword ? (
              <>
                <Ionicons name="checkmark-circle" size={12} color={T.success} />
                <Text style={[styles.syncText, { color: T.success }]}>
                  Up to date
                </Text>
              </>
            ) : (
              <Text style={styles.syncText}>Setup Required</Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={jumpToToday}
          style={({ pressed }) => [styles.todayBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="today-outline" size={15} color={T.primary} />
          <Text style={styles.todayBtnText}>Today</Text>
        </Pressable>
      </Animated.View>

      {!calendarData && !hasPortalPassword ? (
        <View style={styles.portalSetupWrap}>
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.portalSetupCard}>
            <View style={styles.portalSetupIconWrap}>
              <Ionicons name="key-outline" size={32} color={T.primary} />
            </View>
            <Text style={styles.portalSetupTitle}>Student Portal Setup Required</Text>
            <Text style={styles.portalSetupSub}>
              To view your academic calendar and class schedule, please go to Attendance and enter your Student Portal credentials once.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.portalSetupBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/attendance')}
            >
              <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
              <Text style={styles.portalSetupBtnText}>Go to Attendance</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </View>
      ) : calendarData ? (
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.primary}
            />
          }
        >
          {/* ── TODAY WIDGET ─────────────────────────────────────────────────── */}
          {todayData && (() => {
            const type = eventType(todayData.event, todayData.day);
            const cfg  = TYPE_CFG[type];
            const isWeekend = (todayData.day || '').toUpperCase().includes('SUN') || (todayData.day || '').toUpperCase().includes('SAT');
            let displayEvent = todayData.event;
            if (isWeekend) displayEvent = 'Holiday';
            if (displayEvent === 'Regular Classes') displayEvent = 'Regular Class Day';
            
            return (
              <Animated.View entering={FadeInDown.delay(80).springify()} style={[styles.todayWidget, { borderColor: cfg.bar + '30' }]}>
                <View style={[styles.widgetAccent, { backgroundColor: cfg.bar }]} />
                <View style={styles.widgetContent}>
                  <View style={styles.widgetLeft}>
                    <Text style={styles.widgetSup}>TODAY · {todayData.date} {currentMonthShort}</Text>
                    <Text style={[styles.widgetTitle, { color: cfg.color }]} numberOfLines={1}>
                      {displayEvent}
                    </Text>
                    <View style={styles.widgetMeta}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[styles.widgetMetaText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  
                  {type === 'regular' && (
                      <View style={[styles.widgetBadge, { backgroundColor: cfg.bg, borderColor: cfg.bar + '30' }]}>
                        <Text style={[styles.widgetBadgeTop, { color: cfg.color }]}>DAY ORDER</Text>
                        <Text style={[styles.widgetBadgeVal, { color: cfg.color, fontFamily: FONT.mono }]}>
                          {todayData.dayOrder === '-'
                            ? 'N/A'
                            : todayData.dayOrder.replace('DO - ', '').replace('Day Order - ', '')}
                        </Text>
                      </View>
                  )}
                </View>
              </Animated.View>
            );
          })()}

          {/* ── MONTH NAVIGATOR ──────────────────────────────────────────────── */}
          <Animated.View entering={FadeIn.delay(150)} style={styles.navRow}>
            <Pressable
              onPress={() => goToMonth('prev')}
              disabled={currentMonthIndex === 0}
              style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.5 }, currentMonthIndex === 0 && styles.navBtnDisabled]}
            >
              <Ionicons name="chevron-back" size={20} color={currentMonthIndex > 0 ? T.primary : T.border} />
            </Pressable>

            <View style={styles.monthPill}>
              <View style={styles.monthPillInner}>
                <Text style={styles.monthName}>{currentName}</Text>
              </View>
              <View style={styles.monthCount}>
                <Text style={styles.monthCountText}>{currentData.length} days</Text>
              </View>
            </View>

            <Pressable
              onPress={() => goToMonth('next')}
              disabled={!calendarData || currentMonthIndex >= calendarData.monthsData.length - 1}
              style={({ pressed }) => [
                styles.navBtn,
                pressed && { opacity: 0.5 },
                (!calendarData || currentMonthIndex >= calendarData.monthsData.length - 1) && styles.navBtnDisabled,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={(!calendarData || currentMonthIndex >= calendarData.monthsData.length - 1) ? T.border : T.primary}
              />
            </Pressable>
          </Animated.View>

          {/* ── LEGEND & DIVIDER ──────────────────────────────────────────── */}
          <View style={styles.legendContainer}>
            <View style={styles.legendRow}>
              <LegendDot type="regular"  />
              <LegendDot type="holiday"  />
            </View>
            <View style={styles.divider} />
          </View>

          {/* ── EVENT LIST (Mapped inside ScrollView) ───────────────────────── */}
          <View style={styles.listContent}>
            <Animated.View
              key={monthKey}
              entering={slideDir === 'left' ? SlideInRight.duration(280) : SlideInLeft.duration(280)}
            >
              {currentData.map((item: any, index: number) => {
                const isToday = isCurrentMonth && item.date === todayDate;
                return (
                  <View key={item.id || `${item.date}-${index}`}>
                    <EventRow
                      item={item}
                      index={index}
                      isToday={isToday}
                      isHighlighted={false}
                    />
                  </View>
                );
              })}
            </Animated.View>
          </View>

          </ScrollView>
      ) : (
        <View style={{ padding: 16, gap: 12, marginTop: 40 }}>
            <SkeletonBlock style={{ height: 100, borderRadius: 20 }} />
            <SkeletonBlock style={{ height: 50, borderRadius: 16, marginTop: 10 }} />
            <SkeletonBlock style={{ height: 50, borderRadius: 16 }} />
            <SkeletonBlock style={{ height: 50, borderRadius: 16 }} />
            <SkeletonBlock style={{ height: 50, borderRadius: 16 }} />
            <SkeletonBlock style={{ height: 50, borderRadius: 16 }} />
            <SkeletonBlock style={{ height: 50, borderRadius: 16 }} />
        </View>
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

  // ── LOADING WAVE STYLES ───────────────────────────────────────────────
  loadingWaveContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
    zIndex: 10,
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
    letterSpacing: 0.5,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: T.textDark,
    letterSpacing: -0.5,
    fontFamily: FONT.display,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '600',
    color: T.textLight,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: T.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.primary + '25',
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.primary,
  },

  // ── Today Widget ─────────────────────────────────────────────────────────
  todayWidget: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: T.surface,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  widgetAccent: {
    width: 6,
  },
  widgetContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12, 
  },
  widgetLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  widgetSup: {
    fontSize: 12,
    fontWeight: '700',
    color: T.textLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  widgetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
    fontFamily: FONT.display,
  },
  widgetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  widgetMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  widgetBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  widgetBadgeTop: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  widgetBadgeVal: {
    fontSize: 24,
    fontWeight: '900',
  },

  // ── Month navigator ───────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.border,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  monthPill: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  monthPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthName: {
    fontSize: 17,
    fontWeight: '800',
    color: T.primary,
    letterSpacing: -0.3,
    fontFamily: FONT.display,
  },
  monthCount: {
    marginTop: 2,
  },
  monthCountText: {
    fontSize: 12,
    color: T.textLight,
    fontWeight: '600',
  },

  // ── Legend & Divider Container ────────────────────────────────────────────
  legendContainer: {
    backgroundColor: T.bg, 
    zIndex: 10, 
    paddingTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: T.border,
    marginHorizontal: 16,
    marginBottom: 10,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // ── Event row ─────────────────────────────────────────────────────────────
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 0,
  },
  dateCol: {
    width: 48,
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dateBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dateNum: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONT.display,
    lineHeight: 20,
  },
  connector: {
    width: 14,
    height: 2,
    borderRadius: 1,
    marginRight: 10,
    flexShrink: 0,
  },
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: T.borderLight,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardToday: {
    borderColor: T.primary + '30',
    shadowColor: T.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  eventText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  todayPip: {
    alignSelf: 'flex-start',
    backgroundColor: T.todayBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  todayPipText: {
    fontSize: 9,
    fontWeight: '900',
    color: T.primary,
    letterSpacing: 1,
  },
  doBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  doLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  doValue: {
    fontSize: 15,
    fontWeight: '900',
  },

  // ── Portal Setup Card ──────────────────────────────────────────
  portalSetupWrap: {
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  portalSetupCard: {
    backgroundColor: T.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.borderLight,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  portalSetupIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: T.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.primary + '25',
  },
  portalSetupTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: T.textDark,
    fontFamily: FONT.display,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  portalSetupSub: {
    fontSize: 14,
    color: T.textMid,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  portalSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  portalSetupBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});