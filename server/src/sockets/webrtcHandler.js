module.exports = function registerWebRTCHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('webrtc-signal', (data) => {
      io.to(data.toId).emit('webrtc-signal', {
        fromId: socket.id,
        signal: data.signal,
      });
    });
  });
};
