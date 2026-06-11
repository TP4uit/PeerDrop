import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { socketService } from './socket.service';

type PeerDropFile = {
  uri: string;
  name?: string;
  size: number;
  mimeType?: string;
  type?: string;
};

type FileMetadata = {
  id: string;
  name: string;
  size: number;
  fileType: string;
};

type CompletedFileInfo = FileMetadata & {
  localPath?: string;
  downloadPath?: string;
};

type SignalPayload = {
  fromId: string;
  fromName?: string;
  signalData: {
    type: 'offer' | 'answer' | 'ice-candidate';
    offer?: unknown;
    answer?: unknown;
    candidate?: unknown;
  };
};

const peerConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CHANNEL_NAME = 'PeerDropChannel';
const CHUNK_SIZE = 32 * 1024;
const MAX_BUFFERED_AMOUNT = 1024 * 1024;
const LOW_BUFFERED_AMOUNT = 256 * 1024;
const RECEIVE_DIR = `${RNFS.DocumentDirectoryPath}/PeerDrop`;

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function createTransferId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFileName(name: string) {
  return (name || 'peerdrop-file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function normalizeFileUri(uri: string) {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function bytesToBase64(bytes: Uint8Array) {
  let result = '';
  let i = 2;

  for (; i < bytes.length; i += 3) {
    result += BASE64_CHARS[bytes[i - 2] >> 2];
    result += BASE64_CHARS[((bytes[i - 2] & 3) << 4) | (bytes[i - 1] >> 4)];
    result += BASE64_CHARS[((bytes[i - 1] & 15) << 2) | (bytes[i] >> 6)];
    result += BASE64_CHARS[bytes[i] & 63];
  }

  if (i === bytes.length + 1) {
    result += BASE64_CHARS[bytes[i - 2] >> 2];
    result += BASE64_CHARS[(bytes[i - 2] & 3) << 4];
    result += '==';
  } else if (i === bytes.length) {
    result += BASE64_CHARS[bytes[i - 2] >> 2];
    result += BASE64_CHARS[((bytes[i - 2] & 3) << 4) | (bytes[i - 1] >> 4)];
    result += BASE64_CHARS[(bytes[i - 1] & 15) << 2];
    result += '=';
  }

  return result;
}

function base64ByteLength(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

class WebRTCService {
  public peerConnection: any = null;
  public dataChannel: any = null;
  public targetSocketId: string | null = null;
  public pendingFile: PeerDropFile | null = null;

  public onConnected: ((remoteDeviceName: string) => void) | null = null;
  public onProgress:
    | ((percent: number, transferredBytes?: number, totalBytes?: number) => void)
    | null = null;
  public onComplete: ((fileInfo?: CompletedFileInfo | FileMetadata) => void) | null = null;
  public pendingIncomingOffer: SignalPayload | null = null;

  private signalListenerReady = false;
  private signalSocket: {
    on: (event: string, handler: (payload: SignalPayload) => void) => void;
    off: (event: string, handler?: (payload: SignalPayload) => void) => void;
  } | null = null;
  private pendingIceCandidates: unknown[] = [];
  private remoteNickname = 'Remote Device';
  private readonly signalHandler = (payload: SignalPayload) => {
    this.handleSignal(payload).catch((error) => {
      console.error('[WebRTC] Failed to handle signaling message:', error);
    });
  };

  private incomingFileInfo: FileMetadata | null = null;
  private incomingFilePath: string | null = null;
  private receivedSize = 0;
  private receiveQueue: string[] = [];
  private isWriting = false;
  private lastReceiveProgress = -1;
  private lastSendProgress = -1;

  init(targetId: string) {
    this.targetSocketId = targetId;
    this.closePeerConnection();

    this.peerConnection = new RTCPeerConnection(peerConfiguration);

    this.peerConnection.onicecandidate = (event: any) => {
      if (!event.candidate || !this.targetSocketId) {
        return;
      }

      socketService.socket?.emit('webrtc-signal', {
        toId: this.targetSocketId,
        signalData: {
          type: 'ice-candidate',
          candidate: event.candidate,
        },
      });
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] PeerConnection state:', state);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[WebRTC] ICE state:', state);
    };

    // The caller creates the DataChannel. The receiver must install this
    // listener before applying the remote offer, otherwise the channel can be
    // missed on some devices.
    this.peerConnection.ondatachannel = (event: any) => {
      this.attachDataChannel(event.channel);
    };
  }

  async startCall(targetId: string) {
    this.initSignalListener();
    this.init(targetId);

    if (!this.peerConnection) {
      return;
    }

    this.attachDataChannel(this.peerConnection.createDataChannel(CHANNEL_NAME, {
      ordered: true,
    }));

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    socketService.socket?.emit('webrtc-signal', {
      toId: targetId,
      fromName: socketService.nickname || 'Unknown Device',
      signalData: {
        type: 'offer',
        offer,
      },
    });
  }

  initSignalListener() {
    if (!socketService.socket) {
      this.signalListenerReady = false;
      this.signalSocket = null;
      return;
    }

    if (this.signalListenerReady && this.signalSocket === socketService.socket) {
      return;
    }

    if (this.signalSocket) {
      this.signalSocket.off('webrtc-signal', this.signalHandler);
    }

    this.signalListenerReady = true;
    this.signalSocket = socketService.socket;
    socketService.socket.on('webrtc-signal', this.signalHandler);
  }

  private async handleSignal({ fromId, fromName, signalData }: SignalPayload) {
    if (signalData.type === 'offer') {
      this.pendingIncomingOffer = { fromId, fromName, signalData };
      return;
    }

    if (signalData.type === 'answer') {
      if (!this.peerConnection) {
        console.warn('[WebRTC] Received answer before PeerConnection exists');
        return;
      }

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(signalData.answer as any),
      );
      await this.flushPendingIceCandidates();
      return;
    }

    if (signalData.type === 'ice-candidate') {
      if (!this.peerConnection?.remoteDescription) {
        this.pendingIceCandidates.push(signalData.candidate);
        return;
      }

      await this.addIceCandidate(signalData.candidate);
    }
  }

  async acceptIncomingOffer(offerPayload?: SignalPayload) {
    const payload = offerPayload ?? this.pendingIncomingOffer;

    if (!payload || payload.signalData.type !== 'offer') {
      return;
    }

    const { fromId, signalData } = payload;
    this.pendingIncomingOffer = null;
    this.init(fromId);

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(signalData.offer as any),
    );

    await this.flushPendingIceCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    socketService.socket?.emit('webrtc-signal', {
      toId: fromId,
      signalData: {
        type: 'answer',
        answer,
      },
    });
  }

  private async addIceCandidate(candidate: unknown) {
    if (!candidate || !this.peerConnection) {
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate as any));
    } catch (error) {
      console.warn('[WebRTC] Ignored ICE candidate that could not be added:', error);
    }
  }

  private async flushPendingIceCandidates() {
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      await this.addIceCandidate(candidate);
    }
  }

  private attachDataChannel(channel: any) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = LOW_BUFFERED_AMOUNT;

    this.dataChannel.onopen = () => {
      this.sendControlMessage({
        type: 'HANDSHAKE',
        nickname: socketService.nickname || 'Unknown Device',
        deviceId: socketService.deviceId,
      });
    };

    this.dataChannel.onmessage = (event: any) => {
      this.handleDataChannelMessage(event.data).catch((error) => {
        console.error('[WebRTC] Failed to process DataChannel message:', error);
      });
    };

    this.dataChannel.onerror = (error: unknown) => {
      console.error('[WebRTC] DataChannel error:', error);
    };

    this.dataChannel.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
    };
  }

  private async handleDataChannelMessage(data: unknown) {
    if (typeof data === 'string') {
      const handledAsControl = await this.tryHandleControlMessage(data);
      if (handledAsControl) {
        return;
      }

      this.enqueueIncomingChunk(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      this.enqueueIncomingChunk(bytesToBase64(new Uint8Array(data)));
      return;
    }

    if (data && typeof data === 'object' && 'byteLength' in data) {
      this.enqueueIncomingChunk(bytesToBase64(new Uint8Array(data as ArrayBufferLike)));
    }
  }

  private async tryHandleControlMessage(message: string) {
    try {
      const parsed = JSON.parse(message);

      if (parsed.type === 'HANDSHAKE') {
        this.remoteNickname = parsed.nickname || 'Remote Device';
        this.onConnected?.(this.remoteNickname);
        return true;
      }

      if (parsed.type === 'FILE_META' || parsed.type === 'file-meta') {
        const metadata = parsed.metadata as FileMetadata;
        await this.prepareIncomingFile({
          id: metadata.id || createTransferId(),
          name: metadata.name,
          size: Number(metadata.size),
          fileType: metadata.fileType || 'application/octet-stream',
        });
        return true;
      }

      return Boolean(parsed.type);
    } catch {
      return false;
    }
  }

  private async prepareIncomingFile(metadata: FileMetadata) {
    this.resetReceiveState();
    await RNFS.mkdir(RECEIVE_DIR);

    const safeName = sanitizeFileName(metadata.name);
    const incomingPath = `${RECEIVE_DIR}/${Date.now()}-${safeName}`;

    // Create an empty file first. Chunks may already be queued by the time this
    // promise resolves, and the writer will wait until incomingFilePath exists.
    await RNFS.writeFile(incomingPath, '', 'base64');

    this.incomingFileInfo = metadata;
    this.incomingFilePath = incomingPath;
    this.receivedSize = 0;
    this.lastReceiveProgress = -1;
    this.processReceiveQueue();
  }

  private enqueueIncomingChunk(base64Chunk: string) {
    this.receiveQueue.push(base64Chunk);
    this.processReceiveQueue();
  }

  private async processReceiveQueue() {
    if (
      this.isWriting ||
      !this.incomingFileInfo ||
      !this.incomingFilePath ||
      this.receiveQueue.length === 0
    ) {
      return;
    }

    this.isWriting = true;

    try {
      while (this.receiveQueue.length > 0 && this.incomingFileInfo && this.incomingFilePath) {
        const base64Chunk = this.receiveQueue.shift();
        if (!base64Chunk) {
          continue;
        }

        await RNFS.appendFile(this.incomingFilePath, base64Chunk, 'base64');
        this.receivedSize += base64ByteLength(base64Chunk);
        this.reportReceiveProgress();

        if (this.receivedSize >= this.incomingFileInfo.size) {
          await this.completeIncomingFile();
          break;
        }
      }
    } finally {
      this.isWriting = false;

      if (this.receiveQueue.length > 0) {
        this.processReceiveQueue();
      }
    }
  }

  private reportReceiveProgress() {
    if (!this.incomingFileInfo) {
      return;
    }

    const progress = Math.min(
      100,
      Math.round((this.receivedSize / this.incomingFileInfo.size) * 100),
    );

    if (progress !== this.lastReceiveProgress) {
      this.lastReceiveProgress = progress;
      this.onProgress?.(progress, this.receivedSize, this.incomingFileInfo.size);
    }
  }

  private async completeIncomingFile() {
    if (!this.incomingFileInfo || !this.incomingFilePath) {
      return;
    }

    const completed: CompletedFileInfo = {
      ...this.incomingFileInfo,
      localPath: this.incomingFilePath,
    };

    if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath) {
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${sanitizeFileName(
        this.incomingFileInfo.name,
      )}`;

      try {
        await RNFS.copyFile(this.incomingFilePath, downloadPath);
        completed.downloadPath = downloadPath;
      } catch (error) {
        console.warn(
          '[WebRTC] File received in app documents, but could not copy to Downloads:',
          error,
        );
      }
    }

    this.onProgress?.(100, this.incomingFileInfo.size, this.incomingFileInfo.size);
    this.onComplete?.(completed);
    this.resetReceiveState();
  }

  private resetReceiveState() {
    this.incomingFileInfo = null;
    this.incomingFilePath = null;
    this.receivedSize = 0;
    this.receiveQueue = [];
    this.lastReceiveProgress = -1;
  }

  async sendFile(file: PeerDropFile) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('[WebRTC] DataChannel is not open; cannot send file');
      return;
    }

    const filePath = normalizeFileUri(file.uri);
    const metadata: FileMetadata = {
      id: createTransferId(),
      name: file.name || filePath.split('/').pop() || 'peerdrop-file',
      size: Number(file.size),
      fileType: file.mimeType || file.type || 'application/octet-stream',
    };

    this.lastSendProgress = -1;
    this.sendControlMessage({
      type: 'FILE_META',
      metadata,
    });

    let offset = 0;

    while (offset < metadata.size) {
      this.assertDataChannelOpen();
      await this.waitForBackpressure();

      const bytesToRead = Math.min(CHUNK_SIZE, metadata.size - offset);
      const base64Chunk = await RNFS.read(filePath, bytesToRead, offset, 'base64');
      this.dataChannel.send(base64Chunk);

      offset += bytesToRead;
      this.reportSendProgress(offset, metadata.size);
    }

    this.onComplete?.(metadata);
  }

  private reportSendProgress(sentBytes: number, totalBytes: number) {
    const progress = Math.min(100, Math.round((sentBytes / totalBytes) * 100));

    if (progress !== this.lastSendProgress) {
      this.lastSendProgress = progress;
      this.onProgress?.(progress, sentBytes, totalBytes);
    }
  }

  private async waitForBackpressure() {
    while (
      this.dataChannel &&
      this.dataChannel.readyState === 'open' &&
      this.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT
    ) {
      await this.waitForBufferedAmountLow();
    }
  }

  private waitForBufferedAmountLow() {
    const channel = this.dataChannel;

    if (!channel || channel.bufferedAmount <= LOW_BUFFERED_AMOUNT) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const previousHandler = channel.onbufferedamountlow;
      let done = false;

      const finish = () => {
        if (done) {
          return;
        }

        done = true;
        clearTimeout(timeout);

        if (channel.onbufferedamountlow === handleLowBuffer) {
          channel.onbufferedamountlow = previousHandler;
        }

        resolve();
      };

      const handleLowBuffer = () => {
        previousHandler?.();
        finish();
      };

      const timeout = setTimeout(finish, 50);
      channel.bufferedAmountLowThreshold = LOW_BUFFERED_AMOUNT;
      channel.onbufferedamountlow = handleLowBuffer;
    });
  }

  private assertDataChannelOpen() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel closed while sending file');
    }
  }

  private sendControlMessage(payload: Record<string, unknown>) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(payload));
    }
  }

  private closePeerConnection() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // Ignore close errors from already closed native channels.
      }
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        // Ignore close errors from already closed peer connections.
      }
    }

    this.dataChannel = null;
    this.peerConnection = null;
    this.pendingIceCandidates = [];
  }

  disconnect() {
    this.closePeerConnection();
    this.resetReceiveState();
    this.targetSocketId = null;
  }
}

export const webRTCService = new WebRTCService();
