/**
 * 2Guide - Controller: SiteController
 * Quản lý thông tin khu di tích, phân khu, POI, hiện vật và tuyến đường tham quan
 */

const siteModel = require('../models/siteModel');
const dbService = require('../services/dbService');

class SiteController {
  // GET /api/site-data
  getSiteData(req, res) {
    res.json({
      success: true,
      data: siteModel.getSiteData()
    });
  }

  // POST /api/editor/save
  saveEditorData(req, res) {
    try {
      const updatedSite = siteModel.saveSiteData(req.body, dbService);
      console.log(`[Editor] Đã lưu thành công dữ liệu bản đồ (${updatedSite.pois?.length || 0} POIs, ${updatedSite.artifacts?.length || 0} Hiện vật, ${updatedSite.zones?.length || 0} Phân khu, ${updatedSite.tourRoute?.length || 0} Điểm tuyến đường)`);
      res.json({
        success: true,
        message: 'Đã lưu thành công dữ liệu bản đồ vào hệ thống!',
        data: updatedSite
      });
    } catch (err) {
      console.error('[Editor] Lỗi lưu siteData:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new SiteController();
