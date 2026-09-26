/**
 * 2Guide - Middleware: Xác thực mã bí mật ESP32 hai chiều
 * (Ngăn chặn kẻ gian giả mạo thiết bị đẩy dữ liệu bịp, đồng thời bảo vệ du khách)
 */

const { ESP32_SECRET_KEY } = require('../config/appConfig');

function checkSecretValid(req) {
  const incomingSecret = (
    req.headers['x-device-secret'] ||
    req.headers['x-esp32-secret'] ||
    req.headers['device-secret'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '')) ||
    req.body?.secretKey ||
    req.query?.secret ||
    ''
  ).trim();

  return incomingSecret === ESP32_SECRET_KEY;
}

function attachEsp32Headers(res) {
  res.setHeader('X-Device-Secret', ESP32_SECRET_KEY);
  res.setHeader('X-Auth-Status', 'VERIFIED');
}

function verifyEsp32Secret(req, res, next) {
  if (!checkSecretValid(req)) {
    console.warn(`[AN NINH] Từ chối request từ IP ${req.ip} do sai hoặc thiếu mã bí mật ESP32! Endpoint: ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      authStatus: 'UNAUTHORIZED',
      error: 'Xác thực thất bại: Sai hoặc thiếu mã bí mật ESP32 (Unauthorized Device)!'
    });
  }

  attachEsp32Headers(res);
  next();
}

module.exports = {
  ESP32_SECRET_KEY,
  checkSecretValid,
  attachEsp32Headers,
  verifyEsp32Secret
};
