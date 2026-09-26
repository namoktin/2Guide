/**
 * 2Guide - Routes: ApiRoutes
 * Định tuyến toàn bộ REST APIs của hệ thống (Hub, Đoàn khách, Bản đồ, AI & Phần cứng)
 */

const express = require('express');
const router = express.Router();

const hubController = require('../controllers/hubController');
const groupController = require('../controllers/groupController');
const siteController = require('../controllers/siteController');
const voiceAiController = require('../controllers/voiceAiController');
const deviceAuthController = require('../controllers/deviceAuthController');
const adminController = require('../controllers/adminController');

const upload = require('../middlewares/uploadMiddleware');
const { verifyEsp32Secret } = require('../middlewares/esp32AuthMiddleware');
const { verifyAdminSecret } = require('../middlewares/adminAuthMiddleware');

// ==========================================
// 1. DI TÍCH & BẢN ĐỒ (SITE DATA)
// ==========================================
router.get('/site-data', siteController.getSiteData.bind(siteController));
// Lưu bản đồ - Yêu cầu xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY)
router.post('/editor/save', verifyAdminSecret, siteController.saveEditorData.bind(siteController));

// ==========================================
// 2. THIẾT BỊ HUB & PIN
// ==========================================
router.get('/hubs', hubController.getAllHubs.bind(hubController));
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
// Danh sách đoàn khách & Mã QR - Yêu cầu xác thực mã bí mật Ban Quản Lý
router.get('/groups', verifyAdminSecret, groupController.getAllGroups.bind(groupController));
// Tạo đoàn mới & Kết thúc tour - Yêu cầu xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY)
router.post('/groups/create', verifyAdminSecret, groupController.createGroup.bind(groupController));
router.get('/groups/:identifier', groupController.getGroupDetails.bind(groupController));
router.post('/groups/:identifier/end', verifyAdminSecret, groupController.endGroup.bind(groupController));

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

module.exports = router;
