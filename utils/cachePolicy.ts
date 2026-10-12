import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
  ATTENDANCE_TS: '@last_fetch_attendance_ts',
  MARKS_TS: '@last_fetch_marks_ts',
  TIMETABLE_TS: '@last_fetch_timetable_ts',
  CALENDAR_TS: '@last_fetch_calendar_ts',
} as const;

export const TTL_MS = {
  ATTENDANCE: 40 * 60 * 1000, // 40 minutes
  MARKS: 2 * 60 * 60 * 1000,   // 2 hours
} as const;

/**
 * Checks if attendance data is stale (> 40 minutes old).
 */
export async function isAttendanceStale(): Promise<boolean> {
  try {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.ATTENDANCE_TS);
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > TTL_MS.ATTENDANCE;
  } catch {
    return true;
  }
}

/**
 * Records that attendance was just fetched successfully.
 */
export async function recordAttendanceFetched(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.ATTENDANCE_TS, String(Date.now()));
  } catch {}
}

/**
 * Checks if marks data is stale (> 2 hours old).
 */
export async function isMarksStale(): Promise<boolean> {
  try {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.MARKS_TS);
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > TTL_MS.MARKS;
  } catch {
    return true;
  }
}

/**
 * Records that marks were just fetched successfully.
 */
export async function recordMarksFetched(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.MARKS_TS, String(Date.now()));
  } catch {}
}

/**
 * Helper to check if a timestamp is from today (since midnight local time).
 * Timetable & Calendar only change at most once per day.
 */
function isFromToday(timestamp: number): boolean {
  if (!timestamp || isNaN(timestamp)) return false;
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * Checks if timetable data is stale (not yet fetched today).
 */
export async function isTimetableStale(): Promise<boolean> {
  try {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.TIMETABLE_TS);
    if (!ts) return true;
    return !isFromToday(parseInt(ts, 10));
  } catch {
    return true;
  }
}

/**
 * Records that timetable was just fetched successfully.
 */
export async function recordTimetableFetched(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.TIMETABLE_TS, String(Date.now()));
  } catch {}
}

/**
 * Checks if calendar data is stale (not yet fetched today).
 */
export async function isCalendarStale(): Promise<boolean> {
  try {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.CALENDAR_TS);
    if (!ts) return true;
    return !isFromToday(parseInt(ts, 10));
  } catch {
    return true;
  }
}

/**
 * Records that calendar was just fetched successfully.
 */
export async function recordCalendarFetched(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.CALENDAR_TS, String(Date.now()));
  } catch {}
}

/**
 * Clears all cache timestamps (e.g. on manual logout or account reset).
 */
export async function clearAllCacheTimestamps(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
  } catch {}
}

