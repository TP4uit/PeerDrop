"""# PeerDrop

PeerDrop là một ứng dụng chia sẻ tệp ngang hàng (Peer-to-Peer) đa nền tảng, cho phép người dùng gửi và nhận file, hình ảnh, và tài liệu một cách nhanh chóng và an toàn. Dự án sử dụng **WebRTC** để truyền tải dữ liệu trực tiếp giữa các thiết bị và **Socket.io** làm máy chủ tín hiệu (Signaling Server).

Dự án bao gồm 2 phần chính:
- **Mobile App**: Ứng dụng di động được xây dựng bằng React Native (Expo).
- **Server**: Máy chủ tín hiệu (Signaling Server) được xây dựng bằng Node.js và Express.

---

## 🚀 Tính năng nổi bật
* **Truyền tải ngang hàng (P2P):** Gửi file trực tiếp giữa các thiết bị thông qua WebRTC, không lưu trữ dữ liệu trung gian trên máy chủ.
* **Hỗ trợ đa định dạng:** Chia sẻ hình ảnh, video và tài liệu đa dạng nhờ tích hợp `expo-image-picker` và `expo-document-picker`.
* **Quét mã kết nối:** Tích hợp Camera (`expo-camera`) để quét hoặc nhận diện thiết bị nhanh chóng.
* **Lưu trữ cục bộ:** Quản lý và lưu tệp trực tiếp vào thiết bị với `expo-file-system` và `react-native-fs`.

---

## 🛠 Công nghệ sử dụng

### Mobile (Frontend)
* **Framework:** React Native, Expo
* **Điều hướng:** React Navigation, Expo Router
* **Giao tiếp & Mạng:** `socket.io-client`, `react-native-webrtc`
* **Quản lý file & Media:** `expo-media-library`, `expo-file-system`, `react-native-fs`
* **UI/UX:** `react-native-reanimated`, `expo-symbols`, `expo-haptics`

### Server (Backend)
* **Runtime:** Node.js
* **Framework:** Express
* **Giao tiếp:** `socket.io` (Đóng vai trò Signaling Server để kết nối các peer), `cors`

---

## ⚙️ Hướng dẫn Cài đặt & Chạy dự án

### 1. Khởi chạy Máy chủ Tín hiệu (Server)
Máy chủ cần được chạy trước để cung cấp kết nối Socket cho ứng dụng di động.

Kết quả chạy mã
File generated successfully.

```bash
# Di chuyển vào thư mục server
cd server

# Cài đặt các dependencies
npm install

# Khởi chạy server
npm start
# (Hoặc chạy lệnh tương ứng trong file package.json của bạn, ví dụ: node index.js)
2. Khởi chạy Ứng dụng Di động (Mobile)
Đảm bảo bạn đã cài đặt ứng dụng Expo Go trên điện thoại, hoặc đã thiết lập môi trường giả lập (Emulator/Simulator).

Bash
# Di chuyển vào thư mục mobile
cd mobile

# Cài đặt các dependencies
npm install

# Khởi chạy ứng dụng với Expo
npm start
Sau khi chạy lệnh trên, sử dụng ứng dụng Expo Go trên điện thoại quét mã QR xuất hiện trên terminal để mở ứng dụng.

📁 Cấu trúc Thư mục
Plaintext
PeerDrop/
├── mobile/                 # Mã nguồn ứng dụng React Native / Expo
│   ├── package.json        # Chứa thông tin thư viện frontend
│   └── ...                 
└── server/                 # Mã nguồn máy chủ Node.js (Signaling)
    ├── package.json        # Chứa thông tin thư viện backend
    └── ...                 
Được tạo dành riêng cho dự án PeerDrop.
"""

with open("README.md", "w", encoding="utf-8") as f:
f.write(content)

print("File generated successfully.")
