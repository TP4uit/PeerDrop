import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function ScanWebScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);

  const frameSize = Math.min(width - 80, 320);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setSelectedImageName(asset.fileName ?? asset.uri?.split('/').pop() ?? 'Selected image');
      }
    } catch (error) {
      Alert.alert(
        'Unable to open gallery',
        'An error occurred while opening the image picker. Please try again.'
      );
      console.error('ImagePicker error:', error);
    }
  };

  const handleScanImage = () => {
    if (!selectedImage) return;
    setIsScanningImage(true);
    setTimeout(() => {
      setIsScanningImage(false);
      router.push({
        pathname: '/file-selection',
        params: {
          fromScan: 'image',
          imageName: selectedImageName ?? 'Selected image',
        },
      });
    }, 1000);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#8892B0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <View style={styles.cameraArea}>
        <View style={[styles.scannerFrame, { width: frameSize, height: frameSize }]}> 
          <View style={styles.cameraPlaceholder}>
            <MaterialCommunityIcons name="camera" size={42} color="#8892B0" />
            <Text style={styles.placeholderTitle}>Web camera unavailable</Text>
            <Text style={styles.placeholderText}>Use gallery upload to scan a QR image.</Text>
          </View>
          <View style={styles.overlayBorder} pointerEvents="none" />
        </View>

        <View style={styles.instructionsBlock}>
          <Text style={styles.primaryText}>Choose a saved QR image</Text>
          <Text style={styles.secondaryText}>
            Web cannot access the native camera in this preview.
          </Text>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
          <MaterialCommunityIcons name="image-multiple" size={28} color="#00FF41" style={styles.galleryIcon} />
          <Text style={styles.galleryButtonText}>Scan from Gallery</Text>
        </TouchableOpacity>
      </View>

      {selectedImage ? (
        <View style={styles.scanFromGalleryBar}>
          <Text style={styles.scanFromGalleryLabel}>Selected image:</Text>
          <Text style={styles.scanFromGalleryName}>{selectedImageName}</Text>
          <Image source={{ uri: selectedImage }} style={styles.galleryPreview} />
          <TouchableOpacity
            style={[styles.scanFromGalleryAction, isScanningImage && styles.scanFromGalleryActionDisabled]}
            onPress={handleScanImage}
            disabled={isScanningImage}
          >
            <Text style={styles.scanFromGalleryActionText}>
              {isScanningImage ? 'Scanning...' : 'Scan selected image'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040B16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    color: '#E6F1FF',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  scannerFrame: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.16)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cameraPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderTitle: {
    color: '#E6F1FF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  placeholderText: {
    color: '#8892B0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  overlayBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.16)',
  },
  instructionsBlock: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryText: {
    color: '#E6F1FF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  secondaryText: {
    color: '#8892B0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomActions: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  galleryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 999,
    backgroundColor: '#112240',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.16)',
  },
  galleryIcon: {
    marginRight: 12,
  },
  galleryButtonText: {
    color: '#00FF41',
    fontSize: 15,
    fontWeight: '700',
  },
  scanFromGalleryBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#071228',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  scanFromGalleryLabel: {
    color: '#8892B0',
    fontSize: 12,
    marginBottom: 4,
  },
  scanFromGalleryName: {
    color: '#E6F1FF',
    fontSize: 14,
    marginBottom: 12,
  },
  galleryPreview: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    backgroundColor: '#081226',
    marginBottom: 12,
  },
  scanFromGalleryAction: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: '#00FF41',
    alignItems: 'center',
  },
  scanFromGalleryActionDisabled: {
    backgroundColor: 'rgba(0,255,65,0.35)',
  },
  scanFromGalleryActionText: {
    color: '#05091B',
    fontSize: 14,
    fontWeight: '700',
  },
});
