/**
 * 2Guide - Model: Hub (Thiết bị định vị đeo cho khách tham quan)
 */

const { SITE_CODE, normalizeHubId } = require('../config/appConfig');

class HubModel {
  constructor() {
    this.hubs = {};
  }

  /**
   * Khởi tạo danh sách 20 Hub mẫu và nạp từ dữ liệu đã lưu bền vững (MongoDB / JSON)
   */
  init(savedHubs = {}, siteCenter = { lat: 20.99965, lng: 105.84280 }) {
    for (let i = 1; i <= 20; i++) {
      const numStr = String(i).padStart(3, '0');
      const hubId = `${SITE_CODE}${numStr}`;
      const savedHub = (savedHubs && savedHubs[hubId]) || {};

      this.hubs[hubId] = {
        hubId,
        lat: savedHub.lat || (siteCenter.lat + (Math.random() - 0.5) * 0.0004),
        lng: savedHub.lng || (siteCenter.lng + (Math.random() - 0.5) * 0.0006),
        alt: savedHub.alt || 15.0,
        yaw: savedHub.yaw !== undefined ? savedHub.yaw : Math.floor(Math.random() * 360),
        pitch: savedHub.pitch || 0,
        roll: savedHub.roll || 0,
        battery: savedHub.battery !== undefined ? savedHub.battery : (98 - Math.floor(Math.random() * 12)),
        startShiftBattery: savedHub.startShiftBattery || 100,
        endShiftBattery: savedHub.endShiftBattery || null,
        lastSeen: savedHub.lastSeen || Date.now(),
        currentGroupId: savedHub.currentGroupId !== undefined ? savedHub.currentGroupId : null,
        isOnline: savedHub.isOnline !== undefined ? savedHub.isOnline : true
      };
    }

    // Bổ sung các Hub khác nếu đã được lưu trước đó
    if (savedHubs) {
      Object.keys(savedHubs).forEach(hId => {
        if (!this.hubs[hId]) {
          this.hubs[hId] = savedHubs[hId];
        }
      });
    }

    return this.hubs;
  }

  getAll() {
    return Object.values(this.hubs);
  }

  getMap() {
    return this.hubs;
  }

  getById(rawId) {
    const hubId = normalizeHubId(rawId);
    return this.hubs[hubId] || null;
  }

  findOrCreate(rawId, defaultCenter = { lat: 20.99965, lng: 105.84280 }) {
    const hubId = normalizeHubId(rawId);
    if (!this.hubs[hubId]) {
      this.hubs[hubId] = {
        hubId,
        lat: defaultCenter.lat + (Math.random() - 0.5) * 0.0002,
        lng: defaultCenter.lng + (Math.random() - 0.5) * 0.0003,
        alt: 12.0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        battery: 100,
        startShiftBattery: 100,
        endShiftBattery: null,
        lastSeen: Date.now(),
        currentGroupId: null,
        isOnline: true
      };
    }
    return this.hubs[hubId];
  }

  updateTelemetry(rawId, { lat, lng, alt, yaw, pitch, roll, battery, isCharging, rawGps, imu }) {
    const hubId = normalizeHubId(rawId);
    if (!this.hubs[hubId]) {
      this.hubs[hubId] = {
        hubId,
        lat: (lat !== undefined && !isNaN(Number(lat))) ? Number(lat) : 20.99965,
        lng: (lng !== undefined && !isNaN(Number(lng))) ? Number(lng) : 105.84280,
        alt: Number(alt || 0),
        yaw: Number(yaw || 0),
        pitch: Number(pitch || 0),
        roll: Number(roll || 0),
        battery: Number(battery || 100),
        isCharging: !!isCharging,
        rawGps: rawGps || null,
        imu: imu || null,
        startShiftBattery: Number(battery || 100),
        endShiftBattery: null,
        lastSeen: Date.now(),
        currentGroupId: null,
        isOnline: true
      };
    } else {
      const hub = this.hubs[hubId];
      if (lat !== undefined && !isNaN(Number(lat))) hub.lat = Number(lat);
      if (lng !== undefined && !isNaN(Number(lng))) hub.lng = Number(lng);
      if (alt !== undefined) hub.alt = Number(alt);
      if (yaw !== undefined) hub.yaw = Number(yaw);
      if (pitch !== undefined) hub.pitch = Number(pitch);
      if (roll !== undefined) hub.roll = Number(roll);
      if (battery !== undefined) hub.battery = Number(battery);
      if (isCharging !== undefined) hub.isCharging = !!isCharging;
      if (rawGps) hub.rawGps = rawGps;
      if (imu) hub.imu = imu;
      hub.lastSeen = Date.now();
      hub.isOnline = true;
    }
    return this.hubs[hubId];
  }

  updateShiftBattery(shiftType, records = []) {
    records.forEach(({ hubId, battery }) => {
      const normId = normalizeHubId(hubId);
      if (this.hubs[normId]) {
        if (shiftType === 'start') {
          this.hubs[normId].startShiftBattery = Number(battery);
        } else {
          this.hubs[normId].endShiftBattery = Number(battery);
        }
        this.hubs[normId].battery = Number(battery);
      }
    });
    return this.getAll();
  }

  setGroupId(rawId, groupId) {
    const hubId = normalizeHubId(rawId);
    if (this.hubs[hubId]) {
      this.hubs[hubId].currentGroupId = groupId;
    }
  }
}

module.exports = new HubModel();
