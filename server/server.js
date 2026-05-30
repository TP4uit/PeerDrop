// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const registerRoomHandlers = require('./src/sockets/roomHandler');
const registerWebrtcHandlers = require('./src/sockets/webrtcHandler');

const app = express();
const server = http.createServer(app);

// Cấu hình Socket.io với CORS
// Trong môi trường dev có thể mở '*', khi lên production cần giới hạn origin
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Bộ nhớ tạm trên RAM để quản lý các phòng. 
// Cấu trúc: Map<roomId, { users: Map<socketId, userInfo> }>
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[+] Mới kết nối: ${socket.id}`);

    // Truyền shared state 'rooms' vào roomHandler để quản lý logic phòng
    registerRoomHandlers(io, socket, rooms);
    
    // webrtcHandler chỉ làm nhiệm vụ trung chuyển, không cần biết state của rooms
    registerWebrtcHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[🚀] PeerDrop Signaling Server đang chạy tại port ${PORT}`);
});