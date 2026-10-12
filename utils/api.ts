import AsyncStorage from '@react-native-async-storage/async-storage';

// In development, this would be your local machine's IP if running on a real device,
// or 10.0.2.2 for Android emulator, or localhost for iOS simulator.
export const API_BASE_URL = 'http://192.168.1.10:5000/api';

export const fetchScrapedData = async (
  endpoint: string,
  options?: { forceSync?: boolean; password?: string; manual?: boolean }
) => {
  try {
    const username = await AsyncStorage.getItem('user_netid');
    const storedPortalPassword = await AsyncStorage.getItem('portal_password');
    const storedAcademiaPassword = await AsyncStorage.getItem('user_password');
    const sessionToken = await AsyncStorage.getItem('session_token');

    if (!username) {
      await AsyncStorage.removeItem('session_active');
      throw new Error('No credentials found. Please restart the app to login again.');
    }

    const isPortalEndpoint =
      endpoint.startsWith('attendance') ||
      endpoint.startsWith('grades') ||
      endpoint.startsWith('internal-marks') ||
      endpoint.startsWith('internalmarks') ||
      endpoint.startsWith('calendar') ||
      endpoint.startsWith('fee');

    // For student portal endpoints, MUST ONLY use options.password or storedPortalPassword.
    // NEVER fall back to academia password (storedAcademiaPassword), because sending the
    // wrong password to SRM Student Portal blocks the student's account for 5 minutes!
    const password = isPortalEndpoint
      ? options?.password || storedPortalPassword
      : options?.password || storedAcademiaPassword;

    if (isPortalEndpoint && !password) {
      throw new Error('PORTAL_PASSWORD_REQUIRED');
    }

    if (!password) {
      throw new Error('No credentials found. Please restart the app to login again.');
    }

    const body: any = { username, password };
    if (options?.forceSync) {
      body.forceSync = true;
    }
    if (options?.manual) {
      body.manual = true;
    }

    console.log(`[API] Requesting ${API_BASE_URL}/${endpoint} (forceSync: ${!!options?.forceSync})`);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    console.log(`[API] Response status: ${response.status}`);

    const data = await response.json();
    console.log(`[API] Response data (first 300 chars):`, JSON.stringify(data).substring(0, 300));

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch data from backend');
    }

    return data.data !== undefined ? data.data : data;
  } catch (error: any) {
    if (
      !error.message?.includes('manually sync once') &&
      error.message !== 'PORTAL_PASSWORD_REQUIRED'
    ) {
      console.warn(`[API] Error fetching ${endpoint}:`, error.message);
    }
    throw error;
  }
};
