import { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Colors } from '../constants/theme';
import { socketService } from '../services/socket.service';
import { webRTCService } from '../services/webrtc.service';

type IncomingOffer = {
  fromId: string;
  fromName?: string;
  signalData: {
    type: 'offer' | 'answer' | 'ice-candidate';
    offer?: unknown;
    answer?: unknown;
    candidate?: unknown;
  };
};

export default function RootLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const [incomingOffer, setIncomingOffer] = useState<IncomingOffer | null>(null);

  useEffect(() => {
    let currentSocket:
      | {
          on: (event: string, handler: (payload: IncomingOffer) => void) => void;
          off: (event: string, handler?: (payload: IncomingOffer) => void) => void;
        }
      | null = null;

    const handleSignal = (payload: IncomingOffer) => {
      if (payload.signalData.type !== 'offer') {
        return;
      }

      setIncomingOffer(payload);
    };

    const attachToSocket = (
      nextSocket: {
        on: (event: string, handler: (payload: IncomingOffer) => void) => void;
        off: (event: string, handler?: (payload: IncomingOffer) => void) => void;
      } | null,
    ) => {
      if (currentSocket) {
        currentSocket.off('webrtc-signal', handleSignal);
      }

      currentSocket = nextSocket;

      if (!currentSocket) {
        setIncomingOffer(null);
        return;
      }

      currentSocket.on('webrtc-signal', handleSignal);
    };

    const unsubscribe = socketService.subscribeSocket(attachToSocket);

    return () => {
      currentSocket?.off('webrtc-signal', handleSignal);
      unsubscribe();
    };
  }, []);

  const handleAcceptTransfer = async () => {
    if (!incomingOffer) {
      return;
    }

    const acceptedOffer = incomingOffer;
    setIncomingOffer(null);

    try {
      webRTCService.initSignalListener();
      await webRTCService.acceptIncomingOffer(acceptedOffer);

      router.push({
        pathname: '/transfer',
        params: {
          deviceName: acceptedOffer.fromName || acceptedOffer.fromId,
          fileCount: '1',
          totalSize: '0 B',
        },
      });
    } catch (error) {
      console.error('[RootLayout] Failed to accept incoming transfer:', error);
    }
  };

  const handleRejectTransfer = () => {
    if (!incomingOffer) {
      return;
    }

    socketService.socket?.emit('reject-transfer', { toId: incomingOffer.fromId });
    webRTCService.pendingIncomingOffer = null;
    setIncomingOffer(null);
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Home' }}
        />
        <Stack.Screen
          name="radar"
          options={{ title: 'Radar' }}
        />
        <Stack.Screen
          name="receive"
          options={{ title: 'Receive' }}
        />
        <Stack.Screen
          name="file-selection"
          options={{ title: 'Select Files' }}
        />
        <Stack.Screen
          name="scan"
          options={{ title: 'Scan QR' }}
        />
        <Stack.Screen
          name="scan-image"
          options={{ title: 'Choose QR Image' }}
        />
        <Stack.Screen
          name="transfer"
          options={{ title: 'Transfer' }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings' }}
        />
      </Stack>

      <Modal
        transparent
        visible={Boolean(incomingOffer)}
        animationType="fade"
        onRequestClose={handleRejectTransfer}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons name="file-send-outline" size={28} color="#05091B" />
            </View>
            <Text style={styles.modalTitle}>Incoming Transfer</Text>
            <Text style={styles.modalMessage}>
              Thiet bi {incomingOffer?.fromName || incomingOffer?.fromId} muon gui tep cho ban. Ban co chap nhan khong?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleRejectTransfer}>
                <Text style={styles.rejectButtonText}>Tu choi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptTransfer}>
                <Text style={styles.acceptButtonText}>Chap nhan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 9, 27, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#07112C',
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(130, 247, 178, 0.2)',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#82F7B2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalMessage: {
    color: '#A6B6E8',
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  rejectButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#82F7B2',
  },
  acceptButtonText: {
    color: '#05091B',
    fontSize: 14,
    fontWeight: '800',
  },
});
