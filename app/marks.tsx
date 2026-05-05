import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    Easing,
    FadeInDown,
    interpolate,
    useAnimatedProps,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
    Circle,
    Defs,
    G,
    Line,
    Path,
    Rect,
    Stop,
    LinearGradient as SvgLinearGradient,
    Text as SvgText,
} from 'react-native-svg';

import SRMMarksScraper from '../components/SRMMarksScraper';

const { width } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedView = Animated.createAnimatedComponent(View);

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface AssessmentComponent {
    name: string;
    scoreStr: string;
    obtained: number;
    max: number;
    percent: number;
}

// ─── REGEX CONSTANTS ──────────────────────────────────────────────────────────
const REGEX = {
    NON_ALPHANUM: /[^\dA-Z]/gi,
    COURSE_CODE:  /\d{2}[A-Z]{2,3}\d{3}[A-Z]?/i,
    CLEAN_NAME:   /(?:\s*-\s*)?(Theory|Practical|Regular)/gi,
    NUMERIC:      /\d+\.?\d*/g,
    SCORE_FORMAT: /^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)$/,
    NAMED_ABSENT: /^([\w-]+)\s*\/\s*(\d+\.?\d*)\s*(absent|abs|ab)$/i,
    NAMED_SCORE:  /^([\w-]+)\s*\/\s*(\d+\.?\d*)\s+(\d+\.?\d*)$/i,
    TRAILING_SCORE: /\/\s*(\d+\.?\d*)\s+(\d+\.?\d*)$/,
    SLASH_MAX:    /^([\w\s()]+)\s*\/\s*(\d+\.?\d*)$/,
    NAMED_CHUNK:  /([a-z][\w-]*)\s*\/\s*(\d+\.?\d*)\s*((?:absent|abs|ab)\b|\d+\.?\d*)/gi,
    ABSENT_TOKENS: /^(ab|abs|absent)$/i,
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
    bg:          '#F5F2ED',
    cardBg:      '#FFFFFF',
    navBg:       '#F5F2ED',
    surfaceWarm: '#FDFBF8',

    text:        '#1A1E2E',
    textSub:     '#5C6070',
    textLight:   '#9CA3AF',

    accent:      '#2D3A8C',
    accentLight: '#EEF0FB',
    accentMid:   '#6B7AC4',

    scoreHigh:   '#1A7A4A',  scoreHighBg: '#E6F7F0',
    scoreMid:    '#B45309',  scoreMidBg:  '#FEF4E6',
    scoreLow:    '#C0392B',  scoreLowBg:  '#FDF3F2',

    border:      '#E5E1D8',
    borderLight: '#F0EDE8',
    gridLine:    '#EEF0FB',
    shadow:      '#A89F97',

    graphLine:   '#2D3A8C',
    graphDot:    '#1E2A7A',
    graphFill:   '#2D3A8C',

    success:     '#0E7A4A',
};

const FONT = {
    display: Platform.OS === 'ios' ? 'Georgia'     : 'serif',
    mono:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

// ─── SCORE COLOUR HELPER ─────────────────────────────────────────
const scoreColor = (obtained: number, max: number) => {
    if (max === 0) return { color: T.textLight, bg: T.borderLight };
    const pct = (obtained / max) * 100;
    if (pct >= 70) return { color: T.scoreHigh, bg: T.scoreHighBg };
    if (pct >= 45) return { color: T.scoreMid,  bg: T.scoreMidBg  };
    return          { color: T.scoreLow,  bg: T.scoreLowBg  };
};

const formatTime = (isoString?: string) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─── DATA HELPER: ROBUST CROSS-REFERENCE FROM ATTENDANCE ─────────
const normalizeCode = (code: string) => {
    if (!code) return '';
    return code.replaceAll(REGEX.NON_ALPHANUM, '').toUpperCase();
};

const getSubjectMapping = (attendanceData: any[]) => {
    const mapping: Record<string, string> = {};
    if (attendanceData && Array.isArray(attendanceData)) {
        attendanceData.forEach(att => {
            const c = att.code || att.courseCode || '';
            const s = att.subject || att.title || '';
            if (c && s) {
                const codeMatch = c.match(REGEX.COURSE_CODE);
                const cleanCode = codeMatch ? codeMatch[0].toUpperCase() : normalizeCode(c);

                let cleanName = s.replaceAll(REGEX.CLEAN_NAME, '').trim();
                if (cleanName.startsWith(cleanCode)) {
                    cleanName = cleanName.replaceAll(cleanCode, '').replace(/^[-\s]+/, '').trim();
                }

                mapping[cleanCode] = cleanName;
                mapping[normalizeCode(c)] = cleanName;
            }
        });
    }
    return mapping;
};

// ─── DATA TRANSFORMATION ─────────────────────────────────────────
const transformScraperData = (flatMarks: any[]) => {
    const grouped: Record<string, any> = {};
    flatMarks.forEach(mark => {
        if (mark?.code?.includes('Semester')) return;
        const key = mark.code || mark.name;
        if (!grouped[key]) {
            grouped[key] = { code: mark.code, name: mark.name, components: [] };
        }
        const extractedScore = mark.scores ?? mark.score ?? mark.marks ?? mark.mark ?? mark.obtained ?? '';
        const extractedTest  = mark.type ?? mark.test ?? mark.assessment ?? mark.name ?? 'Assessment';
        grouped[key].components.push({ test: extractedTest, score: extractedScore });
    });
    return Object.values(grouped);
};

// ─── PARSING HELPERS ─────────────────────────────────────────────
const heuristicMax = (val: number) => {
    if (val <= 0) return 0;
    const stages = [5, 10, 15, 20, 25, 50, 60];
    for (const s of stages) {
        if (val <= s) return s;
    }
    return 100;
};

const parseKnownFormat = (raw: string, baseName: string): AssessmentComponent | null => {
    let match = REGEX.NAMED_ABSENT.exec(raw);
    if (match) {
        const max = Number.parseFloat(match[2]) || 0;
        return { name: match[1], scoreStr: `0 / ${max}`, obtained: 0, max, percent: 0 };
    }

    match = REGEX.NAMED_SCORE.exec(raw);
    if (match) {
        const max = Number.parseFloat(match[2]) || 0;
        const obtained = Number.parseFloat(match[3]) || 0;
        return { name: match[1], scoreStr: `${obtained} / ${max}`, obtained, max, percent: max > 0 ? (obtained / max) * 100 : 0 };
    }

    match = REGEX.SCORE_FORMAT.exec(raw);
    if (match) {
        const obtained = Number.parseFloat(match[1]) || 0;
        const max = Number.parseFloat(match[2]) || 0;
        return { name: baseName, scoreStr: `${obtained} / ${max}`, obtained, max, percent: max > 0 ? (obtained / max) * 100 : 0 };
    }

    match = REGEX.TRAILING_SCORE.exec(raw);
    if (match) {
        const max = Number.parseFloat(match[1]) || 0;
        const obtained = Number.parseFloat(match[2]) || 0;
        const label = raw.slice(0, raw.lastIndexOf('/')).trim() || baseName;
        return { name: label, scoreStr: `${obtained} / ${max}`, obtained, max, percent: max > 0 ? (obtained / max) * 100 : 0 };
    }

    match = REGEX.SLASH_MAX.exec(raw);
    if (match) {
        const max = Number.parseFloat(match[2]) || 0;
        return { name: match[1].trim() || baseName, scoreStr: `0 / ${max}`, obtained: 0, max, percent: 0 };
    }

    return null;
};

const parseSingleAssessmentSegment = (segment: string, fallbackName: string): AssessmentComponent => {
    const raw = String(segment ?? '').trim();
    const baseName = typeof fallbackName === 'string'
        ? fallbackName.replaceAll(REGEX.CLEAN_NAME, '').trim() || 'Assessment'
        : 'Assessment';

    if (REGEX.ABSENT_TOKENS.test(raw.toLowerCase()) || raw === '-' || raw === '') {
        return { name: baseName, scoreStr: '0', obtained: 0, max: 0, percent: 0 };
    }

    const knownMatch = parseKnownFormat(raw, baseName);
    if (knownMatch) return knownMatch;

    const matches = Array.from(raw.matchAll(REGEX.NUMERIC));
    if (matches.length >= 2) {
        const max = Number.parseFloat(matches.at(-2)?.[0] || '0') || 0;
        const obtained = Number.parseFloat(matches.at(-1)?.[0] || '0') || 0;
        return { name: baseName, scoreStr: `${obtained} / ${max}`, obtained, max, percent: max > 0 ? (obtained / max) * 100 : 0 };
    }

    const oVal = Number.parseFloat(raw.replaceAll(/[^\d.]/g, '')) || 0;
    const mVal = heuristicMax(oVal);
    const pVal = mVal > 0 ? (oVal / mVal) * 100 : 0;
    return { name: baseName, scoreStr: mVal > 0 ? `${oVal} / ${mVal}` : raw, obtained: oVal, max: mVal, percent: pVal };
};

const parseAssessmentSegments = (scoreText: string, fallbackName: string): AssessmentComponent[] => {
    const raw = String(scoreText ?? '').trim();
    if (!raw) return [];

    const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
    if (lines.length > 1) {
        return lines.flatMap(line => parseAssessmentSegments(line, fallbackName));
    }

    const namedMatches = Array.from(raw.matchAll(REGEX.NAMED_CHUNK));
    const residual = raw.replaceAll(REGEX.NAMED_CHUNK, '').replaceAll(/[\s,;|]+/g, '');

    if (namedMatches.length > 0 && !/[\dA-Za-z]/.test(residual)) {
        return namedMatches.map(m => {
            const name = m[1];
            const max = Number.parseFloat(m[2]) || 0;
            const obtainedToken = m[3];
            if (REGEX.ABSENT_TOKENS.test(obtainedToken)) {
                return { name, scoreStr: `0 / ${max}`, obtained: 0, max, percent: 0 };
            }
            const obtained = Number.parseFloat(obtainedToken) || 0;
            return { name, scoreStr: `${obtained} / ${max}`, obtained, max, percent: max > 0 ? (obtained / max) * 100 : 0 };
        });
    }

    return [parseSingleAssessmentSegment(raw, fallbackName)];
};

const processMarksData = (item: any) => {
    const components = item.components || item.marks || [];
    let totalObtained = 0;
    let totalMax = 0;
    const finalProcessed: AssessmentComponent[] = [];

    components.forEach((comp: any) => {
        const existingObtained = typeof comp.obtained === 'number' ? comp.obtained : Number(comp.obtained);
        const existingMax = typeof comp.max === 'number' ? comp.max : Number(comp.max);

        let rawScore = String(comp.score ?? comp.scores ?? comp.scoreStr ?? comp.mark ?? comp.marks ?? '').trim();
        const rawTestName = String(comp.test || comp.name || comp.type || 'Assessment').trim();

        if (!rawScore && Number.isFinite(existingObtained)) {
            rawScore = (existingMax > 0) ? `${existingObtained} / ${existingMax}` : String(existingObtained);
        }

        if ((rawScore.toLowerCase() === 'abs' || rawScore === '0') && existingMax > 0) {
            rawScore = `0 / ${existingMax}`;
        }

        const scoreMatch = REGEX.SCORE_FORMAT.exec(rawScore);
        if (rawTestName.includes('/') && scoreMatch && REGEX.ABSENT_TOKENS.test(rawTestName)) {
            rawScore = `${rawTestName}/${scoreMatch[2]} ${scoreMatch[1]}`;
        }

        const cleanStr = rawScore.toLowerCase();
        if (REGEX.ABSENT_TOKENS.test(cleanStr) || rawScore === '-' || rawScore === '') {
            finalProcessed.push({ name: rawTestName, scoreStr: rawScore || 'Abs', obtained: 0, max: 0, percent: 0 });
            return;
        }

        const segments = rawScore.split(/\n+/).map(s => s.trim()).filter(Boolean);
        const parsedSegments = (segments.length > 1 ? segments : [rawScore]).flatMap(s => parseAssessmentSegments(s, rawTestName));

        parsedSegments.forEach(parsed => {
            totalObtained += parsed.obtained;
            totalMax += parsed.max;
            finalProcessed.push(parsed);
        });
    });

    const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));
    return { processedComponents: finalProcessed, totalObtained: fmt(totalObtained), totalMax: fmt(totalMax) };
};

// ─── GRIDDED SCORE GRAPH ──────────────────────────────────────────
const ScoreGraph = ({
    data,
    expanded,
}: {
    data: { name: string; obtained: number; max: number; percent: number }[];
    expanded: boolean;
}) => {
    const pts = data.filter(d => d.max > 0);

    const GH = 175;
    const GW = width - 64;
    const mL = 38, mR = 30, mT = 32, mB = 32;

    const aW = GW - mL - mR;
    const aH = GH - mT - mB;

    // ── Fixed 0–100% Y-axis so every assessment is comparable ──────
    const Y_MAX  = 100;
    const yTicks = 4;          // 0, 25, 50, 75, 100
    const yStep  = Y_MAX / yTicks;

    const getX = (i: number) =>
        pts.length <= 1 ? mL + aW / 2 : mL + (i / (pts.length - 1)) * aW;
    const getY = (pct: number) =>
        mT + aH - (Math.max(0, Math.min(Y_MAX, pct)) / Y_MAX) * aH;

    // Plot PERCENTAGE, not raw score
    let linePath = '';
    if (pts.length > 0) {
        linePath = `M ${getX(0)} ${getY(pts[0].percent)}`;
        for (let i = 1; i < pts.length; i++) linePath += ` L ${getX(i)} ${getY(pts[i].percent)}`;
    }
    const fillPath = pts.length > 0
        ? `${linePath} L ${getX(pts.length - 1)} ${mT + aH} L ${getX(0)} ${mT + aH} Z`
        : '';

    // 70% threshold reference line Y position
    const refY = getY(70);

    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = expanded
            ? withDelay(80, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }))
            : 0;
    }, [expanded, progress]);

    const totalLength = pts.reduce((acc, _, i) => {
        if (i === 0) return acc;
        const dx = getX(i) - getX(i - 1);
        const dy = getY(pts[i].percent) - getY(pts[i - 1].percent);
        return acc + Math.hypot(dx, dy);
    }, 0) || aW;

    const lineAnim = useAnimatedProps(() => ({ strokeDashoffset: totalLength * (1 - progress.value) }));
    const fillAnim = useAnimatedProps(() => ({ opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0, 0.12]) }));

    const abbrev = (name: string) => {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
        return name.slice(0, 4);
    };

    if (pts.length === 0) return null;

    return (
        <View style={styles.graphCard}>
            <Text style={styles.graphAxisLabel}>SCORE %</Text>
            <Svg width={GW} height={GH} style={{ overflow: 'visible' }}>
                <Defs>
                    <SvgLinearGradient id="sgFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={T.graphFill} stopOpacity="0.5" />
                        <Stop offset="1" stopColor={T.graphFill} stopOpacity="0"   />
                    </SvgLinearGradient>
                </Defs>

                <Rect x={mL} y={mT} width={aW} height={aH} fill={T.surfaceWarm} rx="4" />

                {/* Horizontal grid lines + Y-axis % labels */}
                {Array.from({ length: yTicks + 1 }, (_, i) => {
                    const val = i * yStep;
                    const y   = getY(val);
                    return (
                        <G key={`h${i}`}>
                            <Line x1={mL} y1={y} x2={mL + aW} y2={y}
                                stroke={T.gridLine} strokeWidth="1" />
                            <SvgText x={mL - 6} y={y + 4}
                                fontSize="9" fill={T.textSub}
                                textAnchor="end" fontWeight="600"
                            >{val}%</SvgText>
                        </G>
                    );
                })}

                {/* 70% threshold dashed reference line */}
                <Line
                    x1={mL} y1={refY} x2={mL + aW} y2={refY}
                    stroke={T.scoreMid} strokeWidth="1"
                    strokeDasharray="4 3"
                    opacity={0.55}
                />
                <SvgText
                    x={mL + aW + 2} y={refY + 4}
                    fontSize="8" fill={T.scoreMid} fontWeight="700"
                >70</SvgText>

                {/* Vertical grid lines */}
                {pts.map((d, i) => (
                    <Line key={`v-${d.name}-${i}`}
                        x1={getX(i)} y1={mT} x2={getX(i)} y2={mT + aH}
                        stroke={T.gridLine} strokeWidth="1" />
                ))}

                <Rect x={mL} y={mT} width={aW} height={aH}
                    fill="none" stroke={T.border} strokeWidth="1" rx="4" />

                {/* X-axis labels */}
                {pts.map((d, i) => (
                    <SvgText key={`xl-${d.name}-${i}`}
                        x={getX(i)} y={GH - 4}
                        fontSize="9" fill={T.textSub}
                        textAnchor="middle" fontWeight="700"
                    >{abbrev(d.name)}</SvgText>
                ))}

                <AnimatedPath d={fillPath} fill="url(#sgFill)" animatedProps={fillAnim} />

                <AnimatedPath
                    d={linePath}
                    stroke={T.graphLine} strokeWidth="2.5"
                    fill="none"
                    strokeDasharray={`${totalLength}`}
                    animatedProps={lineAnim}
                    strokeLinecap="round" strokeLinejoin="round"
                />

                {/* Dots + percentage labels above each dot */}
                {pts.map((d, i) => {
                    const cx  = getX(i);
                    const cy  = getY(d.percent);
                    const clr = scoreColor(d.obtained, d.max);
                    const pctLabel = `${Math.round(d.percent)}%`;
                    return (
                        <G key={`dot-${d.name}-${i}`}>
                            <SvgText x={cx} y={cy - 10}
                                fontSize="10" fill={clr.color}
                                textAnchor="middle" fontWeight="800"
                            >{pctLabel}</SvgText>
                            <Circle cx={cx} cy={cy} r="5" fill={T.cardBg} stroke={T.graphLine} strokeWidth="2" />
                            <Circle cx={cx} cy={cy} r="2.5" fill={T.graphLine} />
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
};


// ─── SCORE BADGE ─────────────────────────────────────────────────
const ScoreBadge = ({ obtained, max }: { obtained: string; max: string }) => {
    const numObt = Number.parseFloat(obtained) || 0;
    const numMax = Number.parseFloat(max)      || 0;
    const clr    = scoreColor(numObt, numMax);
    const pct    = numMax > 0 ? Math.round((numObt / numMax) * 100) : 0;

    if (max === '0') {
        return (
            <View style={[styles.scoreBadge, { backgroundColor: T.borderLight, borderColor: T.border }]}>
                <Text style={[styles.scoreBadgeNum, { color: T.textLight, fontFamily: FONT.mono }]}>—</Text>
                <Text style={[styles.scoreBadgeSub, { color: T.textLight }]}>No Data</Text>
            </View>
        );
    }

    return (
        <View style={[styles.scoreBadge, { backgroundColor: clr.bg, borderColor: clr.color + '30' }]}>
            <View style={styles.scoreBadgeTop}>
                <Text style={[styles.scoreBadgeNum, { color: clr.color, fontFamily: FONT.mono }]}>{obtained}</Text>
                <Text style={[styles.scoreBadgeMax, { color: clr.color }]}>/{max}</Text>
            </View>
            <Text style={[styles.scoreBadgePct, { color: clr.color }]}>{pct}%</Text>
        </View>
    );
};

// ─── MARK CARD ────────────────────────────────────────────────────
const MarkCard = React.memo(({ item, index }: any) => {
    const { processedComponents, totalObtained, totalMax } = processMarksData(item);

    const displayComps = processedComponents.filter((c: any) => {
        const s = String(c.scoreStr ?? '').trim();
        return s !== '-' && s !== '';
    });
    const validComps = displayComps.filter((c: any) => c.max > 0);

    const numObt = Number.parseFloat(totalObtained) || 0;
    const numMax = Number.parseFloat(totalMax)      || 0;
    const barClr = scoreColor(numObt, numMax).color;

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 70).springify().damping(22)}
            style={styles.cardShell}
        >
            {/* Left accent bar — grade color */}
            <View style={[styles.accentBar, { backgroundColor: barClr }]} />

            <View style={styles.card}>
                {/* ── Header row ── */}
                <View style={styles.cardTop}>
                    <View style={styles.cardMeta}>
                        <Text style={styles.subjectName} numberOfLines={2}>{item.name}</Text>
                        {item.code ? (
                            <View style={styles.codeBadge}>
                                <Text style={styles.subjectCode}>{item.code}</Text>
                            </View>
                        ) : null}
                    </View>
                    <ScoreBadge obtained={totalObtained} max={totalMax} />
                </View>

                {displayComps.length > 0 && (
                    <View>
                        {/* Ruled divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerLabel}>Performance</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Graph */}
                        {validComps.length > 0 && (
                            <ScoreGraph data={validComps} expanded={true} />
                        )}

                        {/* Assessment breakdown */}
                        <View style={styles.breakdownWrap}>
                            <Text style={styles.breakdownHeader}>Assessment Details</Text>
                            {displayComps.map((comp: any, i: number) => {
                                const rowScore = String(comp.scoreStr ?? '—').trim() || '—';
                                const clr      = comp.max > 0
                                    ? scoreColor(comp.obtained, comp.max)
                                    : { color: T.textSub, bg: T.borderLight };
                                return (
                                    <View key={`${comp.name}-${i}`} style={[
                                        styles.breakRow,
                                        i === displayComps.length - 1 && { borderBottomWidth: 0 },
                                    ]}>
                                        <View style={styles.breakRowLeft}>
                                            <View style={[styles.breakDot, { backgroundColor: clr.color }]} />
                                            <Text style={styles.breakName} numberOfLines={1}>{comp.name || 'Assessment'}</Text>
                                        </View>
                                        <View style={[styles.breakScorePill, { backgroundColor: clr.bg }]}>
                                            <Text style={[styles.breakScore, { color: clr.color, fontFamily: FONT.mono }]}>
                                                {rowScore}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        </Animated.View>
    );
});
MarkCard.displayName = 'MarkCard';

// ─── SUMMARY STRIP ───────────────────────────────────────────────
const SummaryStrip = ({ data }: { data: any[] }) => {
    const subjects = data.filter(d => !(d?.code?.includes('Semester')));
    const withMarks = subjects.filter(d => {
        const { totalMax } = processMarksData(d);
        return Number.parseFloat(totalMax) > 0;
    });
    const avgPct = withMarks.length === 0 ? 0 : withMarks.reduce((acc, d) => {
        const { totalObtained, totalMax } = processMarksData(d);
        const o = Number.parseFloat(totalObtained) || 0;
        const m = Number.parseFloat(totalMax) || 1;
        return acc + (o / m) * 100;
    }, 0) / withMarks.length;

    const clr = scoreColor(avgPct, 100);

    return (
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { fontFamily: FONT.mono, color: T.accent }]}>
                    {subjects.length}
                </Text>
                <Text style={styles.summaryLab}>Subjects</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { fontFamily: FONT.mono, color: T.accent }]}>
                    {withMarks.length}
                </Text>
                <Text style={styles.summaryLab}>With Marks</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { fontFamily: FONT.mono, color: clr.color }]}>
                    {avgPct.toFixed(1)}%
                </Text>
                <Text style={styles.summaryLab}>Avg Score</Text>
            </View>
        </Animated.View>
    );
};

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
                <Animated.View style={[styles.waveDot, { backgroundColor: T.accentMid }, a2]} />
                <Animated.View style={[styles.waveDot, { backgroundColor: T.textLight }, a3]} />
            </View>
            <Text style={styles.waveLoaderTitle}>{title}</Text>
            <Text style={styles.waveLoaderSub}>{subtitle}</Text>
        </View>
    );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────
export default function MarksScreen() {
    const router  = useRouter();
    const insets  = useSafeAreaInsets();
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [marksData,   setMarksData]   = useState<any[]>([]);

    const [isSyncing, setIsSyncing]     = useState(true);
    const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>("Checking...");

    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });

    const navShadow = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(scrollY.value, [0, 40], [0, 0.06], 'clamp'),
        elevation:     interpolate(scrollY.value, [0, 40], [0, 4],    'clamp'),
        borderBottomColor: `rgba(234,230,223,${interpolate(scrollY.value, [0, 40], [0, 1], 'clamp')})`,
    }));

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('academic_data');
            if (stored) {
                const parsed = JSON.parse(stored);

                const subjectMap = getSubjectMapping(parsed.attendance);

                if (parsed.marks?.length > 0) {
                    let grouped = (!parsed.marks[0]?.components && !Array.isArray(parsed.marks[0]?.marks))
                        ? transformScraperData(parsed.marks)
                        : parsed.marks;

                    grouped = grouped.map((item: any) => {
                        const rawString = item.code || item.name || '';

                        const codeMatch = rawString.match(REGEX.COURSE_CODE);
                        const cleanCode = codeMatch ? codeMatch[0].toUpperCase() : normalizeCode(rawString);

                        const mappedName = subjectMap[cleanCode] || subjectMap[normalizeCode(rawString)];

                        let finalName = item.name;

                        if (!finalName || finalName === cleanCode || finalName.includes('Subject (Check') || finalName === 'Unknown Subject') {
                            finalName = mappedName || cleanCode || 'Unknown Subject';
                        } else if (mappedName && finalName.length < mappedName.length) {
                            finalName = mappedName;
                        }

                        finalName = finalName.replaceAll(REGEX.CLEAN_NAME, '').trim();

                        let finalCode = codeMatch ? codeMatch[0].toUpperCase() : (item.code || cleanCode);
                        if (finalName.startsWith(finalCode)) {
                            finalName = finalName.replace(finalCode, '').replace(/^[-\s]+/, '').trim();
                        }

                        return { ...item, name: finalName, code: finalCode };
                    });

                    if (parsed.marks.lastUpdated) {
                        grouped.lastUpdated = parsed.marks.lastUpdated;
                        setLastUpdatedLabel(formatTime(parsed.marks.lastUpdated));
                    }

                    setMarksData(grouped);
                    setLoading(false); setRefreshing(false);
                    return;
                }
            }
            setLoading(false); setRefreshing(false);
        } catch (e) {
            console.error(e);
            setLoading(false); setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(loadData, 1000);
    };

    const handleScrapeComplete = async (newData: any) => {
        try {
            const stored = await AsyncStorage.getItem('academic_data');
            let parsed = stored ? JSON.parse(stored) : {};
            parsed.marks = newData;
            await AsyncStorage.setItem('academic_data', JSON.stringify(parsed));

            loadData();

            if (newData.lastUpdated) {
                const ageInMs = Date.now() - new Date(newData.lastUpdated).getTime();
                if (ageInMs < 5000) {
                    setLastUpdatedLabel("Just now");
                    setIsSyncing(false);
                } else {
                    setLastUpdatedLabel(formatTime(newData.lastUpdated));
                    setIsSyncing(true);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const displayData = marksData.filter(item => !(item?.code?.includes('Semester')));

    return (
        <View style={styles.root}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" backgroundColor={T.navBg} />

            <View style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}>
                <SRMMarksScraper
                    backgroundMode={true}
                    onScrapeComplete={handleScrapeComplete}
                />
            </View>

            {/* ── NAV BAR ── */}
            <AnimatedView style={[styles.navBar, { paddingTop: insets.top + 8 }, navShadow]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={20} color={T.text} />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.navTitle}>Assessment</Text>

                    <View style={styles.syncPill}>
                        {isSyncing ? (
                            <>
                                <ActivityIndicator size="small" color={T.textSub} style={{ transform: [{ scale: 0.65 }] }} />
                                <Text style={styles.syncText}>
                                    Syncing... (Last: {lastUpdatedLabel})
                                </Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={10} color={T.success} />
                                <Text style={[styles.syncText, { color: T.success }]}>
                                    Up to date
                                </Text>
                            </>
                        )}
                    </View>
                </View>

                <View style={{ width: 40 }} />
            </AnimatedView>

            {/* ── SCROLL CONTENT ── */}
            <Animated.ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + 86 },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={T.accent}
                        colors={[T.accent]}
                    />
                }
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                {loading && displayData.length === 0 && (
                    <WaveLoader
                        title="Syncing marks"
                        subtitle="Fetching your latest assessment scores from Academia."
                        color={T.accent}
                    />
                )}

                {!loading && displayData.length > 0 && <SummaryStrip data={displayData} />}

                {!loading && displayData.map((item, i) => <MarkCard key={`${item.code || item.name}-${i}`} item={item} index={i} />)}

                {displayData.length === 0 && !loading && (
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.empty}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="analytics-outline" size={36} color={T.accent} />
                        </View>
                        <Text style={styles.emptyTitle}>No Marks Yet</Text>
                        <Text style={styles.emptySub}>Pull down to refresh and fetch your latest assessment scores from the portal.</Text>
                    </Animated.View>
                )}

                <View style={{ height: 40 }} />
            </Animated.ScrollView>
        </View>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root:          { flex: 1, backgroundColor: T.bg },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },
    waveLoaderWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
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
        color: T.text,
        fontFamily: FONT.display,
        letterSpacing: -0.3,
    },
    waveLoaderSub: {
        fontSize: 13,
        color: T.textSub,
        textAlign: 'center',
        lineHeight: 20,
    },

    // ── Nav ─────────────────────────────────────────────────────────
    navBar: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: T.navBg,
        paddingBottom: 14, paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: T.cardBg,
        borderWidth: 1, borderColor: T.border,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    headerTitleContainer: { alignItems: 'center' },
    navTitle: {
        fontSize: 18, fontWeight: '800', color: T.text,
        letterSpacing: -0.4, fontFamily: FONT.display,
    },
    syncPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 4,
    },
    syncText: {
        fontSize: 9,
        fontWeight: '700',
        color: T.textLight,
        letterSpacing: 0.4,
    },

    // ── Summary strip ───────────────────────────────────────────────
    summaryStrip: {
        flexDirection: 'row',
        backgroundColor: T.cardBg,
        borderRadius: 18, marginBottom: 18,
        paddingVertical: 16,
        borderWidth: 1, borderColor: T.border,
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    },
    summaryItem:    { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
    summaryVal:     { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    summaryLab:     { fontSize: 10, fontWeight: '700', color: T.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

    // ── Card ────────────────────────────────────────────────────────
    cardShell: {
        marginBottom: 14, borderRadius: 20,
        backgroundColor: T.cardBg,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1, borderColor: T.border,
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
    },
    accentBar: { width: 4 },
    card:      { flex: 1, padding: 18 },

    cardTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    cardMeta:    { flex: 1, paddingRight: 14 },
    subjectName: {
        fontSize: 15, fontWeight: '700', color: T.text,
        marginBottom: 6, letterSpacing: -0.3, lineHeight: 21,
    },
    codeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: T.accentLight,
        paddingHorizontal: 7, paddingVertical: 3,
        borderRadius: 6,
    },
    subjectCode: { fontSize: 11, color: T.accent, fontWeight: '700', letterSpacing: 0.3 },

    // ── Score badge ─────────────────────────────────────────────────
    scoreBadge: {
        minWidth: 72,
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 14, borderWidth: 1,
        alignItems: 'center',
    },
    scoreBadgeTop: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
    scoreBadgeNum: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
    scoreBadgeMax: { fontSize: 11, fontWeight: '700', opacity: 0.7 },
    scoreBadgePct: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginTop: 2, textTransform: 'uppercase' },
    scoreBadgeSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

    // ── Divider row ─────────────────────────────────────────────────
    dividerRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginTop: 16, marginBottom: 12,
    },
    dividerLine:  { flex: 1, height: 1, backgroundColor: T.border },
    dividerLabel: {
        fontSize: 10, fontWeight: '800', color: T.textSub,
        letterSpacing: 1.2, textTransform: 'uppercase',
    },

    // ── Graph ───────────────────────────────────────────────────────
    // FIX: overflow removed so SVG labels at edges are never clipped
    graphCard: {
        backgroundColor: T.surfaceWarm,
        borderRadius: 14,
        paddingTop: 10, paddingBottom: 2,
        borderWidth: 1, borderColor: T.borderLight,
        marginBottom: 4,
    },
    graphAxisLabel: {
        fontSize: 9, fontWeight: '800', color: T.textSub,
        letterSpacing: 1.2, marginLeft: 8, marginBottom: 2,
        textTransform: 'uppercase',
    },

    // ── Breakdown ───────────────────────────────────────────────────
    breakdownWrap: {
        marginTop: 12,
        backgroundColor: T.surfaceWarm,
        borderRadius: 14, borderWidth: 1, borderColor: T.borderLight,
        paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
    },
    breakdownHeader: {
        fontSize: 10, fontWeight: '800', color: T.textSub,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
    },
    breakRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: T.borderLight,
    },
    breakRowLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    breakDot:       { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
    breakName:      { fontSize: 13, color: T.text, fontWeight: '600', flex: 1 },
    breakScorePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    breakScore:     { fontSize: 13, fontWeight: '800' },

    // ── Empty ───────────────────────────────────────────────────────
    empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
    emptyIcon: {
        width: 72, height: 72, borderRadius: 20,
        backgroundColor: T.accentLight,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
        borderWidth: 1, borderColor: T.accent + '25',
    },
    emptyTitle: {
        fontSize: 18, fontWeight: '800', color: T.text,
        fontFamily: FONT.display, letterSpacing: -0.3,
    },
    emptySub: {
        fontSize: 13, color: T.textLight,
        textAlign: 'center', paddingHorizontal: 40,
        lineHeight: 20,
    },
});
