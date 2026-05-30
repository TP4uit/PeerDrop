import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import CircularProgress from '../components/ui/CircularProgress';

interface TransferStats {
  speed: string; // MB/s
  timeRemaining: string;
  transferred: string;
  total: string;
}

export default function TransferScreen() {
  const router = useRouter();
  const { deviceName, fileCount, totalSize } = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const [progress, setProgress] = useState(0);
  const [isTransferring, setIsTransferring] = useState(true);
  const [stats, setStats] = useState<TransferStats>({
    speed: '12.5 MB/s',
    timeRemaining: '8s',
    transferred: '95 MB',
    total: totalSize as string,
  });

  // Animation for connection line
  const lineOpacity = useSharedValue(0.3);

  useEffect(() => {
    lineOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  // Simulate transfer progress
  useEffect(() => {
    if (progress >= 100) {
      setIsTransferring(false);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + Math.random() * 15;
        return nextProgress >= 100 ? 100 : nextProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [progress]);

  // Update stats based on progress
  useEffect(() => {
    if (totalSize) {
      const totalNum = parseFloat(totalSize as string);
      const transferred = (totalNum * progress) / 100;
      const timeRemaining = progress > 0 ? Math.ceil((100 - progress) / 20) : 0;

      setStats({
        speed: (Math.random() * 5 + 10).toFixed(1) + ' MB/s',
        timeRemaining: timeRemaining + 's',
        transferred: transferred.toFixed(1) + ' MB',
        total: totalSize as string,
      });
    }
  }, [progress, totalSize]);

  const animatedLineStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
  }));

  const handleComplete = () => {
    router.dismissAll();
    router.push('/');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isTransferring ? 'Transferring Files' : 'Transfer Complete'}
        </Text>
      </View>

      {/* Animated Connection */}
      <View style={[styles.connectionContainer, { width: width - 32 }]}>
        {/* Sender (This Device) */}
        <View style={styles.deviceContainer}>
          <View style={styles.deviceCircle}>
            <MaterialCommunityIcons
              name="devices"
              size={32}
              color="#0084FF"
            />
          </View>
          <Text style={styles.deviceLabel}>This Device</Text>
        </View>

        {/* Connection Line */}
        <Animated.View
          style={[
            styles.connectionLine,
            animatedLineStyle,
          ]}
        >
          {/* Animated dots */}
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.connectionDot,
                {
                  left: `${(i * 33 + progress / 3) % 100}%`,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Receiver */}
        <View style={styles.deviceContainer}>
          <View style={styles.deviceCircle}>
            <MaterialCommunityIcons
              name="cellphone"
              size={32}
              color="#4CAF50"
            />
          </View>
          <Text style={styles.deviceLabel}>{deviceName}</Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <CircularProgress
          percentage={Math.round(progress)}
          size={200}
          strokeWidth={10}
          label={isTransferring ? 'In Progress' : 'Completed'}
          speed={300}
        />
      </View>

      {/* File Info */}
      <View style={styles.fileInfoCard}>
        <View style={styles.fileInfoRow}>
          <Text style={styles.fileInfoLabel}>Files</Text>
          <Text style={styles.fileInfoValue}>{fileCount}</Text>
        </View>
        <View style={styles.fileInfoDivider} />
        <View style={styles.fileInfoRow}>
          <Text style={styles.fileInfoLabel}>Total Size</Text>
          <Text style={styles.fileInfoValue}>{totalSize}</Text>
        </View>
      </View>

      {/* Transfer Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="speedometer"
            size={20}
            color="#0084FF"
          />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>{stats.speed}</Text>
          </View>
        </View>

        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={20}
            color="#FF9800"
          />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Time Remaining</Text>
            <Text style={styles.statValue}>{stats.timeRemaining}</Text>
          </View>
        </View>

        <View style={styles.statItem}>
          <MaterialCommunityIcons
            name="cloud-upload-outline"
            size={20}
            color="#2196F3"
          />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Transferred</Text>
            <Text style={styles.statValue}>
              {stats.transferred} / {stats.total}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {isTransferring ? (
          <>
            <TouchableOpacity style={styles.pauseButton}>
              <MaterialCommunityIcons
                name="pause"
                size={20}
                color="#0084FF"
              />
              <Text style={styles.pauseButtonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton}>
              <MaterialCommunityIcons
                name="close"
                size={20}
                color="#F44336"
              />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.repeatButton}>
              <MaterialCommunityIcons
                name="repeat"
                size={20}
                color="#0084FF"
              />
              <Text style={styles.repeatButtonText}>Send Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleComplete}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#FFF"
              />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  connectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  deviceContainer: {
    alignItems: 'center',
  },
  deviceCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 132, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    maxWidth: 70,
  },
  connectionLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#0084FF',
    marginHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  connectionDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    top: -2.5,
  },
  progressSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  fileInfoCard: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  fileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fileInfoLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  fileInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  fileInfoDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  statsContainer: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statContent: {
    marginLeft: 12,
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 24,
    marginBottom: 40,
  },
  pauseButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#0084FF',
  },
  pauseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0084FF',
    marginLeft: 6,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F44336',
    marginLeft: 6,
  },
  repeatButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#0084FF',
  },
  repeatButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0084FF',
    marginLeft: 6,
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 6,
  },
});
