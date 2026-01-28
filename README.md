# ChatNET - Secure Communication Protocol
> Ứng dụng nhắn tin bảo mật sử dụng mô hình Mã hóa lai (Hybrid Cryptosystem), Chữ ký số và Xác thực toàn vẹn dữ liệu.

## 🌟 Tổng quan kỹ thuật (Technical Overview)

Dự án không sử dụng các thư viện chat có sẵn mà tự triển khai giao thức bảo mật tầng ứng dụng (Application Layer Security) dựa trên bộ giao thức TCP/IP. Hệ thống đảm bảo 3 yếu tố của An toàn thông tin: **Tính bí mật (Confidentiality), Tính toàn vẹn (Integrity) và Tính xác thực (Authentication)**.

## 🔐 Chi tiết các thuật toán Mật mã (Cryptography Implementation)

Dự án sử dụng kết hợp 4 lớp thuật toán mật mã khác nhau:

### 1. Mã hóa Bất đối xứng (RSA - 1024 bit)
* **Thư viện:** `node-forge`
* **Vị trí code:** `src/utils/RSA.ts`
* **Cơ chế:** Sử dụng padding chuẩn `RSA-OAEP`.
* **Mục đích:**
    * **Trao đổi khóa (Key Exchange):** Dùng Public Key của người nhận để mã hóa khóa phiên (Session Key) AES. Đảm bảo chỉ người nhận mới giải mã được khóa này.
    * **Định danh (Identity):** Public Key đóng vai trò như định danh duy nhất của người dùng trong phiên kết nối.

### 2. Mã hóa Đối xứng (AES - 256 bit)
* **Thư viện:** `crypto-js`
* **Vị trí code:** `src/utils/SecureProtocol.ts` (Hàm `encryptPacket`)
* **Cơ chế:**
    * Sử dụng **Session Key** (32 bytes - 256 bit) được sinh ngẫu nhiên tại máy người gửi.
    * Mỗi gói tin (Packet) được mã hóa với một **IV (Initialization Vector)** ngẫu nhiên riêng biệt (16 bytes).
    * **Cấu trúc gói tin:** `IV : CipherText`.
* **Mục đích:** Mã hóa nội dung tin nhắn (Payload) với tốc độ cao và bảo mật mạnh. Việc thay đổi IV liên tục giúp chống lại các tấn công phân tích mẫu (Pattern Analysis).

### 3. Hàm băm & Chữ ký số (SHA-256 & Digital Signature)
* **Thư viện:** `node-forge` (Sign) & `crypto-js` (Hash)
* **Quy trình xác thực (Authentication Flow):**
    1.  **Sender:** Tạo hash SHA-256 của tin nhắn gốc -> Dùng RSA Private Key để ký lên hash đó -> Tạo ra `Signature`.
    2.  **Receiver:** Nhận tin nhắn -> Giải mã AES -> Tách `Signature` và `Text`.
    3.  **Verify:** Dùng RSA Public Key của Sender để kiểm tra xem `Signature` có khớp với `Text` không.
* **Mục đích:** Đảm bảo **Tính toàn vẹn (Integrity)**. Nếu kẻ tấn công (Man-in-the-Middle) sửa đổi tin nhắn trên đường truyền, quá trình Verify sẽ thất bại.

### 4. Mã hóa cổ điển (Caesar Cipher)
* **Vị trí code:** `caesarCipher.ts`
* **Mục đích:** Module giáo dục, dùng để minh họa sự khác biệt giữa mã hóa cổ điển đơn giản và mã hóa hiện đại (RSA/AES).

---

## 📡 Giao thức bắt tay (Handshake Protocol)

Quy trình thiết lập kết nối an toàn diễn ra như sau:

1.  **Connection:** Client A kết nối TCP tới Client B (Port 8888).
2.  **Exchange PubKey:** Hai bên trao đổi RSA Public Key (Gói tin: `PUBKEY::...`).
3.  **Safety Number Generation:** Cả hai bên tự tính toán mã băm SHA-256 của cặp Public Key để tạo ra "Safety Number" (giống Telegram/Signal) nhằm phát hiện tấn công MITM bằng mắt thường.
4.  **Session Key Setup:**
    * Client A sinh ngẫu nhiên chuỗi Hex 64 ký tự (AES Key).
    * Client A mã hóa AES Key này bằng RSA Public Key của B.
    * Client A gửi gói tin `SESSION::[Encrypted_AES_Key]` sang B.
5.  **Secure Tunnel:** Client B giải mã lấy AES Key. Từ lúc này, mọi tin nhắn đều được mã hóa AES và ký số RSA.

---

## 🧪 Tính năng kiểm thử (Security Inspection)

Ứng dụng tích hợp chế độ **"Kính lúp bảo mật"** (Security Inspector Modal):
* Cho phép người dùng bấm vào tin nhắn bất kỳ để xem cấu trúc bên trong.
* Hiển thị công khai: **Nội dung gốc**, **Mã băm SHA-256**, và **Chữ ký số RSA**.
* Trạng thái xác thực: **VERIFIED** (Xanh) hoặc **TAMPERED** (Đỏ).

---

## 🛠 Cài đặt & Chạy

1.  **Yêu cầu:** Node.js, React Native environment.
2.  **Cài đặt:**
    ```bash
    npm install
    # Các thư viện chính: node-forge, crypto-js, react-native-tcp-socket
    ```
3.  **Chạy ứng dụng:**
    ```bash
    npm start
    ```