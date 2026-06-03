import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { socketService } from './socket.service';

// Sử dụng máy chủ STUN miễn phí của Google để dò tìm IP Public của 2 máy
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRTCService {
  public peerConnection: any = null;
  public dataChannel: any = null;
  public targetSocketId: string | null = null;
  public onConnected: ((remoteDeviceName: string) => void) | null = null;

  public pendingFile: any = null;

  public onProgress: ((percent: number) => void) | null = null;
  public onComplete: (() => void) | null = null;
  private lastReportedProgress = -1; // Dùng để tránh UI bị giật lag do render quá nhiều

  private receiveBuffer: any[] = [];
  private incomingFileInfo: any = null;
  private receivedSize = 0;

  // 1. Khởi tạo kết nối cơ bản
  init(targetId: string) {
    this.targetSocketId = targetId;
    this.peerConnection = new RTCPeerConnection(configuration);

    // Bắt sự kiện ICE Candidate và gửi cho máy kia qua Socket.io
    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && socketService.socket) {
        socketService.socket.emit('webrtc-signal', {
          toId: this.targetSocketId,
          signalData: { type: 'ice-candidate', candidate: event.candidate },
        });
      }
    };

    // Lắng nghe khi máy GỬI mở ống DataChannel tới (Dành cho máy NHẬN)
    this.peerConnection.ondatachannel = (event: any) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
  }

  // 2. Cài đặt các sự kiện cho đường truyền dữ liệu

  setupDataChannelListeners() {
    this.dataChannel.onopen = () => {
      console.log('🔥 [WebRTC] Data Channel ĐÃ MỞ! Mạng P2P thiết lập thành công!');
      
      // Gửi gói tin bắt tay (Handshake) chứa tên thiết bị thật của mình sang máy kia
      const handshakePayload = {
        type: 'HANDSHAKE',
        nickname: socketService.nickname || 'Unknown Device'
      };
      this.dataChannel.send(JSON.stringify(handshakePayload));
    };

    this.dataChannel.onmessage = (event: any) => {
      console.log('📩 [WebRTC] TIN NHẮN ĐẾN:', event.data);
      
      try {
        // Thử phân tích dữ liệu tin nhắn dạng JSON
        const parsedData = JSON.parse(event.data);
        
        // Nếu là gói tin bắt tay thiết bị
        if (parsedData.type === 'HANDSHAKE') {
          console.log(`🤝 [WebRTC] Đã bắt tay thành công với: ${parsedData.nickname}`);
          
          // 🌟 KÍCH HOẠT UI: Báo cho màn hình ReceiveScreen biết tên máy gửi thật để bật Pop-up thành công
          if (this.onConnected) {
            this.onConnected(parsedData.nickname);
          }
          return; // Ngắt dòng để không nhảy vào alert phía dưới
        }
      } catch (e) {
        // Nếu không phải chuỗi JSON (ví dụ tin nhắn text bình thường) thì xử lý bình thường
      }

      // Giữ nguyên logic nhận tin nhắn cũ của Phúc
      alert(`Tin nhắn P2P: ${event.data}`); 
    };
  }
  /*setupDataChannelListeners() {
    this.dataChannel.onopen = () => {
      console.log('🔥 [WebRTC] Data Channel ĐÃ MỞ! Mạng P2P thiết lập thành công!');
      // Gửi ngay 1 tin nhắn test đi
      this.dataChannel.send(`Hello từ ${socketService.nickname}!`);
    };

    

    this.dataChannel.onmessage = (event: any) => {
      console.log('📩 [WebRTC] TIN NHẮN ĐẾN:', event.data);
      alert(`Tin nhắn P2P: ${event.data}`); // Hiển thị pop-up lên màn hình
    };
  } */

  // 3. MÁY GỬI: Bắt đầu cuộc gọi (Tạo Offer)
  async startCall(targetId: string) {
    this.init(targetId);

    // Khởi tạo DataChannel với tên 'PeerDropChannel'
    this.dataChannel = this.peerConnection.createDataChannel('PeerDropChannel');
    this.setupDataChannelListeners();

    // Tạo vé mời (Offer) và lưu lại
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Gửi Offer cho đối tác qua Server
    socketService.socket?.emit('webrtc-signal', {
      toId: targetId,
      signalData: { type: 'offer', offer },
    });
    console.log(`📤 [WebRTC] Đã gửi Offer tới ${targetId}`);
  }

  async sendFile(file: any) {
    // Tạm thời cứ log ra. 
    // Khi chạy trên Web, hệ thống tự động bỏ qua file này và xài hàm ở file .web.ts
    // Sau này build app điện thoại thật chúng ta sẽ viết thuật toán băm file vào đây.
    console.log('[Native] Chuẩn bị gửi file:', file?.name);
    this.pendingFile = file;
  }


  // 4. LẮNG NGHE VÀ XỬ LÝ TÍN HIỆU TỪ SOCKET
  initSignalListener() {
    if (!socketService.socket) return;
    
    // Đảm bảo không bị lặp sự kiện
    socketService.socket.off('webrtc-signal');
    
    socketService.socket.on('webrtc-signal', async (payload: any) => {
      const { fromId, signalData } = payload;
      
      // MÁY NHẬN: Khi thấy Offer đến
      if (signalData.type === 'offer') {
        console.log(`📥 [WebRTC] Nhận được Offer từ ${fromId}`);
        this.init(fromId);
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        
        // Tạo câu trả lời (Answer)
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        socketService.socket?.emit('webrtc-signal', {
          toId: fromId,
          signalData: { type: 'answer', answer },
        });
      } 
      // MÁY GỬI: Khi thấy Answer phản hồi
      else if (signalData.type === 'answer') {
        console.log(`📥 [WebRTC] Nhận được Answer từ ${fromId}`);
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      } 
      // CẢ 2 MÁY: Trao đổi IP (ICE)
      else if (signalData.type === 'ice-candidate') {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.error('Lỗi khi add ICE Candidate', e);
        }
      }
    });
  }
}

export const webRTCService = new WebRTCService();