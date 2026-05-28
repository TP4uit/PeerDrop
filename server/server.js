const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const roomHandler = require('./src/sockets/roomHandler');
const webrtcHandler = require('./src/sockets/webrtcHandler');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

roomHandler(io);
webrtcHandler(io);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'PeerDrop signaling server' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PeerDrop signaling server listening on port ${PORT}`);
});