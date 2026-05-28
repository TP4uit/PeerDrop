module.exports = function registerRoomHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', socket.id);
    });
  });
};
