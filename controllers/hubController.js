/**
 * 2Guide - Controller: HubController
 * Xử lý telemetry thiết bị Hub (ATGM336H GPS, MPU6050 IMU, Pin), quản lý pin ca và thông tin thiết bị
 */

const hubModel = require('../models/hubModel');
const groupModel = require('../models/groupModel');
const siteModel = require('../models/siteModel');
const socketManager = require('../websocket/socketManager');
const dbService = require('../services/dbService');
const gazeService = require('../services/gazeService');
const { ESP32_SECRET_KEY, normalizeHubId } = require('../config/appConfig');
const { attachEsp32Headers } = require('../middlewares/esp32AuthMiddleware');

class HubController {
  // GET /api/hubs
  getAllHubs(req, res) {
    res.json({
      success: true,
      data: hubModel.getAll()
    });
  }

  // GET /api/hubs/:hubId/info
  getHubInfo(req, res) {
    const { hubId } = req.params;
    const hub = hubModel.findOrCreate(hubId, siteModel.getCenter());

    let group = null;
    let members = [hub];

    if (hub.currentGroupId) {
      const g = groupModel.getByIdOrToken(hub.currentGroupId);
      if (g && g.status === 'ACTIVE') {
        group = g;
        members = group.hubIds.map(id => hubModel.getById(id) || {
          hubId: id,
          lat: hub.lat,
          lng: hub.lng,
          yaw: 0,
          battery: 100,
          isOnline: false
        });
      }
    }

    res.json({
      success: true,
      data: {
        hub,
        isGrouped: !!group,
        group: group ? {
          groupId: group.groupId,
          groupName: group.groupName,
          leaderName: group.leaderName,
          memberCount: group.memberCount,
          hubIds: group.hubIds
        } : null,
        members
      }
    });
  }

  // POST /api/telemetry
  updateTelemetry(req, res) {
    let { hubId, lat, lng, alt, yaw, pitch, roll, battery, isCharging, rawGps, imu } = req.body;

    if (!hubId || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, error: 'Thiếu hubId hoặc tọa độ lat, lng' });
    }

    const updatedHub = hubModel.updateTelemetry(hubId, {
      lat,
      lng,
      alt,
      yaw,
      pitch,
      roll,
      battery,
      isCharging,
      rawGps,
      imu
    });

    // Nếu Hub này thuộc 1 đoàn khách đang hoạt động, ghi nhận vết di chuyển
    if (updatedHub.currentGroupId) {
      groupModel.recordTrajectory(updatedHub.currentGroupId, updatedHub.hubId, updatedHub.lat, updatedHub.lng);
    }

    // Phát sóng realtime tới Ban Quản Lý và Khách Tham Quan (user.html)
    socketManager.broadcastTelemetry(updatedHub);

    // Tự động kích hoạt phát âm thanh nếu lọt vào tầm nhìn hiện vật hoặc tiếp cận cự ly gần
    gazeService.checkAndTriggerAutoGaze(updatedHub, socketManager);

    // Tự động lưu bền vững trạng thái Hubs & vết di chuyển
    dbService.scheduleSave({
      hubs: hubModel.getMap(),
      groups: groupModel.getMap(),
      groupTokens: groupModel.getTokensMap()
    });

    attachEsp32Headers(res);
    res.json({
      success: true,
      secretKey: ESP32_SECRET_KEY,
      authStatus: 'VERIFIED',
      data: updatedHub
    });
  }

  // POST /api/hubs/shift-battery
  updateShiftBattery(req, res) {
    const { shiftType, records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ' });
    }

    const updatedHubs = hubModel.updateShiftBattery(shiftType, records);

    socketManager.broadcastToAdmins({
      type: 'HUBS_BATTERY_UPDATED',
      shiftType,
      hubs: updatedHubs
    });

    res.json({
      success: true,
      message: `Đã cập nhật pin ${shiftType === 'start' ? 'đầu ca' : 'cuối ca'} thành công!`
    });
  }

  // POST /api/hubs/gaze-poi
  triggerPoiGaze(req, res) {
    const { hubId, poiNumber } = req.body;
    const normHubId = normalizeHubId(hubId || 'NEU001');
    const num = Number(poiNumber) || 1;

    console.log(`[POI GAZE REST] Khách Hub ${normHubId} nhìn hiện vật #${num} trong 3s! [XÁC THỰC THÀNH CÔNG] Gửi mã số #${num} lên ESP32...`);

    // Chỉ gửi đúng mã số xuống ESP32, kèm secretKey để ESP32 xác thực server chính chủ
    const sentCount = socketManager.sendToDevice(normHubId, {
      type: 'PLAY_SD_TRACK',
      hubId: normHubId,
      poiNumber: num,
      secretKey: ESP32_SECRET_KEY,
      timestamp: Date.now()
    });

    socketManager.broadcastToAdmins({
      type: 'ADMIN_POI_GAZE_EVENT',
      hubId: normHubId,
      poiNumber: num,
      deviceNotified: sentCount > 0,
      timestamp: Date.now()
    });

    attachEsp32Headers(res);
    res.json({
      success: true,
      secretKey: ESP32_SECRET_KEY,
      authStatus: 'VERIFIED',
      message: `Đã gửi mã số hiện vật #${num} tới thiết bị phần cứng ESP32 ${normHubId}!`,
      deviceNotified: sentCount > 0,
      poiNumber: num
    });
  }
}

module.exports = new HubController();
