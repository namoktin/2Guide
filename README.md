# 2Guide - Hệ Thống Quản Lý Hub & Hỗ Trợ Khách Tham Quan Di Tích

Dự án phát triển nền tảng web phục vụ **Ban Quản Lý Di Tích** và **Khách Tham Quan Theo Đoàn**, tích hợp thiết bị phần cứng Hub cầm tay (ESP32 / GPS / La bàn / Pin).

---

## 1. Tính Năng Chính (Theo Thiết Kế Chức Năng)

### A. Phân Hệ Ban Quản Lý (Admin Dashboard - `/admin` hoặc `/`)
1. **Kiểm soát vị trí toàn bộ thiết bị thực địa**: Giám sát vị trí thời gian thực của tất cả các Hub (online/offline, tọa độ, % pin) trên bản đồ 2D di tích.
2. **Khởi tạo mã QR dùng 1 lần (Single-use Dynamic QR)**:
   - Tiếp nhận số người trong đoàn khách.
   - Nhân viên phát số lượng Hub tương ứng và nhập danh sách mã Hub ID (`###***`, ví dụ: `VMT001, VMT002, VMT003`).
   - Hệ thống tự động sinh mã QR riêng cho đoàn đó để khách quét camera điện thoại vào xem.
3. **Quản lý & Chốt pin ca hành chính**: Chốt dung lượng pin toàn bộ Hub trong kho vào đầu và cuối ca làm việc theo quy định hành chính.
4. **Kết thúc hành trình & Bản đồ nhiệt (Heatmap)**:
   - Khi đoàn trả Hub, bấm "Kết thúc hành trình" để tự động gom toàn bộ vết di chuyển của đoàn vào kho dữ liệu nhiệt.
   - Bản đồ nhiệt tích lũy hiển thị mật độ lưu lượng du khách theo ngày / tuần / toàn thời gian để ban quản lý tối ưu luồng di chuyển.
   - Tự động đóng phiên và dọn dẹp quyền xem của khách sau khi kết thúc.
5. **Can thiệp luồng tín hiệu & Phát thanh khẩn cấp**:
   - Cho phép Ban Quản Lý gửi thông báo khẩn cấp hoặc phát thanh giọng nói trực tiếp tới Hub bất kỳ hoặc toàn bộ đoàn khách khi cần thiết.

### B. Phân Hệ Khách Tham Quan (User Portal - `/user.html?groupId=...`)
1. **Truy cập nhanh qua quét mã QR 1 lần** trên điện thoại.
2. **Xác nhận Hub cá nhân**: Website hỏi số ID HUB bạn đang cầm trên tay để hiển thị vị trí của bạn bằng **màu nổi bật đặc biệt (Vàng - BẠN)**, còn các thành viên khác trong cùng đoàn hiển thị màu xanh kèm mã Hub.
3. **Tìm kiếm thành viên trong đoàn**: Có thanh tìm kiếm ID HUB và thanh cuộn nhanh. Bấm vào thành viên bất kỳ để bản đồ tự động bay tới vị trí người đó.
4. **Khám phá bản đồ di tích**:
   - Hiển thị ranh giới và nhãn tên từng phân khu di tích.
   - Hiển thị các điểm di tích đặc sắc (POI). Bấm vào để xem tóm tắt lịch sử và nghe thuyết minh âm thanh.
5. **Nhận cảnh báo khẩn cấp từ Ban Quản Lý** qua loa/thông báo trên màn hình.

### C. Công Cụ Giả Lập Thực Địa (`/simulate.html`)
- Cho phép giả lập 5-10 người dùng cầm Hub di chuyển trong di tích, tự động gửi gói tin telemetry (GPS, la bàn, pin) mỗi 1.5 giây để kiểm thử toàn diện hệ thống mà chưa cần phần cứng thật.

---

## 2. Quy Ước Mã Thiết Bị Hub
- Cấu trúc: `###***`
  - `###`: Tên viết tắt của khu di tích (Ví dụ: `VMT` - Văn Miếu Thông, `HTL` - Hoàng Thành Thăng Long, `DLT` - Dinh Độc Lập).
  - `***`: Số thứ tự của thiết bị Hub phát cho di tích đó (Ví dụ: `001`, `002`, `015`...).

---

## 3. Hướng Dẫn Cài Đặt & Khởi Chạy

```bash
# 1. Chuyển vào thư mục 2guide
cd 2guide

# 2. Cài đặt các thư viện (đã cài đặt)
npm install

# 3. Khởi động server
npm start
```

Server sẽ chạy tại cổng **`http://localhost:4000`**:
- **Cổng Ban Quản Lý:** `http://localhost:4000/` (hoặc `http://localhost:4000/admin`)
- **Cổng Khách Tham Quan:** `http://localhost:4000/user.html`
- **Cổng Giả Lập Test:** `http://localhost:4000/simulate.html`

