/**
 * 2Guide - Middleware: Xác thực mã bí mật Studio Biên Tập Bản Đồ (EDITOR_SECRET_KEY)
 * Ngăn chặn kẻ gian sửa đổi hoặc phá hoại dữ liệu bản đồ, POI, Hiện vật và Phân khu
 */

const { EDITOR_SECRET_KEY } = require('../config/appConfig');

function checkEditorSecretValid(req) {
  const incomingKey = (
    req.headers['x-editor-secret'] ||
    req.headers['x-editor-key'] ||
    req.headers['editor-secret-key'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '')) ||
    req.body?.editorKey ||
    req.body?.key ||
    req.query?.editorKey ||
    req.query?.key ||
    ''
  ).trim();

  // CHỈ chấp nhận đúng khóa riêng của Map Studio Editor! TUYỆT ĐỐI KHÔNG CHẤP NHẬN MÃ BAN QUẢN LÝ!
  return incomingKey === EDITOR_SECRET_KEY;
}

function verifyEditorSecret(req, res, next) {
  if (!checkEditorSecretValid(req)) {
    console.warn(`[AN NINH EDITOR] Từ chối thao tác biên tập bản đồ từ IP ${req.ip} do sai/thiếu mã bí mật Editor! Endpoint: ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      authStatus: 'UNAUTHORIZED_EDITOR',
      error: 'Từ chối truy cập: Sai hoặc thiếu mã bí mật Map Studio (Editor Secret Key)!'
    });
  }

  res.setHeader('X-Editor-Auth', 'VERIFIED');
  next();
}

module.exports = {
  EDITOR_SECRET_KEY,
  checkEditorSecretValid,
  verifyEditorSecret
};
