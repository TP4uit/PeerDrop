import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { io, Socket } from 'socket.io-client';

type UserInfo = {
  deviceId: string;
  nickname: string;
  avatar: string;
};

const DEVICE_ID_KEY = '@peerdrop_deviceId';
const NICKNAME_KEY = '@peerdrop_nickname';

function createDeviceId() {
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readConfiguredServerUrl() {
  const envUrl = process.env.EXPO_PUBLIC_SIGNALING_URL;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraUrl = extra?.signalingUrl;

  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }

  if (typeof extraUrl === 'string' && extraUrl.trim()) {
    return extraUrl.trim();
  }

  // Expo exposes the LAN address of Metro in development. This is a useful
  // fallback for real devices on the same Wi-Fi, without hardcoding emulator IPs.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  return undefined;
}

class SocketService {
  public socket: Socket | null = null;
  public deviceId = '';
  public nickname = '';
  public avatar = '';
  public serverUrl = '';

  private lastRoomId: string | null = null;
  private connectPromise: Promise<Socket> | null = null;

  async initializeIdentity() {
    try {
      const [storedDeviceId, storedNickname] = await Promise.all([
        AsyncStorage.getItem(DEVICE_ID_KEY),
        AsyncStorage.getItem(NICKNAME_KEY),
      ]);

      this.deviceId = storedDeviceId || createDeviceId();
      this.nickname =
        storedNickname ||
        Device.deviceName ||
        Device.modelName ||
        'Unknown Device';

      await Promise.all([
        AsyncStorage.setItem(DEVICE_ID_KEY, this.deviceId),
        AsyncStorage.setItem(NICKNAME_KEY, this.nickname),
      ]);

      this.avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
        this.deviceId,
      )}`;
    } catch (error) {
      console.error('[Socket] Failed to initialize device identity:', error);
      this.deviceId = this.deviceId || createDeviceId();
      this.nickname = this.nickname || Device.modelName || 'Unknown Device';
      this.avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
        this.deviceId,
      )}`;
    }
  }

  getUserInfo(): UserInfo {
    return {
      deviceId: this.deviceId,
      nickname: this.nickname,
      avatar: this.avatar,
    };
  }

  async connect(serverUrl?: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connectInternal(serverUrl);

    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connectInternal(serverUrl?: string) {
    if (!this.deviceId) {
      await this.initializeIdentity();
    }

    const resolvedUrl = serverUrl?.trim() || readConfiguredServerUrl();
    if (!resolvedUrl) {
      throw new Error(
        'Missing signaling server URL. Set EXPO_PUBLIC_SIGNALING_URL, app config extra.signalingUrl, or pass socketService.connect(url).',
      );
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.serverUrl = resolvedUrl;
    this.socket = io(resolvedUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: this.getUserInfo(),
      query: {
        deviceId: this.deviceId,
      },
    });

    this.socket.on('connect', () => {
      console.log(`[Socket] Connected to ${resolvedUrl} as ${this.nickname}`);

      // Socket.io gives a new socket.id after reconnect. Re-announce the stable
      // device identity and rejoin the last room so the UI does not lose state.
      this.socket?.emit('device-online', {
        userInfo: this.getUserInfo(),
      });

      if (this.lastRoomId) {
        this.emitJoinRoom(this.lastRoomId);
      }
    });

    this.socket.on('reconnect', (attempt) => {
      console.log(`[Socket] Reconnected after ${attempt} attempt(s)`);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    return this.socket;
  }

  joinRoom(roomId: string) {
    this.lastRoomId = roomId;

    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot join room before socket is connected');
      return;
    }

    this.emitJoinRoom(roomId);
  }

  private emitJoinRoom(roomId: string) {
    this.socket?.emit('join-room', {
      roomId,
      userInfo: this.getUserInfo(),
    });
  }

  leaveRoom() {
    this.lastRoomId = null;
    this.socket?.emit('leave-room');
  }

  disconnect() {
    this.lastRoomId = null;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
