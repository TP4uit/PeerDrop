import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

interface FileItem {
  id: string;
  uri: string;
  name: string;
  size: number;
  type: 'image' | 'video' | 'document' | 'audio';
  color: string;
  selected: boolean;
}

const fileTabs = ['All', 'Photos', 'Videos', 'Documents', 'Music'] as const;
const tabFilter: Record<typeof fileTabs[number], FileItem['type'][]> = {
  All: ['image', 'video', 'document', 'audio'],
  Photos: ['image'],
  Videos: ['video'],
  Documents: ['document'],
  Music: ['audio'],
};

const iconByType: Record<FileItem['type'], React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  image: 'image',
  video: 'video',
  document: 'file-document',
  audio: 'music-note',
};

const typeColor: Record<FileItem['type'], string> = {
  image: '#3058FF',
  video: '#9D4DFF',
  document: '#FF9B3D',
  audio: '#4BC6D8',
};

const getItemType = (mimeType?: string | null, filename?: string | null): FileItem['type'] => {
  const lowerName = filename?.toLowerCase() ?? '';
  if (mimeType?.startsWith('image') || lowerName.match(/\.(jpg|jpeg|png|gif|heic|heif|webp)$/)) {
    return 'image';
  }
  if (mimeType?.startsWith('video') || lowerName.match(/\.(mp4|mov|mkv|webm|avi|3gp)$/)) {
    return 'video';
  }
  if (mimeType?.startsWith('audio') || lowerName.match(/\.(mp3|wav|m4a|aac|ogg)$/)) {
    return 'audio';
  }
  return 'document';
};

const formatFileSize = (size: number) => {
  if (!size) return '0 KB';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeDocuments = (result: any): FileItem[] => {
  const output = (result as any).output ?? result;
  const docs = Array.isArray(output) ? output : [output];

  return docs
    .filter(Boolean)
    .map((doc: any) => {
      const name = doc.name ?? doc.uri?.split('/').pop() ?? 'Unknown file';
      const uri = doc.uri ?? '';
      const size = typeof doc.size === 'number' ? doc.size : 0;
      const type = getItemType(doc.mimeType, name);

      return {
        id: uri || `${name}-${Math.random().toString(36).slice(2)}`,
        uri,
        name,
        size,
        type,
        color: typeColor[type],
        selected: true,
      };
    });
};

export default function FileSelectionScreen() {
  const router = useRouter();
  const { deviceName } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<typeof fileTabs[number]>('All');
  const [files, setFiles] = useState<FileItem[]>([]);
  const { width } = useWindowDimensions();
  const columnCount = 3;
  const itemSize = Math.floor((width - 44) / columnCount);

  const displayedFiles = files.filter((file) =>
    tabFilter[activeTab].includes(file.type)
  );

  const selectedCount = files.filter((f) => f.selected).length;
  const totalBytes = files
    .filter((f) => f.selected)
    .reduce((sum, f) => sum + f.size, 0);
  const totalSize = formatFileSize(totalBytes);

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: false,
      });

      if ('type' in result && result.type === 'cancel') {
        return;
      }

      const pickedFiles = normalizeDocuments(result);
      if (pickedFiles.length === 0) {
        return;
      }

      setFiles((current) => {
        const existingUris = new Set(current.map((file) => file.uri));
        const merged = [...current];

        pickedFiles.forEach((file) => {
          if (!existingUris.has(file.uri)) {
            merged.push(file);
            existingUris.add(file.uri);
          }
        });

        return merged;
      });
    } catch (error) {
      console.error(error);
      Alert.alert('File Selection Error', 'Unable to select files. Please try again.');
    }
  };

  const toggleFile = (id: string) => {
    setFiles((current) =>
      current.map((file) =>
        file.id === id ? { ...file, selected: !file.selected } : file
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = files.every((file) => file.selected);
    setFiles((current) => current.map((file) => ({ ...file, selected: !allSelected })));
  };

  const handleProceed = () => {
    if (selectedCount > 0) {
      router.push({
        pathname: '/transfer',
        params: {
          deviceName,
          fileCount: selectedCount.toString(),
          totalSize,
        },
      });
    }
  };

  const renderTab = (tab: typeof fileTabs[number]) => {
    const active = tab === activeTab;
    return (
      <TouchableOpacity
        key={tab}
        style={[styles.tabItem, active && styles.tabItemActive]}
        onPress={() => setActiveTab(tab)}
      >
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
      </TouchableOpacity>
    );
  };

  const renderFileItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity
      style={[styles.fileCard, { width: itemSize, height: itemSize + 30 }]}
      activeOpacity={0.85}
      onPress={() => toggleFile(item.id)}
    >
      <View style={[styles.fileThumbnail, { backgroundColor: item.color }]}>
        <MaterialCommunityIcons
          name={iconByType[item.type]}
          size={28}
          color="#FFFFFF"
        />
        {item.selected && (
          <View style={styles.selectionBadge}>
            <MaterialCommunityIcons name="check" size={14} color="#05091B" />
          </View>
        )}
      </View>
      <View style={styles.fileMeta}>
        <Text style={styles.fileTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.fileSubtitle}>{formatFileSize(item.size)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#82F7B2" />
        </TouchableOpacity>
        <View style={styles.headerTexts}>
          <Text style={styles.screenTitle}>Select Files</Text>
          <Text style={styles.screenSubtitle}>Sending to {deviceName ?? 'Device'}</Text>
        </View>
        <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllButton}>
          <Text style={styles.selectAllButtonText}>
            {files.every((f) => f.selected) ? 'Deselect all' : 'Select all'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>{fileTabs.map(renderTab)}</View>

      <View style={styles.filePickerBar}>
        <Text style={styles.pickerHint}>
          Choose files from your device to send over the connection.
        </Text>
        <TouchableOpacity style={styles.pickButton} onPress={pickFiles}>
          <MaterialCommunityIcons name="file-plus" size={18} color="#05091B" />
          <Text style={styles.pickButtonText}>Choose Files</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedFiles}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No files selected yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap Choose Files above to pick real files from your device.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTitle}>Selected: {selectedCount} item{selectedCount !== 1 ? 's' : ''}</Text>
          <Text style={styles.bottomSubtitle}>
            {selectedCount > 0 ? `${totalSize} total` : 'Choose files to start sending'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.sendButton, selectedCount === 0 && styles.sendButtonDisabled]}
          disabled={selectedCount === 0}
          onPress={handleProceed}
        >
          <Text style={styles.sendButtonText}>Send Now</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#05091B" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(13, 30, 70, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTexts: {
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
  selectAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(130, 247, 178, 0.35)',
  },
  selectAllButtonText: {
    color: '#82F7B2',
    fontSize: 12,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabItemActive: {
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
  filePickerBar: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerHint: {
    color: '#A6B6E8',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 20,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#82F7B2',
  },
  pickButtonText: {
    marginLeft: 8,
    color: '#05091B',
    fontWeight: '700',
    fontSize: 14,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 150,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  fileCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fileThumbnail: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 14,
    backgroundColor: '#82F7B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileMeta: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  fileTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  fileSubtitle: {
    color: '#9DB1F1',
    fontSize: 11,
    marginTop: 4,
  },
  emptyState: {
    marginTop: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#9DB1F1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(8, 18, 50, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(130, 247, 178, 0.16)',
  },
  bottomTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSubtitle: {
    color: '#83E8B9',
    fontSize: 11,
    marginTop: 4,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#82F7B2',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(130, 247, 178, 0.4)',
  },
  sendButtonText: {
    color: '#05091B',
    fontWeight: '700',
    fontSize: 14,
  },
});
