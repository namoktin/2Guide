# 2Guide - Sơ Đồ Cấu Trúc Kiến Trúc MVC (Model - View - Controller)

Tài liệu hướng dẫn chi tiết về cấu trúc mã nguồn, phân tầng trách nhiệm, luồng dữ liệu và danh mục API của hệ thống **2Guide** (Hệ thống quản lý thiết bị Hub, theo dõi đoàn khách tham quan di tích và trợ lý ảo AI không gian).

---

## 1. Cây Cấu Trúc Thư Mục Hệ Thống

```
2guide/
├── config/                         # Cấu hình toàn cục & biến môi trường
│   └── appConfig.js                # Đọc .env, cổng PORT, mã bí mật, hàm chuẩn hóa Hub ID
│
├── models/                         # [MODEL] Quản lý dữ liệu thực thể & đồng bộ DB
│   ├── hubModel.js                 # Quản lý 20+ Hub, telemetry GPS/IMU, chốt mức pin ca
│   ├── groupModel.js               # Quản lý Đoàn khách, sinh QR Token, lưu & dọn dẹp vết di chuyển
│   └── siteModel.js                # Quản lý Bản đồ di tích, POI, Hiện vật, Phân khu & Tuyến đường
│
├── views/ (public/)                # [VIEW] Giao diện người dùng & quản trị viên
│   ├── user.html                   # Giao diện khách tham quan quét QR (/user)
│   ├── index.html                  # Giao diện Ban quản lý di tích (ADMIN_SECRET_PATH)
│   ├── simulate.html               # Bộ giả lập di chuyển tuyến tính & pin Hub (/simulate)
│   ├── editor.html                 # Map Studio biên tập bản đồ & hiện vật (/editor)
│   ├── test.html                   # Trạm kiểm thử độc lập phần cứng ESP32 (/test.html)
│   ├── css/
│   │   └── style.css               # Phong cách giao diện dark theme chuyên nghiệp
│   └── js/
│       ├── user.js                 # Logic khách tham quan (Bản đồ Leaflet, Nón tầm nhìn, Chat AI)
│       ├── admin.js                # Logic điều hành (Giám sát 20 Hub, heatmap, phát thanh khẩn cấp)
│       ├── editor.js               # Logic Map Studio (Vẽ đa giác phân khu, kéo thả ghim POI)
│       ├── simulate.js             # Logic giả lập di chuyển & gửi telemetry
│       └── map-common.js           # Tiện ích bản đồ chung (Tùy biến Leaflet icons, markers)
│
├── controllers/                    # [CONTROLLER] Xử lý nghiệp vụ & điều phối dữ liệu
│   ├── viewController.js           # Điều hướng trả về trang HTML, chuyển hướng 301/302, chặn 404
│   ├── hubController.js            # Tiếp nhận telemetry GPS/IMU, lấy danh sách Hub, chốt pin
│   ├── groupController.js          # Tạo đoàn khách, sinh mã QR, cô lập dữ liệu đoàn, kết thúc tour
│   ├── siteController.js           # Lấy dữ liệu di tích, lưu dữ liệu biên tập từ Map Studio
│   ├── voiceAiController.js        # Xử lý âm thanh mic INMP441, Whisper STT, Groq LLM & TTS PCM5102A
│   ├── deviceAuthController.js     # Xác thực bảo mật hai chiều mã bí mật ESP32
│   └── adminController.js          # Can thiệp luồng tín hiệu, phát thanh khẩn cấp toàn bộ Hub
│
├── middlewares/                    # [MIDDLEWARES] Bộ lọc an ninh & tiền xử lý request
│   ├── adminAuthMiddleware.js      # Xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY) cho REST & WS
│   ├── esp32AuthMiddleware.js      # Xác thực mã bí mật ESP32 hai chiều (X-Device-Secret)
│   └── uploadMiddleware.js         # Multer xử lý file âm thanh nhị phân .wav (10MB)
│
├── routes/                         # [ROUTES] Định tuyến yêu cầu HTTP đến Controllers
│   ├── viewRoutes.js               # Định tuyến các trang giao diện HTML
│   ├── apiRoutes.js                # Định tuyến toàn bộ REST APIs (/api/...)
│   └── index.js                    # Master Router gắn kết các router vào ứng dụng Express
│
├── websocket/                      # [WEBSOCKET] Quản lý kết nối thời gian thực
│   └── socketManager.js            # Phân quyền vai trò (Admin / Khách), broadcast vị trí realtime
│
├── services/                       # [SERVICES] Dịch vụ bên ngoài & lưu trữ bền vững
│   ├── dbService.js                # Kết nối MongoDB Atlas & fallback lưu trữ local db_store.json
│   └── groqGuideService.js         # Trợ lý AI Hướng dẫn viên nhận thức không gian & lịch sử
│
├── data/                           # [DATA] Dữ liệu nguồn & tệp sao lưu
│   ├── siteData.js                 # Dữ liệu thực địa bản đồ di tích Trường ĐH Kinh Tế Quốc Dân (NEU)
│   └── db_store.json               # Bộ nhớ đệm lưu bền vững Hubs & Groups
│
├── .env                            # Biến môi trường bí mật (Port, MongoDB URI, Groq Key, Secret Key)
├── package.json                    # Cấu hình dự án Node.js & danh mục thư viện
└── server.js                       # Điểm khởi chạy hệ thống (Entry Point tinh gọn ~70 dòng)
```

---

## 2. Bảng Tổng Quan Các Tầng Kiến Trúc MVC

| Tầng Kiến Trúc | Thư Mục / File Đại Diện | Vai Trò & Nhiệm Vụ Cốt Lõi | Thành Phần Liên Kết |
| :--- | :--- | :--- | :--- |
| **ENTRY POINT** | `server.js` | Khởi động Express & HTTP Server, nạp middleware, khởi tạo Database & WebSocket | `appConfig`, `routes`, `socketManager`, `dbService` |
| **CONFIG** | `config/appConfig.js` | Nạp biến môi trường, định nghĩa hằng số hệ thống, hàm chuẩn hóa Hub ID | Toàn bộ ứng dụng |
| **MODEL** | `models/` | Quản lý cấu trúc dữ liệu, trạng thái in-memory, nghiệp vụ thực thể & đồng bộ DB | `dbService`, Controllers |
| **VIEW** | `public/` (views) | Cung cấp giao diện trực quan cho du khách, ban quản trị, kỹ thuật viên và tester | `viewController`, `viewRoutes` |
| **CONTROLLER** | `controllers/` | Tiếp nhận request, xác thực dữ liệu, gọi Model, AI, WebSocket và trả về response | Models, Routes, Services, WebSocket |
| **MIDDLEWARE** | `middlewares/` | Xác thực an ninh hai chiều cho phần cứng ESP32, xử lý upload file nhị phân | Routes, Controllers |
| **ROUTE** | `routes/` | Khai báo toàn bộ đường dẫn HTTP REST APIs và điều hướng trang web | Controllers, Middlewares |
| **WEBSOCKET** | `websocket/socketManager.js` | Quản lý kết nối hai chiều, phân quyền role, truyền phát telemetry trực tiếp | Controllers, Models |
| **SERVICES** | `services/` | Kết nối AI Cloud (Groq Whisper + LLM) và hệ quản trị cơ sở dữ liệu MongoDB Atlas | Controllers, Models |

---

## 3. Bảng Chi Tiết Từng Thành Phần Trong Hệ Thống

### 3.1. Tầng MODEL (Dữ Liệu & Thực Thể Nghiệp Vụ)

| Tên Model | Đường Dẫn File | Trách Nhiệm Dữ Liệu | Các Phương Thức (Methods) Chính |
| :--- | :--- | :--- | :--- |
| **HubModel** | `models/hubModel.js` | Quản lý 20+ thiết bị Hub, tọa độ GPS ATGM336H, góc quay IMU MPU6050, mức pin ca, trạng thái online | • `init(savedHubs, siteCenter)`: Nạp danh sách 20 Hub<br>• `getAll()`: Lấy mảng toàn bộ Hub<br>• `getById(id)`: Lấy thông tin Hub theo mã chuẩn<br>• `findOrCreate(id)`: Tìm hoặc tạo Hub mới<br>• `updateTelemetry(id, data)`: Cập nhật GPS, IMU, Pin<br>• `updateShiftBattery(shiftType, records)`: Chốt pin ca<br>• `setGroupId(hubId, groupId)`: Gán hoặc rời đoàn |
| **GroupModel** | `models/groupModel.js` | Quản lý các đoàn khách, sinh token bảo mật không trùng lặp, tạo QR dùng 1 lần, lưu vết di chuyển tạm thời | • `createGroup(...)`: Sinh token `hl_<time>_<hex>`, ảnh QR base64, gắn Hubs vào đoàn<br>• `getByIdOrToken(id)`: Tìm đoàn theo groupId hoặc mã token<br>• `recordTrajectory(groupId, hubId, lat, lng)`: Ghi nhận vết di chuyển<br>• `endGroup(id, hubModel)`: Kết thúc tour, **xóa sạch toàn bộ tuyến đường**, giải phóng Hub |
| **SiteModel** | `models/siteModel.js` | Quản lý thông tin di tích: Tâm bản đồ, POIs, Hiện vật lịch sử, Phân khu đa giác & Tuyến tham quan | • `getSiteData()`: Lấy dữ liệu di tích hoàn chỉnh<br>• `getCenter()`: Lấy tọa độ trung tâm khuôn viên<br>• `saveSiteData(data, dbService)`: Ghi đè file `data/siteData.js` và đồng bộ MongoDB Atlas |

---

### 3.2. Tầng CONTROLLER (Xử Lý Nghiệp Vụ)

| Tên Controller | Đường Dẫn File | Chức Năng Nghiệp Vụ | Các Endpoint REST API Phụ Trách |
| :--- | :--- | :--- | :--- |
| **ViewController** | `controllers/viewController.js` | Điều hướng trang HTML, chuyển hướng 301/302, bảo vệ đường dẫn bí mật BQL, chặn 404 cổng cũ | • `GET /user` ➔ `user.html`<br>• `GET ADMIN_SECRET_PATH` ➔ `index.html`<br>• `GET /simulate` ➔ `simulate.html`<br>• `GET /editor` ➔ `editor.html`<br>• Chặn 404: `/admin`, `/quanly`, `/index.html` |
| **HubController** | `controllers/hubController.js` | Tiếp nhận telemetry từ phần cứng ESP32, phát sóng realtime tới client, chốt mức pin ca hành chính | • `GET /api/hubs`: Lấy danh sách toàn bộ Hub<br>• `GET /api/hubs/:hubId/info`: Lấy thông tin Hub & thành viên<br>• `POST /api/telemetry`: Ghi nhận GPS/IMU (Yêu cầu mã bí mật)<br>• `POST /api/hubs/shift-battery`: Chốt pin đầu/cuối ca |
| **GroupController** | `controllers/groupController.js` | Tạo đoàn khách, sinh mã QR, cô lập dữ liệu chỉ cho người cùng đoàn xem, kết thúc tour và dọn dẹp | • `GET /api/groups`: Danh sách các đoàn<br>• `POST /api/groups/create`: Tạo đoàn mới & sinh QR Code<br>• `GET /api/groups/:identifier`: Chi tiết đoàn theo Token<br>• `POST /api/groups/:identifier/end`: Kết thúc tour |
| **SiteController** | `controllers/siteController.js` | Cung cấp dữ liệu địa lý cho bản đồ và lưu lại các thay đổi vẽ phân khu/kéo thả hiện vật từ Map Studio | • `GET /api/site-data`: Tải dữ liệu di tích<br>• `POST /api/editor/save`: Lưu bản đồ, POI, hiện vật |
| **VoiceAiController** | `controllers/voiceAiController.js` | Xử lý âm thanh INMP441, Whisper STT, Groq AI LLM giải thích lịch sử & định hướng, tạo luồng TTS MP3 | • `POST /api/chat/ask`: Hỏi đáp văn bản trên web<br>• `POST /api/inmp441/audio`: Nhận file .wav từ ESP32<br>• `POST /api/voice/ask`: Nhận raw audio tương thích<br>• `GET /api/voice/tts`: Luồng MP3 cho DAC PCM5102A |
| **DeviceAuthController** | `controllers/deviceAuthController.js` | Xác thực bảo mật hai chiều giữa thiết bị phần cứng ESP32 và máy chủ Server (kiểm thử test.html) | • `ALL /api/device/verify`: Xác minh mã bí mật thiết bị |
| **AdminController** | `controllers/adminController.js` | Can thiệp luồng tín hiệu và phát âm thanh/thông báo khẩn cấp tới các Hub hoặc theo đoàn | • `POST /api/admin/broadcast`: Phát thông điệp khẩn cấp |

---

### 3.3. Tầng VIEW (Giao Diện Client)

| Tên Trang View | Đường Dẫn File | Đối Tượng Sử Dụng | Tính Năng Hiển Thị Nổi Bật |
| :--- | :--- | :--- | :--- |
| **Cổng Khách Tham Quan** | `public/user.html`<br>`public/js/user.js` | Du khách quét mã QR (`/user?token=...`) | Vị trí người dùng, nón tầm nhìn 360° theo góc Yaw MPU6050, phân khu, tuyến đường, trợ lý AI, ẩn POI để tạo trải nghiệm tự nhiên |
| **Cổng Ban Quản Lý** | `public/index.html`<br>`public/js/admin.js` | Ban quản lý di tích (`ADMIN_SECRET_PATH`) | Giám sát 20 Hub realtime, giám sát tuyến đường di chuyển trong phiên, tạo mã QR đoàn, phát thanh khẩn cấp |
| **Map Studio Biên Tập** | `public/editor.html`<br>`public/js/editor.js` | Kỹ thuật viên di tích (`/editor`) | Kéo thả tạo POI, hiện vật, vẽ đa giác phân khu (Polygon), vẽ tuyến tham quan và lưu bền vững |
| **Trạm Giả Lập Tín Hiệu** | `public/simulate.html`<br>`public/js/simulate.js` | Thử nghiệm vận hành (`/simulate`) | Giả lập Hub di chuyển tuyến tính thẳng một mạch, tự động quay góc Yaw, tự động gửi telemetry mỗi 1s |
| **Trạm Kiểm Thử Phần Cứng** | `public/test.html` | Kỹ sư phần cứng & Tester (Độc lập, mở bằng đúp chuột) | Giả lập module ATGM336H (GPS), MPU6050 (La bàn), INMP441 (Mic), DAC PCM5102A (Loa), test bảo mật ESP32 2 chiều & **bộ mô phỏng tấn công thực chiến Hacker Black (16 vectors)** |

---

### 3.4. Tầng MIDDLEWARE & AN NINH (Bảo Vệ Hệ Thống)

| Tên Module | Đường Dẫn File | Trách Nhiệm Bảo Mật |
| :--- | :--- | :--- |
| **adminAuthMiddleware** | `middlewares/adminAuthMiddleware.js` | • Kiểm tra mã `ADMIN_SECRET_KEY` từ header `X-Admin-Secret` / `X-Admin-Key` hoặc body `adminKey`.<br>• Bảo vệ 5 endpoint POST quản trị (`/api/groups/create`, `/api/groups/:id/end`, `/api/editor/save`, `/api/hubs/shift-battery`, `/api/admin/broadcast`).<br>• Trả về HTTP 401 Unauthorized nếu sai hoặc thiếu mã bí mật. |
| **esp32AuthMiddleware** | `middlewares/esp32AuthMiddleware.js` | • Kiểm tra mã `ESP32_SECRET_KEY` từ header `X-Device-Secret` hoặc body `secretKey`.<br>• Từ chối ngay lập tức với HTTP 401 nếu sai/thiếu mã (chống kẻ gian đẩy telemetry bịp).<br>• Đính kèm `X-Device-Secret` vào phản hồi để ESP32 xác minh máy chủ chính chủ trước khi phát âm thanh ra loa PCM5102A. |
| **uploadMiddleware** | `middlewares/uploadMiddleware.js` | Cấu hình Multer nhận file âm thanh nhị phân WAV trong bộ nhớ RAM (MemoryStorage), giới hạn kích thước an toàn 10MB. |

---

## 4. Sơ Đồ Luồng Dữ Liệu Tương Tác (Data Flow)

### 4.1. Luồng Gửi Telemetry (GPS ATGM336H & IMU MPU6050)
```
[ESP32 / test.html]
       │
       │ HTTP POST /api/telemetry (Kèm Header: X-Device-Secret)
       ▼
[esp32AuthMiddleware] ──(Sai mã)──► Trả về HTTP 401 Unauthorized (Từ chối)
       │ (Đúng mã)
       ▼
[hubController.updateTelemetry]
       │
       ├──► [hubModel]: Cập nhật tọa độ, góc Yaw, mức Pin
       ├──► [groupModel]: Nếu đang trong tour ➔ Ghi nhận vết tuyến đường tạm thời
       ├──► [socketManager]: Phát sóng realtime WebSocket
       │         ├──► Ban Quản Lý (admin.js) ➔ Cập nhật bản đồ giám sát
       │         └──► Khách Cùng Đoàn (user.js) ➔ Cập nhật nón tầm nhìn
       └──► [dbService]: Lên lịch lưu bền vững vào MongoDB Atlas
```

### 4.2. Luồng Xử Lý Âm Thanh AI & Phát Loa DAC PCM5102A
```
[Microphone INMP441 trên ESP32]
       │
       │ HTTP POST /api/inmp441/audio (File WAV + X-Device-Secret)
       ▼
[esp32AuthMiddleware] (Kiểm duyệt an ninh thiết bị)
       │
       ▼
[voiceAiController]
       │
       ├── 1. Gửi âm thanh tới Groq Whisper STT ➔ Chuyển thành văn bản câu hỏi
       ├── 2. Gửi văn bản + Tọa độ + Góc nhìn tới [groqGuideService]
       │      └──> Phân tích Point-in-Polygon (Đang đứng khu nào)
       │      └──> Phân tích góc Yaw (Trước mặt, bên trái, bên phải có gì)
       │      └──> Tra cứu tri thức lịch sử chuyên sâu NEU ➔ Tạo câu trả lời
       ├── 3. Sinh URL Text-To-Speech (TTS) hoặc Direct Binary MP3
       │
       ▼
[Phản Hồi Về ESP32] (Đính kèm Header: X-Device-Secret)
       │
       ▼
[ESP32 Kiểm Tra Mã Bí Mật Phản Hồi]
       ├── (Sai / Thiếu mã): Cảnh báo Server giả mạo ➔ KHÓA LOA PCM5102A
       └── (Đúng mã): Xác minh Server chính chủ ➔ Đẩy dữ liệu vào DAC PCM5102A phát âm thanh cho du khách
```

### 4.3. Luồng Khách Quét Mã QR Truy Cập Tham Quan
```
[Du Khách Quét Mã QR Đoàn]
       │
       │ URL: /user?token=hl_xxxxxxxx_xxxx
       ▼
[viewRoutes] ➔ [viewController] ➔ Trả về user.html
       │
       ▼
[user.js Khởi Chạy]
       │
       ├── Gọi API: GET /api/groups/:token ➔ [groupController]
       │      └──> Xác thực token hợp lệ ➔ CÔ LẬP DỮ LIỆU chỉ trả về danh sách Hub thuộc đoàn
       └── Kết nối WebSocket: REGISTER_USER (kèm myHubId & groupId)
              └──> Nhận luồng cập nhật tọa độ thành viên đoàn & chỉ dẫn đường đi
```

### 4.4. Luồng Xác Thực Ban Quản Lý (Admin WebSocket & REST APIs)
```
[Ban Quản Lý Truy Cập URL Bí Mật: ADMIN_SECRET_PATH]
       │
       ▼
[viewController.renderAdmin / renderEditor]
       │
       └──> Tự động tiêm: window.__ADMIN_KEY__ = ADMIN_SECRET_KEY vào <head>
       │
       ├──► [Kết nối WebSocket]: Gửi { type: 'REGISTER_ADMIN', adminKey: window.__ADMIN_KEY__ }
       │         │
       │         ├── (Sai / Thiếu key) ➔ Server gửi AUTH_FAILED & NGẮT KẾT NỐI (Code 4001)
       │         └── (Đúng key)        ➔ Gán ws.role = 'admin', gửi INIT_ADMIN_STATE giám sát toàn khu
       │
       └──► [Gọi REST POST Quản Trị]: (Tạo đoàn, Hủy đoàn, Chốt pin, Phát loa, Lưu bản đồ)
                 │ Tự động đính kèm Header: X-Admin-Secret: window.__ADMIN_KEY__
                 ▼
            [adminAuthMiddleware]
                 ├── (Sai / Thiếu key) ➔ HTTP 401 Unauthorized (Chặn hacker / Postman ngoài luồng)
                 └── (Đúng key)        ➔ Cho phép thực thi nghiệp vụ Controller
```

---

## 5. Danh Mục Cổng Truy Cập Hệ Thống

| Tên Cổng Truy Cập | Đường Dẫn URL Mặc Định | Cơ Chế Bảo Mật & Phân Quyền |
| :--- | :--- | :--- |
| **Cổng Khách Tham Quan** | `http://localhost:4000/user` | Quét mã QR đoàn dùng 1 lần (`/user?token=...`), chuyển hướng 301 từ `user.html`, KHÔNG bao giờ lộ mã quản trị |
| **Cổng Ban Quản Lý Di Tích** | `http://localhost:4000/quanly_bql_8869` | Ẩn sau đường dẫn bí mật cấu hình trong [.env](file:///c:/Users/Nam/Desktop/antigravity/2guide/.env) (`ADMIN_SECRET_PATH`), tự động cấp quyền qua `ADMIN_SECRET_KEY`, chặn 404 cổng `/admin` và `/quanly` cũ |
| **Studio Biên Tập Bản Đồ** | `http://localhost:4000/editor` | Cổng chuyên dụng cho kỹ thuật viên tạo vùng phân khu, POI, hiện vật; các lệnh lưu được bảo vệ bằng `ADMIN_SECRET_KEY` |
| **Bộ Giả Lập Tín Hiệu** | `http://localhost:4000/simulate` | Giả lập di chuyển tuyến tính và góc nhìn kiểm thử hệ thống |
| **Trạm Kiểm Thử Phần Cứng** | `http://localhost:4000/test.html` | Hoạt động độc lập, kích đúp chuột mở trực tiếp hoặc qua web server, có cấu hình test mã bí mật ESP32 |

