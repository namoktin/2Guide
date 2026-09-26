/**
 * 2Guide - Model: Group (Quản lý đoàn khách tham quan, mã QR token dùng 1 lần và tuyến đường di chuyển)
 */

const crypto = require('crypto');
const QRCode = require('qrcode');
const { SITE_CODE, PORT, normalizeHubId } = require('../config/appConfig');

class GroupModel {
  constructor() {
    this.groups = {};
    this.groupTokens = {};
  }

  init(savedGroups = {}, savedTokens = {}) {
    this.groups = savedGroups || {};
    this.groupTokens = savedTokens || {};
    return { groups: this.groups, groupTokens: this.groupTokens };
  }

  getAll() {
    return Object.values(this.groups);
  }

  getMap() {
    return this.groups;
  }

  getTokensMap() {
    return this.groupTokens;
  }

  getByIdOrToken(identifier) {
    if (!identifier) return null;
    let targetGroupId = identifier;
    if (this.groupTokens[identifier]) {
      targetGroupId = this.groupTokens[identifier];
    }
    return this.groups[targetGroupId] || null;
  }

  async createGroup({ groupName, leaderName, memberCount, hubIds = [], host, protocol = 'http', hubModel, siteCenter }) {
    const timestamp = Date.now();
    const groupId = `GRP_${SITE_CODE}_${timestamp}`;

    // SINH TOKEN BẢO MẬT KHÔNG TRÙNG NHAU (Cryptographically Unique Token)
    const secureToken = 'hl_' + timestamp.toString(36) + '_' + crypto.randomBytes(4).toString('hex');

    const appHost = host || `localhost:${PORT}`;
    const userAccessUrl = `${protocol}://${appHost}/user?token=${secureToken}`;

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

    const normalizedHubIds = hubIds.map(normalizeHubId);

    const newGroup = {
      groupId,
      token: secureToken,
      groupName: groupName || `Đoàn ${normalizedHubIds[0]} (${normalizedHubIds.length} khách)`,
      leaderName: leaderName || 'Khách đoàn',
      memberCount: Number(memberCount || normalizedHubIds.length),
      hubIds: normalizedHubIds,
      userAccessUrl,
      qrCodeDataUrl,
      createdAt: new Date().toISOString(),
      endedAt: null,
      status: 'ACTIVE',
      trajectories: {}
    };

    // Gán mapping token -> groupId
    this.groupTokens[secureToken] = groupId;

    // Gán các Hub vào đoàn này và khởi tạo mảng vết di chuyển
    normalizedHubIds.forEach(id => {
      hubModel.findOrCreate(id, siteCenter);
      hubModel.setGroupId(id, groupId);
      newGroup.trajectories[id] = [];
    });

    this.groups[groupId] = newGroup;
    return newGroup;
  }

  recordTrajectory(groupId, rawHubId, lat, lng) {
    const hubId = normalizeHubId(rawHubId);
    const group = this.groups[groupId];
    if (!group || group.status !== 'ACTIVE') return false;

    if (!group.trajectories[hubId]) {
      group.trajectories[hubId] = [];
    }

    const points = group.trajectories[hubId];
    const shouldAdd = points.length === 0 || (
      Math.abs(points[points.length - 1].lat - lat) > 0.000015 ||
      Math.abs(points[points.length - 1].lng - lng) > 0.000015
    );

    if (shouldAdd) {
      points.push({
        lat: Number(lat),
        lng: Number(lng),
        timestamp: Date.now()
      });
      return true;
    }

    return false;
  }

  endGroup(identifier, hubModel) {
    let targetGroupId = identifier;
    if (this.groupTokens[identifier]) {
      targetGroupId = this.groupTokens[identifier];
    }

    const group = this.groups[targetGroupId];
    if (!group) return null;

    group.status = 'ENDED';
    group.endedAt = new Date().toISOString();

    // BẢO MẬT & BỘ NHỚ: Xóa sạch toàn bộ dữ liệu tuyến đường di chuyển khi kết thúc phiên
    group.trajectories = {};

    // Giải phóng các Hub về trạng thái rảnh rỗi (idle)
    if (group.hubIds && Array.isArray(group.hubIds)) {
      group.hubIds.forEach(id => {
        hubModel.setGroupId(id, null);
      });
    }

    // Xóa mapping token sau khi kết thúc để bảo mật
    if (group.token && this.groupTokens[group.token]) {
      delete this.groupTokens[group.token];
    }

    return group;
  }
}

module.exports = new GroupModel();
