import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const router = useRouter();
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('Alex\'s iPhone');
  const [profileEmail, setProfileEmail] = useState('alex.doe@example.com');
  const [tempName, setTempName] = useState(profileName);
  const [tempEmail, setTempEmail] = useState(profileEmail);

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Transfer History',
      'Are you sure you want to delete all transfer history? This action cannot be undone.',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            Alert.alert('Success', 'Transfer history has been cleared.');
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About PeerDrop',
      'PeerDrop v1.0.0\n\nA fast and secure peer-to-peer file sharing application. Share files instantly with nearby devices over a secure connection.',
      [{ text: 'OK', onPress: () => {} }]
    );
  };

  const openEditModal = () => {
    setTempName(profileName);
    setTempEmail(profileEmail);
    setEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Device name cannot be empty');
      return;
    }
    if (!tempEmail.trim()) {
      Alert.alert('Error', 'Email cannot be empty');
      return;
    }
    setProfileName(tempName);
    setProfileEmail(tempEmail);
    setEditModalVisible(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <MaterialCommunityIcons name="account-circle" size={80} color="#00E19B" />
          </View>
          <Text style={styles.profileName}>{profileName}</Text>
          <Text style={styles.profileEmail}>{profileEmail}</Text>
          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <MaterialCommunityIcons name="pencil" size={16} color="#00E19B" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Options */}
        <View style={styles.settingsGroup}>
          {/* Save to Gallery */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <MaterialCommunityIcons name="image-check" size={20} color="#00E19B" />
              </View>
              <Text style={styles.settingLabel}>Save incoming files to Gallery</Text>
            </View>
            <Switch
              value={saveToGallery}
              onValueChange={setSaveToGallery}
              trackColor={{ false: '#3a5a7a', true: '#00E19B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Clear History */}
          <TouchableOpacity style={styles.settingRow} onPress={handleClearHistory}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 59, 48, 0.18)' }]}>
                <MaterialCommunityIcons name="delete" size={20} color="#FF3B30" />
              </View>
              <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Clear Transfer History</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#7F8CB2" />
          </TouchableOpacity>

          {/* About */}
          <TouchableOpacity style={styles.settingRow} onPress={handleAbout}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <MaterialCommunityIcons name="information" size={20} color="#4B8CFF" />
              </View>
              <Text style={styles.settingLabel}>About PeerDrop</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#7F8CB2" />
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>PeerDrop v1.0.0</Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Device Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Device Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter device name"
                  placeholderTextColor="#7F8CB2"
                  value={tempName}
                  onChangeText={setTempName}
                  selectionColor="#00E19B"
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter email address"
                  placeholderTextColor="#7F8CB2"
                  value={tempEmail}
                  onChangeText={setTempEmail}
                  keyboardType="email-address"
                  selectionColor="#00E19B"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#07112C',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.12)',
  },
  avatarBox: {
    marginBottom: 16,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  profileEmail: {
    color: '#A5B0D0',
    fontSize: 13,
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 225, 155, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.24)',
  },
  editButtonText: {
    color: '#00E19B',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsGroup: {
    backgroundColor: '#07112C',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 225, 155, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  versionText: {
    color: '#7F8CB2',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#07112C',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(0, 225, 155, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 155, 0.24)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#00E19B',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#05091B',
    fontSize: 14,
    fontWeight: '700',
  },
});
