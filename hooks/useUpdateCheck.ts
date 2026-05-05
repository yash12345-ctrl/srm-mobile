/**
 * ─────────────────────────────────────────────────────────────────────────────
 * useUpdateCheck.ts
 *
 * Production-grade update-check hook.
 *
 * Strategy:
 *   1. Only runs on a real Android production build (!__DEV__).
 *   2. Polls `version.json` hosted on GitHub raw (no Play Store HTML scraping).
 *   3. Compares semver: if remote > local → sets showUpdateModal = true.
 *   4. `forceUpdate` flag in the JSON prevents the modal from being dismissed.
 *   5. Caches the last-checked timestamp so we don't hammer the CDN on every
 *      render — re-checks once every 6 hours max.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  ANDROID_PACKAGE,
  CURRENT_VERSION,
  PLAY_STORE_DEEP_LINK,
  PLAY_STORE_WEB_URL,
  VERSION_CHECK_URL,
} from '../constants/AppVersion';
import { Linking } from 'react-native';

// ── Types ────────────────────────────────────────────────────────────────────
interface VersionManifest {
  version: string;
  minVersion?: string;
  forceUpdate?: boolean;
  changelog?: string[];
}

interface UpdateState {
  showUpdateModal: boolean;
  availableVersion: string | null;
  changelog: string[];
  forceUpdate: boolean;
  openStoreListing: () => void;
  dismissUpdate: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const LAST_CHECK_KEY = '@update_last_checked';
const REQUEST_TIMEOUT_MS = 8000;

// ── Semver compare ────────────────────────────────────────────────────────────
/**
 * Returns:
 *   -1  if a < b  (update available)
 *    0  if a === b
 *    1  if a > b
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .split('.')
      .map((p) => Number.parseInt(p, 10) || 0);

  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);

  for (let i = 0; i < len; i++) {
    const ap = av[i] ?? 0;
    const bp = bv[i] ?? 0;
    if (ap < bp) return -1;
    if (ap > bp) return 1;
  }
  return 0;
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Main hook ────────────────────────────────────────────────────────────────
export function useUpdateCheck(): UpdateState {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string[]>([]);
  const [forceUpdate, setForceUpdate] = useState(false);

  // Use a ref so dismissUpdate always reads the LATEST forceUpdate value
  // without needing to be in its dependency array (avoids stale closures).
  const forceUpdateRef = useRef(false);

  // Resolve the actual installed version at runtime.
  // expo-application is the most reliable source on a device build.
  const currentVersion: string =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    CURRENT_VERSION;

  const openStoreListing = useCallback(() => {
    Linking.openURL(PLAY_STORE_DEEP_LINK).catch(() =>
      Linking.openURL(PLAY_STORE_WEB_URL)
    );
  }, []);

  // dismissUpdate: safe — reads from ref, never stale
  const dismissUpdate = useCallback(() => {
    if (!forceUpdateRef.current) {
      setShowUpdateModal(false);
    }
  }, []); // no deps needed — ref is always current

  const checkForUpdate = useCallback(async () => {
    // ── Guard: only run on a real Android production build ──────────────────
    const isProduction =
      Platform.OS === 'android' &&
      !__DEV__;

    if (!isProduction) return;

    // ── Throttle: skip if checked within the last 6 hours ───────────────────
    try {
      const lastChecked = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (lastChecked) {
        const elapsed = Date.now() - Number.parseInt(lastChecked, 10);
        if (elapsed < CHECK_INTERVAL_MS) return;
      }
    } catch {
      // AsyncStorage failure is non-fatal — proceed with the check
    }

    // ── Fetch version manifest ───────────────────────────────────────────────
    try {
      const res = await fetchWithTimeout(VERSION_CHECK_URL, REQUEST_TIMEOUT_MS);

      if (!res.ok) {
        console.warn(`[UpdateCheck] Non-OK response: ${res.status}`);
        return;
      }

      const manifest: VersionManifest = await res.json();

      if (!manifest?.version || typeof manifest.version !== 'string') {
        console.warn('[UpdateCheck] Malformed version manifest:', manifest);
        return;
      }

      // Persist successful check timestamp
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

      const needsUpdate = compareSemver(currentVersion, manifest.version) < 0;

      if (needsUpdate) {
        const isForced = manifest.forceUpdate ?? false;
        setAvailableVersion(manifest.version);
        setChangelog(manifest.changelog ?? []);
        setForceUpdate(isForced);
        forceUpdateRef.current = isForced; // keep ref in sync
        setShowUpdateModal(true);
      }
    } catch (err: unknown) {
      // Network errors, timeouts, JSON parse failures — all non-fatal.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[UpdateCheck] Check failed (non-fatal):', msg);
    }
  }, [currentVersion]);

  useEffect(() => {
    // Small delay so it doesn't compete with the initial data load.
    const timer = setTimeout(checkForUpdate, 2000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    showUpdateModal,
    availableVersion,
    changelog,
    forceUpdate,
    openStoreListing,
    dismissUpdate,
  };
}
