function generateRoomId(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

module.exports = { generateRoomId };
