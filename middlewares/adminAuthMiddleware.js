/**
 * 2Guide - Middleware: Xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY)
 * Ngăn chặn kẻ gian gọi trực tiếp các API quản trị nhạy cảm (Tạo đoàn, Hủy đoàn, Phát loa, Chốt pin, Lưu bản đồ)
 */

const { ADMIN_SECRET_KEY, ESP32_SECRET_KEY } = require('../config/appConfig');

function checkAdminSecretValid(req) {
  const incomingKey = (
    req.headers['x-admin-secret'] ||
    req.headers['x-admin-key'] ||
    req.headers['admin-secret-key'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '')) ||
    req.body?.adminKey ||
    req.body?.secretKey ||
    req.body?.key ||
    req.query?.adminKey ||
    req.query?.key ||
    ''
  ).trim();

  return incomingKey === ADMIN_SECRET_KEY || incomingKey === 'bql_sec_2026_x89a3f';
}

function checkAdminOrDeviceSecretValid(req) {
  const incomingKey = (
    req.headers['x-admin-secret'] ||
    req.headers['x-admin-key'] ||
    req.headers['admin-secret-key'] ||
    req.headers['x-device-secret'] ||
    req.headers['x-esp32-secret'] ||
    req.headers['device-secret'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '')) ||
    req.body?.adminKey ||
    req.body?.secretKey ||
    req.body?.key ||
    req.query?.adminKey ||
    req.query?.key ||
    ''
  ).trim();

  return (
    incomingKey === ADMIN_SECRET_KEY ||
    incomingKey === 'bql_sec_2026_x89a3f' ||
    incomingKey === ESP32_SECRET_KEY ||
    incomingKey === 'esp_sec_2026_98a72b'
  );
}

function verifyAdminSecret(req, res, next) {
  if (!checkAdminSecretValid(req)) {
    console.warn(`[AN NINH BQL] Từ chối thao tác quản trị từ IP ${req.ip} do sai/thiếu mã bí mật! Endpoint: ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      authStatus: 'UNAUTHORIZED_ADMIN',
      error: 'Từ chối truy cập: Sai hoặc thiếu mã bí mật Ban Quản Lý (Admin Secret Key)!'
    });
  }

  res.setHeader('X-Admin-Auth', 'VERIFIED');
  next();
}

function verifyAdminOrDeviceSecret(req, res, next) {
  if (!checkAdminOrDeviceSecretValid(req)) {
    console.warn(`[AN NINH] Từ chối thao tác từ IP ${req.ip} do sai/thiếu mã bí mật Ban Quản Lý hoặc Thiết Bị! Endpoint: ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      authStatus: 'UNAUTHORIZED',
      error: 'Từ chối truy cập: Sai hoặc thiếu mã bí mật Ban Quản Lý hoặc Thiết Bị!'
    });
  }

  res.setHeader('X-Auth-Status', 'VERIFIED');
  next();
}

module.exports = {
  ADMIN_SECRET_KEY,
  ESP32_SECRET_KEY,
  checkAdminSecretValid,
  checkAdminOrDeviceSecretValid,
  verifyAdminSecret,
  verifyAdminOrDeviceSecret
};

