import { socketService } from './socket.service';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

 class WebRTCService {
  public peerConnection: RTCPeerConnection | null = null;
  public dataChannel: RTCDataChannel | null = null;
  public targetSocketId: string | null = null;

  public pendingFile: any = null;

  public onProgress: ((percent: number) => void) | null = null;
  public onComplete: (() => void) | null = null;
  private lastReportedProgress = -1;

  // --- BIẾN TRẠNG THÁI NHẬN FILE ---
  private receiveBuffer: ArrayBuffer[] = [];
  private incomingFileInfo: any = null;
  private receivedSize = 0;

  init(targetId: string) {
    this.targetSocketId = targetId;
    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketService.socket) {
        socketService.socket.emit('webrtc-signal', {
          toId: this.targetSocketId,
          signalData: { type: 'ice-candidate', candidate: event.candidate },
        });
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
  }

  // --- HELPER: TÍNH TOÁN % VÀ LƯU FILE KHI XONG ---
  private updateProgressAndSave() {
    if (!this.incomingFileInfo) return;

    const progress = Math.round((this.receivedSize / this.incomingFileInfo.size) * 100);
    if (progress !== this.lastReportedProgress) {
      if (this.onProgress) this.onProgress(progress);
      this.lastReportedProgress = progress;
    }

    // Khi nhận đủ 100% dung lượng file
    if (this.receivedSize >= this.incomingFileInfo.size) {
      console.log('✅ Đã nhận xong toàn bộ mảnh ghép từ Mobile!');
      this.saveReceivedFile();
      if (this.onComplete) this.onComplete();
      
      // Reset biến để nhận file tiếp theo
      this.incomingFileInfo = null;
      this.receiveBuffer = [];
      this.receivedSize = 0;
    }
  }

  // --- BỘ LẮNG NGHE DATA TỪ MOBILE GỬI LÊN ---
  setupDataChannelListeners() {
    if (!this.dataChannel) return;
    
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      console.log('[WebRTC-Web] Ống truyền dữ liệu đã mở!');
      // Bổ sung gói tin Handshake để giao diện Mobile biết đường mở khóa
      const handshakePayload = {
        type: 'HANDSHAKE',
        nickname: socketService.nickname || 'Web Browser'
      };
      this.dataChannel?.send(JSON.stringify(handshakePayload));
    };

    this.dataChannel.onmessage = (event) => {
      // 1. NHẬN DỮ LIỆU DẠNG TEXT (Chuỗi JSON Metadata hoặc Base64 Chunk từ Mobile)
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          
          // Đón gói tin báo hiệu File-meta
          if (msg.type === 'file-meta') {
            this.incomingFileInfo = msg.metadata;
            this.receiveBuffer = []; 
            this.receivedSize = 0;
            this.lastReportedProgress = -1;
            console.log(`📥 Bắt đầu nhận file: ${msg.metadata.name} (${(msg.metadata.size / 1024 / 1024).toFixed(2)} MB)`);
          }
        } catch (e) {
          // 🚨 NẾU PARSE JSON LỖI -> ĐÂY CHÍNH LÀ MẢNH FILE BASE64 TỪ MOBILE GỬI QUA!
          if (!this.incomingFileInfo) return;

          // Giải mã Base64 thành ArrayBuffer cho trình duyệt
          const binaryString = window.atob(event.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Nhét vào vùng đệm RAM của Web
          this.receiveBuffer.push(bytes.buffer);
          this.receivedSize += bytes.byteLength;
          this.updateProgressAndSave();
        }
      } 
      // 2. NHẬN DỮ LIỆU DẠNG NHỊ PHÂN (Dự phòng nếu DataChannel tự gửi ArrayBuffer)
      else if (event.data instanceof ArrayBuffer) {
        if (!this.incomingFileInfo) return; 

        this.receiveBuffer.push(event.data);
        this.receivedSize += event.data.byteLength;
        this.updateProgressAndSave();
      }
    };
  }

  // --- MÁY GỬI: BĂM NHỎ FILE VÀ GỬI CHO MOBILE ---
  async sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      alert('Chưa kết nối đến máy nào! Vui lòng chọn máy trên Radar trước.');
      return;
    }

    console.log(`📤 Bắt đầu gửi file: ${file.name}`);

    // Bước 1: Gửi vé Metadata báo hiệu trước
    const metadata = { name: file.name, size: file.size, fileType: file.type };
    this.dataChannel.send(JSON.stringify({ type: 'file-meta', metadata }));

    // Bước 2: Băm nhỏ file thành từng mảnh 16KB (Ngưỡng an toàn tuyệt đối)
    const chunkSize = 16 * 1024; 
    const buffer = await file.arrayBuffer();
    let offset = 0;

    // Bước 3: Hàm đệ quy gửi để chống tràn bộ đệm (Backpressure)
    const sendChunk = () => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        console.error('❌ Kênh truyền đã đóng hoặc rớt kết nối. Dừng gửi file!');
        return;
      }

      while (offset < buffer.byteLength) {
        // CẢNH BÁO ÁP SUẤT: Nếu ống nước bị nghẽn > 1MB, dừng lại chờ 50ms
        if (this.dataChannel.bufferedAmount > 1024 * 1024) {
          setTimeout(sendChunk, 50);
          return;
        }

        // Cắt khúc 16KB
        const slice = buffer.slice(offset, offset + chunkSize);
        
        // Đổi Nhị phân sang Chuỗi Base64 để vượt qua cầu nối JS Bridge của React Native
        const uint8Array = new Uint8Array(slice);
        let binaryString = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Chunk = btoa(binaryString);

        try {
          // Gửi đoạn Base64 qua ống DataChannel
          this.dataChannel.send(base64Chunk);
        } catch (error) {
          console.error('❌ Lỗi văng khi nhồi data vào ống:', error);
          return; 
        }
        
        offset += slice.byteLength;

        const progress = Math.round((offset / buffer.byteLength) * 100);
        if (progress % 10 === 0 || progress === 100) {
          console.log(`📤 Đang đẩy lên mạng... ${progress}%`);
        }
      }
      console.log('✅ Đã đẩy toàn bộ file lên đường ống thành công!');
    };

    sendChunk();
  }

  // --- HÀM GHÉP MẢNH VÀ DOWNLOAD TRÊN TRÌNH DUYỆT ---
  saveReceivedFile() {
    // Ép toàn bộ các mảng Byte lại thành 1 cục Blob nguyên bản
    const blob = new Blob(this.receiveBuffer, { type: this.incomingFileInfo.fileType });
    
    // Tạo link ảo và giả lập hành động Click để tải file xuống
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.incomingFileInfo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url); // Dọn rác
    console.log(`🎉 TẢI XUỐNG THÀNH CÔNG: ${this.incomingFileInfo.name}`);
  }

  // --- KHỞI TẠO CUỘC GỌI WEBRTC ---
  async startCall(targetId: string) {
    this.init(targetId);
    if (!this.peerConnection) return;
    this.dataChannel = this.peerConnection.createDataChannel('PeerDropChannel');
    this.setupDataChannelListeners();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    socketService.socket?.emit('webrtc-signal', { toId: targetId, signalData: { type: 'offer', offer } });
  }

  initSignalListener() {
    if (!socketService.socket) return;
    socketService.socket.off('webrtc-signal');
    socketService.socket.on('webrtc-signal', async (payload: any) => {
      const { fromId, signalData } = payload;
      if (signalData.type === 'offer') {
        this.init(fromId);
        if (!this.peerConnection) return;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        socketService.socket?.emit('webrtc-signal', { toId: fromId, signalData: { type: 'answer', answer } });
      } 
      else if (signalData.type === 'answer') {
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      } 
      else if (signalData.type === 'ice-candidate') {
        try { await this.peerConnection?.addIceCandidate(new RTCIceCandidate(signalData.candidate)); } 
        catch (e) {}
      }
    });
  }
}

export const webRTCService = new WebRTCService();