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

  public onProgress: ((percent: number) => void) | null = null;
  public onComplete: (() => void) | null = null;
  private lastReportedProgress = -1; // Dùng để tránh UI bị giật lag do render quá nhiều

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

  setupDataChannelListeners() {
    if (!this.dataChannel) return;
    
    // Cực kỳ quan trọng: Báo cho DataChannel biết dữ liệu nhị phân sẽ là ArrayBuffer
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      console.log('🔥 [WebRTC-Web] Ống truyền dữ liệu đã mở! Đã sẵn sàng gửi/nhận file.');
    };

    this.dataChannel.onmessage = (event) => {
      // 1. NHẬN METADATA (Tên, size file) dưới dạng Text JSON
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'file-meta') {
            this.incomingFileInfo = msg.metadata;
            this.receiveBuffer = []; // Làm sạch thùng chứa
            this.receivedSize = 0;
            console.log(`📥 Bắt đầu nhận file: ${msg.metadata.name} (${(msg.metadata.size / 1024 / 1024).toFixed(2)} MB)`);
          }
        } catch (e) {
          console.log('📩 Tin nhắn Text:', event.data);
        }
      } 
      // 2. NHẬN CÁC MẢNH FILE (Chunk) dưới dạng Nhị phân
      else if (event.data instanceof ArrayBuffer) {
        if (!this.incomingFileInfo) return; 

        // Gom các mảnh ghép vào mảng
        this.receiveBuffer.push(event.data);
        this.receivedSize += event.data.byteLength;

        // Cập nhật giao diện (Chỉ báo cáo khi % có sự thay đổi để tránh lag UI)
        const progress = Math.round((this.receivedSize / this.incomingFileInfo.size) * 100);
        if (progress !== this.lastReportedProgress) {
          if (this.onProgress) this.onProgress(progress);
          this.lastReportedProgress = progress;
        }

        // 3. KHI NHẬN ĐỦ 100% -> GHÉP FILE VÀ LƯU XUỐNG
        if (this.receivedSize === this.incomingFileInfo.size) {
          console.log('✅ Đã nhận xong toàn bộ mảnh ghép!');
          this.saveReceivedFile();
          if (this.onComplete) this.onComplete(); // <--- Báo cho UI biết đã xong
        }
      }
    };
  }

  // --- THUẬT TOÁN BĂM NHỎ VÀ GỬI FILE ---
  async sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      alert('Chưa kết nối đến máy nào! Vui lòng chọn máy trên Radar trước.');
      return;
    }

    console.log(`📤 Bắt đầu gửi file: ${file.name}`);

    // Bước 1: Gửi vé Metadata báo hiệu trước
    const metadata = { name: file.name, size: file.size, fileType: file.type };
    this.dataChannel.send(JSON.stringify({ type: 'file-meta', metadata }));

    // Bước 2: Băm nhỏ file thành từng mảnh 64KB
    const chunkSize = 64 * 1024; 
    const buffer = await file.arrayBuffer();
    let offset = 0;

    // Bước 3: Hàm đệ quy gửi để chống tràn bộ đệm (Backpressure)
    const sendChunk = () => {
      while (offset < buffer.byteLength) {
        // CẢNH BÁO ÁP SUẤT: Nếu ống nước bị nghẽn > 1MB, dừng lại chờ 50ms mới gửi tiếp
        if (this.dataChannel!.bufferedAmount > 1024 * 1024) {
          setTimeout(sendChunk, 50);
          return;
        }

        // Cắt 1 khúc 64KB và ném vào ống DataChannel
        const slice = buffer.slice(offset, offset + chunkSize);
        this.dataChannel!.send(slice);
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

  // --- HÀM GHÉP MẢNH VÀ DOWNLOAD ---
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

  // --- 2 Hàm Khởi Tạo Nguyên Bản Dưới Đây Giữ Nguyên ---
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