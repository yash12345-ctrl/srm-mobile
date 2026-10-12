import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

export const SkeletonBlock = React.memo(({ style }: { style?: StyleProp<ViewStyle> }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 800 })
      ),
      -1,
      true
    );
  }, [pulse]);

  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.7]),
  }));

  return <Animated.View style={[{ backgroundColor: '#EAE6DF', borderRadius: 8 }, style, anim]} />;
});
