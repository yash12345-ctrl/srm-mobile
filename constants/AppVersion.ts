/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AppVersion.ts
 *
 * Single source of truth for the app's current version.
 * Bump CURRENT_VERSION and VERSION_CODE together on every Play Store release.
 *
 * VERSION_CODE must match android.versionCode in app.json.
 * CURRENT_VERSION must match expo.version in app.json.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const CURRENT_VERSION = '1.0.5';
export const VERSION_CODE = 9;

/** Play Store package identifier */
export const ANDROID_PACKAGE = 'com.yashtomar21.srmmobile';

/**
 * Raw GitHub URL pointing to version.json in the main branch.
 * This is the authoritative "latest version" source the app polls.
 *
 * version.json shape:
 *   { "version": "1.0.5", "minVersion": "1.0.0", "forceUpdate": true }
 */
export const VERSION_CHECK_URL =
  'https://raw.githubusercontent.com/yash12345-ctrl/srm-mobile/main/version.json';

/**
 * Fallback: deep-link into Play Store app → falls back to browser URL.
 */
export const PLAY_STORE_DEEP_LINK = `market://details?id=${ANDROID_PACKAGE}`;
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=en&gl=US`;
