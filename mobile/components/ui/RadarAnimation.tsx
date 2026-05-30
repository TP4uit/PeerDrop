import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface RadarAnimationProps {
  size?: number;
  ringCount?: number;
}

export default function RadarAnimation({
  size = 250,
  ringCount = 4,
}: RadarAnimationProps) {
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(1);

  useEffect(() => {
    ringScale.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.out(Easing.quad),
      }),
      -1,
      false
    );

    ringOpacity.value = withRepeat(
      withTiming(0, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const renderRings = () => {
    const rings = [];
    for (let i = 0; i < ringCount; i++) {
      rings.push(
        <View
          key={`ring-${i}`}
          style={[
            styles.ring,
            {
              width: size * ((i + 1) / ringCount),
              height: size * ((i + 1) / ringCount),
              borderRadius: size * ((i + 1) / ringCount) / 2,
              opacity: 1 - i * 0.2,
            },
          ]}
        />
      );
    }
    return rings;
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.radarContainer, animatedStyle]}>
        {renderRings()}
      </Animated.View>
      {/* Static center dot */}
      <View style={styles.centerDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  radarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0084FF',
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0084FF',
    zIndex: 10,
  },
});
