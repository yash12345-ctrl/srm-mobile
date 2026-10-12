import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="small" color="#2D3A8C" />
    </View>
  );
}
