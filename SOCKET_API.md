Tài liệu Đặc tả Giao thức Socket.io (PeerDrop Signaling API)
Base URL Server: ws://<IP_CỦA_SERVER>:3000 (hoặc domain khi deploy)
Thư viện Frontend yêu cầu: socket.io-client

1. Nhóm Quản lý Phòng (Room Management)
1.1. Tham gia / Tạo phòng
Client phát lên (Emit): join-room

Mô tả: Host dùng để tạo phòng mới, Client dùng để quét QR và join vào phòng.

Payload gửi lên:

JSON
{
  "roomId": "123456",
  "userInfo": {
    "nickname": "Nguyen A",
    "avatar": "avatar_1.png"
  }
}
Client lắng nghe (On): * room-joined: Nhận về khi bản thân tham gia thành công.

JSON
{
  "status": "success",
  "roomId": "123456",
  "members": [ { "socketId": "abc...", "nickname": "Nguyen A", "avatar": "..." } ]
}
user-joined: Nhận về khi có một người khác vừa chui vào phòng của mình.

JSON
{
  "socketId": "xyz...",
  "nickname": "Nguyen B",
  "avatar": "avatar_2.png"
}
room-error: Nhận về nếu phòng đã đầy hoặc lỗi.

JSON
{
  "message": "Phòng này đã đầy. Không thể kết nối."
}
1.2. Cập nhật trạng thái Rảnh/Bận
Client phát lên (Emit): status-update

Mô tả: Gọi khi bắt đầu gửi/nhận file để hệ thống ẩn phòng này khỏi Radar.

Payload gửi lên:

JSON
{
  "status": "busy" // hoặc "idle"
}
Client lắng nghe (On): user-status-changed

Mô tả: Frontend dùng sự kiện này để đổi màu Avatar/Nhãn của đối tác trên màn hình.

JSON
{
  "id": "abc...",
  "status": "busy"
}
1.3. Ngắt kết nối mạng (Hệ thống tự động)
Client lắng nghe (On): user-disconnected

Mô tả: Kích hoạt khi đối tác thoát app hoặc rớt mạng. Frontend bắt sự kiện này để đóng DataChannel và quay về màn hình chính.

JSON
{
  "socketId": "xyz..."
}
2. Nhóm Khám phá Thiết bị (Radar Discovery)
2.1. Quét Radar
Client phát lên (Emit): radar-scan

Mô tả: Bắn sự kiện này lên khi bật giao diện sóng Radar (Không cần gửi payload).

Client lắng nghe (On): radar-result

Mô tả: Server trả về mảng danh sách các Host đang mở phòng chờ. Frontend dùng mảng này để render các bong bóng nổi.

JSON
[
  {
    "socketId": "abc...",
    "roomId": "123456",
    "nickname": "Điện thoại của Host",
    "avatar": "avatar_host.png"
  }
]
3. Nhóm Điều phối WebRTC & Truyền tải
3.1. Giao tiếp WebRTC (SDP / ICE Candidate)
Client phát lên (Emit): webrtc-signal

Mô tả: Trung chuyển các gói tin mạng để thiết lập P2P.

Payload gửi lên:

JSON
{
  "toId": "socket_id_của_đối_tác",
  "signalData": { 
     // Có thể là chuỗi SDP Offer/Answer hoặc đối tượng ICE Candidate
  }
}
Client lắng nghe (On): webrtc-signal

Mô tả: Bắt luồng WebRTC từ đối tác gửi tới.

JSON
{
  "fromId": "socket_id_người_gửi",
  "signalData": { ... }
}
3.2. Chặn Handshake (Từ chối nhận tệp)
Client phát lên (Emit): reject-transfer

Mô tả: Khi Pop-up xác nhận hiện lên, nếu người nhận bấm "Từ chối".

Payload gửi lên:

JSON
{
  "toId": "socket_id_của_Host"
}
Client lắng nghe (On): transfer-rejected

Mô tả: Nhận được khi đối tác không chịu nhận tệp.

JSON
{
  "fromId": "socket_id_người_từ_chối",
  "message": "Người nhận đã từ chối yêu cầu truyền tệp."
}
3.3. Hủy ngang giao dịch (Đang truyền thì ngắt)
Client phát lên (Emit): cancel-transfer

Mô tả: Dùng khi 1 trong 2 người bấm nút "Hủy" khi thanh tiến trình (Progress bar) đang chạy.

Payload gửi lên:

JSON
{
  "toId": "socket_id_của_đối_tác"
}
Client lắng nghe (On): transfer-cancelled

Mô tả: Nhận được thông báo hủy. Frontend lập tức gọi API FileSystem xóa file tạm đang lưu dở và đóng kết nối WebRTC.

JSON
{
  "fromId": "socket_id_người_hủy"
}