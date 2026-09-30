# 2Guide - Đặc Tả API & Tham Số Kết Nối Giữa Cục Hub Và Server

Tài liệu quy định chi tiết các cổng API, giao thức WebSocket và toàn bộ tham số đầu vào (Input Parameters) để Cục Hub (ESP32) trao đổi dữ liệu với Máy Chủ 2Guide.

---

## 1. Thông Số Kết Nối & Xác Thực Chung

| Tham Số | Giá Trị Cố Định | Ý Nghĩa / Ghi Chú |
| :--- | :--- | :--- |
| Server Base URL | http://IP_MAY_CHU:4000 | Địa chỉ gốc của REST API Server |
| WebSocket URL | ws://IP_MAY_CHU:4000 | Kênh kết nối thời gian thực 2 chiều |
| Mã Bí Mật Thiết Bị (ESP32_SECRET_KEY) | esp_sec_2026_98a72b | Bắt buộc trong mọi API để vượt qua bảo mật |
| Mã Định Danh Hub (hubId) | NEU001 đến NEU026 | Quy chuẩn NEU + 3 chữ số |
| HTTP Header Xác Thực | X-Device-Secret: esp_sec_2026_98a72b | Phải gửi kèm trong mọi HTTP Request |

---

## 2. Danh Sách Các Kết Nối HTTP REST API

---

### API 1: Bắt Tay & Xác Thực Thiết Bị Khi Khởi Động
Kiểm tra kết nối mạng và tính hợp lệ của mã bí mật phần cứng khi Hub vừa bật nguồn.

- Phương thức: POST
- Đường dẫn: `/api/device/verify`
- Headers:
  - Content-Type: application/json
  - X-Device-Secret: esp_sec_2026_98a72b

#### Bảng tham số đầu vào (JSON Body):
| Tên Tham Số | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả / Ý Nghĩa | Ví Dụ |
| :--- | :---: | :---: | :--- | :--- |
| secretKey | String | Có | Mã bí mật phần cứng của Hub | "esp_sec_2026_98a72b" |

#### JSON gửi lên:
```json
{
  "secretKey": "esp_sec_2026_98a72b"
}
```

#### Dữ liệu Server trả về (200 OK):
```json
{
  "success": true,
  "authStatus": "VERIFIED",
  "secretKey": "esp_sec_2026_98a72b",
  "message": "Xác thực 2 chiều ESP32 <-> Server thành công! Thiết bị hợp lệ."
}
```

---

### API 2: Đẩy Dữ Liệu Định Vị, Cảm Biến & Pin (Telemetry)
Cục Hub gửi định kỳ (khuyến khích 1 giây / lần) tọa độ GPS, góc la bàn IMU và mức pin lên Server.

- Phương thức: POST
- Đường dẫn: `/api/telemetry`
- Headers:
  - Content-Type: application/json
  - X-Device-Secret: esp_sec_2026_98a72b

#### Bảng tham số đầu vào (JSON Body):
| Tên Tham Số | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả / Ý Nghĩa | Giá Trị Hợp Lệ / Ví Dụ |
| :--- | :---: | :---: | :--- | :--- |
| hubId | String | Có | Mã định danh của cục Hub | "NEU001" |
| lat | Number (Float) | Có | Vĩ độ GPS vệ tinh (6 số thập phân) | 20.999650 |
| lng | Number (Float) | Có | Kinh độ GPS vệ tinh (6 số thập phân) | 105.842800 |
| yaw | Number (Float) | Có | Góc la bàn hướng nhìn của du khách | 0.0 đến 360.0 (độ) |
| battery | Number (Int) | Có | Phần trăm dung lượng pin còn lại | 0 đến 100 (%) |
| secretKey | String | Có | Mã bí mật phần cứng | "esp_sec_2026_98a72b" |
| alt | Number (Float) | Không | Độ cao so với mực nước biển (mét) | 15.0 |
| pitch | Number (Float) | Không | Góc nghiêng dọc của Hub | -90.0 đến 90.0 |
| roll | Number (Float) | Không | Góc nghiêng ngang của Hub | -180.0 đến 180.0 |
| isCharging | Boolean | Không | Trạng thái có đang cắm sạc pin không | true / false |

#### JSON gửi lên:
```json
{
  "hubId": "NEU001",
  "lat": 20.999650,
  "lng": 105.842800,
  "alt": 15.0,
  "yaw": 90.0,
  "pitch": 0.0,
  "roll": 0.0,
  "battery": 95,
  "isCharging": false,
  "secretKey": "esp_sec_2026_98a72b"
}
```

#### Dữ liệu Server trả về (200 OK):
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

### API 3: Báo Cáo Nhìn Trúng Hiện Vật Đủ 3 Giây (Gaze POI Trigger)
Gửi lên Server khi thuật toán nội tại trên Hub phát hiện du khách tiến gần (< 6m) và chĩa góc nhìn thẳng vào hiện vật trong 3 giây liên tục.

- Phương thức: POST
- Đường dẫn: `/api/hubs/gaze-poi`
- Headers:
  - Content-Type: application/json
  - X-Device-Secret: esp_sec_2026_98a72b

#### Bảng tham số đầu vào (JSON Body):
| Tên Tham Số | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả / Ý Nghĩa | Ví Dụ |
| :--- | :---: | :---: | :--- | :--- |
| hubId | String | Có | Mã định danh Hub | "NEU001" |
| poiNumber | Number (Int) | Có | Số thứ tự của hiện vật được nhìn trúng | 1, 2, 3... |
| secretKey | String | Có | Mã bí mật phần cứng | "esp_sec_2026_98a72b" |

#### JSON gửi lên:
```json
{
  "hubId": "NEU001",
  "poiNumber": 1,
  "secretKey": "esp_sec_2026_98a72b"
}
```

#### Dữ liệu Server trả về (200 OK):
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

### API 4: Gửi File Thu Âm Giọng Nói Hỏi AI (INMP441 Audio)
Cục Hub gửi file âm thanh thu từ microphone lên Server để AI nhận dạng giọng nói, trả lời câu hỏi và xuất âm thanh ra loa.

- Phương thức: POST
- Đường dẫn: `/api/inmp441/audio`
- Headers:
  - Content-Type: multipart/form-data
  - X-Device-Secret: esp_sec_2026_98a72b
  - X-Hub-Id: NEU001 (tùy chọn)
  - X-Lat: 20.999650 (tùy chọn)
  - X-Lng: 105.842800 (tùy chọn)
  - X-Yaw: 90.0 (tùy chọn)

#### Bảng tham số URL Query (Tùy chọn):
| Tên Tham Số | Kiểu Dữ Liệu | Mô Tả / Ý Nghĩa |
| :--- | :---: | :--- |
| returnBinaryAudio | Boolean | Nếu đặt `=true`, Server sẽ trả về thẳng file âm thanh nhị phân (MP3/WAV) câu trả lời của AI để Hub đẩy trực tiếp ra chip DAC phát ra loa mà không cần bóc tách JSON. |

#### Bảng tham số đầu vào (Multipart Form-Data):
| Tên Trường (Field) | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả / Ý Nghĩa |
| :--- | :---: | :---: | :--- |
| audio | File Binary (.wav) | Có | Dữ liệu file âm thanh thu âm từ Mic: Chuẩn WAV PCM 16-bit, tần số 16000Hz, Mono. |
| hubId | String | Không | Mã định danh Hub (ví dụ: "NEU001"). |
| lat | Number | Không | Vĩ độ hiện tại lúc người dùng hỏi. |
| lng | Number | Không | Kinh độ hiện tại lúc người dùng hỏi. |
| yaw | Number | Không | Hướng quay la bàn lúc hỏi. |
| secretKey | String | Không | "esp_sec_2026_98a72b" |

#### Dữ liệu Server trả về:
1. Trường hợp có `returnBinaryAudio=true`:
   - Header: `Content-Type: audio/mpeg` (hoặc `audio/wav`)
   - Body: Toàn bộ luồng byte nhị phân âm thanh giọng đọc tiếng Việt của AI.
2. Trường hợp mặc định (JSON):
   ```json
   {
     "success": true,
     "authStatus": "VERIFIED",
     "recognizedText": "Nhà A1 được xây dựng từ năm nào?",
     "aiReply": "Tòa nhà A1 Đại học Kinh tế Quốc dân được khởi công xây dựng vào...",
     "nearestPoi": {
       "number": 1,
       "name": "Khu A1 - Giảng Đường"
     }
   }
   ```

---

### API 5: Lấy Luồng Âm Thanh Giọng Đọc AI Trực Tiếp (Text-to-Speech)
Hub gửi chuỗi văn bản cần đọc để Server chuyển thành file âm thanh trả về phát ra loa DAC.

- Phương thức: GET
- Đường dẫn: `/api/voice/tts`
- Headers:
  - X-Device-Secret: esp_sec_2026_98a72b

#### Bảng tham số đầu vào (URL Query Parameters):
| Tên Tham Số | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả / Ý Nghĩa | Ví Dụ |
| :--- | :---: | :---: | :--- | :--- |
| text | String | Có | Đoạn văn bản tiếng Việt cần đọc (phải URL-encode) | text=Chao%20mung%20ban |
| secretKey | String | Không | Mã bí mật phần cứng | secretKey=esp_sec_2026_98a72b |

#### Dữ liệu Server trả về:
- Header: `Content-Type: audio/mpeg`
- Body: Luồng byte nhị phân âm thanh MP3 để nạp vào buffer phát loa.

---

### API 6: Lấy Thông Tin Cấu Hình Hub & Đoàn Khách
Dùng để Hub tra cứu xem mình đang thuộc đoàn khách nào, tên trưởng đoàn và trạng thái hoạt động.

- Phương thức: GET
- Đường dẫn: `/api/hubs/:hubId/info`
- Ví dụ: `/api/hubs/NEU001/info`

#### Bảng tham số đầu vào (Path Parameter):
| Tên Tham Số | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả / Ý Nghĩa |
| :--- | :---: | :---: | :--- |
| hubId | String | Có | Mã định danh của Hub trên đường dẫn URL (ví dụ: NEU001) |

#### Dữ liệu Server trả về (200 OK):
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
      "leaderName": "Nguyễn Văn A",
      "memberCount": 15
    }
  }
}
```

---

## 3. Kênh WebSocket Thời Gian Thực (ws://IP_MAY_CHU:4000)

---

### 3.1. Các Bản Tin Cục Hub GỬI LÊN Server (Hub -> Server)

#### Bản tin 1: Đăng ký thiết bị (Bắt buộc gửi ngay khi vừa kết nối WebSocket)
- JSON gửi lên:
```json
{
  "type": "REGISTER_DEVICE",
  "hubId": "NEU001",
  "secretKey": "esp_sec_2026_98a72b"
}
```
| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
| :--- | :---: | :---: | :--- |
| type | String | Có | Cố định: "REGISTER_DEVICE" |
| hubId | String | Có | Mã Hub (ví dụ: "NEU001") |
| secretKey | String | Có | "esp_sec_2026_98a72b" |

Server phản hồi lại:
```json
{
  "type": "DEVICE_REGISTERED",
  "hubId": "NEU001",
  "authStatus": "VERIFIED"
}
```

---

#### Bản tin 2: Đẩy góc xoay la bàn IMU tốc độ cao
- Dùng khi muốn gửi góc nhìn của du khách liên tục mà không làm nặng đường truyền HTTP.
- JSON gửi lên:
```json
{
  "type": "DEVICE_IMU_STREAM",
  "hubId": "NEU001",
  "yaw": 120.5,
  "pitch": 1.2,
  "roll": -0.5,
  "secretKey": "esp_sec_2026_98a72b"
}
```
| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
| :--- | :---: | :---: | :--- |
| type | String | Có | Cố định: "DEVICE_IMU_STREAM" |
| hubId | String | Có | Mã Hub |
| yaw | Number | Có | Góc la bàn 0.0 đến 360.0 độ |
| pitch | Number | Không | Góc nghiêng dọc (-90 đến +90) |
| roll | Number | Không | Góc nghiêng ngang (-180 đến +180) |
| secretKey | String | Có | "esp_sec_2026_98a72b" |

---

### 3.2. Các Lệnh Server GỬI XUỐNG Cục Hub (Server -> Hub)
Hub cần cài đặt hàm đón nhận các bản tin JSON sau từ kết nối WebSocket:

#### Lệnh 1: Yêu cầu phát bài thuyết minh trên thẻ nhớ SD (PLAY_SD_TRACK)
Server gửi lệnh này khi du khách nhìn trúng hiện vật hoặc hướng dẫn viên bấm phát bài.
```json
{
  "type": "PLAY_SD_TRACK",
  "hubId": "NEU001",
  "poiNumber": 3,
  "secretKey": "esp_sec_2026_98a72b",
  "timestamp": 1727712345678
}
```
| Tham Số Nhận Được | Kiểu | Mô Tả Hành Vi Hub Cần Thực Hiện |
| :--- | :---: | :--- |
| poiNumber | Number (Int) | Số thứ tự hiện vật -> Hub mở file `/tracks/track_003.mp3` trên thẻ nhớ SD phát ra loa |
| secretKey | String | Mã xác thực để Hub kiểm tra lệnh đúng từ Server chính chủ |

---

#### Lệnh 2: Yêu cầu điều chỉnh âm lượng từ xa (SET_VOLUME)
Server gửi lệnh này khi Ban Quản Lý hoặc du khách chỉnh âm lượng trên điện thoại.
```json
{
  "type": "SET_VOLUME",
  "hubId": "NEU001",
  "volume": 80,
  "secretKey": "esp_sec_2026_98a72b"
}
```
| Tham Số Nhận Được | Kiểu | Mô Tả Hành Vi Hub Cần Thực Hiện |
| :--- | :---: | :--- |
| volume | Number (Int) | Mức âm lượng từ 1 đến 100 (%) -> Hub đặt mức gain âm thanh tương ứng cho chip DAC |

---

#### Lệnh 3: Thông báo phát thanh khẩn cấp toàn đoàn (EMERGENCY_BROADCAST)
Ban Quản Lý phát thông báo khẩn cấp hoặc gọi tập trung toàn bộ các Hub trong khuôn viên.
```json
{
  "type": "EMERGENCY_BROADCAST",
  "message": "Toàn đoàn tập trung tại sảnh A1 gấp!",
  "secretKey": "esp_sec_2026_98a72b"
}
```
| Tham Số Nhận Được | Kiểu | Mô Tả Hành Vi Hub Cần Thực Hiện |
| :--- | :---: | :--- |
| message | String | Nội dung cảnh báo khẩn cấp -> Hub phát tiếng bíp/còi báo động cảnh báo du khách |

---

## 4. Toàn Bộ Quy Trình Vận Hành Thực Tế (Step-by-Step Workflow)

Quy trình hoạt động khép kín giữa Cục Hub phần cứng, Du khách và Máy chủ 2Guide được chia thành 5 bước tuần tự:

```
[ BƯỚC 1: KHỞI ĐỘNG & BẮT TAY ]
   Hub bật nguồn -> Nối Wi-Fi -> POST /api/device/verify -> Mở WebSocket ws://IP:4000
   -> Gửi {"type": "REGISTER_DEVICE", "hubId": "NEU001"}

[ BƯỚC 2: DU KHÁCH ĐI THAM QUAN (Định kỳ 1 giây) ]
   Hub đọc GPS + La bàn IMU + Pin
   -> POST /api/telemetry (hoặc gửi WebSocket DEVICE_IMU_STREAM)
   -> Server cập nhật vị trí thời gian thực lên Bản đồ BQL & Điện thoại du khách

[ BƯỚC 3: TỰ ĐỘNG THUYẾT MINH KHI ĐẾN GẦN HIỆN VẬT ]
   Khoảng cách < 6m VÀ góc nhìn chĩa vào hiện vật liên tục 3 giây
   -> Hub gửi: POST /api/hubs/gaze-poi (poiNumber: X)
   -> Server gửi lệnh WebSocket: {"type": "PLAY_SD_TRACK", "poiNumber": X}
   -> Hub mở file /tracks/track_00X.mp3 trên thẻ nhớ SD phát ra loa

[ BƯỚC 4: HỎI ĐÁP VỚI TRỢ LÝ AI (Push-to-Talk) ]
   Du khách nhấn giữ nút trên Hub -> Thu âm mic INMP441
   -> Nhả nút -> Gửi POST /api/inmp441/audio?returnBinaryAudio=true
   -> Server xử lý STT -> Hỏi Groq AI -> Tạo giọng nói TTS
   -> Server trả về luồng byte MP3 -> Hub đẩy thẳng ra DAC PCM5102A phát ra loa

[ BƯỚC 5: ĐIỀU KHIỂN & BÁO ĐỘNG TỪ XA ]
   - Chỉnh âm lượng từ Web: Server gửi {"type": "SET_VOLUME", "volume": 80}
   - Phát thanh khẩn cấp: Server gửi {"type": "EMERGENCY_BROADCAST", "message": "..."}
```

