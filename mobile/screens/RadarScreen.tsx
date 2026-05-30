import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AppDevice {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'computer';
  position: { angle: number; radius: number };
  isOnline: boolean;
}

const mockDevices: AppDevice[] = [
  {
    id: '1',
    name: 'MacBook Pro',
    type: 'computer',
    position: { angle: 20, radius: 0.46 },
    isOnline: true,
  },
  {
    id: '2',
    name: "David's Android",
    type: 'phone',
    position: { angle: 210, radius: 0.52 },
    isOnline: true,
  },
  {
    id: '3',
    name: 'iPad Air',
    type: 'tablet',
    position: { angle: 280, radius: 0.40 },
    isOnline: true,
  },
];

export default function RadarScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const radarSize = Math.min(width - 40, 360);
  const centerOffset = radarSize / 2;
  const bubbleWidth = Math.min(132, radarSize * 0.34);
  const bubbleHeight = 78;
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsScanning(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleDevicePress = (device: AppDevice) => {
    if (!device.isOnline) return;
    router.push({
      pathname: '/file-selection',
      params: { deviceId: device.id, deviceName: device.name },
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Mode</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.searchLabel}>Looking for nearby receivers</Text>

        <View style={[styles.radarContainer, { width: radarSize, height: radarSize }]}>            
          <View style={styles.radarOuter} />
          <View style={styles.radarMiddle} />
          <View style={styles.radarInner} />
          <View style={styles.centerPulse} />
          <View style={styles.centerCircle}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="account-circle" size={40} color="#C6F8E1" />
            </View>
          </View>

          {mockDevices.map((device) => {
            const radians = (device.position.angle * Math.PI) / 180;
            const dx = Math.cos(radians) * device.position.radius * radarSize;
            const dy = Math.sin(radians) * device.position.radius * radarSize;

            return (
              <TouchableOpacity
                key={device.id}
                style={[
                  styles.deviceBubble,
                  {
                    width: bubbleWidth,
                    top: centerOffset + dy - bubbleHeight / 2,
                    left: centerOffset + dx - bubbleWidth / 2,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => handleDevicePress(device)}
              >
              <View style={styles.deviceAvatar}>
                <MaterialCommunityIcons
                  name={device.type === 'phone' ? 'cellphone' : device.type === 'tablet' ? 'tablet' : 'laptop'}
                  size={22}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.deviceLabel} numberOfLines={1}>
                {device.name}
              </Text>
            </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.qrButton} onPress={() => router.push('/file-selection')}>
        <MaterialCommunityIcons name="qrcode-scan" size={20} color="#00E19B" />
        <Text style={styles.qrButtonText}>Scan QR Code instead</Text>
      </TouchableOpacity>
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
  radarOuter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 200,
    borderWidth: 1,
    borderColor: 'rgba(0, 193, 255, 0.12)',
  },
  radarMiddle: {
    position: 'absolute',
    width: '75%',
    height: '75%',
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(0, 193, 255, 0.14)',
  },
  radarInner: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(0, 193, 255, 0.2)',
  },
  centerPulse: {
    position: 'absolute',
    width: '22%',
    height: '22%',
    borderRadius: 100,
    backgroundColor: 'rgba(0, 255, 153, 0.12)',
  },
  centerCircle: {
    width: 112,
    height: 112,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.24)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 24, 57, 0.95)',
  },
  centerIcon: {
    width: 72,
    height: 72,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 193, 255, 0.18)',
  },

  deviceBubble: {
    position: 'absolute',
    minWidth: 94,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 18, 51, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
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
  deviceLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoText: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '90%',
    maxWidth: 420,
    marginBottom: 24,
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
