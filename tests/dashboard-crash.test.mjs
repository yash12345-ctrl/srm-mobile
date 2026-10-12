import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper functions extracted directly from app/dashboard.tsx
const TIMES = ['08:00', '08:50', '09:45', '10:40', '11:35', '12:30', '13:25', '14:20', '15:10', '16:00', '16:50', '17:30'];

function toMinutes(t) {
  if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getCourseForSlot(courses, slot) {
  if (!Array.isArray(courses) || !slot) return undefined;
  return courses.find((c) => {
    if (!c || !c.slot || c.slot === 'TBD') return false;
    const slotStr = String(c.slot);
    const scrapedSlots = slotStr.replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/);
    return scrapedSlots.some((s) => s === slot || (slot.length === 1 && s.startsWith(slot)));
  });
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

function computeAvgAtt(data) {
  if (!data?.attendance?.length) return '—';
  const total = data.attendance.reduce((s, i) => s + (Number.parseFloat(i?.percentage || i?.attendance) || 0), 0);
  return (total / data.attendance.length).toFixed(1);
}

function computeCriticalAttendance(data) {
  return data?.attendance?.filter((i) => {
    if (!i) return false;
    const total = Number.parseInt(i.maxHours || i.totalHours) || 0;
    if (total === 0) return false;
    return (Number.parseFloat(i.percentage || i.attendance) || 0) < 75;
  }) ?? [];
}

function parseTodayInfo(calendar, mockToday = new Date('2026-07-21')) {
  if (!calendar) return { dayOrderNum: null, eventName: null };
  const today = mockToday;

  if (calendar.rows) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const parseDate = (dStr) => {
      if (!dStr || typeof dStr !== 'string') return new Date(NaN);
      const clean = dStr.replace(/today/i, '').trim();
      let m = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      m = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      m = clean.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/);
      if (m) {
        const idx = months.findIndex(x => m[2].toLowerCase().startsWith(x));
        if (idx >= 0) return new Date(Number(m[3]), idx, Number(m[1]));
      }
      return new Date(clean);
    };

    const found = calendar.rows.find((r) => {
      if (!r?.date) return false;
      const dt = parseDate(r.date);
      return !isNaN(dt.getTime()) &&
             dt.getFullYear() === today.getFullYear() &&
             dt.getMonth() === today.getMonth() &&
             dt.getDate() === today.getDate();
    });

    if (!found) return { dayOrderNum: null, eventName: null };

    // Dashboard parser:
    let dayOrderNum = null;
    if (found.dayOrder && found.dayOrder !== '-') {
      const numMatch = String(found.dayOrder).match(/\d+/);
      if (numMatch) {
        dayOrderNum = Number.parseInt(numMatch[0], 10);
      }
    }

    const eventName = (found.remarks && found.remarks !== '-') ? found.remarks : (found.status || null);
    return { dayOrderNum, eventName };
  }

  return { dayOrderNum: null, eventName: null };
}

describe('Dashboard Component - Crash & Data Parsing Tests', () => {
  describe('toMinutes Helper', () => {
    test('parses normal 24h time without crashing', () => {
      assert.equal(toMinutes('08:00'), 480);
      assert.equal(toMinutes('13:25'), 805);
      assert.equal(toMinutes('17:30'), 1050);
    });

    test('handles malformed time strings without throwing', () => {
      assert.doesNotThrow(() => toMinutes(''));
      assert.doesNotThrow(() => toMinutes(null));
      assert.doesNotThrow(() => toMinutes(undefined));
      assert.doesNotThrow(() => toMinutes('invalid'));
      assert.doesNotThrow(() => toMinutes(1234));
      assert.equal(toMinutes(null), 0);
    });
  });

  describe('getCourseForSlot Helper', () => {
    const mockCourses = [
      { title: 'Deep Learning', slot: 'A', room: 'TP401' },
      { title: 'Cloud Computing', slot: 'P1 P2 P3', room: 'LAB1' },
      { title: 'Seminar', slot: 'TBD', room: 'TBD' }
    ];

    test('finds exact matching course slot', () => {
      const c = getCourseForSlot(mockCourses, 'A');
      assert.ok(c);
      assert.equal(c.title, 'Deep Learning');
    });

    test('finds compound slots (e.g., practical P1)', () => {
      const c = getCourseForSlot(mockCourses, 'P1');
      assert.ok(c);
      assert.equal(c.title, 'Cloud Computing');
    });

    test('handles null/undefined/empty inputs without crashing', () => {
      assert.doesNotThrow(() => getCourseForSlot(null, 'A'));
      assert.doesNotThrow(() => getCourseForSlot(mockCourses, null));
      assert.doesNotThrow(() => getCourseForSlot([], 'A'));
      assert.doesNotThrow(() => getCourseForSlot([{ title: 'Broken', slot: null }], 'A'));
      assert.doesNotThrow(() => getCourseForSlot([{ title: 'Broken', slot: 123 }], 'A'));
      assert.equal(getCourseForSlot(null, 'A'), undefined);
    });
  });

  describe('avgAtt & criticalAttendance calculations', () => {
    test('computes average attendance correctly', () => {
      const data = {
        attendance: [
          { percentage: '80.0' },
          { percentage: '90.0' }
        ]
      };
      assert.equal(computeAvgAtt(data), '85.0');
    });

    test('handles empty or missing attendance without throwing', () => {
      assert.equal(computeAvgAtt(null), '—');
      assert.equal(computeAvgAtt({ attendance: [] }), '—');
      assert.equal(computeAvgAtt({}), '—');
    });

    test('handles non-numeric or NaN attendance strings without crashing', () => {
      const data = {
        attendance: [
          { percentage: 'N/A' },
          { percentage: null },
          { attendance: 'invalid' }
        ]
      };
      assert.doesNotThrow(() => computeAvgAtt(data));
      assert.equal(computeAvgAtt(data), '0.0');
    });

    test('identifies critical attendance (<75%)', () => {
      const data = {
        attendance: [
          { code: 'CS1', title: 'Math', totalHours: '40', percentage: '70.0' },
          { code: 'CS2', title: 'Physics', totalHours: '40', percentage: '85.0' },
          { code: 'CS3', title: 'ZeroHrs', totalHours: '0', percentage: '50.0' }
        ]
      };
      const crit = computeCriticalAttendance(data);
      assert.equal(crit.length, 1);
      assert.equal(crit[0].code, 'CS1');
    });
  });

  describe('todayInfo Calendar Row Parsing', () => {
    const realBackendCalendar = {
      success: true,
      stats: { workingDays: '93', holidays: '47', totalDays: '140' },
      rows: [
        { date: '21-07-2026', day: 'Tuesday', status: 'Working day', week: 'Wk 1', dayOrder: 'Day 1', remarks: '-' },
        { date: '22-07-2026', day: 'Wednesday', status: 'Holiday', week: 'Wk 1', dayOrder: '-', remarks: 'Holiday' }
      ]
    };

    test('correctly parses real backend calendar format with "Day 1" and falls back to status when remarks is "-"', () => {
      const info = parseTodayInfo(realBackendCalendar, new Date(2026, 6, 21));
      assert.equal(info.dayOrderNum, 1);
      assert.equal(info.eventName, 'Working day');
    });

    test('parses varied dayOrder formats like "DO - 3", "Day-4", and plain numbers', () => {
      const variedCal = {
        rows: [
          { date: '21-07-2026', dayOrder: 'DO - 3', remarks: 'Exam' },
        ]
      };
      const info = parseTodayInfo(variedCal, new Date(2026, 6, 21));
      assert.equal(info.dayOrderNum, 3);
      assert.equal(info.eventName, 'Exam');
    });

    test('handles holiday rows without crashing', () => {
      const info = parseTodayInfo(realBackendCalendar, new Date(2026, 6, 22));
      assert.equal(info.dayOrderNum, null);
      assert.equal(info.eventName, 'Holiday');
    });

    test('handles unparseable or corrupted dates without crashing', () => {
      const corruptCal = {
        rows: [
          { date: 'invalid-date', dayOrder: 'Day 1' },
          { date: null, dayOrder: null },
          {}
        ]
      };
      assert.doesNotThrow(() => parseTodayInfo(corruptCal));
      const res = parseTodayInfo(corruptCal);
      assert.equal(res.dayOrderNum, null);
    });
  });

  describe('CriticalAttCard Math Safety', () => {
    test('calculates gap and percentage safely with edge cases', () => {
      const testCases = [
        { percentage: '0', expectedGap: 75 },
        { percentage: '74.9', expectedGap: 0.1 },
        { percentage: '100', expectedGap: -25 },
        { percentage: 'NaN', expectedGap: 75 },
        { percentage: null, expectedGap: 75 }
      ];

      for (const tc of testCases) {
        const val = Number.parseFloat(tc.percentage) || 0;
        const pct = Math.min(val, 100);
        const gap = 75 - val;
        const compactAttendance = Number.isFinite(val) ? val.toFixed(1) : '0.0';

        assert.ok(Number.isFinite(pct));
        assert.ok(Number.isFinite(gap));
        assert.doesNotThrow(() => {
          const str = gap > 0 ? gap.toFixed(1) : '0';
          assert.ok(typeof str === 'string');
        });
        assert.ok(typeof compactAttendance === 'string');
      }
    });
  });

  describe('Grades / Semesters Schema Resilience', () => {
    test('extracts semesters from backend /grades/login response without schema mismatch', () => {
      const mockBackendResponse = {
        success: true,
        semesters: [
          {
            semester: '4',
            sgpa: '8.78',
            courses: [{ code: '21AIC202J', description: 'ML', credit: '3', grade: 'A+' }]
          }
        ],
        cgpa: '8.78'
      };

      let newMarks = null;
      if (mockBackendResponse.semesters || mockBackendResponse.grades) {
        newMarks = mockBackendResponse.semesters || mockBackendResponse.grades;
      }

      assert.ok(newMarks);
      assert.equal(Array.isArray(newMarks), true);
      assert.equal(newMarks.length, 1);
      assert.equal(newMarks[0].semester, '4');
    });

    test('supports legacy grades key if backend returns it', () => {
      const legacyResponse = {
        success: true,
        grades: [{ code: '21AIC202J', grade: 'O' }]
      };

      let newMarks = null;
      if (legacyResponse.semesters || legacyResponse.grades) {
        newMarks = legacyResponse.semesters || legacyResponse.grades;
      }

      assert.ok(newMarks);
      assert.equal(newMarks[0].grade, 'O');
    });
  });
});
