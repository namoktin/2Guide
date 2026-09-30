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

// 2. Cổng quản lý Ban Quản Lý:
router.get(ADMIN_SECRET_PATH, viewController.renderAdmin);
// Tự động chuyển hướng từ các đường dẫn quen thuộc sang Cổng Ban Quản Lý
router.get(['/admin', '/quanly', '/index.html'], (req, res) => res.redirect(ADMIN_SECRET_PATH));

// 3. Cổng giả lập tín hiệu GPS & Pin
router.get(['/simulate', '/simulate.html'], viewController.renderSimulate);

// 4. Studio Biên tập Bản đồ & Hiện vật:
router.get(EDITOR_SECRET_PATH, viewController.renderEditor);
// Tự động chuyển hướng sang Cổng Studio Biên Tập
router.get(['/editor', '/editor.html'], (req, res) => res.redirect(EDITOR_SECRET_PATH));

// 5. Trang chủ mặc định chuyển hướng sang /user
router.get('/', viewController.redirectRoot);

module.exports = router;
