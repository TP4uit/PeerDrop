/**
 * Module xử lý và quản lý vòng đời phòng kết nối (Room Lifecycle)
 * Ứng dụng kiến trúc hướng sự kiện phi trạng thái (Stateless Event-Driven)
 */

module.exports = (io, socket, rooms) => {

    // ==========================================
    // 1. SỰ KIỆN: GIA NHẬP HOẶC TẠO PHÒNG (join-room)
    // ==========================================
    socket.on('join-room', (payload) => {
        // Kiểm tra dữ liệu đầu vào (Validation) để tránh sập server nếu payload rỗng
        if (!payload || !payload.roomId || !payload.userInfo) {
            socket.emit('room-error', { message: 'Dữ liệu phòng hoặc định danh không hợp lệ.' });
            return;
        }

        const { roomId, userInfo } = payload;
        const { nickname, avatar } = userInfo;

        // BƯỚC 1: Khởi tạo thực thể phòng nếu mã PIN này chưa tồn tại trên RAM
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                status: 'idle', // Mặc định phòng mới tạo ở trạng thái Rảnh
                members: new Map()
            });
        }

        const room = rooms.get(roomId);

        // BƯỚC 2: Kiểm tra giới hạn thành viên (Đặc tả: Tối đa 2 thiết bị trong 1 phòng P2P)
        if (room.members.size >= 2) {
            socket.emit('room-error', { message: 'Phòng này đã đầy. Không thể kết nối.' });
            return;
        }

        // BƯỚC 3: Thêm thiết bị hiện tại vào danh sách thành viên của phòng
        room.members.set(socket.id, {
            socketId: socket.id,
            roomId: roomId,
            nickname: nickname,
            avatar: avatar
        });

        // BƯỚC 4: Đưa socket vào phòng logic của Socket.io để hỗ trợ phát sóng (Broadcast)
        socket.join(roomId);
        console.log(`[👉] Socket ${socket.id} đã vào phòng: ${roomId}`);

        // BƯỚC 5: Chuyển đổi cấu trúc Map thành mảng Array để gửi về cho Client dễ xử lý dữ liệu
        const membersList = Array.from(room.members.values());

        // Phản hồi thành công riêng cho thiết bị vừa gia nhập (Giao diện cập nhật danh tính đối tác)
        socket.emit('room-joined', { 
            status: 'success', 
            roomId: roomId,
            members: membersList 
        });

        // Phát sóng (Broadcast) thông báo cho thiết bị đang chờ sẵn trong phòng biết đối tác đã vào
        socket.to(roomId).emit('user-joined', {
            socketId: socket.id,
            nickname: nickname,
            avatar: avatar
        });
    });


    // ==========================================
    // 2. SỰ KIỆN: QUÉT RADAR TÌM THIẾT BỊ LÂN CẬN (radar-scan)
    // ==========================================
    socket.on('radar-scan', () => {
        const availableHosts = [];

        // Duyệt qua toàn bộ danh sách các phòng đang có trong bộ nhớ RAM của hệ thống
        for (const [roomId, room] of rooms.entries()) {
            // ĐIỀU KIỆN LỌC RADAR:
            // - Phòng chỉ có duy nhất 1 người (nghĩa là Host đang mở điểm phát và đợi người nhận)
            // - Phòng phải ở trạng thái 'idle' (đang rảnh, chưa bận truyền tải với ai)
            if (room.members.size === 1 && room.status === 'idle') {
                // Lấy ra thông tin của Host duy nhất trong phòng đó
                const hostInfo = Array.from(room.members.values())[0];
                
                // Đóng gói dữ liệu bao gồm cả roomId để Client nhận biết mục tiêu quét được
                availableHosts.push({
                    socketId: hostInfo.socketId,
                    roomId: roomId,
                    nickname: hostInfo.nickname,
                    avatar: hostInfo.avatar
                });
            }
        }

        // Trả kết quả danh sách các Host khả dụng về cho chính Client phát lệnh quét Radar
        socket.emit('radar-result', availableHosts);
    });


    // ==========================================
    // 3. SỰ KIỆN: CẬP NHẬT TRẠNG THÁI RẢNH/BẬN (status-update)
    // ==========================================
    // Chuyển sự kiện này vào roomHandler vì nó cần thay đổi trạng thái 'status' của phòng trên RAM công cộng, 
    // giúp Radar ẩn phòng này đi khi hai thiết bị bắt đầu chu trình Handshake/Chunking.
    socket.on('status-update', (payload) => {
        if (!payload || !payload.status) return;

        const { status } = payload; // 'idle' hoặc 'busy'

        // Tìm phòng mà socket này đang tham gia để cập nhật
        for (const [roomId, room] of rooms.entries()) {
            if (room.members.has(socket.id)) {
                // Cập nhật trạng thái phòng vật lý trên RAM Server
                room.status = status;

                // Phát sóng thông báo thay đổi trạng thái UI cho đối tác còn lại trong phòng biết
                socket.to(roomId).emit('user-status-changed', {
                    id: socket.id,
                    status: status
                });
                console.log(`[*] Phòng ${roomId} chuyển trạng thái sang: ${status}`);
                break;
            }
        }
    });


    // ==========================================
    // 4. SỰ KIỆN HỆ THỐNG: NGẮT KẾT NỐI ĐỘT NGỘT (disconnect)
    // ==========================================
    socket.on('disconnect', () => {
        let targetRoomId = null;

        // Vòng lặp tìm kiếm xem socket vừa rớt mạng nằm ở phòng nào
        for (const [roomId, room] of rooms.entries()) {
            if (room.members.has(socket.id)) {
                targetRoomId = roomId;
                // Xóa bỏ định danh thành viên này khỏi Map nội bộ của phòng
                room.members.delete(socket.id);
                break;
            }
        }

        // Nếu tìm thấy phòng chứa socket vi phạm ngắt kết nối
        if (targetRoomId) {
            const room = rooms.get(targetRoomId);

            // THƯỜNG TRƯỜNG 1: Phòng không còn ai -> Xóa hoàn toàn bản ghi phòng khỏi RAM để tránh phình bộ nhớ
            if (room.members.size === 0) {
                rooms.delete(targetRoomId);
                console.log(`[-] Phòng ${targetRoomId} rỗng. Đã giải phóng tài nguyên hệ thống.`);
            } 
            // THƯỜNG TRƯỜNG 2: Vẫn còn đối tác trong phòng -> Thông báo đối tác hủy ngay kênh truyền (nếu đang chạy)
            else {
                // Đặt lại trạng thái phòng về rảnh vì kết nối P2P cũ đã gãy
                room.status = 'idle';
                
                // Phát lệnh thông báo cho thiết bị còn lại thực hiện dọn dẹp bộ nhớ đệm
                socket.to(targetRoomId).emit('user-disconnected', { socketId: socket.id });
                console.log(`[-] Đối tác trong phòng ${targetRoomId} đã rớt mạng. Đã thông báo cho thiết bị còn lại.`);
            }
        }
        
        console.log(`[-] Đã giải phóng kết nối socket: ${socket.id}`);
    });
};