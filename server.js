/**
 * 2Guide - Server Backend
 * Phục vụ Ban Quản Lý Di Tích & Khách Tham Quan Theo Đoàn
 * Tích hợp Di tích Lịch sử Nhà tù Hỏa Lò (Maison Centrale)
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;
const siteData = require('./data/siteData.js');

const SITE_CODE = process.env.SITE_CODE || siteData.siteCode || 'NHL';
const SITE_NAME = process.env.SITE_NAME || siteData.siteName;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CƠ SỞ DỮ LIỆU IN-MEMORY (LƯU TRỮ VẬN HÀNH)
// ==========================================

// 1. Quản lý danh sách thiết bị Hub
// Cấu trúc: { [hubId]: { hubId, lat, lng, alt, yaw, pitch, roll, battery, startShiftBattery, endShiftBattery, lastSeen, currentGroupId, isOnline } }
const hubs = {};

// Khởi tạo 20 Hub mẫu phân bố xung quanh khu vực Nhà tù Hỏa Lò
for (let i = 1; i <= 20; i++) {
  const numStr = String(i).padStart(3, '0');
  const hubId = `${SITE_CODE}${numStr}`;
  // Khởi tạo tọa độ xung quanh cổng và các trại giam Hỏa Lò
  hubs[hubId] = {
    hubId,
    lat: siteData.center.lat + (Math.random() - 0.5) * 0.0003,
    lng: siteData.center.lng + (Math.random() - 0.5) * 0.0005,
    alt: 12.0,
    yaw: Math.floor(Math.random() * 360),
    pitch: 0,
    roll: 0,
    battery: 98 - Math.floor(Math.random() * 12),
    startShiftBattery: 100,
    endShiftBattery: null,
    lastSeen: Date.now(),
    currentGroupId: null,
    isOnline: true
  };
}

// 2. Quản lý đoàn khách (Groups) & Mapping Token dùng 1 lần
// groups: { [groupId]: { groupId, token, groupName, leaderName, memberCount, hubIds, userAccessUrl, qrCodeDataUrl, createdAt, endedAt, status: 'ACTIVE'|'ENDED', trajectories: {} } }
const groups = {};
// groupTokens: { [token]: groupId }
const groupTokens = {};

// 3. Kho dữ liệu Bản đồ nhiệt (Heatmap Data)
const heatmapPoints = [];

// Seed dữ liệu nhiệt mẫu dọc theo tuyến 20 điểm tham quan Hỏa Lò
siteData.pois.forEach((poi) => {
  for (let k = 0; k < 10; k++) {
    heatmapPoints.push({
      lat: poi.lat + (Math.random() - 0.5) * 0.0001,
      lng: poi.lng + (Math.random() - 0.5) * 0.0001,
      intensity: 0.6 + Math.random() * 0.4,
      timestamp: Date.now() - Math.floor(Math.random() * 86400000 * 3)
    });
  }
});

// ==========================================
// CÁC ENDPOINT REST API
// ==========================================

// 1. Lấy thông tin khu di tích (20 POIs, Phân khu & Tuyến tham quan)
app.get('/api/site-data', (req, res) => {
  res.json({
    success: true,
    data: siteData
  });
});

// 1.1 Lưu dữ liệu bản đồ từ Map Studio (Kéo thả POI, vẽ vùng phân khu, vẽ tuyến đường)
app.post('/api/editor/save', (req, res) => {
  const { siteCode, siteName, locationName, center, zoom, zones, pois, tourRoute } = req.body;

  if (siteCode) siteData.siteCode = siteCode;
  if (siteName) siteData.siteName = siteName;
  if (locationName) siteData.locationName = locationName;
  if (center) siteData.center = center;
  if (zoom) siteData.zoom = zoom;
  if (zones) siteData.zones = zones;
  if (pois) siteData.pois = pois;
  if (tourRoute) siteData.tourRoute = tourRoute;

  const fileContent = `/**
 * 2Guide - Dữ liệu thực địa: ${siteData.siteName || 'Khu Di Tích'}
 * Cập nhật tự động từ 2Guide Map Studio lúc ${new Date().toLocaleString('vi-VN')}
 */

module.exports = ${JSON.stringify(siteData, null, 2)};
`;

  try {
    fs.writeFileSync(path.join(__dirname, 'data', 'siteData.js'), fileContent, 'utf8');
    console.log(`[Editor] Đã lưu thành công dữ liệu bản đồ (${pois?.length || 0} POIs, ${zones?.length || 0} Zones, ${tourRoute?.length || 0} Route points)`);
    res.json({ success: true, message: 'Đã lưu thành công dữ liệu bản đồ vào hệ thống!' });
  } catch (err) {
    console.error('[Editor] Lỗi ghi file siteData.js:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Danh sách toàn bộ Hubs (Chỉ dành cho Ban Quản Lý)
app.get('/api/hubs', (req, res) => {
  const hubList = Object.values(hubs);
  res.json({
    success: true,
    data: hubList
  });
});

// 3. Chốt mức pin đầu ca / cuối ca theo giờ hành chính
app.post('/api/hubs/shift-battery', (req, res) => {
  const { shiftType, records } = req.body;
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ' });
  }

  records.forEach(({ hubId, battery }) => {
    if (hubs[hubId]) {
      if (shiftType === 'start') {
        hubs[hubId].startShiftBattery = Number(battery);
      } else {
        hubs[hubId].endShiftBattery = Number(battery);
      }
      hubs[hubId].battery = Number(battery);
    }
  });

  broadcastToAdmins({
    type: 'HUBS_BATTERY_UPDATED',
    shiftType,
    hubs: Object.values(hubs)
  });

  res.json({ success: true, message: `Đã cập nhật pin ${shiftType === 'start' ? 'đầu ca' : 'cuối ca'} thành công!` });
});

// 4. Nhận dữ liệu Telemetry từ thiết bị Hub (GPS, La bàn, Pin)
app.post('/api/telemetry', (req, res) => {
  const { hubId, lat, lng, alt, yaw, pitch, roll, battery } = req.body;

  if (!hubId || lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, error: 'Thiếu hubId hoặc tọa độ lat, lng' });
  }

  if (!hubs[hubId]) {
    hubs[hubId] = {
      hubId,
      lat: Number(lat),
      lng: Number(lng),
      alt: Number(alt || 0),
      yaw: Number(yaw || 0),
      pitch: Number(pitch || 0),
      roll: Number(roll || 0),
      battery: Number(battery || 100),
      startShiftBattery: Number(battery || 100),
      endShiftBattery: null,
      lastSeen: Date.now(),
      currentGroupId: null,
      isOnline: true
    };
  } else {
    hubs[hubId].lat = Number(lat);
    hubs[hubId].lng = Number(lng);
    if (alt !== undefined) hubs[hubId].alt = Number(alt);
    if (yaw !== undefined) hubs[hubId].yaw = Number(yaw);
    if (pitch !== undefined) hubs[hubId].pitch = Number(pitch);
    if (roll !== undefined) hubs[hubId].roll = Number(roll);
    if (battery !== undefined) hubs[hubId].battery = Number(battery);
    hubs[hubId].lastSeen = Date.now();
    hubs[hubId].isOnline = true;
  }

  const updatedHub = hubs[hubId];

  // Nếu Hub này thuộc 1 đoàn khách đang hoạt động, ghi nhận vết di chuyển
  if (updatedHub.currentGroupId && groups[updatedHub.currentGroupId] && groups[updatedHub.currentGroupId].status === 'ACTIVE') {
    const group = groups[updatedHub.currentGroupId];
    if (!group.trajectories[hubId]) {
      group.trajectories[hubId] = [];
    }
    const points = group.trajectories[hubId];
    const shouldAdd = points.length === 0 || (
      Math.abs(points[points.length - 1].lat - updatedHub.lat) > 0.000015 ||
      Math.abs(points[points.length - 1].lng - updatedHub.lng) > 0.000015
    );
    if (shouldAdd) {
      points.push({
        lat: updatedHub.lat,
        lng: updatedHub.lng,
        timestamp: Date.now()
      });
    }

    // Gửi realtime CÔ LẬP CHỈ CHO ĐOÀN ĐÓ
    broadcastToGroup(updatedHub.currentGroupId, {
      type: 'HUB_LOCATION_UPDATE',
      hubId,
      lat: updatedHub.lat,
      lng: updatedHub.lng,
      yaw: updatedHub.yaw,
      battery: updatedHub.battery
    });
  }

  // Gửi realtime tới Ban Quản Lý (Admin Dashboard)
  broadcastToAdmins({
    type: 'HUB_LOCATION_UPDATE',
    hub: updatedHub
  });

  res.json({ success: true, data: updatedHub });
});

// 5. TRÌNH SINH MÃ QR ĐOÀN DÙNG 1 LẦN - KHÔNG TRÙNG LẶP (COLLISION-FREE DYNAMIC QR)
app.post('/api/groups/create', async (req, res) => {
  try {
    const { groupName, leaderName, memberCount, hubIds } = req.body;

    if (!hubIds || !Array.isArray(hubIds) || hubIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Phải chọn ít nhất 1 Hub ID cho đoàn' });
    }

    const timestamp = Date.now();
    const groupId = `GRP_${SITE_CODE}_${timestamp}`;

    // SINH TOKEN BẢO MẬT KHÔNG TRÙNG NHAU (Cryptographically Unique Token)
    // Cấu trúc token: hl_<timestamp36>_<random8hex>
    const secureToken = 'hl_' + timestamp.toString(36) + '_' + crypto.randomBytes(4).toString('hex');

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    // Link QR chỉ chứa token riêng biệt của đoàn
    const userAccessUrl = `${protocol}://${host}/user.html?token=${secureToken}`;

    // Tạo ảnh QR Code độ phân giải cao
    const qrCodeDataUrl = await QRCode.toDataURL(userAccessUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 360,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const newGroup = {
      groupId,
      token: secureToken,
      groupName: groupName || `Đoàn ${hubIds[0]} (${hubIds.length} khách)`,
      leaderName: leaderName || 'Khách đoàn',
      memberCount: Number(memberCount || hubIds.length),
      hubIds,
      userAccessUrl,
      qrCodeDataUrl,
      createdAt: new Date().toISOString(),
      endedAt: null,
      status: 'ACTIVE',
      trajectories: {}
    };

    // Gán mapping token -> groupId
    groupTokens[secureToken] = groupId;

    // Gán các Hub vào đoàn này
    hubIds.forEach(id => {
      if (hubs[id]) {
        hubs[id].currentGroupId = groupId;
      }
      newGroup.trajectories[id] = [];
    });

    groups[groupId] = newGroup;

    console.log(`[Group Created] Đoàn: ${groupId} | Token: ${secureToken} | Hubs: ${hubIds.join(', ')}`);

    broadcastToAdmins({
      type: 'GROUP_CREATED',
      group: newGroup
    });

    res.json({
      success: true,
      data: newGroup
    });
  } catch (error) {
    console.error('[Group] Lỗi tạo mã QR đoàn:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Lấy danh sách đoàn khách (Dành cho Ban Quản Lý)
app.get('/api/groups', (req, res) => {
  const groupList = Object.values(groups);
  res.json({
    success: true,
    data: groupList
  });
});

// 7. LẤY CHI TIẾT THÔNG TIN ĐOÀN CỦA KHÁCH (CÔ LẬP DỮ LIỆU CHỈ CHO ĐOÀN ĐÓ)
app.get('/api/groups/:identifier', (req, res) => {
  let { identifier } = req.params;

  // Kiểm tra xem identifier là token hay groupId
  let targetGroupId = identifier;
  if (groupTokens[identifier]) {
    targetGroupId = groupTokens[identifier];
  }

  const group = groups[targetGroupId];

  if (!group) {
    return res.status(404).json({
      success: false,
      error: 'Mã QR không hợp lệ, không tồn tại hoặc đã hết hạn.'
    });
  }

  // Nếu đoàn đã kết thúc hành trình, tự động dọn dẹp và chặn hiển thị
  if (group.status === 'ENDED') {
    return res.json({
      success: false,
      isEnded: true,
      message: 'Hành trình tham quan của đoàn khách này đã kết thúc. Cảm ơn quý khách đã ghé thăm di tích!'
    });
  }

  // CÔ LẬP DỮ LIỆU: Chỉ lấy các Hub thuộc danh sách hubIds của ĐOÀN NÀY, tuyệt đối không trả về Hub đoàn khác
  const memberHubs = group.hubIds.map(id => hubs[id] || { hubId: id, isOnline: false });

  res.json({
    success: true,
    data: {
      groupId: group.groupId,
      token: group.token,
      groupName: group.groupName,
      leaderName: group.leaderName,
      memberCount: group.memberCount,
      hubIds: group.hubIds,
      createdAt: group.createdAt,
      status: group.status,
      members: memberHubs,
      qrCodeDataUrl: group.qrCodeDataUrl // Trả về QR để khách có thể chia sẻ cho người trong đoàn
    }
  });
});

// 8. Kết thúc hành trình của đoàn khách -> Gom dữ liệu vào Bản đồ nhiệt (Heatmap)
app.post('/api/groups/:identifier/end', (req, res) => {
  let { identifier } = req.params;
  let targetGroupId = identifier;
  if (groupTokens[identifier]) {
    targetGroupId = groupTokens[identifier];
  }

  const group = groups[targetGroupId];
  if (!group) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy đoàn khách' });
  }

  group.status = 'ENDED';
  group.endedAt = new Date().toISOString();

  // Gom toàn bộ đường đi (trajectories) vào Bản đồ nhiệt
  let pointsAdded = 0;
  Object.values(group.trajectories).forEach(pointList => {
    pointList.forEach(pt => {
      heatmapPoints.push({
        lat: pt.lat,
        lng: pt.lng,
        intensity: 0.85,
        timestamp: pt.timestamp || Date.now()
      });
      pointsAdded++;
    });
  });

  // Giải phóng các Hub về trạng thái rảnh rỗi (idle)
  group.hubIds.forEach(id => {
    if (hubs[id]) {
      hubs[id].currentGroupId = null;
    }
  });

  // Xóa mapping token sau khi kết thúc để bảo mật
  if (group.token && groupTokens[group.token]) {
    delete groupTokens[group.token];
  }

  console.log(`[Group Ended] Đoàn ${targetGroupId} kết thúc. Gom ${pointsAdded} tọa độ vào bản đồ nhiệt.`);

  broadcastToGroup(targetGroupId, {
    type: 'GROUP_ENDED',
    message: 'Hành trình tham quan của quý khách đã kết thúc. Cảm ơn quý khách đã ghé thăm di tích!'
  });

  broadcastToAdmins({
    type: 'GROUP_ENDED',
    groupId: targetGroupId,
    heatmapPointsCount: heatmapPoints.length
  });

  res.json({
    success: true,
    message: `Đã kết thúc hành trình đoàn ${group.groupName}. Đã tích hợp ${pointsAdded} điểm vào bản đồ nhiệt.`,
    data: {
      groupId: targetGroupId,
      totalHeatmapPoints: heatmapPoints.length
    }
  });
});

// 9. Lấy dữ liệu Bản đồ nhiệt (Heatmap)
app.get('/api/heatmap', (req, res) => {
  const { timeRange } = req.query;
  const now = Date.now();
  let filtered = heatmapPoints;

  if (timeRange === 'day') {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    filtered = heatmapPoints.filter(p => p.timestamp >= oneDayAgo);
  } else if (timeRange === 'week') {
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    filtered = heatmapPoints.filter(p => p.timestamp >= oneWeekAgo);
  }

  const heatData = filtered.map(p => [p.lat, p.lng, p.intensity || 0.8]);

  res.json({
    success: true,
    count: heatData.length,
    data: heatData
  });
});

// 10. Can thiệp luồng tín hiệu / Phát thanh khẩn cấp từ Ban Quản Lý
app.post('/api/admin/broadcast', (req, res) => {
  const { targetType, targetId, message, urgency } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Nội dung thông báo không được để trống' });
  }

  const broadcastPayload = {
    type: 'ADMIN_EMERGENCY_BROADCAST',
    timestamp: new Date().toISOString(),
    urgency: urgency || 'high',
    targetType,
    targetId: targetId || 'ALL',
    message: message.trim()
  };

  console.log(`[Admin Voice] Can thiệp luồng tín hiệu [${targetType} - ${targetId}]: "${message}"`);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      if (targetType === 'ALL_HUBS' || !client.groupId || client.groupId === targetId || client.myHubId === targetId) {
        client.send(JSON.stringify(broadcastPayload));
      }
    }
  });

  res.json({
    success: true,
    message: 'Đã gửi thông điệp can thiệp luồng tín hiệu thành công!',
    data: broadcastPayload
  });
});

// ==========================================
// QUẢN LÝ WEBSOCKET KẾT NỐI REALTIME
// ==========================================

wss.on('connection', (ws) => {
  ws.role = 'guest';

  ws.on('message', (messageText) => {
    try {
      const data = JSON.parse(messageText);

      if (data.type === 'REGISTER_ADMIN') {
        ws.role = 'admin';
        console.log('[WS] Ban Quản Lý đã kết nối WebSocket.');
        ws.send(JSON.stringify({
          type: 'INIT_ADMIN_STATE',
          hubs: Object.values(hubs),
          groups: Object.values(groups),
          siteData
        }));
      }

      if (data.type === 'REGISTER_USER') {
        ws.role = 'user';
        ws.groupId = data.groupId;
        ws.myHubId = data.myHubId;
        console.log(`[WS] Khách tham quan Hub ${ws.myHubId} thuộc đoàn ${ws.groupId} đã kết nối.`);
      }
    } catch (e) {
      console.warn('[WS] Nhận tin nhắn không đúng định dạng JSON');
    }
  });
});

function broadcastToAdmins(payload) {
  const jsonStr = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.role === 'admin') {
      client.send(jsonStr);
    }
  });
}

function broadcastToGroup(groupId, payload) {
  const jsonStr = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.groupId === groupId) {
      client.send(jsonStr);
    }
  });
}

// Định tuyến
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/simulate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simulate.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

// Khởi động server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`2Guide - HỆ THỐNG QUẢN LÝ HUB & HỖ TRỢ THAM QUAN DI TÍCH`);
  console.log(`Khu Di Tích: ${SITE_NAME} (Mã: ${SITE_CODE})`);
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`- Cổng Ban Quản Lý:   http://localhost:${PORT}/ (hoặc /admin)`);
  console.log(`- Cổng Khách Tham Quan: http://localhost:${PORT}/user.html`);
  console.log(`- Cổng Giả Lập Test:    http://localhost:${PORT}/simulate.html`);
  console.log(`- Studio Biên Tập Map:  http://localhost:${PORT}/editor.html (hoặc /editor)`);
  console.log(`=======================================================`);
});
