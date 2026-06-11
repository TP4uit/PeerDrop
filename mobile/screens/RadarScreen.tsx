import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { socketService } from '../services/socket.service';
import { webRTCService } from '../services/webrtc.service';

interface AppDevice {
  socketId: string;
  roomId?: string;
  nickname?: string;
  avatar?: string;
}

type DeviceType = 'phone' | 'tablet' | 'computer';

const getDeviceName = (device: AppDevice) => device.nickname || 'Unknown Device';

const getDeviceType = (device: AppDevice): DeviceType => {
  const lowerName = getDeviceName(device).toLowerCase();

  if (lowerName.includes('ipad') || lowerName.includes('tablet')) {
    return 'tablet';
  }

  if (
    lowerName.includes('mac') ||
    lowerName.includes('pc') ||
    lowerName.includes('laptop') ||
    lowerName.includes('computer')
  ) {
    return 'computer';
  }

  return 'phone';
};

const getDeviceIcon = (device: AppDevice) => {
  const type = getDeviceType(device);

  if (type === 'tablet') {
    return 'tablet';
  }

  if (type === 'computer') {
    return 'laptop';
  }

  return 'cellphone';
};

const RadarWave = ({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const start = () => {
      anim.setValue(0);

      Animated.timing(anim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        start();
      });
    };

    const timer = setTimeout(start, delay);

    return () => clearTimeout(timer);
  }, [anim, delay]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 3.2],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.7, 1],
    outputRange: [0.8, 0.5, 0.15, 0],
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

export default function RadarScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const radarSize = Math.min(width - 40, 360);
  const centerOffset = radarSize / 2;
  const bubbleWidth = Math.min(132, radarSize * 0.34);
  const bubbleHeight = 78;

  const [discoveredDevices, setDiscoveredDevices] = useState<AppDevice[]>([]);
  const [selectedSocketId, setSelectedSocketId] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketService.socket;

    const handleRadarResult = (data: AppDevice[]) => {
      const devices = Array.isArray(data) ? data : [];
      setDiscoveredDevices(devices);
    };

    socket?.on('radar-result', handleRadarResult);
    socket?.emit('radar-scan');

    const scanInterval = setInterval(() => {
      socketService.socket?.emit('radar-scan');
    }, 2000);

    return () => {
      clearInterval(scanInterval);
      socket?.off('radar-result', handleRadarResult);
    };
  }, []);

  const handleDevicePress = (device: AppDevice) => {
    if (!device.socketId) {
      return;
    }

    setSelectedSocketId(device.socketId);
    webRTCService.startCall(device.socketId);

    router.push({
      pathname: '/file-selection',
      params: {
        deviceId: device.socketId,
        roomId: device.roomId,
        deviceName: getDeviceName(device),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Searching...</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.searchLabel}>Looking for nearby devices</Text>

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
              <MaterialCommunityIcons name="account-circle" size={42} color="#C6F8E1" />
            </View>
          </View>

          {discoveredDevices.map((device, index) => {
            const angle = (index * (360 / Math.max(discoveredDevices.length, 1))) % 360;
            const radius = index % 2 === 0 ? 0.36 : 0.48;
            const radians = (angle * Math.PI) / 180;
            const dx = Math.cos(radians) * radius * radarSize;
            const dy = Math.sin(radians) * radius * radarSize;
            const isSelected = selectedSocketId === device.socketId;

            return (
              <TouchableOpacity
                key={device.socketId}
                style={[
                  styles.deviceBubble,
                  isSelected && styles.deviceBubbleSelected,
                  {
                    width: bubbleWidth,
                    top: centerOffset + dy - bubbleHeight / 2,
                    left: centerOffset + dx - bubbleWidth / 2,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => handleDevicePress(device)}
              >
                <View style={[styles.deviceAvatar, isSelected && styles.deviceAvatarSelected]}>
                  <MaterialCommunityIcons
                    name={getDeviceIcon(device)}
                    size={22}
                    color={isSelected ? '#05091B' : '#FFFFFF'}
                  />
                </View>

                <Text style={styles.deviceLabel} numberOfLines={1}>
                  {getDeviceName(device)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.qrActions}>
        <TouchableOpacity style={styles.qrButton} onPress={() => router.push('/scan')}>
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="#00E19B" />
          <Text style={styles.qrButtonText}>Scan QR Code with camera</Text>
        </TouchableOpacity>
      </View>
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
  searchLabel: {
    color: '#A5B0D0',
    fontSize: 13,
    marginBottom: 24,
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
    borderWidth: 2,
    borderColor: 'rgba(0,225,155,0.55)',
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
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,193,255,0.18)',
  },
  deviceBubble: {
    position: 'absolute',
    minWidth: 94,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(10,25,60,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    shadowColor: '#00E19B',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  deviceBubbleSelected: {
    borderColor: 'rgba(130, 247, 178, 0.72)',
  },
  deviceAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 193, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceAvatarSelected: {
    backgroundColor: '#82F7B2',
  },
  deviceLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrActions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: Platform.OS === 'android' ? 36 : 24,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '90%',
    maxWidth: 420,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.22)',
    backgroundColor: 'rgba(0, 225, 155, 0.08)',
  },
  qrButtonText: {
    color: '#00E19B',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
  },
});
