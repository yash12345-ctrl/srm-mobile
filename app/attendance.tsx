import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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

import { API_BASE_URL, fetchScrapedData } from '../utils/api';
import { isAttendanceStale, recordAttendanceFetched } from '../utils/cachePolicy';
import { SkeletonBlock } from '../components/Skeleton';
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
    const percentage = Number.parseFloat(item.percentage || item.attendance) || 0;
    const isSafe = percentage >= 75;
    const title = item.title || item.subject || '';
    const isLab = title.toLowerCase().includes('lab') || title.toLowerCase().includes('practical');

    const totalHours = Number.parseInt(item.maxHours || item.totalHours) || 0;
    const absent = Number.parseInt(item.absent || item.totalAbsent) || 0;
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
              {((item.title || item.subject) ?? ' ').charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.subjectTitle} numberOfLines={1}>{item.title || item.subject}</Text>
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

const AttendanceBody = ({ loading, attData }: { loading: boolean; attData: any[];  }) => {
  if (loading) {
    return (
      <View style={{ padding: 16, gap: 16, marginTop: 12 }}>
        <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
        <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
        <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
        <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
        <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
      </View>
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

// --- COMPONENT: STUDENT PORTAL LOGIN CARD ---
const PortalLoginCard = ({
  netId,
  portalPassword,
  setPortalPassword,
  showPortalPassword,
  setShowPortalPassword,
  onSubmit,
  submitting,
  error,
  isModal = false,
  onClose,
}: {
  netId: string;
  portalPassword: string;
  setPortalPassword: (val: string) => void;
  showPortalPassword: boolean;
  setShowPortalPassword: (val: boolean) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  isModal?: boolean;
  onClose?: () => void;
}) => {
  return (
    <View style={[styles.loginCard, isModal && styles.loginCardModal]}>
      {isModal && onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.loginModalCloseBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={THEME.textSec} />
        </TouchableOpacity>
      )}

      <View style={styles.loginIconBox}>
        <Ionicons name="lock-closed" size={26} color={THEME.accent} />
      </View>

      <Text style={styles.loginTitle}>Student Portal Login</Text>
      <Text style={styles.loginSubtitle}>
        Attendance is hosted on the SRM Student Portal.{'\n'}
        Enter your password once to enable automatic background syncs.
      </Text>

      {error ? (
        <View style={styles.loginErrorBanner}>
          <Ionicons name="alert-circle" size={18} color={THEME.danger} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.loginErrorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.loginInputGroup}>
        <Text style={styles.loginInputLabel}>NetID</Text>
        <View style={[styles.loginInputBox, styles.loginInputBoxDisabled]}>
          <Ionicons name="person-outline" size={18} color={THEME.textLight} style={{ marginRight: 10 }} />
          <Text style={styles.loginInputDisabledText}>{netId || 'SRM NetID'}</Text>
          <Ionicons name="shield-checkmark" size={16} color={THEME.success} style={{ marginLeft: 'auto' }} />
        </View>
      </View>

      <View style={styles.loginInputGroup}>
        <Text style={styles.loginInputLabel}>Portal Password</Text>
        <View style={styles.loginInputBox}>
          <Ionicons name="key-outline" size={18} color={THEME.textSec} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.loginTextInput}
            placeholder="Enter Student Portal password"
            placeholderTextColor={THEME.textLight}
            secureTextEntry={!showPortalPassword}
            value={portalPassword}
            onChangeText={setPortalPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
          <TouchableOpacity
            onPress={() => setShowPortalPassword(!showPortalPassword)}
            style={styles.loginEyeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPortalPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={THEME.textSec}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.loginSubmitBtn, submitting && styles.loginSubmitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loginSubmitBtnText}>Connecting to Student Portal...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
            <Text style={styles.loginSubmitBtnText}>Fetch Attendance</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.loginSecurityNotice}>
        <Ionicons name="shield-checkmark-outline" size={14} color={THEME.textSec} />
        <Text style={styles.loginSecurityText}>
          Your password is saved securely to sync your attendance, grades, and marks.
        </Text>
      </View>
    </View>
  );
};

// --- COMPONENT: CAPTCHA MODAL ---
const CaptchaModal = ({
  visible,
  base64,
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  base64: string | null;
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) => {
  if (!visible || !base64) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.captchaOverlay}>
        <View style={styles.captchaCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.captchaTitle}>Manual Captcha Required</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={THEME.textSec} />
            </TouchableOpacity>
          </View>
          <Text style={styles.captchaDesc}>
            Our automatic solver couldn&apos;t read this one. Please enter the characters below to continue.
          </Text>

          <View style={styles.captchaImageContainer}>
            <Image
              source={{ uri: `data:image/png;base64,${base64}` }}
              style={styles.captchaImage}
              resizeMode="contain"
            />
          </View>

          <TextInput
            style={styles.captchaInput}
            placeholder="Enter captcha text"
            placeholderTextColor={THEME.textLight}
            value={value}
            onChangeText={onChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />

          <TouchableOpacity style={styles.captchaSubmitBtn} onPress={onSubmit} activeOpacity={0.8}>
            <Text style={styles.captchaSubmitText}>Submit Captcha</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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

  // STUDENT PORTAL AUTH & CAPTCHA STATE
  const [netId, setNetId] = useState<string>("");
  const [portalPassword, setPortalPassword] = useState<string>("");
  const [showPortalPassword, setShowPortalPassword] = useState<boolean>(false);
  const [portalSubmitting, setPortalSubmitting] = useState<boolean>(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [showPortalModal, setShowPortalModal] = useState<boolean>(false);
  const [captchaStatus, setCaptchaStatus] = useState<{ pending: boolean; base64: string | null }>({ pending: false, base64: null });
  const [captchaInput, setCaptchaInput] = useState<string>("");

  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startCaptchaPolling = useCallback((username: string) => {
    if (!username) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/attendance/status/${encodeURIComponent(username)}`);
        const data = await res.json();
        if (data && data.pending && data.base64) {
          setCaptchaStatus({ pending: true, base64: data.base64 });
        } else {
          setCaptchaStatus({ pending: false, base64: null });
        }
      } catch (e) {
        // silent fail on polling errors
      }
    }, 2000);
  }, []);

  const stopCaptchaPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setCaptchaStatus({ pending: false, base64: null });
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const submitCaptcha = async () => {
    if (!captchaInput.trim() || !netId) return;
    try {
      await fetch(`${API_BASE_URL}/attendance/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: netId, text: captchaInput.trim() })
      });
      setCaptchaStatus({ pending: false, base64: null });
      setCaptchaInput('');
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const storedNetId = await AsyncStorage.getItem('user_netid');
      if (storedNetId) setNetId(storedNetId);

      const storedPortalPass = await AsyncStorage.getItem('portal_password');
      if (storedPortalPass) setPortalPassword(storedPortalPass);

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

  // Handle successful data extraction from the scraper
  const handleScrapeComplete = useCallback((data: any) => {
    console.log(`[AttendanceScreen] handleScrapeComplete called. Data type:`, typeof data);
    
    // 1. If backend returns an explicit error or failure, don't wipe the UI
    if (data && data.success === false) {
      console.log(`[AttendanceScreen] handleScrapeComplete: Explicit error from backend:`, data.error);
      const errMsg = data.error || "Sync failed.";
      if (
        errMsg.toLowerCase().includes('password') ||
        errMsg.toLowerCase().includes('credential') ||
        errMsg.toLowerCase().includes('login')
      ) {
        setPortalError(errMsg);
      }
      setSyncStep(errMsg);
      setTimeout(() => setSyncStep(""), 3500);
      setRefreshing(false);
      setLoading(false);
      return;
    }

    // 2. Extract the actual attendance array
    const newAttData = Array.isArray(data) ? data : (data.attendance || null);
    console.log(`[AttendanceScreen] handleScrapeComplete: Extracted newAttData (isArray: ${Array.isArray(newAttData)}, length: ${newAttData?.length})`);

    // 3. Only update the UI and cache if we actually got valid data
    if (newAttData && newAttData.length > 0) {
      console.log(`[AttendanceScreen] handleScrapeComplete: Valid data found, updating state and cache`);
      setAttData(newAttData);
      setPortalError(null);
      
      // Fix: Cache the newly fetched data so the user doesn't hit a loading screen next time
      const cacheObj = { 
        data: newAttData, 
        lastUpdated: data?.lastUpdated || new Date().toISOString() 
      };
      AsyncStorage.setItem('attendance_data_v2', JSON.stringify(cacheObj)).catch(() => {});

      // Sync into academic_data so the Dashboard immediately receives attendance
      AsyncStorage.getItem('academic_data').then(oldStr => {
        const old = oldStr ? JSON.parse(oldStr) : {};
        const updated = { ...old, attendance: newAttData };
        AsyncStorage.setItem('academic_data', JSON.stringify(updated)).catch(() => {});
      }).catch(() => {});
    }
    
    if (data && data.lastUpdated) {
      setLastUpdated(data.lastUpdated);
    }

    setRefreshing(false);
    setLoading(false);
    
    // Clear the sync message shortly after success
    setTimeout(() => setSyncStep(""), 2500);
  }, []);

  const fetchAttendance = async (force: boolean = false) => {
    try {
      console.log(`[AttendanceScreen] fetchAttendance started (force: ${force})`);
      setSyncStep("Fetching attendance from backend...");
      setPortalError(null);
      if (netId) startCaptchaPolling(netId);
      const data = await fetchScrapedData('attendance/login', { forceSync: force });
      stopCaptchaPolling();
      console.log(`[AttendanceScreen] fetchAttendance completed, calling handleScrapeComplete`);
      handleScrapeComplete(data);
      recordAttendanceFetched();
    } catch (err: any) {
      stopCaptchaPolling();
      console.log(`[AttendanceScreen] fetchAttendance error:`, err.message);
      const msg = err.message || "Sync failed.";
      if (
        msg.toLowerCase().includes('password') ||
        msg.toLowerCase().includes('credential') ||
        msg.toLowerCase().includes('login')
      ) {
        setPortalError(msg);
      }
      setSyncStep(msg);
      setRefreshing(false);
      setLoading(false);
      
      // Clear the error message after a few seconds
      setTimeout(() => setSyncStep(""), 3500);
    }
  };

  const handlePortalLogin = async () => {
    if (!portalPassword.trim()) {
      setPortalError('Please enter your portal password.');
      return;
    }
    if (!netId) {
      setPortalError('NetID is missing. Please restart or log in again.');
      return;
    }

    try {
      setPortalSubmitting(true);
      setPortalError(null);
      setSyncStep("Authenticating with Student Portal...");
      startCaptchaPolling(netId);

      const data = await fetchScrapedData('attendance/login', {
        forceSync: true,
        password: portalPassword.trim(),
        manual: true,
      });

      stopCaptchaPolling();

      if (data && data.success === false) {
        setPortalError(data.error || 'Failed to authenticate with Student Portal.');
        setSyncStep(data.error || "Sync failed.");
        return;
      }

      await AsyncStorage.setItem('portal_password', portalPassword.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      handleScrapeComplete(data);
      recordAttendanceFetched();
      setShowPortalModal(false);
      setPortalError(null);
    } catch (err: any) {
      stopCaptchaPolling();
      const msg = err.message || 'Error connecting to Student Portal';
      setPortalError(msg);
      setSyncStep(msg);
    } finally {
      setPortalSubmitting(false);
    }
  };

  useEffect(() => {
    if (scraperKey > 0) {
      fetchAttendance(true);
    } else {
      Promise.all([
        AsyncStorage.getItem('portal_password'),
        AsyncStorage.getItem('attendance_data_v2'),
        AsyncStorage.getItem('attendance_data')
      ]).then(async ([portalPass, cachedV2, cachedV1]) => {
        const hasCached = !!(cachedV2 || cachedV1);
        if (cachedV2) {
          handleScrapeComplete(JSON.parse(cachedV2));
        } else if (cachedV1) {
          handleScrapeComplete(JSON.parse(cachedV1));
        }

        // Only call backend if cache is missing OR older than 40 minutes
        if (portalPass) {
          const isStale = await isAttendanceStale();
          if (!hasCached) {
            setLoading(true);
            fetchAttendance(false);
          } else if (isStale) {
            // Background revalidation (> 40 mins)
            fetchAttendance(false);
          } else {
            setLoading(false);
          }
        } else {
          // Completely new user without portal password:
          // DO NOT call fetchAttendance! Show the Student Portal Login Card immediately!
          setLoading(false);
        }
      });
    }
  }, [scraperKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSyncStep("Starting sync...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScraperKey(prev => prev + 1); // Trigger fetch
  }, []);

  const overallAvg = useMemo(() => {
    if (!attData.length) return 0;
    const startedSubjects = attData.filter(item => (Number.parseInt(item.maxHours || item.totalHours) || 0) > 0);
    if (startedSubjects.length === 0) return 0;
    const total = startedSubjects.reduce((acc, curr) => acc + (Number.parseFloat(curr.percentage || curr.attendance) || 0), 0);
    return Number.parseFloat((total / startedSubjects.length).toFixed(1));
  }, [attData]);

  const isAuthError = Boolean(
    portalError && (
      portalError.toLowerCase().includes('password') || 
      portalError.toLowerCase().includes('credential') ||
      portalError.toLowerCase().includes('login')
    )
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={THEME.navBg} />

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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPortalModal(true);
            }}
            style={styles.headerPortalBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="key-outline" size={16} color={THEME.accent} />
            <Text style={styles.headerPortalBtnText}>Portal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={26} color={THEME.textMain} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 50, flexGrow: 1 }}
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
        {loading && attData.length === 0 ? (
          <View style={{ padding: 16, gap: 16, marginTop: 12 }}>
            <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
            <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
            <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
            <SkeletonBlock style={{ height: 110, borderRadius: 20 }} />
          </View>
        ) : (!loading && attData.length === 0) || (isAuthError && attData.length === 0) ? (
          <View style={styles.loginWrap}>
            <PortalLoginCard
              netId={netId}
              portalPassword={portalPassword}
              setPortalPassword={setPortalPassword}
              showPortalPassword={showPortalPassword}
              setShowPortalPassword={setShowPortalPassword}
              onSubmit={handlePortalLogin}
              submitting={portalSubmitting}
              error={portalError}
            />
          </View>
        ) : (
          <>
            {isAuthError && (
              <View style={styles.authWarningBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="warning" size={18} color={THEME.warning} style={{ marginRight: 8 }} />
                  <Text style={styles.authWarningText} numberOfLines={2}>
                    Portal session expired. Tap to re-authenticate.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.authWarningBtn}
                  onPress={() => setShowPortalModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.authWarningBtnText}>Login</Text>
                </TouchableOpacity>
              </View>
            )}

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

            <View style={styles.listContainer}>
              <Text style={styles.sectionTitle}>Detailed Performance</Text>
              <AttendanceBody loading={loading} attData={attData} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Captcha Modal */}
      <CaptchaModal
        visible={captchaStatus.pending && Boolean(captchaStatus.base64)}
        base64={captchaStatus.base64}
        value={captchaInput}
        onChange={setCaptchaInput}
        onSubmit={submitCaptcha}
        onClose={() => setCaptchaStatus({ pending: false, base64: null })}
      />

      {/* Portal Credentials Modal for updating anytime */}
      <Modal
        visible={showPortalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPortalModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScrollWrap}
            keyboardShouldPersistTaps="handled"
          >
            <PortalLoginCard
              netId={netId}
              portalPassword={portalPassword}
              setPortalPassword={setPortalPassword}
              showPortalPassword={showPortalPassword}
              setShowPortalPassword={setShowPortalPassword}
              onSubmit={handlePortalLogin}
              submitting={portalSubmitting}
              error={portalError}
              isModal={true}
              onClose={() => setShowPortalModal(false)}
            />
          </ScrollView>
        </View>
      </Modal>
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

  // PORTAL LOGIN CARD & MODAL
  loginWrap: {
    padding: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  loginCard: {
    backgroundColor: THEME.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  loginCardModal: {
    width: '100%',
    maxWidth: 420,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 30, 46, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalScrollWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  loginModalCloseBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: THEME.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.accent + '25',
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.textMain,
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  loginSubtitle: {
    fontSize: 13,
    color: THEME.textSec,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  loginErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.danger + '35',
  },
  loginErrorText: {
    flex: 1,
    fontSize: 12,
    color: THEME.danger,
    fontWeight: '600',
    lineHeight: 17,
  },
  loginInputGroup: {
    marginBottom: 16,
  },
  loginInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSec,
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  loginInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    height: 50,
  },
  loginInputBoxDisabled: {
    backgroundColor: THEME.borderLight,
    borderColor: THEME.border,
  },
  loginInputDisabledText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textMain,
    flex: 1,
  },
  loginTextInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.textMain,
    fontWeight: '500',
    height: '100%',
  },
  loginEyeBtn: {
    padding: 6,
  },
  loginSubmitBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  loginSubmitBtnDisabled: {
    opacity: 0.7,
  },
  loginSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loginSecurityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 10,
  },
  loginSecurityText: {
    fontSize: 11,
    color: THEME.textSec,
    textAlign: 'center',
    flex: 1,
  },

  // HEADER PORTAL BUTTON
  headerPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: THEME.accentLight,
    borderWidth: 1,
    borderColor: THEME.accent + '25',
  },
  headerPortalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.accent,
  },

  // AUTH WARNING BANNER
  authWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.warningBg,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: THEME.warning + '35',
  },
  authWarningText: {
    fontSize: 12,
    color: THEME.warning,
    fontWeight: '600',
  },
  authWarningBtn: {
    backgroundColor: THEME.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 10,
  },
  authWarningBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // CAPTCHA MODAL
  captchaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  captchaCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  captchaTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.textMain,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  captchaDesc: {
    fontSize: 12,
    color: THEME.textSec,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 17,
  },
  captchaImageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 14,
  },
  captchaImage: {
    width: 180,
    height: 60,
  },
  captchaInput: {
    backgroundColor: THEME.surfaceWarm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: THEME.textMain,
    marginBottom: 14,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 2,
  },
  captchaSubmitBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captchaSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
