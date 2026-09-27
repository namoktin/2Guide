/**
 * 2Guide - Model: Group (Quản lý đoàn khách tham quan và mã QR token)
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
      status: 'ACTIVE'
    };

    // Gán mapping token -> groupId
    this.groupTokens[secureToken] = groupId;

    // Gán các Hub vào đoàn này
    normalizedHubIds.forEach(id => {
      hubModel.findOrCreate(id, siteCenter);
      hubModel.setGroupId(id, groupId);
    });

    this.groups[groupId] = newGroup;
    return newGroup;
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

  // Phương thức no-op an toàn
  recordTrajectory() {
    return false;
  }
}

module.exports = new GroupModel();

