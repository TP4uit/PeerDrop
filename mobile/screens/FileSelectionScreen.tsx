import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { webRTCService } from '../services/webrtc.service';

type MediaKind = 'image' | 'video';

interface SelectedMediaFile {
  id: string;
  uri: string;
  thumbnailUri: string;
  name: string;
  size: number;
  type: MediaKind;
  mimeType: string;
  duration?: number;
}

interface MediaItem {
  id: string;
  asset: MediaLibrary.Asset;
  thumbnailUri: string;
  name: string;
  type: MediaKind;
  duration?: number;
}

const PAGE_SIZE = 60;
const fileTabs = ['All', 'Photos', 'Videos'] as const;

const extensionMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
};

const getDeviceName = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? 'Device';
  }

  return value ?? 'Device';
};

const getMediaType = (asset: MediaLibrary.Asset): MediaKind =>
  asset.mediaType === MediaLibrary.MediaType.video ? 'video' : 'image';

const getMimeType = (filename: string, type: MediaKind) => {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return extensionMimeTypes[extension] ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDuration = (seconds = 0) => {
  if (!seconds) return '';

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const normalizeAsset = (asset: MediaLibrary.Asset): MediaItem => ({
  id: asset.id,
  asset,
  thumbnailUri: asset.uri,
  name: asset.filename || 'Media file',
  type: getMediaType(asset),
  duration: asset.duration,
});

const getFileSize = async (uri: string) => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? info.size ?? 0 : 0;
  } catch (error) {
    console.warn('[FileSelection] Unable to read media size:', error);
    return 0;
  }
};

export default function FileSelectionScreen() {
  const router = useRouter();
  const { deviceName } = useLocalSearchParams();
  const displayDeviceName = getDeviceName(deviceName);
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<(typeof fileTabs)[number]>('All');
  const [mediaFiles, setMediaFiles] = useState<MediaItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedMediaFile[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [resolvingAssetId, setResolvingAssetId] = useState<string | null>(null);

  const columnCount = 3;
  const itemGap = 10;
  const horizontalPadding = 16;
  const itemSize = Math.floor((width - horizontalPadding * 2 - itemGap * (columnCount - 1)) / columnCount);

  const selectedIds = useMemo(
    () => new Set(selectedFiles.map((file) => file.id)),
    [selectedFiles],
  );

  const displayedFiles = useMemo(() => {
    if (activeTab === 'Photos') {
      return mediaFiles.filter((file) => file.type === 'image');
    }

    if (activeTab === 'Videos') {
      return mediaFiles.filter((file) => file.type === 'video');
    }

    return mediaFiles;
  }, [activeTab, mediaFiles]);

  const totalBytes = useMemo(
    () => selectedFiles.reduce((total, file) => total + file.size, 0),
    [selectedFiles],
  );
  const totalSize = formatBytes(totalBytes);

  const appendAssets = useCallback((assets: MediaLibrary.Asset[]) => {
    setMediaFiles((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const nextItems = assets
        .filter((asset) => !existingIds.has(asset.id))
        .map(normalizeAsset);

      return [...current, ...nextItems];
    });
  }, []);

  const fetchMediaPage = useCallback(
    async (after?: string) => {
      const response = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      appendAssets(response.assets);
      setEndCursor(response.endCursor);
      setHasNextPage(response.hasNextPage);
    },
    [appendAssets],
  );

  const requestPermissionAndLoad = useCallback(async () => {
    setIsLoading(true);

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);

      if (!permission.granted) {
        setPermissionGranted(false);
        setMediaFiles([]);
        return;
      }

      setPermissionGranted(true);
      setMediaFiles([]);
      setSelectedFiles([]);
      setEndCursor(undefined);
      setHasNextPage(false);
      await fetchMediaPage();
    } catch (error) {
      console.error('[FileSelection] Failed to load media library:', error);
      Alert.alert('Media Library Error', 'Unable to load photos and videos from this device.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchMediaPage]);

  useEffect(() => {
    requestPermissionAndLoad();
  }, [requestPermissionAndLoad]);

  const loadMore = useCallback(async () => {
    if (!permissionGranted || !hasNextPage || !endCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      await fetchMediaPage(endCursor);
    } catch (error) {
      console.warn('[FileSelection] Unable to load more media:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [endCursor, fetchMediaPage, hasNextPage, isLoadingMore, permissionGranted]);

  const resolveSelectedFile = useCallback(async (item: MediaItem): Promise<SelectedMediaFile> => {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(item.asset, {
      shouldDownloadFromNetwork: true,
    });
    const uri = assetInfo.localUri || assetInfo.uri || item.asset.uri;
    const size = await getFileSize(uri);
    const name = assetInfo.filename || item.name;
    const type = getMediaType(assetInfo);

    return {
      id: item.id,
      uri,
      thumbnailUri: item.thumbnailUri,
      name,
      size,
      type,
      mimeType: getMimeType(name, type),
      duration: assetInfo.duration,
    };
  }, []);

  const toggleFile = useCallback(
    async (item: MediaItem) => {
      if (selectedIds.has(item.id)) {
        setSelectedFiles((current) => current.filter((file) => file.id !== item.id));
        return;
      }

      setResolvingAssetId(item.id);
      try {
        const selectedFile = await resolveSelectedFile(item);
        setSelectedFiles((current) => {
          if (current.some((file) => file.id === selectedFile.id)) {
            return current;
          }

          return [...current, selectedFile];
        });
      } catch (error) {
        console.error('[FileSelection] Failed to prepare selected media:', error);
        Alert.alert('Selection Error', 'Unable to prepare this media file for sending.');
      } finally {
        setResolvingAssetId(null);
      }
    },
    [resolveSelectedFile, selectedIds],
  );

  const handleSend = useCallback(() => {
    if (selectedFiles.length === 0) {
      return;
    }

    webRTCService.pendingFile = selectedFiles[0];
    router.push({
      pathname: '/transfer',
      params: {
        deviceName: displayDeviceName,
        fileCount: selectedFiles.length.toString(),
        totalSize,
      },
    });
  }, [displayDeviceName, router, selectedFiles, totalSize]);

  const renderTab = (tab: (typeof fileTabs)[number]) => {
    const active = tab === activeTab;

    return (
      <TouchableOpacity
        key={tab}
        style={[styles.tabButton, active && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab)}
      >
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
      </TouchableOpacity>
    );
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    const isSelected = selectedIds.has(item.id);
    const isResolving = resolvingAssetId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        disabled={Boolean(resolvingAssetId)}
        onPress={() => toggleFile(item)}
        style={[styles.mediaCard, { width: itemSize }]}
      >
        <View style={[styles.thumbnailWrap, { width: itemSize, height: itemSize }]}>
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.mediaShade} />

          {item.type === 'video' && (
            <View style={styles.videoBadge}>
              <MaterialCommunityIcons name="play" size={12} color="#FFFFFF" />
              <Text style={styles.videoDuration}>{formatDuration(item.duration)}</Text>
            </View>
          )}

          <View style={[styles.checkBadge, isSelected && styles.checkBadgeSelected]}>
            {isResolving ? (
              <ActivityIndicator size="small" color="#82F7B2" />
            ) : (
              <MaterialCommunityIcons
                name={isSelected ? 'check' : 'plus'}
                size={14}
                color={isSelected ? '#05091B' : '#FFFFFF'}
              />
            )}
          </View>
        </View>

        <Text style={styles.mediaName} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color="#82F7B2" size="large" />
          <Text style={styles.emptyTitle}>Loading media</Text>
        </View>
      );
    }

    if (!permissionGranted) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="folder-lock-outline" size={42} color="#82F7B2" />
          <Text style={styles.emptyTitle}>Storage access needed</Text>
          <Text style={styles.emptySubtitle}>
            Allow access to photos and videos so PeerDrop can show files from this phone.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermissionAndLoad}>
            <Text style={styles.permissionButtonText}>Allow Access</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="image-off-outline" size={42} color="#82F7B2" />
        <Text style={styles.emptyTitle}>No media found</Text>
        <Text style={styles.emptySubtitle}>Photos and videos from this device will appear here.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#82F7B2" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.screenTitle}>Select Files</Text>
          <Text style={styles.screenSubtitle}>Sending to {displayDeviceName}</Text>
        </View>
        <Text style={styles.counterText}>{selectedFiles.length}</Text>
      </View>

      <View style={styles.tabRow}>{fileTabs.map(renderTab)}</View>

      <FlatList
        data={displayedFiles}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color="#82F7B2" />
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {selectedFiles.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.fab}
          onPress={handleSend}
        >
          <View>
            <Text style={styles.fabTitle}>Send</Text>
            <Text style={styles.fabSubtitle}>
              {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} • {totalSize}
            </Text>
          </View>
          <MaterialCommunityIcons name="send" size={22} color="#05091B" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05091B',
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 30, 70, 0.8)',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  screenSubtitle: {
    color: '#A6B6E8',
    fontSize: 13,
    marginTop: 4,
  },
  counterText: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: 'rgba(130, 247, 178, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(130, 247, 178, 0.32)',
    color: '#82F7B2',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 32,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(130, 247, 178, 0.14)',
  },
  tabText: {
    color: '#A6B6E8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#82F7B2',
  },
  gridContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  mediaCard: {
    overflow: 'hidden',
  },
  thumbnailWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0C1634',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  mediaShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 9, 27, 0.08)',
  },
  videoBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(5, 9, 27, 0.72)',
  },
  videoDuration: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 9, 27, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  checkBadgeSelected: {
    backgroundColor: '#82F7B2',
    borderColor: '#82F7B2',
  },
  mediaName: {
    color: '#DDE6FF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 7,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#9DB1F1',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  permissionButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#82F7B2',
  },
  permissionButtonText: {
    color: '#05091B',
    fontSize: 14,
    fontWeight: '800',
  },
  listFooter: {
    paddingVertical: 18,
  },
  fab: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 22,
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#82F7B2',
    shadowColor: '#82F7B2',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabTitle: {
    color: '#05091B',
    fontSize: 16,
    fontWeight: '800',
  },
  fabSubtitle: {
    color: 'rgba(5, 9, 27, 0.72)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
});
