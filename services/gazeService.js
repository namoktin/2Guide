/**
 * 2Guide - Service: GazeService
 * Tự động phát hiện khi thiết bị Hub (ESP32) hướng nón tầm nhìn (45°, 5m) vào HIỆN VẬT LỊCH SỬ
 * CHỈ PHÁT HIỆN VẬT (artifacts), TUYỆT ĐỐI KHÔNG PHÁT POI
 */

const siteModel = require('../models/siteModel');
const { ESP32_SECRET_KEY, normalizeHubId } = require('../config/appConfig');

class GazeService {
  constructor() {
    this.hubGazeTracking = {};
    this.lastTriggeredTime = {};
  }

  checkAndTriggerAutoGaze(hub, socketManager) {
    if (!hub || hub.lat === undefined || hub.lng === undefined || hub.yaw === undefined || !socketManager) return null;
    const siteData = siteModel.getSiteData();
    if (!siteData || !siteData.artifacts || !siteData.artifacts.length) return null;

    const normHubId = normalizeHubId(hub.hubId);

    const METERS_PER_DEG_LAT = 111000;
    const radCenter = (hub.lat * Math.PI) / 180;
    const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * Math.cos(radCenter);

    let matched = null;
    let matchDist = 0;
    let matchDiff = 0;

    // CHỈ QUÉT MẢNG HIỆN VẬT LỊCH SỬ (artifacts), BỎ QUA HOÀN TOÀN CÁC ĐIỂM POI
    for (const art of siteData.artifacts) {
      const dLatMeters = (art.lat - hub.lat) * METERS_PER_DEG_LAT;
      const dLngMeters = (art.lng - hub.lng) * METERS_PER_DEG_LNG;
      const dist = Math.sqrt(dLatMeters * dLatMeters + dLngMeters * dLngMeters);

      // Cự ly tầm nhìn chuẩn 5.0m
      if (dist <= 5.0) {
        let bearing = Math.atan2(dLngMeters, dLatMeters) * (180 / Math.PI);
        bearing = (bearing + 360) % 360;

        const cleanYaw = (Number(hub.yaw) || 0) % 360;
        let diff = Math.abs(bearing - cleanYaw);
        if (diff > 180) diff = 360 - diff;

        // Chỉ kích hoạt khi hướng nhìn (Yaw) nằm trong nón 45° (lệch <= 22.5°)
        if (diff <= 22.5) {
          matched = art;
          matchDist = dist;
          matchDiff = diff;
          break;
        }
      }
    }

    const now = Date.now();

    // NẾU HIỆN VẬT KHÔNG NẰM TRONG TẦM NHÌN: HỦY THEO DÕI NGAY LẬP TỨC
    if (!matched) {
      delete this.hubGazeTracking[normHubId];
      return null;
    }

    // NẾU MỚI BẮT ĐẦU NHÌN HOẶC ĐỔI HIỆN VẬT MỚI: BẮT ĐẦU ĐẾM THỜI GIAN KHÓA MỤC TIÊU 1.5S
    const tracking = this.hubGazeTracking[normHubId];
    if (!tracking || tracking.targetId !== matched.id) {
      this.hubGazeTracking[normHubId] = {
        targetId: matched.id,
        startTime: now,
        triggered: false
      };
      return null;
    }

    // ĐÃ KHÓA TRÚNG: KIỂM TRA ĐỦ 1.5 GIÂY (1500MS) LIÊN TỤC TRONG TẦM NHÌN CHƯA
    const elapsed = now - tracking.startTime;
    const cooldown = this.lastTriggeredTime[normHubId + '_' + matched.id] || 0;

    if (elapsed >= 1500 && !tracking.triggered && (now - cooldown > 15000)) {
      tracking.triggered = true;
      this.lastTriggeredTime[normHubId + '_' + matched.id] = now;

      const artNum = matched.number || 1;
      console.log(`[SERVER AUTO GAZE] Hub ${normHubId} đã nhìn trúng Hiện vật #${artNum}. ${matched.name} đủ 1.5s (~${matchDist.toFixed(1)}m, lệch ${Math.round(matchDiff)}°)! Đang phát thẻ nhớ /sdcard/${String(artNum).padStart(3, '0')}.mp3 cho ESP32...`);

      // Gửi lệnh phát thẻ nhớ MicroSD FAT32 xuống phần cứng ESP32 / trạm test
      const sentCount = socketManager.sendToDevice(normHubId, {
        type: 'PLAY_SD_TRACK',
        hubId: normHubId,
        poiNumber: artNum,
        secretKey: ESP32_SECRET_KEY,
        timestamp: Date.now()
      });

      // Báo sự kiện cho Ban Quản Lý
      socketManager.broadcastToAdmins({
        type: 'ADMIN_POI_GAZE_EVENT',
        hubId: normHubId,
        poiNumber: artNum,
        deviceNotified: sentCount > 0,
        timestamp: Date.now()
      });

      return { matched, artNum };
    }

    return null;
  }
}

module.exports = new GazeService();
