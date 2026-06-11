import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { socketService, type ConnectionState } from '@/services/socket.service';
import { webRTCService } from '@/services/webrtc.service';
import { addTransferHistoryItem } from '@/utils/transferHistory';

const formatFileSize = (size = 0) => {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const RadarWave = ({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    const timer = setTimeout(() => {
      anim.setValue(0);

      loop = Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 5000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
    }, delay);

    return () => {
      clearTimeout(timer);
      loop?.stop();
      anim.stopAnimation();
    };
  }, [anim, delay]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 3.2],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.15, 0.8, 1],
    outputRange: [0.7, 0.4, 0.15, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wave,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
};

export default function ReceiveScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const radarSize = Math.min(width - 40, 340);
  const [stage, setStage] = useState<'waiting' | 'success' | 'connected'>('waiting');
  const [serverState, setServerState] = useState<'connecting' | 'ready' | 'reconnecting' | 'offline'>('connecting');
  const [serverError, setServerError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState<string>('');
  const [retryToken, setRetryToken] = useState(0);
  const senderNameRef = useRef('');

  useEffect(() => {
    let active = true;
    let currentSocket: Awaited<ReturnType<typeof socketService.connect>> | null = null;
    let unsubscribeConnectionState: (() => void) | null = null;
    let roomJoinTimeout: ReturnType<typeof setTimeout> | null = null;
    let resolveRoomJoin: (() => void) | null = null;
    let rejectRoomJoin: ((error: Error) => void) | null = null;
    let hasJoinedReceiveRoom = false;

    const clearRoomJoinWait = () => {
      if (roomJoinTimeout) {
        clearTimeout(roomJoinTimeout);
      }

      roomJoinTimeout = null;
      resolveRoomJoin = null;
      rejectRoomJoin = null;
    };

    const markRoomReady = () => {
      if (!active) {
        return;
      }

      setServerState('ready');
      setServerError(null);
      hasJoinedReceiveRoom = true;
      webRTCService.initSignalListener();
    };

    const handleRoomJoined = () => {
      const resolve = resolveRoomJoin;
      clearRoomJoinWait();
      markRoomReady();
      resolve?.();
    };

    const handleRoomError = (payload?: { message?: string }) => {
      const error = new Error(payload?.message || 'Unable to join receive room.');
      const reject = rejectRoomJoin;
      clearRoomJoinWait();

      if (active) {
        setServerState('offline');
        setServerError(error.message);
      }

      reject?.(error);
    };

    const waitForRoomJoin = () =>
      new Promise<void>((resolve, reject) => {
        resolveRoomJoin = resolve;
        rejectRoomJoin = reject;
        roomJoinTimeout = setTimeout(() => {
          const error = new Error('Timed out joining receive room.');
          clearRoomJoinWait();
          reject(error);
        }, 5000);
      });

    const handleConnectionState = (state: ConnectionState, reason?: string) => {
      if (!active) {
        return;
      }

      if (state === 'reconnecting') {
        setServerState('reconnecting');
        setServerError(null);
        return;
      }

      if (state === 'connected') {
        setServerError(null);
        setServerState((current) =>
          current === 'reconnecting' || current === 'offline' ? 'connecting' : current,
        );

        if (hasJoinedReceiveRoom) {
          socketService.joinRoom(socketService.deviceId);
        }

        return;
      }

      if (state === 'offline') {
        setServerState('offline');
        setServerError(
          reason || 'Unable to reach the signaling server. Start the backend and try again.',
        );
      }
    };

    const configureWebRTCCallbacks = () => {
      webRTCService.onConnected = (remoteDeviceName: string) => {
        senderNameRef.current = remoteDeviceName;
        setSenderName(remoteDeviceName);
        setStage('success');

        setTimeout(() => {
          if (active) {
            setStage('connected');
          }
        }, 2000);
      };

      webRTCService.onComplete = async (fileInfo?: any) => {
        await addTransferHistoryItem({
          id: `${Date.now()}`,
          fileName: fileInfo?.name || 'Received file',
          device: senderNameRef.current || 'Unknown Device',
          date: new Date().toLocaleString(),
          size: formatFileSize(fileInfo?.size || 0),
          status: 'completed',
        });
      };
    };

    const connectForReceive = async () => {
      setServerState('connecting');
      setServerError(null);
      setStage('waiting');

      try {
        const socket = await socketService.connect();
        if (!active) {
          return;
        }

        currentSocket = socket;
        currentSocket.on('room-joined', handleRoomJoined);
        currentSocket.on('room-error', handleRoomError);
        unsubscribeConnectionState = socketService.subscribeConnectionState(handleConnectionState);
        configureWebRTCCallbacks();

        const roomJoinPromise = waitForRoomJoin();
        socketService.joinRoom(socketService.deviceId);
        await roomJoinPromise;
        if (!active) {
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }

        console.error('[Receive] Failed to connect to signaling server:', error);
        setServerState('offline');
        setServerError('Unable to reach the signaling server. Start the backend and try again.');
      }
    };

    connectForReceive();

    return () => {
      active = false;
      clearRoomJoinWait();
      unsubscribeConnectionState?.();
      currentSocket?.off('room-joined', handleRoomJoined);
      currentSocket?.off('room-error', handleRoomError);
      socketService.leaveRoom();
      webRTCService.onConnected = null;
      webRTCService.onComplete = null;
    };
  }, [retryToken]);

  const isWaiting = serverState === 'ready' && stage === 'waiting';
  const isConnected = stage === 'connected';

  const renderStatusBlock = () => {
    if (serverState === 'connecting') {
      return (
        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>Connecting to server...</Text>
          <Text style={styles.statusSubtitle}>
            PeerDrop is preparing receive mode and checking the signaling server.
          </Text>
        </View>
      );
    }

    if (serverState === 'reconnecting') {
      return (
        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>Reconnecting...</Text>
          <Text style={styles.statusSubtitle}>
            The signaling connection dropped briefly. PeerDrop will restore receive mode automatically.
          </Text>
        </View>
      );
    }

    if (serverState === 'offline') {
      return (
        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>Server unavailable</Text>
          <Text style={styles.statusSubtitle}>{serverError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setRetryToken((value) => value + 1)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isWaiting) {
      return (
        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>Waiting for connection...</Text>
          <View style={styles.dotRow}>
            <View style={styles.pulseDot} />
            <View style={[styles.pulseDot, styles.pulseDotDelay]} />
            <View style={[styles.pulseDot, styles.pulseDotDelayMore]} />
          </View>
        </View>
      );
    }

    if (isConnected) {
      return (
        <View style={styles.connectedCard}>
          <View style={styles.connectedAvatar}>
            <MaterialCommunityIcons name="android" size={32} color="#05091B" />
          </View>
          <Text style={styles.connectedName}>{senderName}</Text>
          <Text style={styles.connectedStatus}>Secure Connection Established</Text>
          <Text style={styles.connectedHint}>Waiting for files...</Text>
        </View>
      );
    }

    return (
      <View style={styles.statusBlock}>
        <Text style={styles.statusTitle}>Connection Successful</Text>
        <Text style={styles.statusSubtitle}>
          You are securely connected to {senderName}.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive Mode</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.mainTitle}>Ready to Receive</Text>
        <Text style={styles.subtitle}>
          Your device is currently visible to nearby users as {socketService.nickname || 'Unknown Device'}
        </Text>

        <View
          style={[
            styles.radarContainer,
            {
              width: radarSize,
              height: radarSize,
            },
          ]}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <RadarWave key={index} delay={index * 1000} />
          ))}

          <View style={styles.centerGlow} />

          <View style={styles.centerCircle}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="cellphone" size={40} color="#8AF7B5" />
            </View>
          </View>
        </View>

        {renderStatusBlock()}
      </View>

      {stage === 'success' && serverState === 'ready' && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconBox}>
              <MaterialCommunityIcons name="check" size={24} color="#05091B" />
            </View>
            <Text style={styles.successTitle}>Connection Successful!</Text>
            <Text style={styles.successDescription}>
              You are securely connected to {senderName || 'the sender'}.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05091B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 44,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#05091B',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 28,
  },
  radarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 28,
  },
  wave: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(0,225,155,0.35)',
  },
  centerGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(0,225,155,0.08)',
  },
  centerCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,225,155,0.25)',
    backgroundColor: 'rgba(7,24,57,0.98)',
    shadowColor: '#00E19B',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  centerIcon: {
    width: 72,
    height: 72,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 153, 0.18)',
  },
  statusBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(7, 17, 44, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusSubtitle: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  retryButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#82F7B2',
  },
  retryButtonText: {
    color: '#05091B',
    fontSize: 14,
    fontWeight: '800',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E19B',
    marginHorizontal: 6,
    opacity: 0.35,
  },
  pulseDotDelay: {
    opacity: 0.6,
  },
  pulseDotDelayMore: {
    opacity: 1,
  },
  connectedCard: {
    width: '90%',
    padding: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(7, 24, 57, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.18)',
    alignItems: 'center',
  },
  connectedAvatar: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#00E19B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  connectedName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  connectedStatus: {
    color: '#8AF7B5',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  connectedHint: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 9, 27, 0.35)',
  },
  successCard: {
    width: '84%',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: '#07112C',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.22)',
  },
  successIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#00E19B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDescription: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
