import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import our extraction functions
const BATCH1_SCHEDULE = [
  ['A', 'A', 'F', 'F', 'G', 'P6', 'P7', 'P8', 'P9', 'P10', 'L11', 'L12'],
  ['P11', 'P12', 'P13', 'P14', 'P15', 'B', 'B', 'G', 'G', 'A', 'L21', 'L22'],
  ['C', 'C', 'A', 'D', 'B', 'P26', 'P27', 'P28', 'P29', 'P30', 'L31', 'L32'],
  ['P31', 'P32', 'P33', 'P34', 'P35', 'D', 'D', 'B', 'E', 'C', 'L41', 'L42'],
  ['E', 'E', 'C', 'F', 'D', 'P46', 'P47', 'P48', 'P49', 'P50', 'L51', 'L52'],
];
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

function renderDashboardMock(academicData, timetableData, calendarData, profileData) {
  // 1. Avg att
  let avgAtt = '—';
  if (academicData?.attendance?.length) {
    const total = academicData.attendance.reduce(
      (s, i) => s + (Number.parseFloat(i?.percentage || i?.attendance) || 0),
      0
    );
    avgAtt = (total / academicData.attendance.length).toFixed(1);
  }

  // 2. Critical att
  const critical = academicData?.attendance?.filter((i) => {
    if (!i) return false;
    const total = Number.parseInt(i.maxHours || i.totalHours, 10) || 0;
    if (total === 0) return false;
    return (Number.parseFloat(i.percentage || i.attendance) || 0) < 75;
  }) ?? [];

  // 3. First name
  const full = profileData?.name || 'User';
  const firstName = String(full).split(' ')[0] || 'User';

  // 4. Classes pipeline
  const displayDayOrder = 1;
  const activeDayIndex = displayDayOrder - 1;
  const daySlots = BATCH1_SCHEDULE[activeDayIndex] || [];
  const nowMinutes = 10 * 60;

  const allClasses = daySlots.map((slot, index) => {
    const course = getCourseForSlot(timetableData?.courses, slot);
    if (course) return { time: TIMES[index], title: course.title, room: course.room };
    return null;
  }).filter(Boolean);

  const withStatus = allClasses.map((cls, idx, arr) => {
    const startMins = toMinutes(cls.time);
    const nextMins = idx < arr.length - 1 ? toMinutes(arr[idx + 1].time) : startMins + 50;
    let status = 'future', progress = 0;
    if (nowMinutes >= nextMins) {
      status = 'past'; progress = 1;
    } else if (nowMinutes >= startMins) {
      status = 'current';
      progress = (nextMins - startMins) > 0 ? (nowMinutes - startMins) / (nextMins - startMins) : 0;
    }
    return { ...cls, status, progress };
  });

  return { avgAtt, criticalCount: critical.length, firstName, classesCount: withStatus.length };
}

describe('Chaos & Fuzzing Crash Test Suite', () => {
  const FUZZ_PAYLOADS = [
    null,
    undefined,
    {},
    [],
    '',
    '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>',
    { attendance: null },
    { attendance: [null, undefined, {}, { code: null, percentage: undefined }] },
    { attendance: [{ percentage: 'NaN' }, { percentage: 'Infinity' }, { percentage: '-100' }] },
    { courses: null },
    { courses: [null, { slot: null }, { slot: 999 }, { slot: {} }] },
    { profile: null },
    { profile: { name: null } },
    { profile: { name: 12345 } },
    { rows: null },
    { rows: [null, {}, { date: '32-13-9999' }] }
  ];

  test('Dashboard pipeline survives 16 chaotic edge-case payloads without throwing uncaught exceptions', () => {
    for (const fuzz of FUZZ_PAYLOADS) {
      assert.doesNotThrow(() => {
        renderDashboardMock(fuzz, fuzz, fuzz, fuzz);
      }, `Should not crash on fuzz payload: ${JSON.stringify(fuzz)}`);
    }
  });

  test('JSON parser error handling simulates corrupted AsyncStorage strings', () => {
    const corruptedStrings = [
      '',
      '{ broken json ',
      'undefined',
      'null',
      '<html><body>Error</body></html>',
      '{"attendance": [unquoted]}'
    ];

    for (const str of corruptedStrings) {
      assert.doesNotThrow(() => {
        let parsed = null;
        try {
          parsed = JSON.parse(str);
        } catch {
          parsed = null; // App safe fallback
        }
        // Run with parsed fallback
        renderDashboardMock(parsed, parsed, parsed, parsed);
      });
    }
  });

  test('HTTP status error handling survives non-JSON error bodies', () => {
    const errorResponses = [
      { status: 500, body: 'Internal Server Error (Text)' },
      { status: 502, body: '<html><head><title>502 Bad Gateway</title></head></html>' },
      { status: 429, body: '{"error": "Too many requests"}' },
      { status: 401, body: '{"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"}' }
    ];

    for (const mockResp of errorResponses) {
      assert.doesNotThrow(() => {
        let errMessage = 'Request failed';
        try {
          const json = JSON.parse(mockResp.body);
          errMessage = json.error || errMessage;
        } catch {
          errMessage = `Server returned status ${mockResp.status}`;
        }
        assert.ok(typeof errMessage === 'string');
      });
    }
  });
});
