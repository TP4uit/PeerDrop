import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ReceiveScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const radarSize = Math.min(width - 40, 340);
  const [stage, setStage] = useState<'waiting' | 'success' | 'connected'>('waiting');

  useEffect(() => {
    const successTimer = setTimeout(() => setStage('success'), 2200);
    const connectedTimer = setTimeout(() => setStage('connected'), 3600);

    return () => {
      clearTimeout(successTimer);
      clearTimeout(connectedTimer);
    };
  }, []);

  const isWaiting = stage === 'waiting';
  const isConnected = stage === 'connected';

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
          Your device is currently visible to nearby users as Alex's iPhone
        </Text>

        <View style={[styles.radarContainer, { width: radarSize, height: radarSize }]}>  
          <View style={styles.radarOuter} />
          <View style={styles.radarMiddle} />
          <View style={styles.radarInner} />
          <View style={styles.centerPulse} />
          <View style={styles.centerCircle}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="cellphone" size={40} color="#8AF7B5" />
            </View>
          </View>
        </View>

        {isWaiting ? (
          <View style={styles.statusBlock}>
            <Text style={styles.statusTitle}>Waiting for connection...</Text>
            <View style={styles.dotRow}>
              <View style={styles.pulseDot} />
              <View style={[styles.pulseDot, styles.pulseDotDelay]} />
              <View style={[styles.pulseDot, styles.pulseDotDelayMore]} />
            </View>
          </View>
        ) : isConnected ? (
          <View style={styles.connectedCard}>
            <View style={styles.connectedAvatar}>
              <MaterialCommunityIcons name="android" size={32} color="#05091B" />
            </View>
            <Text style={styles.connectedName}>David's Android</Text>
            <Text style={styles.connectedStatus}>Secure Connection Established</Text>
            <Text style={styles.connectedHint}>Waiting for files...</Text>
          </View>
        ) : (
          <View style={styles.statusBlock}>
            <Text style={styles.statusTitle}>Connection Successful</Text>
            <Text style={styles.statusSubtitle}>
              You are securely connected to David's Android.
            </Text>
          </View>
        )}
      </View>

      {stage === 'success' && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconBox}>
              <MaterialCommunityIcons name="check" size={24} color="#05091B" />
            </View>
            <Text style={styles.successTitle}>Connection Successful!</Text>
            <Text style={styles.successDescription}>
              You are securely connected to David's Android.
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
  radarOuter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 200,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 153, 0.12)',
  },
  radarMiddle: {
    position: 'absolute',
    width: '75%',
    height: '75%',
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.18)',
  },
  radarInner: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 153, 0.24)',
  },
  centerPulse: {
    position: 'absolute',
    width: '22%',
    height: '22%',
    borderRadius: 100,
    backgroundColor: 'rgba(0, 255, 153, 0.14)',
  },
  centerCircle: {
    width: 112,
    height: 112,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 153, 0.24)',
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
    backgroundColor: 'rgba(0, 255, 153, 0.18)',
  },
  statusBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusSubtitle: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
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
