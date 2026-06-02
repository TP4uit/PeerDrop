/**
 * Module hỗ trợ tạo mã định danh phòng (Room ID) ngẫu nhiên.
 * Đảm bảo mã sinh ra là duy nhất và chưa tồn tại trong In-Memory Map.
 */

// Hàm sinh ra một chuỗi số ngẫu nhiên có độ dài xác định (mặc định 6 số)
const generateRandomPIN = (length = 6) => {
    let pin = '';
    for (let i = 0; i < length; i++) {
        // Random từ 0 đến 9
        pin += Math.floor(Math.random() * 10).toString();
    }
    return pin;
};

/**
 * Hàm tạo Room ID duy nhất.
 * @param {Map} rooms - Map chứa danh sách các phòng hiện tại trên server
 * @returns {string} Mã PIN 6 số duy nhất
 */
const generateUniqueRoomId = (rooms) => {
    let newRoomId;
    let isUnique = false;
    
    // Vòng lặp kiểm tra va chạm (Collision Check)
    // Ngăn chặn trường hợp random trùng với mã phòng đang hoạt động
    while (!isUnique) {
        newRoomId = generateRandomPIN(6);
        if (!rooms.has(newRoomId)) {
            isUnique = true;
        }
    }
    
    return newRoomId;
};

module.exports = {
    generateRandomPIN,
    generateUniqueRoomId
};