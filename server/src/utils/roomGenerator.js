const generateRoomId = (length = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Bỏ I, 1, O, 0 để tránh nhầm lẫn
    let roomId = '';
    for (let i = 0; i < length; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
};

module.exports = { generateRoomId };