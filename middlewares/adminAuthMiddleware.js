/**
 * 2Guide - Middleware: Xác thực mã bí mật Ban Quản Lý (ADMIN_SECRET_KEY)
 * Ngăn chặn kẻ gian gọi trực tiếp các API quản trị nhạy cảm (Tạo đoàn, Hủy đoàn, Phát loa, Chốt pin, Lưu bản đồ)
 */

const { ADMIN_SECRET_KEY } = require('../config/appConfig');

function checkAdminSecretValid(req) {
  const incomingKey = (
    req.headers['x-admin-secret'] ||
    req.headers['x-admin-key'] ||
    req.headers['admin-secret-key'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '')) ||
    req.body?.adminKey ||
    req.body?.secretKey ||
    req.query?.adminKey ||
    ''
  ).trim();

  return incomingKey === ADMIN_SECRET_KEY;
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

module.exports = {
  ADMIN_SECRET_KEY,
  checkAdminSecretValid,
  verifyAdminSecret
};
