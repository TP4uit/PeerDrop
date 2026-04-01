const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
// Cấu hình Socket.io cho phép mọi thiết bị kết nối vào
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[+] Thiết bị mới kết nối: ${socket.id}`);

    // Thiết bị tham gia vào một phòng (dựa trên mã ID hoặc quét QR)
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} đã tham gia phòng: ${roomId}`);
        // Báo cho các máy khác trong phòng biết có người mới vào
        socket.to(roomId).emit('user-joined', socket.id);
    });

    // Trạm trung chuyển tín hiệu WebRTC (Offer, Answer, ICE Candidates)
    socket.on('webrtc-signal', (data) => {
        // Gửi tín hiệu đến đích danh thiết bị bên kia (data.toId)
        io.to(data.toId).emit('webrtc-signal', {
            fromId: socket.id,
            signal: data.signal
        });
    });

    socket.on('disconnect', () => {
        console.log(`[-] Thiết bị ngắt kết nối: ${socket.id}`);
    });
});

// Chạy server ở port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PeerDrop Signaling Server đang chạy tại port ${PORT}`);
    console.log(`👉 Mở CMD gõ 'ipconfig' để lấy IPv4. Điện thoại sẽ kết nối qua: http://<IPv4_của_bạn>:${PORT}`);
});