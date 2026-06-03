import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { socketService } from './socket.service';
import RNFS from 'react-native-fs'; // 🔥 Dùng thư viện Native để có lệnh Append
import * as MediaLibrary from 'expo-media-library';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// 🌟 THUẬT TOÁN ĐỘNG CƠ: Chuyển đổi Nhị phân sang Base64
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array) {
  let result = '';
  let i;
  const l = bytes.length;
  for (i = 2; i < l; i += 3) {
    result += chars[bytes[i - 2] >> 2];
    result += chars[((bytes[i - 2] & 3) << 4) | (bytes[i - 1] >> 4)];
    result += chars[((bytes[i - 1] & 15) << 2) | (bytes[i] >> 6)];
    result += chars[bytes[i] & 63];
  }
  if (i === l + 1) {
    result += chars[bytes[i - 2] >> 2];
    result += chars[(bytes[i - 2] & 3) << 4];
    result += '==';
  } else if (i === l) {
    result += chars[bytes[i - 2] >> 2];
    result += chars[((bytes[i - 2] & 3) << 4) | (bytes[i - 1] >> 4)];
    result += chars[(bytes[i - 1] & 15) << 2];
    result += '=';
  }
  return result;
}

class WebRTCService {
  public peerConnection: any = null;
  public dataChannel: any = null;
  public targetSocketId: string | null = null;
  public onConnected: ((remoteDeviceName: string) => void) | null = null;
  public pendingFile: any = null;

  public onProgress: ((percent: number) => void) | null = null;
  public onComplete: (() => void) | null = null;
  private lastReportedProgress = -1;

  private incomingFileInfo: any = null;
  private receivedSize = 0;
  public pendingFileUri: string | null = null;
  
  private chunkQueue: any[] = [];
  private isWriting = false;

  init(targetId: string) {
    this.targetSocketId = targetId;
    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && socketService.socket) {
        socketService.socket.emit('webrtc-signal', {
          toId: this.targetSocketId,
          signalData: { type: 'ice-candidate', candidate: event.candidate },
        });
      }
    };

    this.peerConnection.ondatachannel = (event: any) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
  }

  setupDataChannelListeners() {
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      console.log('🔥 [Mobile] Mạng P2P thiết lập thành công!');
      const handshakePayload = {
        type: 'HANDSHAKE',
        nickname: socketService.nickname || 'Unknown Device'
      };
      this.dataChannel.send(JSON.stringify(handshakePayload));
    };

    this.dataChannel.onmessage = async (event: any) => {
      if (typeof event.data === 'string') {
        try {
          const parsedData = JSON.parse(event.data);
          
          if (parsedData.type === 'HANDSHAKE') {
            console.log(`🤝 Đã bắt tay với: ${parsedData.nickname}`);
            if (this.onConnected) this.onConnected(parsedData.nickname);
            return; 
          }

          if (parsedData.type === 'file-meta') {
            const safeFileName = parsedData.metadata.name.replace(/\s+/g, '_');
            const uri = `${RNFS.CachesDirectoryPath}/${safeFileName}`;
            
            // 🛑 FIX LỖI TỐC ĐỘ: Đợi hệ điều hành tạo file rỗng xong xuôi...
            await RNFS.writeFile(uri, '', 'utf8');
            
            // ...Rồi MỚI gán biến để mở khóa cho Hàng đợi ghi (Queue)
            this.pendingFileUri = uri;
            this.incomingFileInfo = parsedData.metadata;
            this.receivedSize = 0;
            this.lastReportedProgress = -1;
            
            console.log(`📥 [Mobile] Ổ cứng đã mở, sẵn sàng nhận: ${this.incomingFileInfo.name}`);
            
            // Kích hoạt lại hàng đợi phòng khi có chunk tới sớm bị kẹt
            this.processWriteQueue();
            return;
          }
        } catch (e) {
          // 🔥 FIX HỐ ĐEN: Nếu parse JSON thất bại, đây CHÍNH LÀ MẢNH DỮ LIỆU FILE!
          this.chunkQueue.push(event.data);
          this.processWriteQueue();
        }
      } else {
        // Dành cho trường hợp RN WebRTC phiên bản mới trả về ArrayBuffer chuẩn
        this.chunkQueue.push(event.data);
        this.processWriteQueue();
      }
    };
  }

  private async processWriteQueue() {
    // 🛑 CHẶN LẠI: Nếu file chưa tạo xong (pendingFileUri đang null) thì khoá van không cho ghi!
    if (this.isWriting || this.chunkQueue.length === 0 || !this.pendingFileUri || !this.incomingFileInfo) {
        return;
    }
    
    this.isWriting = true;

    while (this.chunkQueue.length > 0) {
      const data = this.chunkQueue.shift();

      try {
        let base64Chunk = '';
        let chunkSize = 0;
        
        if (typeof data === 'string') {
           base64Chunk = data;
           // Tính lại số byte chuẩn từ chuỗi Base64
           const padding = (data.endsWith("==") ? 2 : (data.endsWith("=") ? 1 : 0));
           chunkSize = Math.floor((data.length * 3) / 4) - padding;
        } else {
           const bytes = new Uint8Array(data);
           chunkSize = bytes.byteLength;
           base64Chunk = bytesToBase64(bytes);
        }

        // Bơm thẳng nước xuống ổ cứng
        await RNFS.appendFile(this.pendingFileUri!, base64Chunk, 'base64');
        this.receivedSize += chunkSize;

        const progress = Math.round((this.receivedSize / this.incomingFileInfo.size) * 100);
        if (progress !== this.lastReportedProgress) {
          if (this.onProgress) this.onProgress(progress);
          this.lastReportedProgress = progress;
          
          if (progress % 10 === 0 || progress === 100) {
             console.log(`📦 [Mobile] Đã lưu... ${progress}% (${this.receivedSize}/${this.incomingFileInfo.size} bytes)`);
          }
        }

        // KHI NHẬN ĐỦ 100%
        if (this.receivedSize >= this.incomingFileInfo.size) {
          console.log('🎉 [Mobile] LẮP RÁP FILE THÀNH CÔNG 100%!');
          
          try {
            const localUri = `file://${this.pendingFileUri}`;
            const asset = await MediaLibrary.createAssetAsync(localUri);
            await MediaLibrary.createAlbumAsync('PeerDrop', asset, false);
            console.log('✅ File đã nằm an toàn trong Bộ sưu tập của máy!');
          } catch(e) {
            console.log('⚠️ File đã được lưu, đường dẫn:', this.pendingFileUri);
          }

          if (this.onComplete) this.onComplete();
          
          // Đóng sập các biến lại để kết thúc phiên truyền tải
          this.incomingFileInfo = null;
          this.pendingFileUri = null; 
          break; // Thoát vòng lặp
        }
      } catch (err) {
        console.error('❌ Lỗi khi ghi đĩa IO:', err);
      }
    }
    this.isWriting = false;
  }

  async startCall(targetId: string) {
    this.init(targetId);
    this.dataChannel = this.peerConnection.createDataChannel('PeerDropChannel');
    this.setupDataChannelListeners();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    socketService.socket?.emit('webrtc-signal', {
      toId: targetId,
      signalData: { type: 'offer', offer },
    });
  }

  async sendFile(file: any) {
    console.log('[Native] Bắt đầu truyền file:', file?.name);
    this.pendingFile = file;
  }

  initSignalListener() {
    if (!socketService.socket) return;
    socketService.socket.off('webrtc-signal');
    socketService.socket.on('webrtc-signal', async (payload: any) => {
      const { fromId, signalData } = payload;
      if (signalData.type === 'offer') {
        this.init(fromId);
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        socketService.socket?.emit('webrtc-signal', { toId: fromId, signalData: { type: 'answer', answer } });
      } 
      else if (signalData.type === 'answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      } 
      else if (signalData.type === 'ice-candidate') {
        try { await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate)); } 
        catch (e) {}
      }
    });
  }
}

export const webRTCService = new WebRTCService();