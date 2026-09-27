# 2Guide - Tổng Hợp Toàn Bộ Tính Năng Hệ Thống (System Features)

> **Dự án**: Nền Tảng Quản Lý Hub Phần Cứng & Trợ Lý Tham Quan Di Tích Thông Minh (2Guide)  
> **Kiến trúc**: Mô hình MVC (Model - View - Controller) & Phòng thủ đa tầng (Defense-in-Depth)  
> **Địa bàn thực tế**: Trường Đại Học Kinh Tế Quốc Dân (NEU)  
> **Công nghệ lõi**: Node.js, Express, WebSocket (ws), MongoDB Atlas, Groq Cloud AI, Web Audio HRTF 3D, Leaflet GIS, ESP32 Phần Cứng.

---

## MỤC LỤC

1. [Phân Hệ Thiết Bị Cầm Tay & Phần Cứng ESP32](#1-phân-hệ-thiết-bị-cầm-tay--phần-cứng-esp32)
2. [Công Nghệ Âm Thanh Không Gian 3D (Spatial Audio HRTF)](#2-công-nghệ-âm-thanh-không-gian-3d-spatial-audio-hrtf)
3. [Nón Tầm Nhìn & Khóa Mục Tiêu Hiện Vật (Vision Cone & Auto Gaze)](#3-nón-tầm-nhìn--khóa-mục-tiêu-hiện-vật-vision-cone--auto-gaze)
4. [Trợ Lý Ảo Đàm Thoại Thông Minh (Groq Cloud AI Pipeline)](#4-trợ-lý-ảo-đàm-thoại-thông-minh-groq-cloud-ai-pipeline)
5. [Cổng Quản Trị Ban Quản Lý (Admin Dashboard)](#5-cổng-quản-trị-ban-quản-lý-admin-dashboard)
6. [Cổng Khách Tham Quan Theo Đoàn (Visitor Portal)](#6-cổng-khách-tham-quan-theo-đoàn-visitor-portal)
7. [Studio Biên Tập Bản Đồ & Tuyến Du Lịch (Map Studio)](#7-studio-biên-tập-bản-đồ--tuyến-du-lịch-map-studio)
8. [Bộ Giả Lập Thực Địa Tuyến Tính (Field Movement Simulator)](#8-bộ-giả-lập-thực-địa-tuyến-tính-field-movement-simulator)
9. [Trạm Kiểm Thử Toàn Diện Phần Cứng (Hardware Test Station)](#9-trạm-kiểm-thử-toàn-diện-phần-cứng-hardware-test-station)
10. [Kiến Trúc An Ninh Phòng Thủ Đa Tầng (Defense-in-Depth)](#10-kiến-trúc-an-ninh-phòng-thủ-đa-tầng-defense-in-depth)

---

## 1. Phân Hệ Thiết Bị Cầm Tay & Phần Cứng ESP32

- **Định danh chuẩn hóa**: Mã thiết bị định dạng `###***` (ví dụ `NEU001` đến `NEU023`).
- **Module GPS ATGM336H**: Đọc chuỗi NMEA, trích xuất tọa độ WGS-84 (`lat`, `lng`, `alt`), tốc độ và số vệ tinh.
- **Module IMU MPU6050 / MPU9250**:
  - Đo 3 trục con quay hồi chuyển (`Yaw`, `Pitch`, `Roll`).
  - Hỗ trợ truyền luồng tần số cao qua WebSocket `DEVICE_IMU_STREAM` để cập nhật hướng nhìn tức thì mà không gây nghẽn GPS.
- **Microphone I2S INMP441**: Thu âm thanh giọng nói 16-bit mono 16kHz, truyền nhị phân lên server qua `POST /api/inmp441/audio`.
- **Mạch giải mã âm thanh DAC PCM5102A**: Tiếp nhận luồng âm thanh qua giao tiếp I2S DMA, xuất ra cổng 3.5mm chất lượng cao.
- **Thẻ nhớ MicroSD FAT32**: Lưu trữ cục bộ các bài thuyết minh hiện vật (`/audio/sdcard/001.mp3` đến `007.mp3`), cho tốc độ phát tức thì (<10ms).
- **Cơ chế xác thực bảo mật 2 chiều**: Sử dụng khóa bí mật `X-Device-Secret: esp_sec_2026_98a72b` để chống giả mạo thiết bị và chống cướp loa.

---

## 2. Công Nghệ Âm Thanh Không Gian 3D (Spatial Audio HRTF)

- **Chuỗi xử lý Web Audio**:
  $$\text{Source} \longrightarrow \text{PannerNode (HRTF)} \longrightarrow \text{GainNode (Dynamic Volume)} \longrightarrow \text{AnalyserNode} \longrightarrow \text{DAC Audio Out}$$
- **Định vị không gian HRTF (Head-Related Transfer Function)**:
  - Tự động tính toán vị trí nguồn âm $(X, Z)$ dựa trên khoảng cách và góc lệch giữa hướng nhìn của khách (`Yaw`) và phương vị của hiện vật.
  - Phân tách âm thanh lập thể giữa tai trái và tai phải, tái hiện chân thực âm trường tự nhiên.
- **Thuật toán âm lượng động theo khoảng cách thực tế**:
  $$\text{Volume} = \text{MasterVol} \times \left(0.25 + \frac{5.0 - d}{4.5} \times 0.75\right)$$
  - Tại biên $5.0\text{m}$: Âm lượng bắt đầu ở mức êm dịu $25\%$.
  - Càng lại gần hiện vật ($d \le 0.5\text{m}$): Âm lượng tăng tuyến tính mượt mà lên $100\%$.
  - Ra ngoài $5.0\text{m}$: Âm thanh tự động ngắt hoàn toàn.

---

## 3. Nón Tầm Nhìn & Khóa Mục Tiêu Hiện Vật (Vision Cone & Auto Gaze)

- **Thông số hình học chuẩn hóa**:
  - Góc mở nón tầm nhìn: **$45^\circ$** (độ lệch tối đa $|\Delta\text{Yaw}| \le 22.5^\circ$).
  - Bán kính quét: **$5.0\text{m}$**.
- **Quy tắc phát âm thanh nghiêm ngặt**:
  1. **Chỉ kích hoạt Hiện vật (`artifacts`)**: Tuyệt đối không kích hoạt các điểm POI thông thường.
  2. **Chỉ phát khi nằm trong nón tầm nhìn**: Đi đến rất gần nhưng quay lưng hoặc nhìn lệch ra ngoài nón $45^\circ$ $\rightarrow$ Không phát âm thanh.
  3. **Cơ chế khóa mục tiêu (Dwell Time)**: Cần nhìn liên tục vào hiện vật trong **$1.5\text{s}$** mới phát âm thanh, loại trừ hoàn toàn trường hợp vô tình xoay đầu lướt qua.
  4. **Thời gian giãn cách (Cooldown)**: 15 giây chống phát lặp lại liên tục cho cùng một hiện vật.
  5. Khi đủ điều kiện, server gửi lệnh WebSocket `PLAY_SD_TRACK` kèm số hiệu hiện vật xuống đúng thiết bị phần cứng.

---

## 4. Trợ Lý Ảo Đàm Thoại Thông Minh (Groq Cloud AI Pipeline)

- **Chuyển giọng nói thành văn bản (Speech-to-Text)**:
  - Sử dụng mô hình **Groq Whisper Large v3** (`whisper-large-v3`) tối ưu riêng cho tiếng Việt.
  - Tự động lọc bỏ nhiễu nền và hiện tượng ảo giác âm thanh.
- **Trí tuệ nhân tạo hướng dẫn viên (Groq LLM)**:
  - Sử dụng mô hình suy luận tốc độ cực cao: **`openai/gpt-oss-120b`** (hoặc `llama-3.3-70b-versatile`).
  - Hệ thống tự động nạp ngữ cảnh thực địa: Vị trí tọa độ, phân khu hiện tại, hiện vật đang đứng trước mặt và hướng quay la bàn.
  - Thời gian phản hồi toàn trình chỉ ~1.5 giây với giọng văn truyền cảm, đậm chất văn hóa di tích.
- **Phản hồi thời gian thực kép**:
  - **Màn hình Web**: Đẩy sự kiện WebSocket `AI_DIALOGUE_UPDATE` tự động mở ngăn chat hiển thị câu hỏi và lời đáp.
  - **Loa phần cứng**: Nối tiếp luồng Text-To-Speech (TTS) tiếng Việt đa phân đoạn trả thẳng về DAC PCM5102A qua `GET /api/voice/tts` (có chime WAV dự phòng khi mất kết nối mạng).

---

## 5. Cổng Quản Trị Ban Quản Lý (Admin Dashboard)

- **Đường dẫn bảo mật**: Ẩn giấu qua biến môi trường `ADMIN_SECRET_PATH` (mặc định `/quanly_bql_8869`).
- **Giám sát thời gian thực**:
  - Theo dõi trạng thái, mức pin, tọa độ của tất cả 20+ Hub trên bản đồ Leaflet Dark Theme.
  - Hiển thị nhãn trạng thái trực quan: Online (Xanh ngọc), Đang sạc (Xanh lá), Pin yếu (Đỏ cảnh báo).
- **Khởi tạo đoàn khách & Mã QR Token 1 lần**:
  - Nhập số lượng khách, gán danh sách Hub ID được mượn.
  - Hệ thống tự động sinh mã QR liên kết dùng 1 lần (dạng `hl_timestamp_randomhash`), ngăn chặn chia sẻ trái phép.
- **Chốt pin ca hành chính**: Ghi nhận dung lượng pin toàn bộ Hub vào đầu ca và cuối ca làm việc theo quy định hành chính.
- **Bản đồ nhiệt lưu lượng (Heatmap)**: Tích lũy vết di chuyển sau khi kết thúc tour để phân tích mật độ du khách và tối ưu hóa luồng tham quan.
- **Phát thanh khẩn cấp (Emergency Broadcast)**: Gửi thông báo chữ và âm thanh tới từng Hub riêng lẻ hoặc toàn bộ các Hub trong di tích.

---

## 6. Cổng Khách Tham Quan Theo Đoàn (Visitor Portal)

- **Truy cập không cần cài app**: Khách quét mã QR trên điện thoại là vào ngay giao diện web di động (`/user?token=...`).
- **Nhận diện thiết bị cá nhân**: Khách chọn mã Hub đang cầm trên tay để được định vị bằng màu nổi bật (Vàng - BẠN), các thành viên khác trong đoàn hiển thị màu xanh lơ.
- **Tìm kiếm thành viên trong đoàn**: Danh sách thành viên kèm pin, bấm vào tên ai là bản đồ tự động bay tới vị trí người đó.
- **Lưới kết nối đoàn (Mesh Grid Network)**: Vẽ đường nối động giữa các thành viên để hướng dẫn viên dễ dàng bao quát đoàn.
- **Hộp thoại đàm thoại AI thông minh**: Mở ngăn chat đàm thoại trực tiếp với trợ lý ảo hoặc xem lại nội dung vừa nghe thuyết minh từ phần cứng.

---

## 7. Studio Biên Tập Bản Đồ & Tuyến Du Lịch (Map Studio)

- **Địa chỉ truy cập**: `/editor` (được bảo vệ bằng mã bí mật Ban Quản Lý).
- **Biên tập phân khu (Zones)**: Vẽ đa giác (Polygon) phân định các tòa nhà, sân bãi với màu sắc tùy biến.
- **Biên tập điểm di tích (POIs) & Hiện vật (Artifacts)**:
  - Kéo thả ghim tọa độ trực quan trên nền bản đồ số.
  - Chỉnh sửa thông tin chi tiết: Tên tiếng Việt, Tên tiếng Anh, Năm xây dựng, Nội dung văn bản và kịch bản thuyết minh âm thanh.
- **Biên tập tuyến đường tham quan mẫu (Tour Route)**: Vẽ đường polyline hướng dẫn du khách lộ trình tham quan tối ưu.
- **Lưu trữ tức thì**: Đồng bộ ngay lập tức vào MongoDB Atlas và kho sao lưu JSON.

---

## 8. Bộ Giả Lập Thực Địa Tuyến Tính (Field Movement Simulator)

- **Địa chỉ truy cập**: `/simulate`
- **Mô phỏng đa đối tượng**: Giả lập cùng lúc 5-10 du khách cầm Hub di chuyển theo các lộ trình ngẫu nhiên.
- **Mô phỏng di chuyển tuyến tính A $\rightarrow$ B**:
  - Chọn điểm xuất phát và điểm đích trên bản đồ.
  - Hệ thống tự động tính toán góc hướng di chuyển (`Heading / Yaw`), bước đi mượt mà từng giây một.
  - Tự động co giãn nón tầm nhìn $45^\circ$, hiển thị vết đường đi và gửi gói tin telemetry lên server đều đặn.

---

## 9. Trạm Kiểm Thử Toàn Diện Phần Cứng (Hardware Test Station)

- **Địa chỉ truy cập**: `/test.html`
- **Mô phỏng 100% phần cứng thực tế**:
  - La bàn điện tử IMU MPU6050 xoay 360° với phản hồi trực quan.
  - Bộ phát GPS NMEA chuẩn GGA/RMC.
  - Bộ thu âm kiểm thử microphone I2S INMP441, hiển thị biểu đồ sóng âm thanh trực tiếp.
  - Bộ phát giải mã DAC PCM5102A tích hợp radar âm thanh 3D, thanh trượt cự ly và góc xoay.
  - Terminal Log hiển thị chi tiết từng byte truyền nhận qua WebSocket và REST API.

---

## 10. Kiến Trúc An Ninh Phòng Thủ Đa Tầng (Defense-in-Depth)

Hệ thống triển khai 7 tầng bảo vệ liên hoàn (xem chi tiết tại [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)):
1. **Lớp 1: Ẩn giấu bề mặt tấn công** (Obfuscated Admin Path & chặn 404 các cổng nhạy cảm).
2. **Lớp 2: Tường lửa API quản trị** (`verifyAdminSecret`).
3. **Lớp 3: Kiểm soát phân quyền WebSocket** (Chặn nâng quyền trái phép, ngắt kết nối với mã lỗi 4001/4002).
4. **Lớp 4: Xác thực phần cứng ESP32 hai chiều** (`X-Device-Secret`).
5. **Lớp 5: Bảo vệ quyền riêng tư du khách** (Token ngẫu nhiên, xóa sạch vết di chuyển khi kết thúc tour).
6. **Lớp 6: Lá chắn chống quá tải** (Sliding Window Rate Limiter).
7. **Lớp 7: Cơ chế dữ liệu bền vững kép** (MongoDB Atlas + Local JSON Fallback Store).
