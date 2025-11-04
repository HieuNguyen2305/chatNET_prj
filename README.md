# 💬 ChatNET

Ứng dụng chat peer-to-peer (P2P) qua mạng LAN với tính năng mã hóa Caesar Cipher, được xây dựng bằng React Native.

## 🏗️ Kiến trúc & Công nghệ

### Stack công nghệ
- **Framework**: React Native 0.81.4
- **Language**: TypeScript 5.8.3
- **UI Library**: React 19.1.0
- **Networking**: 
  - `react-native-tcp-socket` - TCP communication
  - `@react-native-community/netinfo` - Network detection
- **Build Tools**: 
  - Metro Bundler
  - Gradle (Android)
  - Xcode (iOS)

### Mã hóa
Ứng dụng sử dụng **Caesar Cipher** - một phương pháp mã hóa thay thế đơn giản:
- Mỗi ký tự được dịch chuyển một số vị trí cố định trong bảng chữ cái
- Hỗ trợ cả chữ thường, chữ hoa, chữ có dấu tiếng Việt, số và ký tự đặc biệt
- Key từ 1-25 (dịch chuyển tương ứng)
- File: `src/utils/caesarCipher.ts`

## 📋 Yêu cầu hệ thống

### Môi trường phát triển
- **Node.js**: >= 20.x (như trong `package.json`)
- **npm** hoặc **yarn**: Để quản lý dependencies
- **Git**: Để clone và version control

### Android Development
- **Android Studio**: Godzilla (2024) hoặc mới hơn
- **JDK**: 17 hoặc 21
- **Android SDK**: 
  - Build Tools version 35.0.0
  - Platform: Android 15 (API 35)
  - NDK (nếu cần native modules)
- **Gradle**: 8.10.2
- **Android Gradle Plugin**: 8.7.3

### iOS Development (chỉ trên macOS)
- **macOS**: Ventura (13.0) hoặc mới hơn
- **Xcode**: 14.0+
- **CocoaPods**: Để quản lý iOS dependencies
- **iOS Deployment Target**: 13.4+

### Thiết bị test
- **Android**: API 21+ (Android 5.0+)
- **iOS**: iOS 13.4+
- **Network**: Cả 2 thiết bị phải cùng mạng WiFi/LAN

## 🚀 Cài đặt

### 1. Clone repository
```bash
git clone https://github.com/xuandungpham/ChatNET.git
cd ChatNET
```

### 2. Cài đặt dependencies
```bash
# Sử dụng npm
npm install

# Hoặc yarn
yarn install
```

### 3. Cài đặt iOS dependencies (chỉ trên macOS)
```bash
cd ios
pod install
cd ..
```

### 4. Kiểm tra cấu hình Android
Đảm bảo file `android/local.properties` có đường dẫn SDK. Nếu chưa có file `android/local.properties` thì có thể tạo thêm:
```properties
sdk.dir=C\:\\Users\\YourUsername\\AppData\\Local\\Android\\sdk
```

## 📱 Chạy ứng dụng

### Android

#### Bước 1: Khởi động Metro Bundler
Mở terminal/command prompt và chạy:
```bash
npm start
# Hoặc
npx react-native start
```

#### Bước 2: Chạy trên thiết bị/emulator
Mở terminal mới (giữ Metro chạy) và thực thi:
```bash
# Chạy trên emulator hoặc thiết bị đã kết nối
npm run android

# Hoặc dùng React Native CLI trực tiếp
npx react-native run-android
```

**Lưu ý**: 
- Đảm bảo USB Debugging đã bật trên thiết bị Android
- Kiểm tra thiết bị đã kết nối: `adb devices`
- Nếu có nhiều thiết bị, chỉ định device: `adb -s <device_id> install app.apk`

### iOS (chỉ macOS)

#### Bước 1: Khởi động Metro Bundler
```bash
npm start
```

#### Bước 2: Chạy trên simulator/device
```bash
# Chạy trên iOS simulator mặc định
npm run ios

# Chạy trên iPhone 15 Pro simulator
npx react-native run-ios --simulator="iPhone 15 Pro"

# Chạy trên thiết bị thật (cần Apple Developer Account)
npx react-native run-ios --device
```

## 📦 Build APK (Android)

### Debug APK
```bash
# Build debug APK
npm run build:apk

# Hoặc thủ công
cd android
./gradlew assembleDebug
cd ..

# File APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (Signed)
```bash
# Build release APK đã ký
npm run build:release

# File APK: android/app/build/outputs/apk/release/app-release.apk
```

**Cấu hình signing** (trong `android/app/build.gradle`):
```gradle
signingConfigs {
    release {
        storeFile file('my-release-key.keystore')
        storePassword 'your-store-password'
        keyAlias 'my-key-alias'
        keyPassword 'your-key-password'
    }
}
```

### Cài đặt APK lên thiết bị
```bash
# Cài debug APK
npm run install:apk

# Cài release APK
npm run install:release

# Hoặc thủ công với adb
adb install -r path/to/app.apk
```

## 📖 Cách sử dụng

### Bước 1: Mở Settings
1. Mở ứng dụng trên cả 2 thiết bị
2. Nhấn vào icon ⚙️ (Settings) góc phải trên cùng

### Bước 2: Cấu hình
**Thiết bị A:**
- Xem "📱 Địa chỉ IP của bạn" (ví dụ: `192.168.1.100`)
- Nhập IP của thiết bị B vào "🌐 IP người nhận"
- Cấu hình mã hóa (nếu cần):
  - Bật/tắt "🔐 Chế độ mã hóa"
  - Nhập "🔑 Key mã hóa" (1-25, ví dụ: `3`)

**Thiết bị B:**
- Xem IP của mình
- Nhập IP của thiết bị A vào "IP người nhận"
- **Quan trọng**: Sử dụng cùng key mã hóa với thiết bị A

### Bước 3: Chat
- Nhập tin nhắn vào ô input phía dưới
- Nhấn nút gửi (icon ✉️)
- Tin nhắn sẽ được mã hóa (nếu bật) và gửi qua TCP socket

### Ví dụ
```
Thiết bị A (IP: 192.168.1.100):
- Nhập IP người nhận: 192.168.1.101
- Key: 3
- Gửi: "Hello" → Mã hóa thành "Khoor" → Thiết bị B nhận

Thiết bị B (IP: 192.168.1.101):
- Nhập IP người nhận: 192.168.1.100
- Key: 3 (phải giống thiết bị A)
- Nhận: "Khoor" → Giải mã thành "Hello"
```

**⭐ Nếu thấy hữu ích, hãy star repository này!**
