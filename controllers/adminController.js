/**
 * 2Guide - Controller: AdminController
 * Xử lý các tác vụ quản trị, can thiệp luồng tín hiệu và phát thanh khẩn cấp
 */

const socketManager = require('../websocket/socketManager');

class AdminController {
  // POST /api/admin/broadcast
  broadcastEmergency(req, res) {
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

    socketManager.broadcastEmergency(broadcastPayload, targetType, targetId);

    res.json({
      success: true,
      message: 'Đã gửi thông điệp can thiệp luồng tín hiệu thành công!',
      data: broadcastPayload
    });
  }
}

module.exports = new AdminController();
