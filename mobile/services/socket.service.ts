import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';

type UserInfo = {
  deviceId: string;
  nickname: string;
  avatar: string;
};

const DEVICE_ID_KEY = '@peerdrop_deviceId';
const NICKNAME_KEY = '@peerdrop_nickname';
const CONNECT_TIMEOUT_MS = 18000;
const CONNECT_ERROR_LOG_WINDOW_MS = 5000;
const SOCKET_TRANSPORTS = ['polling', 'websocket'] as const;

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
type SocketSubscriber = (socket: Socket | null) => void;
type ConnectionStateSubscriber = (state: ConnectionState, reason?: string) => void;

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

  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:3000';
  }

  // Expo exposes the LAN address of Metro in development. This is a useful
  // fallback for real devices on the same Wi-Fi.
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
  public connectionState: ConnectionState = 'idle';

  private lastRoomId: string | null = null;
  private connectPromise: Promise<Socket> | null = null;
  private socketSubscribers = new Set<SocketSubscriber>();
  private connectionStateSubscribers = new Set<ConnectionStateSubscriber>();
  private lastConnectErrorMessage = '';
  private lastConnectErrorLoggedAt = 0;
  private lastConnectionStateReason = '';
  private hasConnectedOnce = false;

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

  subscribeSocket(listener: SocketSubscriber) {
    this.socketSubscribers.add(listener);
    listener(this.socket);

    return () => {
      this.socketSubscribers.delete(listener);
    };
  }

  subscribeConnectionState(listener: ConnectionStateSubscriber) {
    this.connectionStateSubscribers.add(listener);
    listener(this.connectionState, this.lastConnectionStateReason);

    return () => {
      this.connectionStateSubscribers.delete(listener);
    };
  }

  async connect(serverUrl?: string) {
    const resolvedUrl = serverUrl?.trim() || readConfiguredServerUrl();

    if (!resolvedUrl) {
      throw new Error(
        'Missing signaling server URL. Set EXPO_PUBLIC_SIGNALING_URL, app config extra.signalingUrl, or pass socketService.connect(url).',
      );
    }

    if (this.socket?.connected && this.serverUrl === resolvedUrl) {
      this.connectionState = 'connected';
      return this.socket;
    }

    const socketIsActive = Boolean((this.socket as (Socket & { active?: boolean }) | null)?.active);

    if (
      this.socket &&
      this.serverUrl === resolvedUrl &&
      (this.connectionState === 'connecting' ||
        this.connectionState === 'reconnecting' ||
        socketIsActive)
    ) {
      this.connectPromise = this.waitForSocketConnection(this.socket, resolvedUrl);

      try {
        return await this.connectPromise;
      } finally {
        this.connectPromise = null;
      }
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connectInternal(resolvedUrl);

    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connectInternal(resolvedUrl: string) {
    if (!this.deviceId) {
      await this.initializeIdentity();
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.notifySocketSubscribers();
    }

    this.serverUrl = resolvedUrl;
    this.hasConnectedOnce = false;
    this.setConnectionState('connecting');
    this.lastConnectErrorMessage = '';
    this.lastConnectErrorLoggedAt = 0;

    console.log(
      `[Socket] Connecting to ${resolvedUrl} with transports: ${SOCKET_TRANSPORTS.join(', ')}`,
    );

    const socket = io(resolvedUrl, {
      transports: [...SOCKET_TRANSPORTS],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: this.getUserInfo(),
      query: {
        deviceId: this.deviceId,
      },
    });
    this.socket = socket;
    this.notifySocketSubscribers();

    socket.on('connect', () => {
      this.hasConnectedOnce = true;
      this.setConnectionState('connected');
      console.log(`[Socket] Connected to ${resolvedUrl} as ${this.nickname}`);

      socket.emit('device-online', {
        userInfo: this.getUserInfo(),
      });

      if (this.lastRoomId) {
        this.emitJoinRoom(this.lastRoomId);
      }
    });

    const manager = socket.io as {
      on: (event: string, handler: (...args: any[]) => void) => void;
      off: (event: string, handler: (...args: any[]) => void) => void;
    };

    manager.on('reconnect_attempt', (attempt) => {
      this.setConnectionState('reconnecting', `attempt ${attempt}`);
    });

    manager.on('reconnect', (attempt) => {
      this.setConnectionState('connected', `reconnected after ${attempt} attempt(s)`);
      console.log(`[Socket] Reconnected after ${attempt} attempt(s)`);
    });

    manager.on('reconnect_error', (error) => {
      this.setConnectionState('reconnecting', error?.message || 'reconnect error');
      this.logConnectError(`Reconnect error: ${error?.message || 'unknown error'}`);
    });

    manager.on('reconnect_failed', () => {
      this.setConnectionState('offline', 'reconnect failed');
    });

    socket.on('connect_error', (error) => {
      this.setConnectionState(this.hasConnectedOnce ? 'reconnecting' : 'connecting', error.message);
      const currentTransport = socket.io.engine?.transport?.name || 'unknown';
      this.logConnectError(
        `${error.message} (url=${resolvedUrl}, transport=${currentTransport}, state=${this.connectionState})`,
      );
    });

    socket.on('disconnect', (reason) => {
      this.setConnectionState(socket.active ? 'reconnecting' : 'offline', reason);
      console.log('[Socket] Disconnected:', reason);
    });

    return await this.waitForSocketConnection(socket, resolvedUrl);
  }

  private async waitForSocketConnection(socket: Socket, resolvedUrl: string) {
    if (socket.connected) {
      this.setConnectionState('connected');
      return socket;
    }

    const manager = socket.io as {
      on: (event: string, handler: (...args: any[]) => void) => void;
      off: (event: string, handler: (...args: any[]) => void) => void;
    };

    return await new Promise<Socket>((resolve, reject) => {
      let settled = false;
      let lastError: Error | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
        manager.off('reconnect_failed', handleReconnectFailed);
      };

      const finishResolve = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(socket);
      };

      const finishReject = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        this.hasConnectedOnce = false;
        this.setConnectionState('offline', error.message);

        if (this.socket === socket) {
          socket.removeAllListeners();
          socket.disconnect();
          this.socket = null;
          this.notifySocketSubscribers();
        }

        reject(error);
      };

      const handleConnect = () => {
        finishResolve();
      };

      const handleConnectError = (error: Error) => {
        lastError = error;
      };

      const handleReconnectFailed = () => {
        finishReject(lastError || new Error(`Unable to connect to ${resolvedUrl}`));
      };

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleConnectError);
      manager.on('reconnect_failed', handleReconnectFailed);

      timeoutId = setTimeout(() => {
        if (socket.connected) {
          finishResolve();
          return;
        }

        finishReject(lastError || new Error(`Timed out connecting to ${resolvedUrl}`));
      }, CONNECT_TIMEOUT_MS);

      if (socket.connected) {
        finishResolve();
      }
    });
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
    this.hasConnectedOnce = false;
    this.setConnectionState('idle');

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.notifySocketSubscribers();
    }
  }

  private notifySocketSubscribers() {
    for (const listener of this.socketSubscribers) {
      listener(this.socket);
    }
  }

  private setConnectionState(state: ConnectionState, reason = '') {
    if (this.connectionState === state && this.lastConnectionStateReason === reason) {
      return;
    }

    this.connectionState = state;
    this.lastConnectionStateReason = reason;

    for (const listener of this.connectionStateSubscribers) {
      listener(state, reason);
    }
  }

  private logConnectError(message: string) {
    const now = Date.now();

    if (
      this.lastConnectErrorMessage === message &&
      now - this.lastConnectErrorLoggedAt < CONNECT_ERROR_LOG_WINDOW_MS
    ) {
      return;
    }

    this.lastConnectErrorMessage = message;
    this.lastConnectErrorLoggedAt = now;
    console.warn('[Socket] Connection error:', message);
  }
}

export const socketService = new SocketService();
