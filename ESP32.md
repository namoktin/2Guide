# TÀI LIỆU CẤU TRÚC API GIAO TIẾP ESP32 <-> SERVER (2GUIDE)

Tài liệu chuẩn hóa toàn bộ các cổng API và giao thức WebSocket giao tiếp giữa thiết bị Cục Hub (ESP32) và Máy chủ (Server).

- **Địa chỉ Máy chủ (Base URL):** `http://<IP_MAY_CHU>:4000`
- **Địa chỉ WebSocket (Realtime):** `ws://<IP_MAY_CHU>:4000`
- **Mã Bí Mật Phần Cứng (Secret Key):** `esp_sec_2026_98a72b`
- **HTTP Header bắt buộc:** `X-Device-Secret: esp_sec_2026_98a72b`

---

## PHẦN 1: CÁC KẾT NỐI HTTP REST API (ESP32 GỬI LÊN SERVER)

---

### 1. API: /api/device/verify
- **Loại:** POST
- **Mô tả:** Bắt tay và xác thực tính hợp lệ của mã bí mật phần cứng khi Hub vừa bật nguồn và kết nối Wi-Fi.
- **Cấu trúc mẫu:**
  - **Gửi lên (Request Header & Body):**
    - Headers:
      ```http
      Content-Type: application/json
      X-Device-Secret: esp_sec_2026_98a72b
      ```
    - Body JSON:
      ```json
      {
        "secretKey": "esp_sec_2026_98a72b"
      }
      ```
  - **Nhận về (Response JSON - 200 OK):**
    ```json
    {
      "success": true,
      "authStatus": "VERIFIED",
      "secretKey": "esp_sec_2026_98a72b",
      "message": "Xác thực 2 chiều ESP32 <-> Server thành công! Thiết bị hợp lệ."
    }
    ```

---

### 2. API: /api/telemetry
- **Loại:** POST
- **Mô tả:** Gửi định kỳ (1 giây/lần) tọa độ GPS, góc la bàn hướng nhìn (Yaw) và dung lượng pin của Hub lên Server để vẽ lên bản đồ.
- **Cấu trúc mẫu:**
  - **Gửi lên (Request Header & Body):**
    - Headers:
      ```http
      Content-Type: application/json
      X-Device-Secret: esp_sec_2026_98a72b
      ```
    - Body JSON:
      ```json
      {
        "hubId": "NEU001",
        "lat": 20.999650,
        "lng": 105.842800,
        "yaw": 90.0,
        "battery": 95,
        "secretKey": "esp_sec_2026_98a72b",
        "alt": 15.0,
        "pitch": 0.0,
        "roll": 0.0,
        "isCharging": false
      }
      ```
  - **Nhận về (Response JSON - 200 OK):**
    ```json
    {
      "success": true,
      "authStatus": "VERIFIED",
      "secretKey": "esp_sec_2026_98a72b",
      "data": {
        "hubId": "NEU001",
        "lat": 20.999650,
        "lng": 105.842800,
        "yaw": 90.0,
        "battery": 95
      }
    }
    ```

---

### 3. API: /api/hubs/gaze-poi
- **Loại:** POST
- **Mô tả:** Gửi báo cáo khi thuật toán nội bộ trên Hub phát hiện du khách tiến gần (khoảng cách <= 5m) và chĩa thẳng góc nhìn (nón 45 độ) vào hiện vật liên tục 3 giây.
- **Cấu trúc mẫu:**
  - **Gửi lên (Request Header & Body):**
    - Headers:
      ```http
      Content-Type: application/json
      X-Device-Secret: esp_sec_2026_98a72b
      ```
    - Body JSON:
      ```json
      {
        "hubId": "NEU001",
        "poiNumber": 1,
        "secretKey": "esp_sec_2026_98a72b"
      }
      ```
  - **Nhận về (Response JSON - 200 OK):**
    ```json
    {
      "success": true,
      "authStatus": "VERIFIED",
      "poiNumber": 1,
      "deviceNotified": true,
      "message": "Đã gửi mã số hiện vật #1 tới thiết bị phần cứng ESP32 NEU001!"
    }
    ```

---

### 4. API: /api/inmp441/audio?returnBinaryAudio=true
- **Loại:** POST
- **Mô tả:** Du khách nhấn giữ nút và nói vào Mic INMP441, Hub gửi file âm thanh ghi âm lên Server để AI nhận diện câu hỏi và trả về trực tiếp luồng byte âm thanh MP3 để Hub phát ra loa qua chip DAC PCM5102A.
- **Cấu trúc mẫu:**
  - **Gửi lên (Multipart Form-Data):**
    - Headers:
      ```http
      Content-Type: multipart/form-data
      X-Device-Secret: esp_sec_2026_98a72b
      ```
    - Form Data Fields:
      - `audio`: File ghi âm nhị phân định dạng `.wav` (PCM 16-bit, 16000Hz, Mono).
      - `hubId`: `"NEU001"`
      - `secretKey`: `"esp_sec_2026_98a72b"`
  - **Nhận về (Binary Stream):**
    - Headers:
      ```http
      Content-Type: audio/mpeg
      ```
    - Body: Luồng byte nhị phân dữ liệu âm thanh MP3 của giọng AI trả lời (ESP32 ghi thẳng vào buffer I2S để chip DAC phát ra loa ngoài).

---

### 5. API: /api/voice/tts
- **Loại:** GET
- **Mô tả:** Chuyển một đoạn văn bản tiếng Việt thành luồng file âm thanh MP3 để nạp vào loa Hub.
- **Cấu trúc mẫu:**
  - **Gửi lên (URL Query):**
    - Path & Query:
      ```http
      GET /api/voice/tts?text=Chao%20mung%20ban%20den%20voi%20NEU&secretKey=esp_sec_2026_98a72b
      ```
    - Headers:
      ```http
      X-Device-Secret: esp_sec_2026_98a72b
      ```
  - **Nhận về (Binary Audio):**
    - Content-Type: `audio/mpeg`
    - Body: Luồng byte âm thanh file MP3.

---

### 6. API: /api/hubs/:hubId/info
- **Loại:** GET
- **Mô tả:** Tra cứu trạng thái hoạt động của Hub và thông tin đoàn khách hiện tại mà Hub này đang tham gia.
- **Cấu trúc mẫu:**
  - **Gửi lên (URL Path):**
    - Đường dẫn: `/api/hubs/NEU001/info`
    - Headers:
      ```http
      X-Device-Secret: esp_sec_2026_98a72b
      ```
  - **Nhận về (Response JSON - 200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "hub": {
          "hubId": "NEU001",
          "battery": 95,
          "currentGroupId": "GROUP_101",
          "lat": 20.999650,
          "lng": 105.842800
        },
        "isGrouped": true,
        "group": {
          "groupId": "GROUP_101",
          "groupName": "Đoàn Tham Quan NEU K65",
          "memberCount": 15
        }
      }
    }
    ```

---

### 7. API: /api/site-data
- **Loại:** GET
- **Mô tả:** Tải dữ liệu toàn bộ phân khu khuôn viên, danh sách hiện vật di tích và lộ trình tour tham quan về lưu bộ nhớ Hub.
- **Cấu trúc mẫu:**
  - **Gửi lên (Request):**
    - Đường dẫn: `/api/site-data`
    - Headers:
      ```http
      X-Device-Secret: esp_sec_2026_98a72b
      ```
  - **Nhận về (Response JSON - 200 OK):**
    ```json
    {
      "success": true,
      "siteInfo": {
        "name": "Khuôn viên Đại học Kinh tế Quốc dân",
        "description": "Bản đồ di tích và hiện vật lịch sử NEU"
      },
      "zones": [ ... ],
      "artifacts": [
        {
          "id": "art-1",
          "number": 1,
          "name": "Tòa Nhà Thế Kỷ A2",
          "lat": 20.999650,
          "lng": 105.842800,
          "sdTrack": "track_001.mp3"
        }
      ],
      "tourRoute": [ ... ]
    }
    ```

---

## PHẦN 2: KÊNH WEBSOCKET REALTIME (ws://<IP_MAY_CHU>:4000)

---

### 8. API: WebSocket Event -> REGISTER_DEVICE
- **Loại:** WebSocket (ESP32 gửi lên Server)
- **Mô tả:** Đăng ký định danh thiết bị ngay sau khi ESP32 thiết lập kết nối WebSocket với Server.
- **Cấu trúc mẫu:**
  - **Gửi lên (ESP32 -> Server):**
    ```json
    {
      "type": "REGISTER_DEVICE",
      "hubId": "NEU001",
      "secretKey": "esp_sec_2026_98a72b"
    }
    ```
  - **Nhận về (Server -> ESP32 phản hồi):**
    ```json
    {
      "type": "DEVICE_REGISTERED",
      "hubId": "NEU001",
      "authStatus": "VERIFIED"
    }
    ```

---

### 9. API: WebSocket Event -> DEVICE_IMU_STREAM
- **Loại:** WebSocket (ESP32 gửi lên Server)
- **Mô tả:** Truyền liên tục góc xoay la bàn IMU (Yaw) tốc độ cao (nhiều lần/giây) để nón tầm nhìn trên bản đồ xoay mượt mà theo người dùng.
- **Cấu trúc mẫu:**
  - **Gửi lên (ESP32 -> Server):**
    ```json
    {
      "type": "DEVICE_IMU_STREAM",
      "hubId": "NEU001",
      "yaw": 120.5,
      "pitch": 0.0,
      "roll": 0.0,
      "secretKey": "esp_sec_2026_98a72b"
    }
    ```
  - **Nhận về:** Server xử lý xoay nón tầm nhìn 5m, 45 độ trên bản đồ trực tiếp của Quản lý và User.

---

### 10. API: WebSocket Event -> PLAY_SD_TRACK
- **Loại:** WebSocket (Server CHỦ ĐỘNG GỬI XUỐNG ESP32)
- **Mô tả:** Server yêu cầu Hub phát file âm thanh thuyết minh có sẵn trong thẻ nhớ micro-SD gắn trên Hub.
- **Cấu trúc mẫu:**
  - **Server gửi xuống (ESP32 đón nhận):**
    ```json
    {
      "type": "PLAY_SD_TRACK",
      "hubId": "NEU001",
      "poiNumber": 1,
      "secretKey": "esp_sec_2026_98a72b",
      "timestamp": 1727712345678
    }
    ```
  - **Hành động ESP32 thực hiện:** Mở file âm thanh `/tracks/track_001.mp3` trên thẻ nhớ SD và phát qua chip DAC ra loa.

---

### 11. API: WebSocket Event -> SET_VOLUME
- **Loại:** WebSocket (Server CHỦ ĐỘNG GỬI XUỐNG ESP32)
- **Mô tả:** Server gửi lệnh điều khiển âm lượng từ xa khi người dùng hoặc Ban Quản Lý chỉnh âm lượng trên giao diện web.
- **Cấu trúc mẫu:**
  - **Server gửi xuống (ESP32 đón nhận):**
    ```json
    {
      "type": "SET_VOLUME",
      "hubId": "NEU001",
      "volume": 80,
      "secretKey": "esp_sec_2026_98a72b"
    }
    ```
  - **Hành động ESP32 thực hiện:** Nhận giá trị `volume` ($1 - 100$) và gán mức khuếch đại cho chip giải mã DAC PCM5102A.

---

### 12. API: WebSocket Event -> EMERGENCY_BROADCAST
- **Loại:** WebSocket (Server CHỦ ĐỘNG GỬI XUỐNG ESP32)
- **Mô tả:** Ban Quản Lý phát thông báo khẩn cấp hoặc gọi tập trung toàn bộ các Hub trong khuôn viên.
- **Cấu trúc mẫu:**
  - **Server gửi xuống (ESP32 đón nhận):**
    ```json
    {
      "type": "EMERGENCY_BROADCAST",
      "message": "Toàn đoàn tập trung tại sảnh A1 gấp!",
      "secretKey": "esp_sec_2026_98a72b"
    }
    ```
  - **Hành động ESP32 thực hiện:** Ngắt bài thuyết minh hiện tại, phát còi cảnh báo ngắt quãng và phát âm thanh thông điệp khẩn cấp ra loa.
