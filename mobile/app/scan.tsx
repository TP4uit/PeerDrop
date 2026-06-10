import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  Easing,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export default function ScanScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const scanLine = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] =
    useCameraPermissions();

  const [flash, setFlash] =
    useState<'off' | 'on'>('off');

  const [scanned, setScanned] = useState(false);

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null);

  const [selectedImageName, setSelectedImageName] =
    useState<string | null>(null);

  const [isScanningImage, setIsScanningImage] =
    useState(false);

  useEffect(() => {
    const animate = () => {
      scanLine.setValue(0);

      Animated.timing(scanLine, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => animate());
    };

    animate();
  }, []);

  useEffect(() => {
    if (!permission) return;

    if (!permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const frameSize = Math.min(width - 80, 320);

  const lineTop = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize - 2],
  });

  const toggleFlash = () => {
    setFlash((prev) =>
      prev === 'off' ? 'on' : 'off'
    );
  };

  const handleBarcodeScanned = ({
    data,
  }: {
    data: string;
  }) => {
    if (scanned) return;

    setScanned(true);

    Alert.alert(
      'QR Code Detected',
      data,
      [
        {
          text: 'Continue',
          onPress: () => {
            router.push({
              pathname: '/file-selection',
              params: {
                qrData: data,
              },
            });
          },
        },
        {
          text: 'Scan Again',
          style: 'cancel',
          onPress: () => setScanned(false),
        },
      ]
    );
  };

  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });

      if (
        !result.canceled &&
        result.assets?.length > 0
      ) {
        const asset = result.assets[0];

        setSelectedImage(asset.uri);

        setSelectedImageName(
          asset.fileName ??
            asset.uri.split('/').pop() ??
            'Selected Image'
        );
      }
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Error',
        'Unable to open gallery.'
      );
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
          imageName:
            selectedImageName ??
            'Selected Image',
        },
      });
    }, 1000);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color="#A0AEC0"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Scan QR Code
        </Text>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={toggleFlash}
        >
          <MaterialCommunityIcons
            name="flashlight"
            size={24}
            color={
              flash === 'on'
                ? '#00FF66'
                : '#A0AEC0'
            }
          />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraArea}>
        <View
          style={[
            styles.scannerFrame,
            {
              width: frameSize,
              height: frameSize,
            },
          ]}
        >
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flash as any}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={
                scanned
                  ? undefined
                  : handleBarcodeScanned
              }
            />
          ) : (
            <View
              style={styles.cameraPlaceholder}
            >
              <MaterialCommunityIcons
                name="camera-off"
                size={48}
                color="#718096"
              />

              <Text
                style={styles.placeholderTitle}
              >
                Camera Permission Required
              </Text>

              <Text
                style={styles.placeholderText}
              >
                Please grant camera access
                to scan QR codes.
              </Text>
            </View>
          )}

          <View
            style={styles.scannerOverlay}
            pointerEvents="none"
          />

          <Animated.View
            style={[
              styles.scanLine,
              {
                top: lineTop,
              },
            ]}
          />

          <View
            style={styles.cornerTopLeft}
          />
          <View
            style={styles.cornerTopRight}
          />
          <View
            style={styles.cornerBottomLeft}
          />
          <View
            style={styles.cornerBottomRight}
          />
        </View>

        <View
          style={styles.instructionsBlock}
        >
          <Text style={styles.primaryText}>
            Align QR Code Within Frame
          </Text>

          <Text style={styles.secondaryText}>
            The code will be scanned
            automatically when detected.
          </Text>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={pickImage}
        >
          <MaterialCommunityIcons
            name="image-multiple"
            size={24}
            color="#00FF66"
          />

          <Text
            style={styles.galleryButtonText}
          >
            Scan From Gallery
          </Text>
        </TouchableOpacity>
      </View>

      {selectedImage && (
        <View
          style={styles.scanFromGalleryBar}
        >
          <Text
            style={
              styles.scanFromGalleryLabel
            }
          >
            Selected Image
          </Text>

          <Text
            style={styles.scanFromGalleryName}
          >
            {selectedImageName}
          </Text>

          <Image
            source={{
              uri: selectedImage,
            }}
            style={styles.galleryPreview}
          />

          <TouchableOpacity
            style={[
              styles.scanButton,
              isScanningImage &&
                styles.scanButtonDisabled,
            ]}
            onPress={handleScanImage}
            disabled={isScanningImage}
          >
            <Text
              style={styles.scanButtonText}
            >
              {isScanningImage
                ? 'Scanning...'
                : 'Scan Selected Image'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.05)',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  cameraArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  scannerFrame: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#111827',
  },

  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  placeholderTitle: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  placeholderText: {
    marginTop: 8,
    color: '#94A3B8',
    textAlign: 'center',
  },

  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      'rgba(0,0,0,0.12)',
  },

  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FF66',
    shadowColor: '#00FF66',
    shadowOpacity: 1,
    shadowRadius: 8,
  },

  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#00FF66',
  },

  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#00FF66',
  },

  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#00FF66',
  },

  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#00FF66',
  },

  instructionsBlock: {
    marginTop: 24,
    alignItems: 'center',
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  secondaryText: {
    marginTop: 8,
    color: '#94A3B8',
    textAlign: 'center',
  },

  bottomActions: {
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 36 : 24,
  },

  galleryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#112240',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  galleryButtonText: {
    color: '#00FF66',
    fontSize: 15,
    fontWeight: '700',
  },

  scanFromGalleryBar: {
    padding: 20,
    backgroundColor: '#071120',
  },

  scanFromGalleryLabel: {
    color: '#94A3B8',
    marginBottom: 6,
  },

  scanFromGalleryName: {
    color: '#FFFFFF',
    marginBottom: 12,
  },

  galleryPreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 12,
  },

  scanButton: {
    backgroundColor: '#00FF66',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },

  scanButtonDisabled: {
    opacity: 0.5,
  },

  scanButtonText: {
    color: '#000',
    fontWeight: '700',
  },
});