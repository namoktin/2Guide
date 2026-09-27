/**
 * 2Guide - Routes: ApiRoutes
 * Định tuyến toàn bộ REST APIs của hệ thống (Hub, Đoàn khách, Bản đồ, AI & Phần cứng)
 * Áp dụng xác thực mã bí mật nghiêm ngặt cho toàn bộ các tác vụ đọc/ghi dữ liệu quản trị
 */

const express = require('express');
const router = express.Router();

const hubController = require('../controllers/hubController');
const groupController = require('../controllers/groupController');
const siteController = require('../controllers/siteController');
const voiceAiController = require('../controllers/voiceAiController');
const deviceAuthController = require('../controllers/deviceAuthController');
const adminController = require('../controllers/adminController');
const viewController = require('../controllers/viewController');

const upload = require('../middlewares/uploadMiddleware');
const { verifyEsp32Secret } = require('../middlewares/esp32AuthMiddleware');
const {
  verifyAdminSecret,
  checkAdminSecretValid,
  verifyAdminOrDeviceSecret,
  checkAdminOrDeviceSecretValid
} = require('../middlewares/adminAuthMiddleware');
const { verifyEditorSecret, checkEditorSecretValid } = require('../middlewares/editorAuthMiddleware');
const { ADMIN_SECRET_PATH, EDITOR_SECRET_PATH, ADMIN_SECRET_KEY, EDITOR_SECRET_KEY, ESP32_SECRET_KEY } = require('../config/appConfig');


// ==========================================
// 1. DI TÍCH & BẢN ĐỒ (SITE DATA)
// ==========================================
router.get('/site-data', siteController.getSiteData.bind(siteController));

// Lưu bản đồ - Yêu cầu xác thực mã bí mật Map Studio (EDITOR_SECRET_KEY)
router.post('/editor/save', verifyEditorSecret, siteController.saveEditorData.bind(siteController));

// Xác thực key đăng nhập Map Studio Editor
router.post('/editor/verify-key', (req, res) => {
  const isValid = checkEditorSecretValid(req);
  if (isValid) {
    res.setHeader('Set-Cookie', 'editor_session_key=; Path=/; Max-Age=0');
    return res.json({ success: true, message: 'Xác thực Map Studio thành công', redirect: EDITOR_SECRET_PATH });
  }
  return res.status(401).json({ success: false, error: 'Mã bí mật Map Studio Editor không chính xác!' });
});

// Mở khóa giao diện Map Studio (Chỉ trả về HTML Dashboard khi nhập đúng Secret Key)
router.post('/editor/unlock-dashboard', (req, res) => {
  const isValid = checkEditorSecretValid(req);
  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Mã bí mật Map Studio không chính xác!' });
  }
  const html = viewController.getEditorDashboardHtml();
  return res.json({ success: true, html });
});

router.get('/editor/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'editor_session_key=; Path=/; Max-Age=0');
  res.redirect(EDITOR_SECRET_PATH);
});

// ==========================================
// 2. THIẾT BỊ HUB & PIN
// ==========================================
// Danh sách Hubs - Yêu cầu xác thực quyền Ban Quản Lý hoặc Trạm Giả Lập Kỹ Thuật
router.get('/hubs', verifyAdminOrDeviceSecret, hubController.getAllHubs.bind(hubController));

// Thông tin chi tiết một Hub (Dành cho khách tham quan quét QR trên Hub của họ)
router.get('/hubs/:hubId/info', hubController.getHubInfo.bind(hubController));

// Chốt pin ca - Yêu cầu xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY)
router.post('/hubs/shift-battery', verifyAdminSecret, hubController.updateShiftBattery.bind(hubController));

// Nhận telemetry (GPS, IMU, Pin) - Yêu cầu xác thực mã bí mật ESP32
router.post('/telemetry', verifyEsp32Secret, hubController.updateTelemetry.bind(hubController));

// Nhận tín hiệu nhìn hiện vật 3s - Yêu cầu xác thực mã bí mật ESP32
router.post('/hubs/gaze-poi', verifyEsp32Secret, hubController.triggerPoiGaze.bind(hubController));

// ==========================================
// 3. ĐOÀN KHÁCH & MÃ QR TOKEN DÙNG 1 LẦN
// ==========================================
// Danh sách đoàn khách & Mã QR - Yêu cầu xác thực quyền Ban Quản Lý
router.get('/groups', verifyAdminSecret, groupController.getAllGroups.bind(groupController));

// Tạo đoàn mới & Kết thúc tour - Ban Quản Lý hoặc Trạm Giả Lập Kỹ Thuật
router.post(['/groups', '/groups/create'], verifyAdminOrDeviceSecret, groupController.createGroup.bind(groupController));
router.get('/groups/:identifier', verifyAdminSecret, groupController.getGroupDetails.bind(groupController));
router.post('/groups/:identifier/end', verifyAdminSecret, groupController.endGroup.bind(groupController));

// ==========================================
// 3.1. TRẠM GIẢ LẬP THỰC ĐỊA (/simulate)
// ==========================================
// Xác thực key đăng nhập trạm giả lập kỹ thuật (Chấp nhận mã BQL hoặc mã ESP32)
router.post('/simulate/verify-key', (req, res) => {
  const isValid = checkAdminOrDeviceSecretValid(req);
  if (isValid) {
    return res.json({
      success: true,
      message: 'Xác thực trạm giả lập thành công'
    });
  }
  return res.status(401).json({
    success: false,
    error: 'Mã bí mật trạm giả lập không chính xác! (Vui lòng dùng mã Ban Quản Lý hoặc mã Kỹ Thuật ESP32)'
  });
});


// ==========================================
// 4. TRỢ LÝ AI & ÂM THANH PHẦN CỨNG
// ==========================================
// Hỏi đáp AI text chat cho khách tham quan qua web
router.post('/chat/ask', voiceAiController.askChat.bind(voiceAiController));

// Nhận file âm thanh microphone INMP441 (ESP32-S3) - Yêu cầu xác thực mã bí mật ESP32
router.post('/inmp441/audio', upload.single('audio'), verifyEsp32Secret, voiceAiController.handleInmp441Audio.bind(voiceAiController));

// Cổng raw audio tương thích - Yêu cầu xác thực mã bí mật ESP32
router.post('/voice/ask', verifyEsp32Secret, voiceAiController.handleVoiceAsk.bind(voiceAiController));

// Luồng Text-To-Speech (TTS) cho DAC PCM5102A - Yêu cầu xác thực mã bí mật ESP32
router.get('/voice/tts', verifyEsp32Secret, voiceAiController.streamTts.bind(voiceAiController));

// ==========================================
// 5. XÁC THỰC BẢO MẬT THIẾT BỊ ESP32
// ==========================================
router.all('/device/verify', deviceAuthController.verifyDevice.bind(deviceAuthController));

// ==========================================
// 6. QUẢN TRỊ VIÊN & PHÁT THANH KHẨN CẤP
// ==========================================
// Phát thanh khẩn cấp - Yêu cầu xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY)
router.post('/admin/broadcast', verifyAdminSecret, adminController.broadcastEmergency.bind(adminController));

// Xác thực key đăng nhập Ban Quản Lý
router.post('/admin/verify-key', (req, res) => {
  const isValid = checkAdminSecretValid(req);
  if (isValid) {
    res.setHeader('Set-Cookie', 'admin_session_key=; Path=/; Max-Age=0');
    return res.json({ success: true, message: 'Xác thực Ban Quản Lý thành công', redirect: ADMIN_SECRET_PATH });
  }
  return res.status(401).json({ success: false, error: 'Mã bí mật Ban Quản Lý không chính xác!' });
});

// Mở khóa giao diện Dashboard BQL (Chỉ trả về HTML Dashboard khi nhập đúng Secret Key)
router.post('/admin/unlock-dashboard', (req, res) => {
  const isValid = checkAdminSecretValid(req);
  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Mã bí mật Ban Quản Lý không chính xác!' });
  }
  const html = viewController.getAdminDashboardHtml();
  return res.json({ success: true, html });
});

router.get('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_session_key=; Path=/; Max-Age=0');
  res.redirect(ADMIN_SECRET_PATH);
});

module.exports = router;
