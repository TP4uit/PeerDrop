import React, { useEffect, useState, useRef } from 'react';
import { View, Button, Text, TextInput, StyleSheet } from 'react-native';
import io from 'socket.io-client';

// 1. Cấu hình đục lỗ NAT
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function App() {
  const [socket, setSocket] = useState(null);
  const [myId, setMyId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [status, setStatus] = useState('Chưa kết nối');

  // Dùng useRef để giữ giá trị WebRTC không bị reset khi component render lại
  const peerConnection = useRef(null);
  const dataChannel = useRef(null);

  useEffect(() => {
    // 2. Kết nối tới server.js của bạn 
    
    const newSocket = io('http://localhost:3000'); 
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setMyId(newSocket.id);
      setStatus('Đã kết nối Server trung gian');
    });

    // 3. Lắng nghe tín hiệu WebRTC từ Server
    newSocket.on('webrtc-signal', async (data) => {
      if (data.signal.type === 'offer') {
        setStatus('Đang nhận yêu cầu kết nối P2P...');
        await handleReceiveOffer(newSocket, data.fromId, data.signal);
      } 
      else if (data.signal.type === 'answer') {
        setStatus('Người kia đã đồng ý!');
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));
      } 
      else if (data.signal.type === 'candidate') {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
      }
    });

    return () => newSocket.disconnect();
  }, []);

  // KHỞI TẠO P2P (Dùng chung cho cả 2 máy)
  const initWebRTC = (remoteId, isInitiator) => {
    peerConnection.current = new RTCPeerConnection(configuration);

    if (isInitiator) {
      dataChannel.current = peerConnection.current.createDataChannel('PeerDrop');
      setupDataChannel(dataChannel.current);
    } else {
      peerConnection.current.ondatachannel = (event) => {
        dataChannel.current = event.channel;
        setupDataChannel(dataChannel.current);
      };
    }

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-signal', {
          toId: remoteId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };
  };

  // CÁC HÀM XỬ LÝ (Offer/Answer/DataChannel)
  const handleReceiveOffer = async (socketInstance, remoteId, offer) => {
    initWebRTC(remoteId, false); // Khởi tạo với tư cách người Nhận
    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    socketInstance.emit('webrtc-signal', { toId: remoteId, signal: answer });
  };

  const setupDataChannel = (channel) => {
    channel.onopen = () => setStatus(' KÊNH P2P ĐÃ MỞ! THÀNH CÔNG!');
    channel.onmessage = (event) => alert("Nhận được tin nhắn P2P: " + event.data);
    channel.onclose = () => setStatus(' Kênh P2P đã đóng');
  };

  // HÀNH ĐỘNG CỦA NGƯỜI GỬI
  const startP2PConnection = async () => {
    if (!partnerId) return alert('Hãy nhập ID của máy kia!');
    initWebRTC(partnerId, true);
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('webrtc-signal', { toId: partnerId, signal: offer });
  };

  const sendTestMessage = () => {
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send("Hello từ thiết bị " + myId);
    } else {
      alert("Kênh P2P chưa kết nối xong!");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PeerDrop Demo</Text>
      <Text>Trạng thái: {status}</Text>
      <Text style={styles.idText}>ID của máy này: {myId}</Text>
      
      <View style={styles.box}>
        <Text>Nhập ID máy kia để kết nối:</Text>
        <TextInput 
          style={styles.input} 
          onChangeText={setPartnerId} 
          value={partnerId} 
          placeholder="Dán ID máy kia vào đây..."
        />
        <Button title="1. Bắt tay kết nối P2P" onPress={startP2PConnection} />
      </View>

      <View style={styles.box}>
        <Button title="2. Gửi file/Tin nhắn P2P trực tiếp" onPress={sendTestMessage} color="green" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  idText: { color: 'blue', marginVertical: 10, fontWeight: 'bold' },
  box: { marginVertical: 20, padding: 10, borderWidth: 1, borderColor: '#ccc' },
  input: { borderWidth: 1, borderColor: '#999', padding: 10, marginVertical: 10 }
});