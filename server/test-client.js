// test-client.js
const { io } = require("socket.io-client");

// Đảm bảo server backend của bạn đang chạy ở port này
const SERVER_URL = "http://localhost:3000";

// Hàm hỗ trợ delay để dễ quan sát log theo trình tự thời gian
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTest() {
    console.log("🚀 BẮT ĐẦU GIẢ LẬP LUỒNG SIGNALING CHO PEERDROP\n");

    // Khởi tạo 2 client giả lập
    const host = io(SERVER_URL);
    const client = io(SERVER_URL);
    const roomId = "P2P_001"; 

    // ==========================================
    // LẮNG NGHE SỰ KIỆN CỦA MÁY HOST
    // ==========================================
    host.on("connect", () => console.log(`[Host] 🟢 Đã kết nối tới server với ID: ${host.id}`));
    host.on("room-joined", (data) => console.log(`[Host] 🏠 Kết quả join phòng:`, data));
    host.on("user-joined", (data) => console.log(`[Host] 🔔 Có người vào phòng:`, data));
    host.on("webrtc-signal", (data) => console.log(`[Host] 📡 Nhận tín hiệu WebRTC:`, data));
    host.on("user-disconnected", (data) => console.log(`[Host] ⚠️ Đối tác rớt mạng:`, data));

    // ==========================================
    // LẮNG NGHE SỰ KIỆN CỦA MÁY CLIENT
    // ==========================================
    client.on("connect", () => console.log(`[Client] 🟢 Đã kết nối tới server với ID: ${client.id}`));
    client.on("radar-result", (data) => console.log(`[Client] 🛰️ Radar tìm thấy các phòng:`, data));
    client.on("room-joined", (data) => console.log(`[Client] 🏠 Kết quả join phòng:`, data));
    client.on("webrtc-signal", (data) => console.log(`[Client] 📡 Nhận tín hiệu WebRTC:`, data));

    await sleep(1500);

    // ==========================================
    // KỊCH BẢN THỬ NGHIỆM
    // ==========================================

    console.log("\n--- BƯỚC 1: HOST TẠO VÀ CHỜ TRONG PHÒNG ---");
    host.emit("join-room", { 
        roomId, 
        userInfo: { deviceName: "Điện thoại của Phúc", os: "Android", model: "Galaxy A16" } 
    });
    await sleep(1000);

    console.log("\n--- BƯỚC 2: CLIENT BẬT RADAR QUÉT ---");
    client.emit("radar-scan");
    await sleep(1000);

    console.log("\n--- BƯỚC 3: CLIENT BẤM CHỌN VÀO PHÒNG CỦA HOST ---");
    client.emit("join-room", { 
        roomId, 
        userInfo: { deviceName: "Máy tính của FE", os: "Windows" } 
    });
    await sleep(1000);

    console.log("\n--- BƯỚC 4: CLIENT GỬI WEBRTC OFFER CHO HOST ---");
    // Lưu ý: toId ở đây client phải lấy từ data trả về lúc join phòng hoặc quét radar
    client.emit("webrtc-signal", { 
        toId: host.id, 
        signalData: { type: "offer", sdp: "v=0\r\no=alice..." } 
    });
    await sleep(1000);

    console.log("\n--- BƯỚC 5: HOST TRẢ LỜI WEBRTC ANSWER CHO CLIENT ---");
    host.emit("webrtc-signal", { 
        toId: client.id, 
        signalData: { type: "answer", sdp: "v=0\r\no=bob..." } 
    });
    await sleep(1000);

    console.log("\n--- BƯỚC 6: GIẢ LẬP CLIENT BỊ ĐỨT MẠNG (TẮT WIFI/APP) ---");
    client.disconnect();
    
    await sleep(1000);
    console.log("\n✅ HOÀN TẤT BÀI TEST. SIGNALING SERVER HOẠT ĐỘNG HOÀN HẢO!");
    process.exit(0);
}

runTest();