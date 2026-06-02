import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TransferHistoryItem {
  id: string;
  fileName: string;
  device: string;
  date: string;
  size: string;
  status: 'completed' | 'failed' | 'pending';
}

const TRANSFER_HISTORY_KEY = 'transfer_history';

export async function loadTransferHistory(): Promise<TransferHistoryItem[]> {
  try {
    const stored = await AsyncStorage.getItem(TRANSFER_HISTORY_KEY);
    return stored ? (JSON.parse(stored) as TransferHistoryItem[]) : [];
  } catch (error) {
    console.error('Failed to load transfer history', error);
    return [];
  }
}

export async function saveTransferHistory(items: TransferHistoryItem[]) {
  try {
    await AsyncStorage.setItem(TRANSFER_HISTORY_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save transfer history', error);
  }
}

export async function addTransferHistoryItem(item: TransferHistoryItem) {
  const existing = await loadTransferHistory();
  const next = [item, ...existing].slice(0, 10);
  await saveTransferHistory(next);
  return next;
}

export async function clearTransferHistory() {
  try {
    await AsyncStorage.removeItem(TRANSFER_HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear transfer history', error);
  }
}
