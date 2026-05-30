import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FileItem {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'video' | 'document' | 'audio';
  color: string;
  selected: boolean;
}

const fileTabs = ['Photos', 'Videos', 'Documents', 'Music'] as const;
const tabFilter: Record<typeof fileTabs[number], FileItem['type'][]> = {
  Photos: ['image'],
  Videos: ['video'],
  Documents: ['document'],
  Music: ['audio'],
};

const mockFiles: FileItem[] = [
  { id: '1', name: 'Sunset.png', size: '6.1 MB', type: 'image', color: '#3058FF', selected: false },
  { id: '2', name: 'City Lights.jpg', size: '4.5 MB', type: 'image', color: '#3E6BFF', selected: false },
  { id: '3', name: 'Abstract Art.jpg', size: '3.9 MB', type: 'image', color: '#1D3AE8', selected: false },
  { id: '4', name: 'Night Sky.png', size: '5.4 MB', type: 'image', color: '#2A47DD', selected: false },
  { id: '5', name: 'Forest Path.jpg', size: '4.8 MB', type: 'image', color: '#4A74FF', selected: false },
  { id: '6', name: 'Portrait.jpg', size: '3.2 MB', type: 'image', color: '#1F43CE', selected: false },
  { id: '7', name: 'Travel.mp4', size: '34 MB', type: 'video', color: '#0047BA', selected: false },
  { id: '8', name: 'Meeting.mp4', size: '21 MB', type: 'video', color: '#1862D6', selected: false },
  { id: '9', name: 'Report.pdf', size: '2.8 MB', type: 'document', color: '#2F4BE8', selected: false },
  { id: '10', name: 'Invoice.pdf', size: '1.5 MB', type: 'document', color: '#1C34C7', selected: false },
  { id: '11', name: 'Song.mp3', size: '5.1 MB', type: 'audio', color: '#1A60FF', selected: false },
  { id: '12', name: 'Podcast.mp3', size: '9.8 MB', type: 'audio', color: '#2945D8', selected: false },
];

const iconByType: Record<FileItem['type'], string> = {
  image: 'image',
  video: 'video',
  document: 'file-document',
  audio: 'music-note',
};

export default function FileSelectionScreen() {
  const router = useRouter();
  const { deviceName } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<typeof fileTabs[number]>('Photos');
  const [files, setFiles] = useState<FileItem[]>(mockFiles);
  const { width } = useWindowDimensions();
  const columnCount = 3;
  const itemSize = Math.floor((width - 44) / columnCount);

  const displayedFiles = files.filter((file) =>
    tabFilter[activeTab].includes(file.type)
  );

  const selectedCount = files.filter((f) => f.selected).length;
  const totalSize = files
    .filter((f) => f.selected)
    .reduce((sum, f) => sum + parseFloat(f.size), 0)
    .toFixed(1);

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
          totalSize: `${totalSize} MB`,
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
        <Text style={styles.fileSubtitle}>{item.size}</Text>
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

      <FlatList
        data={displayedFiles}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTitle}>Selected: {selectedCount} item{selectedCount !== 1 ? 's' : ''}</Text>
          <Text style={styles.bottomSubtitle}>
            {selectedCount > 0 ? `${totalSize} MB total` : 'Tap files to start selecting'}
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
