import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const mockImages = [
  { id: '1', title: 'IMG_9824.HEIC', subtitle: 'QR from laptop screen' },
  { id: '2', title: 'Screenshot_2026.png', subtitle: 'Saved QR from chat' },
  { id: '3', title: 'scan-qrcode.jpg', subtitle: 'Photo from gallery' },
];

export default function ScanImageScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    router.replace('/scan');
  }, [router]);

  const renderItem = ({ item }: { item: typeof mockImages[number] }) => {
    const selected = item.id === selectedId;

    return (
      <TouchableOpacity
        style={[styles.imageCard, selected && styles.imageCardSelected]}
        onPress={() => setSelectedId(item.id)}
      >
        <View style={styles.imageIconWrapper}>
          <MaterialCommunityIcons name="image" size={24} color="#00E19B" />
        </View>
        <View style={styles.imageMeta}>
          <Text style={styles.imageTitle}>{item.title}</Text>
          <Text style={styles.imageSubtitle}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select QR Image</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.body, { width: width - 40 }]}> 
        <Text style={styles.instructions}>Choose an image with a QR code to connect to a device.</Text>

        <FlatList
          data={mockImages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={[styles.scanButton, !selectedId && styles.scanButtonDisabled]}
          disabled={!selectedId}
          onPress={() => router.push('/scan')}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={20} color={selectedId ? '#05091B' : '#8AAEA6'} />
          <Text style={[styles.scanButtonText, !selectedId && styles.scanButtonTextDisabled]}>Scan selected image</Text>
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
    alignSelf: 'center',
  },
  instructions: {
    color: '#A5B0D0',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 24,
  },
  imageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#071328',
    borderWidth: 1,
    borderColor: 'rgba(0,225,155,0.12)',
  },
  imageCardSelected: {
    borderColor: '#00E19B',
    backgroundColor: 'rgba(0,225,155,0.12)',
  },
  imageIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(0,225,155,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  imageMeta: {
    flex: 1,
  },
  imageTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  imageSubtitle: {
    color: '#7B8AA3',
    fontSize: 12,
  },
  divider: {
    height: 12,
  },
  scanButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#00E19B',
    marginTop: 10,
  },
  scanButtonDisabled: {
    backgroundColor: 'rgba(0,225,155,0.2)',
  },
  scanButtonText: {
    color: '#05091B',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
  },
  scanButtonTextDisabled: {
    color: '#8AAEA6',
  },
});
