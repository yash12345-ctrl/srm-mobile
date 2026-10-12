import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Core logic extracted from app/attendance.tsx
function computeOverallAvg(attData) {
  if (!Array.isArray(attData) || !attData.length) return 0;
  const startedSubjects = attData.filter((item) => {
    if (!item) return false;
    return (Number.parseInt(item.maxHours || item.totalHours, 10) || 0) > 0;
  });
  if (startedSubjects.length === 0) return 0;
  const total = startedSubjects.reduce(
    (sum, item) => sum + (Number.parseFloat(item.percentage) || 0),
    0
  );
  return Number.parseFloat((total / startedSubjects.length).toFixed(1));
}

function handleAttendanceScrapeComplete(data) {
  if (!data) return { status: 'empty', items: [] };

  // 1. If backend returns an explicit error or failure
  if (data.success === false) {
    return { status: 'error', error: data.error || 'Sync failed.', items: [] };
  }

  // 2. Extract actual attendance array
  const newAttData = Array.isArray(data) ? data : (data.attendance || null);

  if (newAttData && newAttData.length > 0) {
    return {
      status: 'success',
      items: newAttData,
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  }

  return { status: 'no_change', items: [] };
}

describe('Attendance Screen - Crash & Parsing Tests', () => {
  describe('computeOverallAvg', () => {
    test('computes average for standard subjects', () => {
      const data = [
        { code: 'C1', maxHours: '40', percentage: '80.0' },
        { code: 'C2', maxHours: '50', percentage: '90.0' }
      ];
      assert.equal(computeOverallAvg(data), 85.0);
    });

    test('ignores subjects where maxHours is 0', () => {
      const data = [
        { code: 'C1', maxHours: '40', percentage: '80.0' },
        { code: 'C2', maxHours: '0', percentage: '0.0' }
      ];
      assert.equal(computeOverallAvg(data), 80.0);
    });

    test('handles division by zero when all subjects have maxHours 0 without returning Infinity/NaN', () => {
      const data = [
        { code: 'C1', maxHours: '0', percentage: '0.0' },
        { code: 'C2', maxHours: '0', percentage: '0.0' }
      ];
      const res = computeOverallAvg(data);
      assert.equal(res, 0);
      assert.ok(Number.isFinite(res));
    });

    test('handles null/undefined/empty array safely', () => {
      assert.equal(computeOverallAvg(null), 0);
      assert.equal(computeOverallAvg(undefined), 0);
      assert.equal(computeOverallAvg([]), 0);
      assert.equal(computeOverallAvg([null, undefined]), 0);
    });

    test('handles corrupted string values in hours or percentage', () => {
      const data = [
        { code: 'C1', maxHours: 'forty', percentage: 'good' },
        { code: 'C2', maxHours: null, percentage: undefined },
        { code: 'C3', maxHours: '40', percentage: '75.5' }
      ];
      assert.doesNotThrow(() => computeOverallAvg(data));
      assert.equal(computeOverallAvg(data), 75.5);
    });
  });

  describe('handleAttendanceScrapeComplete Payload Handler', () => {
    test('processes standard backend response { success: true, attendance: [...] }', () => {
      const payload = {
        success: true,
        attendance: [
          { code: '21AIC301J', title: 'DEEP LEARNING', maxHours: '48', attended: '42', absent: '6', percentage: '87.50' }
        ],
        lastUpdated: '2026-10-11T12:00:00Z'
      };
      const res = handleAttendanceScrapeComplete(payload);
      assert.equal(res.status, 'success');
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].code, '21AIC301J');
    });

    test('processes raw array payload (fallback format)', () => {
      const payload = [
        { code: '21AIC301J', title: 'DEEP LEARNING', maxHours: '48', attended: '42', absent: '6', percentage: '87.50' }
      ];
      const res = handleAttendanceScrapeComplete(payload);
      assert.equal(res.status, 'success');
      assert.equal(res.items.length, 1);
    });

    test('handles backend error payload cleanly without crash', () => {
      const payload = { success: false, error: 'Portal session timed out' };
      const res = handleAttendanceScrapeComplete(payload);
      assert.equal(res.status, 'error');
      assert.equal(res.error, 'Portal session timed out');
      assert.equal(res.items.length, 0);
    });

    test('handles null/undefined payload safely', () => {
      assert.doesNotThrow(() => handleAttendanceScrapeComplete(null));
      assert.doesNotThrow(() => handleAttendanceScrapeComplete(undefined));
      const res = handleAttendanceScrapeComplete(null);
      assert.equal(res.status, 'empty');
    });

    test('handles empty attendance list without wiping previous state unnecessarily', () => {
      const payload = { success: true, attendance: [] };
      const res = handleAttendanceScrapeComplete(payload);
      assert.equal(res.status, 'no_change');
    });
  });
});
