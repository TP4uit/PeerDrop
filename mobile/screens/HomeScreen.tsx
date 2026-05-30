import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface RecentTransfer {
  id: string;
  fileName: string;
  device: string;
  date: string;
  size: string;
  status: 'completed' | 'failed' | 'pending';
}

const recentTransfers: RecentTransfer[] = [
  {
    id: '1',
    fileName: 'Project_Proposal_v2.pdf',
    device: "Sarah's MacBook",
    date: 'Today, 14:30',
    size: '2.4 MB',
    status: 'completed',
  },
  {
    id: '2',
    fileName: 'Vacation_Photos.zip',
    device: 'Alex’s iPhone',
    date: 'Yesterday',
    size: '18.0 MB',
    status: 'completed',
  },
  {
    id: '3',
    fileName: 'Design_Guide.sketch',
    device: 'Office iPad',
    date: 'Yesterday',
    size: '5.8 MB',
    status: 'pending',
  },
];

export default function HomeScreen() {
  const router = useRouter();

  const renderActionCard = (
    icon: string,
    label: string,
    subtitle: string,
    onPress: () => void,
    color: string
  ) => (
    <TouchableOpacity
      style={[styles.actionCard, { borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}24` }]}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  const renderTransferItem = ({ item }: { item: RecentTransfer }) => (
    <View style={styles.transferRow}>
      <View style={styles.transferRowLeft}>
        <View style={styles.transferIconBox}>
          <MaterialCommunityIcons name="file-document-outline" size={18} color="#FFF" />
        </View>
        <View style={styles.transferTextContainer}>
          <Text style={styles.transferFileName}>{item.fileName}</Text>
          <Text style={styles.transferMeta}>{item.device}</Text>
        </View>
      </View>
      <View style={styles.transferRight}>
        <Text style={styles.transferSize}>{item.size}</Text>
        <Text style={styles.transferStatus}>{item.date}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.wrapper} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <View style={styles.cardTop}> 
          <View style={styles.profileRow}>
            <View style={styles.avatarWrapper}>
              <MaterialCommunityIcons name="account-circle" size={46} color="#FFFFFF" />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>Alex's iPhone</Text>
              <View style={styles.statusRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.statusText}>Online • Ready to share</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            {renderActionCard('upload', 'Send', 'Share files now', () => router.push('/radar'), '#4CAF50')}
          {renderActionCard('download', 'Receive', 'Wait for incoming', () => router.push('/radar'), '#2196F3')}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transfers</Text>
          <TouchableOpacity>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={recentTransfers}
          keyExtractor={(item) => item.id}
          renderItem={renderTransferItem}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.transferList}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#05091B',
  },
  container: {
    padding: 16,
  },
  cardTop: {
    backgroundColor: '#07112C',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 40,
    elevation: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#14264F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
    marginRight: 8,
  },
  statusText: {
    color: '#96A0C7',
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    backgroundColor: '#07112C',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionSubtitle: {
    color: '#96A0C7',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionAction: {
    color: '#4B8CFF',
    fontSize: 13,
    fontWeight: '600',
  },
  transferList: {
    paddingBottom: 40,
  },
  transferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#081541',
    borderRadius: 22,
    padding: 18,
  },
  transferRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transferIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#0F2A5A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  transferTextContainer: {
    flex: 1,
  },
  transferFileName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  transferMeta: {
    color: '#7F8CB2',
    fontSize: 12,
  },
  transferRight: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  transferSize: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  transferStatus: {
    color: '#7F8CB2',
    fontSize: 12,
  },
  separator: {
    height: 12,
  },
});
