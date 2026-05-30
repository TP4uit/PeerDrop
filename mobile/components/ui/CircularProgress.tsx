import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

interface CircularProgressProps {
  percentage: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  speed?: number;
}

export default function CircularProgress({
  percentage,
  size = 200,
  strokeWidth = 8,
  label,
  speed = 500,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = useSharedValue(circumference);

  useEffect(() => {
    offset.value = withTiming(circumference * (1 - percentage / 100), {
      duration: speed,
      easing: Easing.inOut(Easing.quad),
    });
  }, [percentage]);

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F0F0F0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Animated.Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#0084FF"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>

        {/* Center text */}
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.percentage}>{percentage}%</Text>
          {label && <Text style={styles.label}>{label}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentage: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
