// server/src/sockets/roomHandler.js

module.exports = (io, socket, rooms) => {
    
    // UC1: Xử lý Tạo hoặc Vào phòng
    socket.on('join-room', ({ roomId, userInfo }) => {
        // Nếu phòng chưa tồn tại thì khởi tạo
        if (!rooms.has(roomId)) {
            rooms.set(roomId, { users: new Map() });
        }

        const room = rooms.get(roomId);

        // Giới hạn phòng tối đa 2 người
        if (room.users.size >= 2) {
            socket.emit('room-joined', { 
                status: 'error', 
                message: 'Phòng đã đầy, không thể tham gia.' 
            });
            return;
        }

        // Lưu thông tin user vào bộ nhớ và cho socket join room của Socket.io
        room.users.set(socket.id, userInfo);
        socket.join(roomId);

        // Lấy danh sách thành viên hiện tại trong phòng để gửi trả về
        const members = Array.from(room.users.entries()).map(([id, info]) => ({
            socketId: id,
            ...info
        }));

        // Báo cho chính client vừa gửi request là đã join thành công
        socket.emit('room-joined', { status: 'success', members });

        // Báo cho người còn lại trong phòng (nếu có) biết có người mới vào
        socket.to(roomId).emit('user-joined', { 
            socketId: socket.id, 
            userInfo 
        });
        
        console.log(`[Room] ${socket.id} đã vào phòng ${roomId}. Sĩ số: ${room.users.size}/2`);
    });

    // UC2: Khám phá Radar (Quét các phòng đang có 1 người đợi)
    socket.on('radar-scan', () => {
        const availableRooms = [];
        
        for (const [roomId, roomData] of rooms.entries()) {
            // Chỉ trả về những phòng có đúng 1 Host đang chờ
            if (roomData.users.size === 1) {
                // Lấy thông tin của người đầu tiên (Host)
                const hostEntry = Array.from(roomData.users.entries())[0];
                availableRooms.push({
                    roomId,
                    hostInfo: { socketId: hostEntry[0], ...hostEntry[1] }
                });
            }
        }

        // Trả kết quả radar về cho client yêu cầu
        socket.emit('radar-result', availableRooms);
    });

    // UC4: Xử lý khi Client ngắt kết nối (mất mạng, đóng app)
    socket.on('disconnect', () => {
        console.log(`[-] Đã ngắt kết nối: ${socket.id}`);
        
        // Quét tìm xem user này đang ở phòng nào để xử lý
        for (const [roomId, roomData] of rooms.entries()) {
            if (roomData.users.has(socket.id)) {
                // Xóa user khỏi phòng
                roomData.users.delete(socket.id);
                
                // Báo cho (các) người còn lại trong phòng
                socket.to(roomId).emit('user-disconnected', { socketId: socket.id });

                // Dọn dẹp RAM: Nếu phòng không còn ai thì xóa luôn phòng
                if (roomData.users.size === 0) {
                    rooms.delete(roomId);
                    console.log(`[Room] Đã dọn dẹp phòng trống: ${roomId}`);
                }
                break; // Một user chỉ ở 1 phòng, tìm thấy rồi thì thoát vòng lặp
            }
        }
    });
};