/**
 * 2Guide - Routes: ViewRoutes
 * Định tuyến các trang giao diện (Khách tham quan, Ban quản trị, Giả lập, Biên tập)
 */

const express = require('express');
const router = express.Router();
const viewController = require('../controllers/viewController');
const { ADMIN_SECRET_PATH } = require('../config/appConfig');

// Chặn truy cập trực tiếp file index.html hoặc đường dẫn quản lý cũ
router.get(['/index.html', '/admin', '/quanly'], viewController.blockOldAdmin);

// Chuyển hướng user.html sang /user
router.get('/user.html', viewController.redirectUserHtml);

// Cổng khách tham quan: /user
router.get('/user', viewController.renderUser);

// Cổng quản lý bí mật theo biến môi trường .env
router.get(ADMIN_SECRET_PATH, viewController.renderAdmin);

// Cổng giả lập tín hiệu GPS & Pin
router.get('/simulate', viewController.renderSimulate);

// Studio Biên tập Bản đồ & Hiện vật
router.get('/editor', viewController.renderEditor);

// Trang chủ mặc định chuyển hướng sang /user
router.get('/', viewController.redirectRoot);

module.exports = router;
