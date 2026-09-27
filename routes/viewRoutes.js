/**
 * 2Guide - Routes: ViewRoutes
 * Định tuyến các trang giao diện (Khách tham quan, Ban quản trị, Giả lập, Biên tập)
 * Áp dụng cơ chế bảo vệ kép: Đường dẫn bí mật + Màn hình đăng nhập Secret Key
 */

const express = require('express');
const router = express.Router();
const viewController = require('../controllers/viewController');
const { ADMIN_SECRET_PATH, EDITOR_SECRET_PATH } = require('../config/appConfig');

// 1. Cổng khách tham quan: /user và /user.html
router.get('/user.html', viewController.redirectUserHtml);
router.get('/user', viewController.renderUser);

// 2. Cổng quản lý Ban Quản Lý: CHỈ CHO PHÉP TRUY CẬP QUA ĐƯỜNG DẪN BÍ MẬT
router.get(ADMIN_SECRET_PATH, viewController.renderAdmin);
// Chặn hoàn toàn mọi đường dẫn công khai cũ /admin, /quanly, /index.html
router.get(['/admin', '/quanly', '/index.html'], viewController.blockPublicAdmin);

// 3. Cổng giả lập tín hiệu GPS & Pin
router.get(['/simulate', '/simulate.html'], viewController.renderSimulate);

// 4. Studio Biên tập Bản đồ & Hiện vật: CHỈ CHO PHÉP TRUY CẬP QUA ĐƯỜNG DẪN BÍ MẬT
router.get(EDITOR_SECRET_PATH, viewController.renderEditor);
// Chặn hoàn toàn mọi đường dẫn công khai cũ /editor, /editor.html
router.get(['/editor', '/editor.html'], viewController.blockPublicEditor);

// 5. Trang chủ mặc định chuyển hướng sang /user
router.get('/', viewController.redirectRoot);

module.exports = router;
