import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface Device {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'computer' | 'unknown';
  signal: number; // 0-100
  distance?: string;
  isOnline: boolean;
}

interface DiscoveredDeviceCardProps {
  device: Device;
  onPress: (device: Device) => void;
}

export default function DiscoveredDeviceCard({ device, onPress }: DiscoveredDeviceCardProps) {
  const getDeviceIcon = () => {
    switch (device.type) {
      case 'phone':
        return 'cellphone';
      case 'tablet':
        return 'tablet';
      case 'computer':
        return 'laptop';
      default:
        return 'devices';
    }
  };

  const getSignalIcon = () => {
    if (device.signal >= 75) return 'wifi-strength-4';
    if (device.signal >= 50) return 'wifi-strength-3';
    if (device.signal >= 25) return 'wifi-strength-2';
    return 'wifi-strength-1';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !device.isOnline && styles.containerOffline,
      ]}
      onPress={() => onPress(device)}
      activeOpacity={0.7}
    >
      <View style={styles.contentContainer}>
        <View style={[styles.iconContainer, device.isOnline ? styles.iconOnline : styles.iconOffline]}>
          <MaterialCommunityIcons
            name={getDeviceIcon()}
            size={24}
            color={device.isOnline ? '#FFF' : '#999'}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {device.name}
          </Text>
          <View style={styles.metaContainer}>
            <MaterialCommunityIcons
              name={getSignalIcon()}
              size={14}
              color={device.isOnline ? '#0084FF' : '#999'}
            />
            <Text style={[styles.metaText, !device.isOnline && styles.metaTextOffline]}>
              {device.distance || 'Nearby'}
            </Text>
            {device.isOnline && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Online</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={device.isOnline ? '#0084FF' : '#999'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  containerOffline: {
    opacity: 0.6,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconOnline: {
    backgroundColor: '#0084FF',
  },
  iconOffline: {
    backgroundColor: '#F0F0F0',
  },
  infoContainer: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    marginRight: 12,
  },
  metaTextOffline: {
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
});
