// server/src/sockets/webrtcHandler.js

module.exports = (io, socket) => {
    
    // UC3: Trung chuyển tín hiệu WebRTC (Offer, Answer, ICE Candidates)
    socket.on('webrtc-signal', ({ toId, signalData }) => {
        
        // Sử dụng io.to().emit() để gửi đích danh gói tin đến socket.id của máy nhận.
        // Bắt buộc đính kèm fromId để Frontend của máy nhận biết ai đang gửi tín hiệu cho mình
        io.to(toId).emit('webrtc-signal', {
            fromId: socket.id, // ID của người phát tín hiệu
            signalData         // Cục payload (SDP hoặc ICE Candidate)
        });
        
    });
    
};