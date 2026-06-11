import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Modal,
  Pressable,
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
import CircularProgress from '@/components/ui/CircularProgress';
import { addTransferHistoryItem } from '@/utils/transferHistory';
import { webRTCService } from '../services/webrtc.service';

interface TransferStats {
  speed: string; // MB/s
  timeRemaining: string;
  transferred: string;
  total: string;
}

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatSpeed = (bytesPerSecond = 0) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
};

const formatTimeRemaining = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

export default function TransferScreen() {
  const router = useRouter();
  const { deviceName, fileCount, totalSize } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const transferStartTimeRef = useRef<number | null>(null);
  const activeTotalBytesRef = useRef(webRTCService.pendingFile?.size || 0);

  const [progress, setProgress] = useState(0);
  const [isTransferring, setIsTransferring] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [stats, setStats] = useState<TransferStats>({
    speed: '0 B/s',
    timeRemaining: '0s',
    transferred: '0 B',
    total: (totalSize as string) || formatBytes(activeTotalBytesRef.current),
  });

  // Animation for connection line
  const lineOpacity = useSharedValue(0.3);
  const segmentOffset = useSharedValue(0);

  useEffect(() => {
    lineOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    segmentOffset.value = withRepeat(
      withTiming(100, { duration: 1800, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // Track transfer progress from the WebRTC service.
  useEffect(() => {
    if (isTransferring && !isPaused) {
      webRTCService.onProgress = (percent, transferredBytes, totalBytes) => {
        // Nếu người dùng đang bấm tạm dừng thì đóng băng hiển thị, không tính toán tiếp
        if (isPaused) return;
        const now = Date.now();
        if (!transferStartTimeRef.current) {
          transferStartTimeRef.current = now;
        }

        const total = totalBytes || activeTotalBytesRef.current;
        const transferred = transferredBytes ?? Math.round((total * percent) / 100);
        activeTotalBytesRef.current = total;

        const elapsedSeconds = Math.max((now - transferStartTimeRef.current) / 1000, 0.001);
        const bytesPerSecond = transferred / elapsedSeconds;
        const remainingSeconds = bytesPerSecond > 0 ? (total - transferred) / bytesPerSecond : 0;

        setProgress(percent);
        setStats({
          speed: formatSpeed(bytesPerSecond),
          timeRemaining: formatTimeRemaining(remainingSeconds),
          transferred: formatBytes(transferred),
          total: formatBytes(total),
        });
      };

      webRTCService.onComplete = (fileInfo) => {
        const total = fileInfo?.size || activeTotalBytesRef.current;
        setProgress(100);
        setStats((currentStats) => ({
          ...currentStats,
          timeRemaining: '0s',
          transferred: formatBytes(total),
          total: formatBytes(total),
        }));
        setIsTransferring(false);
      };

      // --- THÊM ĐOẠN NÀY VÀO DƯỚI CÙNG ---
      // Nếu có file đang nằm chờ, ra lệnh gửi ngay khi màn hình đã sẵn sàng
      if (webRTCService.pendingFile) {
        const fileToSend = webRTCService.pendingFile;
        activeTotalBytesRef.current = fileToSend.size || activeTotalBytesRef.current;
        transferStartTimeRef.current = Date.now();
        setStats({
          speed: '0 B/s',
          timeRemaining: '0s',
          transferred: '0 B',
          total: formatBytes(activeTotalBytesRef.current),
        });

        webRTCService.sendFile(fileToSend);
        
        // Xóa file trong kho đi để không bị gửi lặp lại
        webRTCService.pendingFile = null; 
      }
    }

    return () => {
      webRTCService.onProgress = null;
      webRTCService.onComplete = null;
    };
  }, [isTransferring]);

  const animatedLineStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
  }));

  const animatedSegmentStyle = useAnimatedStyle(() => ({
    left: `${segmentOffset.value}%`,
  }));

  const handleComplete = async () => {
    await addTransferHistoryItem({
      id: `${Date.now()}`,
      fileName: `${fileCount} file${fileCount === '1' ? '' : 's'}`,
      device: (deviceName as string) || 'Unknown Device',
      date: new Date().toLocaleString(),
      size: (totalSize as string) || '0 MB',
      status: 'completed',
    });

    router.dismissAll();
    router.push('/');
  };

  const handlePauseToggle = () => {
    setIsPaused((s) => !s);
  };

  const handleCancelPress = () => {
    setShowCancelConfirm(true);
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    setIsTransferring(false);
    setProgress(0);
    router.push('/');
  };

  const handleSendAgain = () => {
    setProgress(0);
    transferStartTimeRef.current = null;
    setStats({
      speed: '0 B/s',
      timeRemaining: '0s',
      transferred: '0 B',
      total: (totalSize as string) || formatBytes(activeTotalBytesRef.current),
    });
    setIsTransferring(true);
    setIsPaused(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isTransferring ? 'Transferring' : 'Transfer Complete'}
        </Text>
      </View>

      {/* Animated Connection */}
      <View style={[styles.connectionContainer, { width: width - 32 }]}>
        {/* Sender (This Device) */}
        <View style={styles.deviceContainer}>
          <View style={[styles.deviceCircle, styles.deviceCircleSender]}>
            <MaterialCommunityIcons name="account-circle" size={32} color="#00E19B" />
          </View>
          <Text style={styles.deviceLabel}>You</Text>
        </View>

        {/* Connection Line with moving green segment */}
        <Animated.View style={[styles.connectionLine, animatedLineStyle]}>
          <Animated.View style={[styles.connectionProgress, animatedSegmentStyle]} />
        </Animated.View>

        {/* Receiver */}
        <View style={styles.deviceContainer}>
          <View style={[styles.deviceCircle, styles.deviceCircleReceiver]}>
            <MaterialCommunityIcons name="cellphone" size={32} color="#4CAF50" />
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
          speed={50}
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
          <Text style={styles.fileInfoValue}>{stats.total}</Text>
        </View>

        <View style={styles.statItem}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={20} color="#2196F3" />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Transferred</Text>
            <Text style={styles.statValue}>
              {stats.transferred} / {stats.total}
            </Text>
          </View>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="speedometer" size={20} color="#00E19B" />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>{stats.speed}</Text>
          </View>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="timer-outline" size={20} color="#F6C453" />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Time Remaining</Text>
            <Text style={styles.statValue}>{stats.timeRemaining}</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {isTransferring ? (
          <>
            <TouchableOpacity style={styles.pauseButton} onPress={handlePauseToggle}>
              <MaterialCommunityIcons name={isPaused ? 'play' : 'pause'} size={20} color="#00E19B" />
              <Text style={styles.pauseButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelPress}>
              <MaterialCommunityIcons name="close" size={20} color="#F44336" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.repeatButton} onPress={handleSendAgain}>
              <MaterialCommunityIcons name="repeat" size={20} color="#00E19B" />
              <Text style={styles.repeatButtonText}>Send Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneButton} onPress={handleComplete}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#FFF" />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Cancel confirmation modal */}
      <Modal visible={showCancelConfirm} transparent animationType="fade" onRequestClose={() => setShowCancelConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Transfer?</Text>
            <Text style={styles.modalMessage}>Are you sure you want to cancel the transfer?</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalButtonSecondary} onPress={() => setShowCancelConfirm(false)}>
                <Text style={styles.modalButtonSecondaryText}>No, Continue</Text>
              </Pressable>
              <Pressable style={styles.modalButtonPrimary} onPress={confirmCancel}>
                <Text style={styles.modalButtonPrimaryText}>Yes, Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05091B',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  connectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 24,
    backgroundColor: '#0B1330',
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
    backgroundColor: '#071328',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceCircleSender: {
    backgroundColor: 'rgba(0,225,155,0.08)',
  },
  deviceCircleReceiver: {
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  deviceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E6F0FF',
    textAlign: 'center',
    maxWidth: 70,
  },
  connectionLine: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(0,225,155,0.12)',
    marginHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  connectionDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E19B',
    top: -2.5,
  },
  connectionProgressContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -6,
    height: 12,
    justifyContent: 'center',
  },
  connectionProgress: {
    position: 'absolute',
    width: 48,
    height: 8,
    borderRadius: 6,
    backgroundColor: '#00E19B',
    shadowColor: '#00E19B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  progressSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  fileInfoCard: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#081026',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fileInfoLabel: {
    fontSize: 13,
    color: '#7B8AA3',
    fontWeight: '500',
  },
  fileInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fileInfoDivider: {
    height: 1,
    backgroundColor: '#0F1A2B',
    marginVertical: 4,
  },
  statsContainer: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#081026',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    color: '#7B8AA3',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: '#071328',
    borderWidth: 1,
    borderColor: 'rgba(0,225,155,0.18)',
  },
  pauseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00E19B',
    marginLeft: 6,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#071328',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.18)',
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
    backgroundColor: '#071328',
    borderWidth: 1,
    borderColor: 'rgba(0,225,155,0.18)',
  },
  repeatButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00E19B',
    marginLeft: 6,
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#00E19B',
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#051122',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#071428',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#9FB1C9',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButtonPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F44336',
    borderRadius: 8,
  },
  modalButtonPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalButtonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
    borderRadius: 8,
    marginRight: 8,
  },
  modalButtonSecondaryText: {
    color: '#00E19B',
    fontWeight: '700',
  },
});
