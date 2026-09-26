/**
 * 2Guide - Controller: DeviceAuthController
 * Xác thực bảo mật hai chiều giữa thiết bị ESP32 phần cứng và Server
 */

const { ESP32_SECRET_KEY } = require('../config/appConfig');
const { checkSecretValid, attachEsp32Headers } = require('../middlewares/esp32AuthMiddleware');

class DeviceAuthController {
  // ALL /api/device/verify
  verifyDevice(req, res) {
    const isValid = checkSecretValid(req);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        authStatus: 'UNAUTHORIZED',
        message: 'Mã bí mật thiết bị ESP32 không chính xác hoặc bị thiếu!',
        timestamp: Date.now()
      });
    }

    attachEsp32Headers(res);
    res.json({
      success: true,
      authStatus: 'VERIFIED',
      secretKey: ESP32_SECRET_KEY,
      message: 'Xác thực 2 chiều ESP32 <-> Server thành công! Thiết bị hợp lệ.',
      timestamp: Date.now()
    });
  }
}

module.exports = new DeviceAuthController();
