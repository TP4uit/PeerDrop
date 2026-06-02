/**
 * Module điều phối tín hiệu WebRTC (WebRTC Signaling Router)
 * Hoạt động như một trạm trung chuyển phi trạng thái (Stateless Relay).
 */

module.exports = (io, socket) => {

    // ==========================================
    // 1. ĐỊNH TUYẾN TÍN HIỆU LÕI (webrtc-signal)
    // ==========================================
    // Đây là sự kiện quan trọng nhất định tuyến gói tin WebRTC (Offer, Answer, ICE)
    socket.on('webrtc-signal', (payload) => {
        // Kiểm tra tính hợp lệ để chống nghẽn server do rác dữ liệu
        if (!payload || !payload.toId || !payload.signalData) {
            console.warn(`[!] Cảnh báo: Thiết bị ${socket.id} gửi gói tín hiệu webrtc-signal không hợp lệ.`);
            return;
        }

        const { toId, signalData } = payload;

        // Định tuyến an toàn gói tin tới chính xác Socket ID của thiết bị đích
        // Đính kèm fromId để thiết bị đích biết ai gửi và có thể phản hồi lại
        io.to(toId).emit('webrtc-signal', {
            fromId: socket.id,
            signalData: signalData
        });
    });


    // ==========================================
    // 2. TỪ CHỐI NHẬN TỆP (reject-transfer) -> Áp dụng cho Use Case 07 (Handshake)
    // ==========================================
    // Khi Client nhận được Offer kèm Metadata nhưng bấm "Từ chối" trên Pop-up
    socket.on('reject-transfer', (payload) => {
        if (!payload || !payload.toId) return;

        const { toId } = payload;
        
        // Chuyển tiếp tín hiệu từ chối về lại cho Host
        io.to(toId).emit('transfer-rejected', {
            fromId: socket.id,
            message: 'Người nhận đã từ chối yêu cầu truyền tệp.'
        });
        
        console.log(`[x] Thiết bị ${socket.id} đã từ chối nhận tệp từ ${toId}`);
    });


    // ==========================================
    // 3. HỦY NGANG GIAO DỊCH (cancel-transfer) -> Áp dụng cho Use Case 09
    // ==========================================
    // Bất kỳ ai (Host hoặc Client) bấm nút Hủy khi tệp đang truyền dở dang
    socket.on('cancel-transfer', (payload) => {
        if (!payload || !payload.toId) return;

        const { toId } = payload;

        // Báo cho đối tác lập tức dừng vòng lặp đọc/ghi tệp, đóng kênh DataChannel và xóa file tạm
        io.to(toId).emit('transfer-cancelled', { 
            fromId: socket.id 
        });

        console.log(`[!] Giao dịch giữa ${socket.id} và ${toId} đã bị hủy ngang.`);
    });
};