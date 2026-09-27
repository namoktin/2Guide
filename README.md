# 2Guide - Nền Tảng Quản Lý Hub Phần Cứng & Hỗ Trợ Tham Quan Di Tích Thông Minh

Hệ thống điều hành toàn diện kết hợp giữa thiết bị phần cứng cầm tay **ESP32** (tích hợp GPS ATGM336H, la bàn số IMU MPU6050, micro I2S INMP441, giải mã âm thanh DAC PCM5102A và thẻ nhớ MicroSD) với nền tảng Web thời gian thực phục vụ **Ban Quản Lý Di Tích**, **Đoàn Khách Tham Quan** và **Trợ Lý Ảo AI Đàm Thoại Không Gian**.

---

## 🌟 Cấu Trúc Các Phân Hệ & Cổng Truy Cập

Hệ thống khởi chạy mặc định tại cổng **`http://localhost:4000`** với 5 cổng chuyên biệt:

1. **Cổng Ban Quản Lý Di Tích (`/quanly_bql_8869`)**:
   - Đường dẫn được ẩn giấu và bảo vệ bằng `ADMIN_SECRET_PATH` & `ADMIN_SECRET_KEY`.
   - Giám sát thời gian thực vị trí, trạng thái, dung lượng pin của tất cả 20+ Hub trên bản đồ số.
   - Khởi tạo đoàn khách, sinh mã QR Token dùng 1 lần (`Single-use Dynamic QR Token`).
   - Chốt pin ca làm việc hành chính (đầu ca / cuối ca).
   - Kết thúc tour, tự động dọn dẹp phiên và gom vết di chuyển vào bản đồ nhiệt (`Heatmap`).
   - Phát thanh khẩn cấp (Emergency Broadcast) gửi thông báo chữ và âm thanh xuống các Hub.

2. **Cổng Khách Tham Quan Theo Đoàn (`/user?token=...`)**:
   - Quét mã QR trên điện thoại là vào ngay, không cần cài đặt ứng dụng.
   - Chọn Hub cá nhân để hiển thị nổi bật (`Màu Vàng - BẠN`), các thành viên khác hiển thị màu xanh lơ.
   - Nón tầm nhìn động $45^\circ$, bán kính $5.0\text{m}$ tự động xoay theo la bàn thực địa.
   - Tự động mở ngăn chat đàm thoại AI thông minh khi khách đặt câu hỏi qua micro hoặc giao diện.

3. **Trạm Kiểm Thử Toàn Diện Phần Cứng (`/test.html`)**:
   - Trạm kiểm thử độc lập mô phỏng đầy đủ mọi vi mạch của thiết bị ESP32 thực tế:
     - La bàn điện tử IMU MPU6050 xoay la bàn 360° phản hồi thời gian thực.
     - Bộ phát xung GPS ATGM336H chuẩn chuỗi NMEA GGA/RMC.
     - Kiểm thử thu âm microphone I2S INMP441, chuyển đổi giọng nói qua Groq Whisper STT.
     - Radar âm thanh không gian 3D Web Audio HRTF kết hợp xuất âm thanh ra chip DAC PCM5102A.
     - Terminal Log ghi nhận chi tiết từng byte truyền nhận qua WebSocket và REST API.

4. **Bộ Giả Lập Thực Địa Tuyến Tính (`/simulate`)**:
   - Mô phỏng đồng thời 5-10 du khách cầm Hub di chuyển trong di tích.
   - Chế độ di chuyển tuyến tính A $\rightarrow$ B với bước đi tự nhiên, tự động tính hướng đi (`Heading/Yaw`), cập nhật nón tầm nhìn và gửi gói tin telemetry đều đặn.

5. **Map Studio - Biên Tập Bản Đồ & Tuyến Du Lịch (`/editor`)**:
   - Công cụ đồ họa trực quan vẽ đa giác phân khu (`Zones`), kéo thả ghim hiện vật (`Artifacts`) và điểm di tích (`POIs`).
   - Biên tập kịch bản thuyết minh âm thanh đa ngôn ngữ.
   - Đồng bộ ngay lập tức vào MongoDB Atlas và kho sao lưu JSON.

---

## 🛠 Công Nghệ Cốt Lõi

- **Backend**: Node.js, Express, WebSocket (`ws`), Multer.
- **Cơ Sở Dữ Liệu Kép**: MongoDB Atlas kết hợp Local JSON Store dự phòng tự động khôi phục.
- **Trí Tuệ Nhân Tạo (AI)**:
  - **Groq Whisper Large v3**: Chuyển đổi giọng nói tiếng Việt thành văn bản.
  - **Groq LLM (`openai/gpt-oss-120b`)**: Phân tích ngữ cảnh thực địa, tọa độ, phân khu và hiện vật trước mặt để trả lời như một hướng dẫn viên chuyên nghiệp.
- **Âm Thanh Không Gian 3D**: Web Audio HRTF (`PannerNode` + `GainNode`), âm lượng tăng dần từ 25% (ở 5m) lên 100% (ở 0.5m) khi khách tiến lại gần hiện vật.
- **Bản Đồ Số**: Leaflet GIS, Leaflet Heatmap, bản đồ Dark Theme chuyên nghiệp.
- **An Ninh Bảo Mật**: Mô hình phòng thủ 7 tầng (Defense-in-Depth), xác thực 2 chiều mã bí mật `X-Device-Secret` cho ESP32.

---

## 🚀 Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (phiên bản 18 trở lên).

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Cấu hình biến môi trường
Sao chép tệp cấu hình mẫu và cập nhật các khóa bí mật:
```bash
cp .env.example .env
```
Mở `.env` và điền:
- `GROQ_API_KEY`: Khóa API từ [Groq Console](https://console.groq.com).
- `MONGODB_URI`: Chuỗi kết nối MongoDB Atlas của bạn.
- `ADMIN_SECRET_PATH`: Đường dẫn cổng quản lý bí mật (ví dụ: `quanly_bql_8869`).
- `ESP32_SECRET_KEY`: Khóa bí mật phần cứng (ví dụ: `esp_sec_2026_98a72b`).
- `ADMIN_SECRET_KEY`: Khóa bí mật Ban Quản Lý (ví dụ: `bql_sec_2026_8869`).

### 4. Khởi động máy chủ
```bash
# Chạy môi trường sản xuất:
npm start

# Hoặc chạy môi trường phát triển (tự động reload):
npm run dev
```

Máy chủ sẽ lắng nghe tại: **`http://localhost:4000`**

---

## 📚 Tài Liệu Kỹ Thuật Tham Chiếu

- 🏗 **[MVC_ARCHITECTURE.md](./MVC_ARCHITECTURE.md)**: Chi tiết cấu trúc phân tầng MVC, mô hình dữ liệu và danh mục toàn bộ REST API & WebSocket.
- 🛡 **[SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)**: Tài liệu kiến trúc bảo mật phòng thủ 7 tầng (Defense-in-Depth), chống giả mạo thiết bị, kiểm soát phân quyền và kiểm thử Red Team.
- 🎯 **[SYSTEM_FEATURES.md](./SYSTEM_FEATURES.md)**: Bảng phân tích chi tiết toàn bộ tính năng và thông số kỹ thuật của hệ thống.
