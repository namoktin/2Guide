/**
 * 2Guide - Server Backend (Kiến trúc MVC - Model View Controller)
 * Phục vụ Ban Quản Lý Di Tích & Khách Tham Quan Theo Đoàn
 * Cơ sở di tích: Trường Đại Học Kinh Tế Quốc Dân (NEU)
 */

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const {
  PORT,
  SITE_NAME,
  SITE_CODE,
  ADMIN_SECRET_PATH
} = require('./config/appConfig');

// Nạp các thành phần MVC
const hubModel = require('./models/hubModel');
const groupModel = require('./models/groupModel');
const siteModel = require('./models/siteModel');
const socketManager = require('./websocket/socketManager');
const dbService = require('./services/dbService');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

// 1. Cấu hình Middlewares toàn cục
app.use(cors({
  exposedHeaders: ['X-Device-Secret', 'X-Auth-Status', 'X-Recognized-Text', 'X-AI-Reply', 'X-Nearest-Poi']
}));
app.use(express.raw({ type: ['audio/wav', 'audio/x-wav', 'application/octet-stream'], limit: '10mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Nạp dữ liệu bền vững (MongoDB Atlas / File JSON cục bộ) vào Models
const savedState = dbService.loadInitialData();
hubModel.init(savedState.hubs, siteModel.getCenter());
groupModel.init(savedState.groups, savedState.groupTokens);

// 3. Khởi tạo WebSocket Realtime Manager
socketManager.init(server, { hubModel, groupModel, siteModel });

// 4. Định tuyến toàn bộ Views và REST APIs (Master Router)
app.use(routes);

// 5. Phục vụ tài nguyên tĩnh (Static Assets: css, js, images) - index: false để kiểm soát views qua ViewController
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 6. Khởi động máy chủ HTTP & WebSocket
server.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`2Guide - HỆ THỐNG QUẢN LÝ HUB & HỖ TRỢ THAM QUAN DI TÍCH (MVC)`);
  console.log(`Khu Di Tích: ${SITE_NAME} (Mã: ${SITE_CODE})`);
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`- Cổng Khách Tham Quan:         http://localhost:${PORT}/user`);
  console.log(`- Cổng Ban Quản Lý (MÃ BÍ MẬT): http://localhost:${PORT}${ADMIN_SECRET_PATH}`);
  console.log(`- Cổng Giả Lập:                 http://localhost:${PORT}/simulate`);
  console.log(`- Studio Biên Tập Bản Đồ:       http://localhost:${PORT}/editor`);
  console.log(`- Trạm Kiểm Thử Phần Cứng:      http://localhost:${PORT}/test.html`);
  console.log(`=======================================================`);

  // Kết nối và đồng bộ cơ sở dữ liệu MongoDB Atlas
  await dbService.init({
    siteData: siteModel.getSiteData(),
    hubs: hubModel.getMap(),
    groups: groupModel.getMap(),
    groupTokens: groupModel.getTokensMap()
  });
});
