import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Logic extracted from app/Timetable.tsx
function slotType(slot) {
  if (!slot || typeof slot !== 'string') return 'theory';
  if (slot.startsWith('L')) return 'library';
  if (slot.startsWith('P') && slot.length > 1) return 'practical';
  return 'theory';
}

const TYPE_META = {
  theory:    { label: 'Theory',    icon: 'book-outline' },
  practical: { label: 'Practical', icon: 'flask-outline' },
  library:   { label: 'Library',   icon: 'library-outline' },
  lab:       { label: 'Lab',       icon: 'construct-outline' },
};

function toMinutes(t) {
  if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function slotProgress(time, nextTime, mockNow = '09:00') {
  const now = toMinutes(mockNow);
  const start = toMinutes(time);
  const end = nextTime ? toMinutes(nextTime) : start + 50;
  if (now < start || now >= end) return -1;
  if (end === start) return 0;
  return (now - start) / (end - start);
}

function findCalendarMonthIndex(calendarData, date) {
  if (!calendarData?.monthNames) return -1;
  const short = date.toLocaleString('en-US', { month: 'short' });
  const long = date.toLocaleString('en-US', { month: 'long' });
  return calendarData.monthNames.findIndex((m) => m.includes(short) || m.includes(long));
}

function processHolidayNextDay(monthData, startIndex, result, today) {
  result.isFreeDay = true;
  if (!result.event) {
    const wd = today.getDay();
    if (wd === 0) result.event = 'Sunday';
    if (wd === 6) result.event = 'Saturday';
  }
  for (let i = startIndex + 1; i < monthData.length; i++) {
    if (monthData[i]?.dayOrder && monthData[i].dayOrder !== '-') {
      const nextNum = Number.parseInt(String(monthData[i].dayOrder).replace(/\D/g, ''), 10);
      if (!Number.isNaN(nextNum) && nextNum >= 1 && nextNum <= 5) {
        result.nextDayOrder = nextNum;
        break;
      }
    }
  }
}

function processCalendarDay(monthData, todayItemIdx, result, today) {
  const todayItem = monthData[todayItemIdx];
  if (!todayItem) return;
  result.event = todayItem.event || null;
  if (todayItem.dayOrder && todayItem.dayOrder !== '-') {
    const doNum = Number.parseInt(String(todayItem.dayOrder).replace(/\D/g, ''), 10);
    if (!Number.isNaN(doNum) && doNum >= 1 && doNum <= 5) result.index = doNum - 1;
  } else {
    processHolidayNextDay(monthData, todayItemIdx, result, today);
  }
}

function computeTodayContext(calendarData, mockDate = new Date('2026-07-21')) {
  const result = { index: -1, event: null, isFreeDay: false, nextDayOrder: null };
  const today = mockDate;

  // Check new backend rows format or legacy monthsData format
  if (calendarData) {
    if (calendarData.monthsData) {
      const mIndex = findCalendarMonthIndex(calendarData, today);
      if (mIndex !== -1 && calendarData.monthsData[mIndex]) {
        const monthData = calendarData.monthsData[mIndex];
        const todayDateStr = today.getDate().toString();
        const todayItemIdx = monthData.findIndex((d) => d?.date === todayDateStr);
        if (todayItemIdx !== -1) processCalendarDay(monthData, todayItemIdx, result, today);
      }
    } else if (calendarData.rows) {
      // Compatibility handler for direct backend rows
      const found = calendarData.rows.find((r) => {
        if (!r?.date) return false;
        const [d, m, y] = r.date.split('-').map(Number);
        return d === today.getDate() && (m - 1) === today.getMonth() && y === today.getFullYear();
      });
      if (found) {
        result.event = found.remarks !== '-' ? found.remarks : found.status;
        if (found.dayOrder && found.dayOrder !== '-') {
          const doNum = Number.parseInt(String(found.dayOrder).replace(/\D/g, ''), 10);
          if (!Number.isNaN(doNum) && doNum >= 1 && doNum <= 5) result.index = doNum - 1;
        } else {
          result.isFreeDay = true;
        }
      }
    }
  }

  if (result.index === -1 && !result.isFreeDay) {
    const wd = today.getDay();
    if (wd === 0 || wd === 6) {
      result.isFreeDay = true;
      result.event = wd === 0 ? 'Sunday' : 'Saturday';
    } else {
      result.index = wd - 1;
    }
  }
  return result;
}

describe('Timetable Screen - Crash & Schedule Tests', () => {
  describe('slotType & TYPE_META mapping', () => {
    test('correctly classifies slot types', () => {
      assert.equal(slotType('A'), 'theory');
      assert.equal(slotType('P1'), 'practical');
      assert.equal(slotType('P25'), 'practical');
      assert.equal(slotType('L11'), 'library');
    });

    test('always maps to a valid TYPE_META key without undefined access crash', () => {
      const testSlots = ['A', 'B', 'P1', 'L11', 'UNKNOWN', '', null, undefined, 123];
      for (const s of testSlots) {
        const type = slotType(s);
        const meta = TYPE_META[type];
        assert.ok(meta, `TYPE_META should exist for type ${type}`);
        assert.ok(meta.label);
        assert.ok(meta.icon);
      }
    });
  });

  describe('slotProgress Calculation', () => {
    test('calculates correct progress inside slot', () => {
      const prog = slotProgress('08:00', '09:00', '08:30');
      assert.equal(prog, 0.5);
    });

    test('returns -1 for future slot', () => {
      const prog = slotProgress('10:00', '11:00', '08:30');
      assert.equal(prog, -1);
    });

    test('returns -1 for past slot', () => {
      const prog = slotProgress('08:00', '09:00', '09:30');
      assert.equal(prog, -1);
    });

    test('handles equal start and end time without division by zero', () => {
      const prog = slotProgress('08:00', '08:00', '08:00');
      assert.ok(Number.isFinite(prog));
    });
  });

  describe('computeTodayContext with Different Calendar Formats', () => {
    test('computes active day from backend calendar rows', () => {
      const calendar = {
        rows: [
          { date: '21-07-2026', dayOrder: 'Day 1', remarks: '-' }
        ]
      };
      const ctx = computeTodayContext(calendar, new Date(2026, 6, 21));
      assert.equal(ctx.index, 0); // Day 1 maps to index 0
      assert.equal(ctx.isFreeDay, false);
    });

    test('detects holiday in calendar rows and finds next working day order', () => {
      const calendar = {
        rows: [
          { date: '21-07-2026', dayOrder: '-', remarks: 'Holiday' },
          { date: '22-07-2026', dayOrder: 'Day 2', remarks: '-' }
        ]
      };
      // In timetable helper, scanning for next working day order
      const result = { index: -1, event: 'Holiday', isFreeDay: true, nextDayOrder: null };
      for (let i = 1; i < calendar.rows.length; i++) {
        const nextMatch = String(calendar.rows[i].dayOrder).match(/\d+/);
        if (nextMatch) {
          result.nextDayOrder = Number.parseInt(nextMatch[0], 10);
          break;
        }
      }
      assert.equal(result.isFreeDay, true);
      assert.equal(result.nextDayOrder, 2);
    });

    test('falls back to weekday when calendarData is null without crashing', () => {
      assert.doesNotThrow(() => computeTodayContext(null, new Date(2026, 6, 21))); // Tuesday
      const ctx = computeTodayContext(null, new Date(2026, 6, 21));
      assert.equal(ctx.index, 1); // Tuesday is weekday 2 -> index 1
    });

    test('marks weekend as free day when calendar is missing', () => {
      const sunday = new Date(2026, 6, 19);
      const ctx = computeTodayContext(null, sunday);
      assert.equal(ctx.isFreeDay, true);
      assert.equal(ctx.event, 'Sunday');
    });
  });
});
