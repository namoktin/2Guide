/**
 * 2Guide - Controller: GroupController
 * Quản lý đoàn khách tham quan, tạo mã QR bảo mật 1 lần, kết thúc tour và dọn dẹp dữ liệu
 */

const groupModel = require('../models/groupModel');
const hubModel = require('../models/hubModel');
const siteModel = require('../models/siteModel');
const socketManager = require('../websocket/socketManager');
const dbService = require('../services/dbService');
const { PORT } = require('../config/appConfig');

class GroupController {
  // GET /api/groups
  getAllGroups(req, res) {
    res.json({
      success: true,
      data: groupModel.getAll()
    });
  }

  // GET /api/groups/:identifier
  getGroupDetails(req, res) {
    const { identifier } = req.params;
    const group = groupModel.getByIdOrToken(identifier);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Mã QR không hợp lệ, không tồn tại hoặc đã hết hạn.'
      });
    }

    if (group.status === 'ENDED') {
      return res.json({
        success: false,
        isEnded: true,
        message: 'Hành trình tham quan của đoàn khách này đã kết thúc. Cảm ơn quý khách đã ghé thăm di tích!'
      });
    }

    // CÔ LẬP DỮ LIỆU: Chỉ lấy các Hub thuộc danh sách hubIds của ĐOÀN NÀY, tuyệt đối không trả về Hub đoàn khác
    const memberHubs = group.hubIds.map(id => hubModel.getById(id) || { hubId: id, isOnline: false });

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
        qrCodeDataUrl: group.qrCodeDataUrl
      }
    });
  }

  // POST /api/groups/create
  async createGroup(req, res) {
    try {
      const { groupName, leaderName, memberCount, hubIds } = req.body;

      if (!hubIds || !Array.isArray(hubIds) || hubIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Phải chọn ít nhất 1 Hub ID cho đoàn' });
      }

      const host = req.get('host') || `localhost:${PORT}`;
      const protocol = req.protocol || 'http';

      const newGroup = await groupModel.createGroup({
        groupName,
        leaderName,
        memberCount,
        hubIds,
        host,
        protocol,
        hubModel,
        siteCenter: siteModel.getCenter()
      });

      // Lưu bền vững ngay lập tức vào cơ sở dữ liệu
      dbService.saveImmediate({
        hubs: hubModel.getMap(),
        groups: groupModel.getMap(),
        groupTokens: groupModel.getTokensMap()
      });

      console.log(`[Group Created] Đoàn: ${newGroup.groupId} | Token: ${newGroup.token} | Hubs: ${hubIds.join(', ')}`);

      socketManager.broadcastToAdmins({
        type: 'GROUP_CREATED',
        group: newGroup,
        hubs: hubModel.getAll()
      });

      res.json({
        success: true,
        data: newGroup
      });
    } catch (error) {
      console.error('[Group] Lỗi tạo mã QR đoàn:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/groups/:identifier/end
  endGroup(req, res) {
    const { identifier } = req.params;
    const group = groupModel.endGroup(identifier, hubModel);

    if (!group) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đoàn khách' });
    }

    // Lưu bền vững ngay lập tức vào cơ sở dữ liệu
    dbService.saveImmediate({
      hubs: hubModel.getMap(),
      groups: groupModel.getMap(),
      groupTokens: groupModel.getTokensMap()
    });

    console.log(`[Group Ended] Đoàn ${group.groupId} kết thúc hành trình tham quan.`);

    socketManager.broadcastToGroup(group.groupId, {
      type: 'GROUP_ENDED',
      message: 'Hành trình tham quan của quý khách đã kết thúc. Cảm ơn quý khách đã ghé thăm di tích!'
    });

    socketManager.broadcastToAdmins({
      type: 'GROUP_ENDED',
      groupId: group.groupId,
      hubs: hubModel.getAll()
    });

    res.json({
      success: true,
      message: `Đã kết thúc hành trình đoàn ${group.groupName} và xóa sạch toàn bộ dữ liệu tuyến đường.`,
      data: {
        groupId: group.groupId
      }
    });
  }
}

module.exports = new GroupController();
