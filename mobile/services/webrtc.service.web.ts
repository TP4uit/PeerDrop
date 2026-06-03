import { socketService } from './socket.service';

// Sử dụng STUN Server của Google
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

  init(targetId: string) {
    this.targetSocketId = targetId;
    // Dùng trực tiếp API của trình duyệt Web
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
    this.dataChannel.onopen = () => {
      console.log('🔥 [WebRTC-Web] Data Channel ĐÃ MỞ! Mạng P2P thiết lập thành công!');
      this.dataChannel?.send(`Hello từ ${socketService.nickname} (Web)!`);
    };

    this.dataChannel.onmessage = (event) => {
      console.log('📩 [WebRTC-Web] TIN NHẮN ĐẾN:', event.data);
      alert(`🎉 Tin nhắn P2P: ${event.data}`);
    };
  }

  async startCall(targetId: string) {
    this.init(targetId);

    if (!this.peerConnection) return;

    this.dataChannel = this.peerConnection.createDataChannel('PeerDropChannel');
    this.setupDataChannelListeners();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    socketService.socket?.emit('webrtc-signal', {
      toId: targetId,
      signalData: { type: 'offer', offer },
    });
    console.log(`📤 [WebRTC-Web] Đã gửi Offer tới ${targetId}`);
  }

  initSignalListener() {
    if (!socketService.socket) return;
    
    socketService.socket.off('webrtc-signal');
    
    socketService.socket.on('webrtc-signal', async (payload: any) => {
      const { fromId, signalData } = payload;
      
      if (signalData.type === 'offer') {
        console.log(`📥 [WebRTC-Web] Nhận được Offer từ ${fromId}`);
        this.init(fromId);
        if (!this.peerConnection) return;
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        socketService.socket?.emit('webrtc-signal', {
          toId: fromId,
          signalData: { type: 'answer', answer },
        });
      } 
      else if (signalData.type === 'answer') {
        console.log(`📥 [WebRTC-Web] Nhận được Answer từ ${fromId}`);
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      } 
      else if (signalData.type === 'ice-candidate') {
        try {
          await this.peerConnection?.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.error('Lỗi khi add ICE Candidate', e);
        }
      }
    });
  }
}

export const webRTCService = new WebRTCService();