import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Logic extracted from app/calendar.tsx
function transformCalendarData(data) {
  if (!data) return null;
  let calendarData = data.calendar || data;

  if (calendarData.rows && !calendarData.monthNames) {
    const monthMap = new Map();
    calendarData.rows.forEach((row) => {
      if (!row || !row.date) return;
      const parts = String(row.date).split('-');
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

      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dateObj = new Date(y, m, d);
        const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (!monthMap.has(monthName)) monthMap.set(monthName, []);
        monthMap.get(monthName).push({
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

  if (!calendarData || !calendarData.monthNames) return null;
  return calendarData;
}

describe('Calendar Screen - Crash & Transformation Tests', () => {
  const sampleBackendPayload = {
    success: true,
    stats: { workingDays: '93', holidays: '47', totalDays: '140' },
    rows: [
      { date: '21-07-2026', day: 'Tuesday', status: 'Working day', week: 'Wk 1', dayOrder: 'Day 1', remarks: '-' },
      { date: '22-07-2026', day: 'Wednesday', status: 'Holiday', week: 'Wk 1', dayOrder: '-', remarks: 'College Holiday' },
      { date: '15-08-2026', day: 'Saturday', status: 'Holiday', week: 'Wk 4', dayOrder: '-', remarks: 'Independence Day' }
    ]
  };

  test('converts backend rows into monthNames and monthsData format', () => {
    const transformed = transformCalendarData(sampleBackendPayload);
    assert.ok(transformed);
    assert.ok(Array.isArray(transformed.monthNames));
    assert.ok(Array.isArray(transformed.monthsData));
    assert.equal(transformed.monthNames.length, 2); // July 2026 and August 2026
    assert.ok(transformed.monthNames.includes('July 2026'));
    assert.ok(transformed.monthNames.includes('August 2026'));
  });

  test('maps remarks and events properly', () => {
    const transformed = transformCalendarData(sampleBackendPayload);
    const julyData = transformed.monthsData[transformed.monthNames.indexOf('July 2026')];
    assert.equal(julyData[0].date, '21');
    assert.equal(julyData[0].dayOrder, 'Day 1');
    assert.equal(julyData[0].event, 'Working day'); // '-' replaced by status

    assert.equal(julyData[1].date, '22');
    assert.equal(julyData[1].event, 'College Holiday');
  });

  test('handles null, undefined, and empty objects without crashing', () => {
    assert.doesNotThrow(() => transformCalendarData(null));
    assert.doesNotThrow(() => transformCalendarData(undefined));
    assert.doesNotThrow(() => transformCalendarData({}));
    assert.doesNotThrow(() => transformCalendarData({ rows: [] }));
    assert.equal(transformCalendarData(null), null);
    assert.equal(transformCalendarData({}), null);
  });

  test('safely skips malformed date rows without crashing the whole calendar', () => {
    const payloadWithBadRows = {
      rows: [
        { date: 'bad-date', day: 'Mon' },
        null,
        { date: null },
        { date: '21-07-2026', day: 'Tue', remarks: 'Good' }
      ]
    };
    assert.doesNotThrow(() => transformCalendarData(payloadWithBadRows));
    const res = transformCalendarData(payloadWithBadRows);
    assert.ok(res);
    assert.equal(res.monthNames.length, 1);
  });
});
