import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

// Tự động lấy IP của máy tính đang chạy Metro Bundler
const getDevServerIP = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const machineIp = hostUri.split(':')[0];
    return `http://${machineIp}:3000`;
  }
  return 'http://localhost:3000';
};

const SERVER_URL = getDevServerIP();

class SocketService {
  public socket: Socket | null = null;
  public deviceId: string = '';
  public nickname: string = '';
  public avatar: string = '';

  // 1. HÀM KHỞI TẠO ĐỊNH DANH
  async initializeIdentity() {
    try {
      // Đọc bộ nhớ xem máy này từng vào app chưa
      const storedDeviceId = await AsyncStorage.getItem('@peerdrop_deviceId');
      const storedNickname = await AsyncStorage.getItem('@peerdrop_nickname');

      if (storedDeviceId && storedNickname) {
        // NẾU LÀ MÁY CŨ: Lấy lại dữ liệu cũ
        this.deviceId = storedDeviceId;
        this.nickname = storedNickname;
        console.log('✅ [Identity] Đã tải định danh máy cũ:', this.nickname);
      } else {
        // NẾU LÀ MÁY MỚI (Lần đầu mở app):
        // Sinh ID duy nhất dựa vào thời gian thực
        this.deviceId = `device-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
        
        // Lấy tên thiết bị thật. Device.deviceName lấy tên người dùng tự đặt (VD: "Phúc's Phone"), 
        // fallback sang modelName (VD: "SM-A166B")
        const realDeviceName = Device.deviceName || Device.modelName || 'Thiết bị không xác định';
        this.nickname = realDeviceName;

        // Lưu vào bộ nhớ máy để các lần sau không bị mất
        await AsyncStorage.setItem('@peerdrop_deviceId', this.deviceId);
        await AsyncStorage.setItem('@peerdrop_nickname', this.nickname);
        console.log('✅ [Identity] Đã tạo và lưu định danh máy mới:', this.nickname);
      }
      
      // Tạo avatar vui nhộn dựa trên ID
      this.avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${this.deviceId}`;
      
    } catch (error) {
      console.error('⚠️ [Identity] Lỗi khởi tạo định danh:', error);
    }
  }

  // 2. HÀM KẾT NỐI (Đã chuyển thành async)
  async connect() {
    if (this.socket?.connected) return;

    // Đảm bảo định danh đã sẵn sàng TRƯỚC KHI kết nối socket
    if (!this.deviceId) {
      await this.initializeIdentity();
    }

    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log(`✅ [Socket] Kết nối thành công (${this.nickname}) - ID:`, this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ [Socket] Đã ngắt kết nối');
    });
  }

  // 3. HÀM VÀO PHÒNG
  joinRoom(roomId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket chưa kết nối, không thể join room!');
      return;
    }
    
    this.socket.emit('join-room', {
      roomId: roomId,
      userInfo: {
        nickname: this.nickname,
        avatar: this.avatar
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();