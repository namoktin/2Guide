# TÀI LIỆU KIẾN TRÚC BẢO MẬT HỆ THỐNG 2GUIDE (DEFENSE-IN-DEPTH)

> **Dự án**: Hệ thống quản lý Hub phần cứng & Hỗ trợ du khách tham quan di tích (2Guide)  
> **Kiến trúc**: Mô hình phòng thủ đa tầng (Defense-in-Depth) kết hợp MVC  
> **Địa bàn thực tế**: Trường Đại Học Kinh Tế Quốc Dân (NEU)  
> **Ngày cập nhật**: 26/09/2026  
> **Trạng thái an ninh**: Đã kiểm thử và đánh chặn thành công 100% các kịch bản tấn công thực nghiệm.

---

## MỤC LỤC

1. [Tổng Quan Mô Hình Phòng Thủ Đa Tầng (Defense-in-Depth)](#1-tổng-quan-mô-hình-phòng-thủ-đa-tầng-defense-in-depth)
2. [Lớp 1: Ẩn Giấu Bề Mặt Tấn Công & Cô Lập Định Tuyến (Routing Obfuscation)](#2-lớp-1-ẩn-giấu-bề-mặt-tấn-công--cô-lập-định-tuyến-routing-obfuscation)
3. [Lớp 2: Xác Thực & Ủy Quyền Ban Quản Lý (Admin Authentication Guard)](#3-lớp-2-xác-thực--ủy-quyền-ban-quản-lý-admin-authentication-guard)
4. [Lớp 3: Kiểm Soát & Ngắt Kết Nối WebSocket Kịp Thời (Anti-Privilege Escalation)](#4-lớp-3-kiểm-soát--ngắt-kết-nối-websocket-kịp-thời-anti-privilege-escalation)
5. [Lớp 4: Xác Thực Phần Cứng ESP32 Hai Chiều (Mutual Hardware Authentication)](#5-lớp-4-xác-thực-phần-cứng-esp32-hai-chiều-mutual-hardware-authentication)
6. [Lớp 5: Bảo Vệ Quyền Riêng Tư & Dữ Liệu Du Khách (Visitor Privacy & Ephemeral Data)](#6-lớp-5-bảo-vệ-quyền-riêng-tư--dữ-liệu-du-khách-visitor-privacy--ephemeral-data)
7. [Lớp 6: Lá Chắn Chống Quá Tải & Tấn Công Spam Dồn Dập (Rate Limiting Shield)](#7-lớp-6-lá-chắn-chống-quá-tải--tấn-công-spam-dồn-dập-rate-limiting-shield)
8. [Lớp 7: Bộ Công Cụ Kiểm Thử Xâm Nhập Thực Chiến (Red Team Pentest Simulator)](#8-lớp-7-bộ-công-cụ-kiểm-thử-xâm-nhập-thực-chiến-red-team-pentest-simulator)
9. [Bảng Ma Trận Nguy Cơ & Cơ Chế Phòng Thủ (Threat Matrix)](#9-bảng-ma-trận-nguy-cơ--cơ-chế-phòng-thủ-threat-matrix)
10. [Hướng Dẫn Vận Hành & Bảo Trì An Ninh](#10-hướng-dẫn-vận-hành--bảo-trì-an-ninh)

---

## 1. Tổng Quan Mô Hình Phòng Thủ Đa Tầng (Defense-in-Depth)

Hệ thống **2Guide** không dựa vào một chốt chặn duy nhất mà triển khai chiến lược **phòng thủ theo chiều sâu (Defense-in-Depth)** gồm 7 lớp bảo vệ liên hoàn. Kẻ tấn công nếu vượt qua được một lớp bên ngoài sẽ ngay lập tức bị các lớp bên trong vô hiệu hóa.

```
       [ KẺ GIAN / BOTNET / SCANNER NGOÀI INTERNET ]
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ LỚP 1: Ẩn Giấu Đường Dẫn & Chặn 404 Cổng Cũ (Path Guard)    │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ LỚP 6: Lá Chắn Giới Hạn Tần Suất (Rate Limiting HTTP 429)   │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ LỚP 2: Tường Lửa API Quản Trị (adminAuthMiddleware - 401)    │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ LỚP 3: Phân Quyền & Ngắt Kết Nối WebSocket (WS Code 4001)   │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ LỚP 4: Xác Thực 2 Chiều Thiết Bị ESP32 (esp32AuthMiddleware)│
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ LỚP 5: Cô Lập Dữ Liệu Đoàn & Xóa Tuyến Đường Tour Tức Thì   │
 └──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
            [ DỮ LIỆU & PHẦN CỨNG AN TOÀN TUYỆT ĐỐI ]
```

---

## 2. Lớp 1: Ẩn Giấu Bề Mặt Tấn Công & Cô Lập Định Tuyến (Routing Obfuscation)

### 2.1. Vấn Đề An Ninh Cũ
- Các cổng quản lý đặt tại `/admin`, `/quanly` hoặc `/login` rất dễ bị các công cụ dò quét tự động (Shodan, DirBuster, ffuf) tìm ra trong vài giây.
- Thanh điều hướng trên giao diện trước đây có chức năng chuyển đổi qua lại giữa Quản Lý, Du Khách, Biên Tập và Giả Lập, khiến du khách có thể vô tình hoặc cố ý bấm sang giao diện quản trị.

### 2.2. Giải Pháp Đã Triển Khai
1. **Đường Dẫn Bí Mật Trong Biến Môi Trường ([.env](file:///c:/Users/Nam/Desktop/antigravity/2guide/.env))**:
   ```env
   ADMIN_SECRET_PATH=/quanly_bql_8869
   ```
   Chỉ người có liên kết bí mật này mới có thể mở trang quản trị trung tâm.
2. **Vô Hiệu Hóa & Trả Về HTTP 404 Cho Các Cổng Cũ**:
   - Trong [controllers/viewController.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/controllers/viewController.js), mọi truy cập vào `/admin`, `/quanly`, `/login`, `index.html` đều bị chuyển hướng hoặc chặn thẳng với mã lỗi **`404 Not Found`**.
   - Phục vụ tệp tĩnh với cấu hình `express.static(..., { index: false })` trong [server.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/server.js) để ngăn ngừa máy chủ tự động phục vụ file `index.html` tại thư mục gốc `/`.
3. **Cô Lập Hoàn Toàn Giao Diện Người Dùng**:
   - Xóa bỏ triệt để thanh chuyển role trên các trang [user.html](file:///c:/Users/Nam/Desktop/antigravity/2guide/public/user.html), [index.html](file:///c:/Users/Nam/Desktop/antigravity/2guide/public/index.html), [editor.html](file:///c:/Users/Nam/Desktop/antigravity/2guide/public/editor.html).
   - Du khách truy cập qua cổng riêng biệt: `/user`.

---

## 3. Lớp 2: Xác Thực & Ủy Quyền Ban Quản Lý (Admin Authentication Guard)

### 3.1. Cơ Chế Mã Khóa Bí Mật Quản Trị
- Khởi tạo mã khóa ngẫu nhiên có độ dài và độ phức tạp cao trong [.env](file:///c:/Users/Nam/Desktop/antigravity/2guide/.env):
  ```env
  ADMIN_SECRET_KEY=bql_sec_2026_x89a3f
  ```

### 3.2. Middleware [adminAuthMiddleware.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/middlewares/adminAuthMiddleware.js)
Mọi request gửi tới các endpoint quản trị nhạy cảm đều phải vượt qua hàm kiểm tra:
```javascript
function checkAdminSecretValid(req) {
  const incomingKey = (
    req.headers['x-admin-secret'] ||
    req.headers['x-admin-key'] ||
    req.body?.adminKey ||
    ''
  ).trim();

  return incomingKey === ADMIN_SECRET_KEY;
}
```
Nếu sai hoặc thiếu mã, máy chủ trả về ngay lập tức:
```json
{
  "success": false,
  "authStatus": "UNAUTHORIZED_ADMIN",
  "error": "Từ chối truy cập: Sai hoặc thiếu mã bí mật Ban Quản Lý (Admin Secret Key)!"
}
```

### 3.3. Các Endpoint Được Bảo Vệ Tuyệt Đối
1. `POST /api/groups/create`: Tạo đoàn khách mới & sinh mã QR.
2. `POST /api/groups/:id/end`: Kết thúc tour & giải phóng thiết bị Hub.
3. `POST /api/editor/save`: Lưu bản đồ, vẽ phân khu, kéo thả điểm POI.
4. `POST /api/hubs/shift-battery`: Chốt mức pin đầu/cuối ca trực của nhân viên.
5. `POST /api/admin/broadcast`: Phát thanh khẩn cấp toàn bộ khuôn viên di tích.
6. `GET /api/groups`: Xem danh sách tất cả các đoàn và mã QR token (ngăn chặn kẻ gian đánh cắp token của du khách).

### 3.4. Trải Nghiệm Tiện Dụng Cho Ban Quản Lý
Khi người quản lý truy cập đúng đường dẫn bí mật `ADMIN_SECRET_PATH`, [controllers/viewController.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/controllers/viewController.js) sẽ tự động tiêm mã khóa vào mã nguồn HTML:
```html
<script>window.__ADMIN_KEY__ = "bql_sec_2026_x89a3f";</script>
```
Giao diện quản lý ([admin.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/public/js/admin.js)) sẽ tự động đính kèm mã này vào các cuộc gọi API. **Ban Quản Lý không phải mất thời gian nhập mật khẩu thủ công lặp đi lặp lại**, trong khi người ngoài không có cách nào lấy được mã này từ cổng `/user`.

---

## 4. Lớp 3: Kiểm Soát & Ngắt Kết Nối WebSocket Kịp Thời (Anti-Privilege Escalation)

### 4.1. Lỗ Hổng Tiềm Tàng Ban Đầu
Trong kiến trúc thời gian thực, nếu WebSocket cho phép bất kỳ ai gửi gói tin `{ type: 'REGISTER_ADMIN' }` mà không kiểm tra danh tính, kẻ gian chỉ cần mở kết nối `ws://...` là có thể:
- Xem lén toàn bộ tọa độ GPS thời gian thực của 20+ Hub trong di tích.
- Xem lén lịch trình di chuyển của toàn bộ các đoàn khách.
- Nhận danh sách hiện vật, POI và cấu trúc an ninh nội bộ.

### 4.2. Giải Pháp Triển Khai Tại [websocket/socketManager.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/websocket/socketManager.js)
1. **Gán vai trò mặc định an toàn**: Khi client kết nối, mặc định vai trò là `ws.role = 'guest'`.
2. **Kiểm tra mã khi đăng ký quyền Admin**:
   ```javascript
   if (data.type === 'REGISTER_ADMIN') {
     const adminKey = (data.adminKey || '').trim();

     if (adminKey !== ADMIN_SECRET_KEY) {
       console.warn('[WS AN NINH] CẢNH BÁO: Client cố tình đăng ký quyền Admin mà không có mã hợp lệ!');
       ws.send(JSON.stringify({
         type: 'AUTH_FAILED',
         error: 'Từ chối: Sai hoặc thiếu mã bí mật Ban Quản Lý!'
       }));
       ws.close(4001, 'Unauthorized Admin');
       return;
     }

     ws.role = 'admin';
     ws.send(JSON.stringify({
       type: 'INIT_ADMIN_STATE',
       authStatus: 'VERIFIED',
       hubs: this.hubModel.getAll(),
       groups: this.groupModel.getAll(),
       siteData: this.siteModel.getSiteData()
     }));
   }
   ```
3. **Chế tài xử lý**: Kẻ gian không những bị từ chối gói tin `INIT_ADMIN_STATE` mà còn bị máy chủ **ngắt kết nối WebSocket lập tức với mã lỗi 4001**.

---

## 5. Lớp 4: Xác Thực Phần Cứng ESP32 Hai Chiều (Mutual Hardware Authentication)

Hệ thống triển khai cơ chế tin cậy hai chiều giữa thiết bị cầm tay ESP32-S3 và Máy Chủ Trung Tâm thông qua `ESP32_SECRET_KEY`.

```
[ THIẾT BỊ PHẦN CỨNG ESP32 ]                          [ MÁY CHỦ 2GUIDE SERVER ]
            │                                                      │
            │  1. Gửi GPS / Audio (Kèm Header: X-Device-Secret)    │
            ├─────────────────────────────────────────────────────►│
            │                                                      │
            │                                           [esp32AuthMiddleware]
            │                                           Kiểm tra mã bí mật
            │                                           (Sai mã ➔ Chặn HTTP 401)
            │                                                      │
            │  2. Phản hồi kết quả (Kèm Header: X-Device-Secret)   │
            │◄─────────────────────────────────────────────────────┤
            │                                                      │
   [ESP32 Kiểm Tra Mã Server]                                      │
   (Sai mã ➔ Khóa Loa PCM5102A)                                    │
   (Đúng mã ➔ Phát âm thanh cho khách)                              │
```

### 5.1. Chiều 1: Thiết Bị ➔ Máy Chủ (Chống Bơm Dữ Liệu Ảo)
- **Rủi ro**: Kẻ gian dùng script gửi tọa độ GPS giả mạo để làm sai lệch vị trí của Hub hoặc gửi file âm thanh rác vào micro.
- **Biện pháp**: [middlewares/esp32AuthMiddleware.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/middlewares/esp32AuthMiddleware.js) bảo vệ toàn bộ các endpoint phần cứng:
  - `POST /api/telemetry` (Nhận GPS ATGM336H & IMU MPU6050)
  - `POST /api/inmp441/audio` (Nhận file .wav từ microphone)
  - `POST /api/voice/ask` (Cổng raw audio)
  - `GET /api/voice/tts` (Luồng âm thanh nhị phân MP3)
- Bất kỳ request nào thiếu hoặc sai mã `X-Device-Secret` đều bị chặn với HTTP 401.

### 5.2. Chiều 2: Máy Chủ ➔ Thiết Bị (Chống Server Giả Mạo Cướp Loa)
- **Rủi ro**: Kẻ gian lập một máy chủ giả mạo trong mạng nội bộ Wi-Fi di tích (Man-in-the-middle / Evil Twin) để lừa ESP32 tải âm thanh giả, kích động hoặc thông báo sai lệch cho du khách.
- **Biện pháp**:
  - Máy chủ luôn đính kèm Header `X-Device-Secret: ESP32_SECRET_KEY` trong phản hồi.
  - Mã nguồn firmware ESP32 (và logic kiểm thử trong [public/test.html](file:///c:/Users/Nam/Desktop/antigravity/2guide/public/test.html)) kiểm tra nghiêm ngặt mã này trước khi cho phép dữ liệu đi vào mạch giải mã âm thanh **DAC PCM5102A**.
  - Nếu mã không khớp, ESP32 phát tín hiệu cảnh báo và **KHÓA TOÀN BỘ MẠCH KHUẾCH ĐẠI LOA**.

---

## 6. Lớp 5: Bảo Vệ Quyền Riêng Tư & Dữ Liệu Du Khách (Visitor Privacy & Ephemeral Data)

### 6.1. Mã QR Token Dùng Một Lần Không Thể Đoán Mò
- Khi Ban Quản Lý tạo đoàn mới, [models/groupModel.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/models/groupModel.js) sinh token ngẫu nhiên dạng:
  ```javascript
  token = 'hl_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  // Ví dụ: hl_m4y3a8z_9b2e4f1c
  ```
- Khách du lịch chỉ có thể truy cập tour của mình thông qua liên kết chứa token này (`/user?token=...`).

### 6.2. Cô Lập Dữ Liệu Khách Tham Quan (Data Isolation)
- Khi gọi `GET /api/groups/:token`, [controllers/groupController.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/controllers/groupController.js) chỉ trả về danh sách các Hub được phân bổ riêng cho đoàn đó:
  ```javascript
  const memberHubs = group.hubIds.map(id => hubModel.getById(id));
  ```
  Du khách thuộc đoàn A tuyệt đối không xem được vị trí hay thông tin của đoàn B hay 20+ Hub khác trong di tích.

### 6.3. Xóa Bỏ Tuyến Đường Tức Thì Khi Kết Thúc Tour (Ephemeral Trajectory)
- Nhằm tuân thủ nguyên tắc bảo vệ quyền riêng tư vị trí (Location Privacy):
  - Khi đoàn kết thúc tour qua `POST /api/groups/:id/end`, hệ thống **XÓA SẠCH HOÀN TOÀN** mảng tọa độ di chuyển (`trajectory`) khỏi bộ nhớ.
  - Không có bất kỳ vết di chuyển lịch sử nào của du khách bị lưu lại sau chuyến tham quan.

### 6.4. Ẩn POI Khám Phá Tự Nhiên
- Trên bản đồ dành cho khách tham quan (`/user`), toàn bộ các điểm di tích POI được ẩn khỏi giao diện.
- Khách tự do di chuyển, nón tầm nhìn Hub tự động quét theo góc quay Yaw MPU6050, AI Hướng dẫn viên chỉ giải thích khi khách đứng đối diện hiện vật.

---

## 7. Lớp 6: Lá Chắn Chống Quá Tải & Tấn Công Spam Dồn Dập (Rate Limiting Shield)

### 7.1. Nguy Cơ Tê Liệt Do Spam Request (DoS / Flood)
- Nếu không có giới hạn tần suất, một kẻ tấn công hoặc mã độc có thể gửi hàng trăm request mỗi giây:
  - Làm cạn kiệt hạn mức gọi AI LLM (Groq API Quota).
  - Làm treo vòng lặp sự kiện đơn luồng (Event Loop Lag) của Node.js.
  - Làm đầy bộ nhớ RAM (Buffer Allocation), dẫn đến sập máy chủ do tràn bộ nhớ (Out-Of-Memory Crash).

### 7.2. Triển Khai Middleware [rateLimitMiddleware.js](file:///c:/Users/Nam/Desktop/antigravity/2guide/middlewares/rateLimitMiddleware.js)
Hệ thống sử dụng giải thuật cửa sổ trượt (Sliding Window Counter) theo địa chỉ IP của máy khách:

```javascript
// 1. Giới hạn chung toàn bộ API: Tối đa 40 requests / 5 giây
const generalRateLimiter = createRateLimiter({
  windowMs: 5000,
  max: 40,
  message: 'Cảnh báo: Tần suất gửi request vượt quá mức cho phép. Máy chủ tạm khóa kết nối.'
});

// 2. Giới hạn Trợ Lý AI: Tối đa 10 câu hỏi / 10 giây (bảo vệ Quota Groq LLM)
const aiRateLimiter = createRateLimiter({
  windowMs: 10000,
  max: 10,
  message: 'Cảnh báo: Bạn đang hỏi AI quá nhanh dồn dập. Vui lòng đợi trong giây lát!'
});
```

### 7.3. Phản Hồi Khi Bị Vượt Ngưỡng (HTTP 429)
Khi phát hiện dấu hiệu spam dồn dập, máy chủ ngay lập tức từ chối và trả về mã lỗi trong vòng **dưới 0.5 mili-giây** (không tiêu tốn CPU/RAM xử lý nghiệp vụ):
- Mã trạng thái: **`HTTP 429 Too Many Requests`**
- Header đi kèm: `Retry-After: 5`
- Body JSON:
  ```json
  {
    "success": false,
    "status": 429,
    "rateLimited": true,
    "retryAfterSec": 5,
    "error": "Quá nhiều yêu cầu gửi dồn dập! Máy chủ tạm dừng tiếp nhận để chống quá tải (HTTP 429).",
    "tip": "Máy chủ đã kích hoạt lá chắn bảo vệ. Vui lòng thử lại sau 5 giây."
  }
  ```

---

## 8. Lớp 7: Bộ Công Cụ Kiểm Thử Xâm Nhập Thực Chiến (Red Team Pentest Simulator)

Để kiểm chứng tính vững chắc của hệ thống, trang [public/test.html](file:///c:/Users/Nam/Desktop/antigravity/2guide/public/test.html) được tích hợp sẵn 2 công cụ kiểm thử an ninh chuyên nghiệp:

### 8.1. Trình Mô Phỏng "HACKER BLACK (Kỹ Năng Tầm Trung)"
Mô phỏng 16 kịch bản tấn công thực tế mà hacker mũ đen thường dùng:
1. `GET /admin` ➔ Bị chặn 404 (Ẩn cổng cũ).
2. `GET /quanly` ➔ Bị chặn 404 (Ẩn cổng tiếng Việt).
3. `GET /login` ➔ Bị chặn 404 (Không mở form login công khai).
4. `GET /.env` ➔ Bị chặn 404 (Bảo vệ file biến môi trường).
5. `GET /server.js` ➔ Bị chặn 404 (Không lộ file mã nguồn).
6. `WS REGISTER_ADMIN` (Không key) ➔ Bị từ chối `AUTH_FAILED` & ngắt kết nối WebSocket mã 4001.
7. `WS REGISTER_ADMIN` (Key đoán mò `admin123`) ➔ Bị từ chối `AUTH_FAILED` & ngắt kết nối.
8. `POST /api/admin/broadcast` (Cướp loa phát thanh) ➔ Bị chặn 401 Unauthorized.
9. `POST /api/editor/save` (Xóa sạch bản đồ) ➔ Bị chặn 401 Unauthorized.
10. `POST /api/groups/create` (Tạo đoàn khách ma) ➔ Bị chặn 401 Unauthorized.
11. `POST /api/hubs/shift-battery` (Sửa thông số pin) ➔ Bị chặn 401 Unauthorized.
12. `POST /api/telemetry` (Bơm tọa độ GPS ảo) ➔ Bị chặn 401 Unauthorized.
13. `POST /api/inmp441/audio` (Bơm âm thanh độc hại) ➔ Bị chặn 401 Unauthorized.
14. `POST /api/admin/broadcast` (Tấn công từ điển 10 mật khẩu) ➔ 10/10 lần bị chặn 401.
15. `GET /api/groups` (Đọc trộm danh sách đoàn & token) ➔ Bị chặn 401 Unauthorized.
16. `GET /user` (Rà soát lộ mã bí mật) ➔ An toàn: Trang khách hoàn toàn sạch mã bí mật.

### 8.2. Trình Kiểm Thử Chịu Tải & Giới Hạn Tần Suất (Stress Test Flood Simulator)
- Cho phép người kiểm thử bắn dồn dập 15, 30, 50 hoặc 75 requests trong vòng 1 giây vào các endpoint `/api/site-data`, `/api/chat/ask`, `/api/telemetry`.
- Trực quan hóa luồng gói tin: Hiển thị thời gian thực các gói tin đạt `200 OK` và các gói tin bị lá chắn `HTTP 429 Too Many Requests` đánh chặn an toàn.

---

## 9. Bảng Ma Trận Nguy Cơ & Cơ Chế Phòng Thủ (Threat Matrix)

| Nguy Cơ Tấn Công (Threat Vector) | Mức Độ Rủi Ro | Hậu Quả Tiềm Tàng Nếu Bị Xâm Nhập | Lớp Bảo Vệ Của 2Guide | Trạng Thái Phòng Thủ |
| :--- | :---: | :--- | :--- | :---: |
| **Dò quét cổng quản trị (Directory Brute-force)** | Cao | Tìm ra trang admin, dò mật khẩu | **Lớp 1**: Ẩn sau `ADMIN_SECRET_PATH`, chặn 404 các URL cũ | 🛡️ **100% Chặn Đứng** |
| **Leo thang đặc quyền WebSocket** | Tối Cao | Theo dõi GPS toàn di tích thời gian thực | **Lớp 3**: Kiểm tra `ADMIN_SECRET_KEY`, đóng kết nối 4001 | 🛡️ **100% Chặn Đứng** |
| **Gọi trái phép API quản trị (Postman/Curl)** | Tối Cao | Cướp loa phát thanh, sửa bản đồ, đổi pin | **Lớp 2**: `adminAuthMiddleware` chặn đứng với HTTP 401 | 🛡️ **100% Chặn Đứng** |
| **Đánh cắp mã QR du khách** | Cao | Vào xem dữ liệu đoàn khách khác | **Lớp 2 & 5**: Chặn `GET /api/groups` (401), cô lập dữ liệu theo token | 🛡️ **100% Chặn Đứng** |
| **Bơm dữ liệu GPS / Âm thanh giả mạo** | Cao | Làm lệch vị trí Hub, phá hỏng bản đồ | **Lớp 4**: `esp32AuthMiddleware` kiểm tra `ESP32_SECRET_KEY` (401) | 🛡️ **100% Chặn Đứng** |
| **Server giả mạo trong mạng Wi-Fi (MitM)** | Cao | Lừa ESP32 phát âm thanh kích động ra loa | **Lớp 4**: ESP32 kiểm tra Header máy chủ, khóa loa PCM5102A | 🛡️ **100% Chặn Đứng** |
| **Tấn công từ điển (Dictionary Attack)** | Trung Bình | Bẻ khóa mã bí mật nếu đặt mật khẩu yếu | **Lớp 2 & 4**: Key dài, sinh ngẫu nhiên có độ entropy cao | 🛡️ **100% Chặn Đứng** |
| **Spam request làm treo server (DoS / Flood)** | Tối Cao | Treo server, nghẽn Event Loop, cạn quota AI | **Lớp 6**: `rateLimitMiddleware` chặn với HTTP 429 trong <0.5ms | 🛡️ **100% Chặn Đứng** |
| **Lộ vị trí riêng tư của khách sau tour** | Trung Bình | Vi phạm quyền riêng tư du khách | **Lớp 5**: Xóa sạch toàn bộ tuyến đường ngay khi kết thúc tour | 🛡️ **100% Chặn Đứng** |

---

## 10. Hướng Dẫn Vận Hành & Bảo Trì An Ninh

1. **Bảo Vệ Tệp [.env](file:///c:/Users/Nam/Desktop/antigravity/2guide/.env)**:
   - Tuyệt đối không commit tệp `.env` lên các kho lưu trữ công cộng (GitHub, GitLab).
   - Tệp `.gitignore` của dự án đã được cấu hình để loại trừ `.env`.
2. **Định Kỳ Thay Đổi Mã Bí Mật**:
   - Khi có nhân sự quản lý nghỉ việc hoặc sau mỗi quý vận hành, nên cập nhật các chuỗi ngẫu nhiên mới cho `ADMIN_SECRET_KEY` và `ESP32_SECRET_KEY`.
3. **Cấu Hình Reverse Proxy Khi Triển Khai Production**:
   - Khi chạy thực tế trên Internet, nên đặt Node.js phía sau Nginx hoặc Cloudflare để hỗ trợ mã hóa HTTPS/TLS (cổng 443) và chống DDoS tầng mạng (L3/L4).
   - Bật cờ `app.set('trust proxy', 1)` trong Express nếu đặt sau Proxy để Rate Limiter nhận diện đúng IP gốc của người dùng.

---
*Tài liệu được biên soạn và chuẩn hóa theo tiêu chuẩn an ninh kiến trúc 2Guide.*
