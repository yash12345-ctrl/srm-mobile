import React from 'react';
import { StyleSheet, View } from 'react-native';
import Video from 'react-native-video';

interface VideoSplashScreenProps {
  readonly onAnimationComplete: () => void;
}

export default function VideoSplashScreen({ onAnimationComplete }: VideoSplashScreenProps) {
  return (
    <View style={styles.container}>
      <Video
        source={require('../assets/videos/splash-animation.mp4')} // Ensure this matches your file name
        style={styles.video}
        resizeMode="cover"
        repeat={false}
        onEnd={onAnimationComplete} 
        paused={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Match this to your video's background
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});