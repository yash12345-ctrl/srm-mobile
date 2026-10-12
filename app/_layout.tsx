import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, LogBox } from 'react-native';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
]);

import { useColorScheme } from '@/hooks/use-color-scheme';
// ─── Global Error Boundary ────────────────────────────────────────────────────
// Catches any unhandled React render errors and shows a friendly screen
// instead of letting them bubble to native and trigger the OS "force stop" dialog.
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <View style={eb.card}>
            <Text style={eb.emoji}>⚠️</Text>
            <Text style={eb.title}>Something went wrong</Text>
            <Text style={eb.msg}>{this.state.errorMsg}</Text>
            <TouchableOpacity
              style={eb.btn}
              onPress={() => this.setState({ hasError: false, errorMsg: '' })}
            >
              <Text style={eb.btnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F2ED', padding: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  emoji:     { fontSize: 40, marginBottom: 12 },
  title:     { fontSize: 18, fontWeight: '800', color: '#1A1E2E', marginBottom: 8 },
  msg:       { fontSize: 13, color: '#5C6070', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  btn:       { backgroundColor: '#2D3A8C', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});
// ─────────────────────────────────────────────────────────────────────────────

export const unstable_settings = {
  initialRouteName: 'login/index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const hasHandledSessionExpired = useRef(false);

  const SESSION_DATA_KEYS = [
    'academic_data',
    'timetable_data',
    'academic_calendar_data',
    'student_profile_data',
    'attendance_data_v2',
    'attendance_data',
    'portal_password',
    'grades_data',
    'session_active'
  ] as const;

  const handleGlobalSessionDeath = useCallback(() => {
    if (hasHandledSessionExpired.current) return;
    hasHandledSessionExpired.current = true;
    
    // Wipe scraped data; keep user_netid so login screen can greet the user
    AsyncStorage.multiRemove([...SESSION_DATA_KEYS]).catch(() => {});
    
    // Hard redirect to login screen
    router.replace('/login');
  }, [router]);

  return (
    <AppErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login/index" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

