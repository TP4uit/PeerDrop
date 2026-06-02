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

// Fallback in-memory storage for when AsyncStorage is unavailable
let memoryCache: TransferHistoryItem[] = [];
let isAsyncStorageAvailable = true;

const checkAsyncStorageAvailable = async (): Promise<boolean> => {
  if (!isAsyncStorageAvailable) return false;

  try {
    await AsyncStorage.setItem('__test__', '1');
    await AsyncStorage.removeItem('__test__');
    return true;
  } catch (error) {
    console.warn('AsyncStorage not available, using memory cache:', error);
    isAsyncStorageAvailable = false;
    return false;
  }
};

export async function loadTransferHistory(): Promise<TransferHistoryItem[]> {
  try {
    const available = await checkAsyncStorageAvailable();

    if (available) {
      const stored = await AsyncStorage.getItem(TRANSFER_HISTORY_KEY);
      return stored ? (JSON.parse(stored) as TransferHistoryItem[]) : [];
    } else {
      return memoryCache;
    }
  } catch (error) {
    console.error('Failed to load transfer history', error);
    return memoryCache;
  }
}

export async function saveTransferHistory(items: TransferHistoryItem[]) {
  try {
    memoryCache = items;

    const available = await checkAsyncStorageAvailable();
    if (available) {
      await AsyncStorage.setItem(TRANSFER_HISTORY_KEY, JSON.stringify(items));
    }
  } catch (error) {
    console.error('Failed to save transfer history', error);
    memoryCache = items;
  }
}

export async function addTransferHistoryItem(item: TransferHistoryItem) {
  try {
    const existing = await loadTransferHistory();
    const next = [item, ...existing].slice(0, 10);
    await saveTransferHistory(next);
    return next;
  } catch (error) {
    console.error('Failed to add transfer history item', error);
    memoryCache = [item, ...memoryCache].slice(0, 10);
    return memoryCache;
  }
}

export async function clearTransferHistory() {
  try {
    memoryCache = [];

    const available = await checkAsyncStorageAvailable();
    if (available) {
      await AsyncStorage.removeItem(TRANSFER_HISTORY_KEY);
    }
  } catch (error) {
    console.error('Failed to clear transfer history', error);
    memoryCache = [];
  }
}
