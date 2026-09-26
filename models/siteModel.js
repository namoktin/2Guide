/**
 * 2Guide - Model: SiteData (Dữ liệu địa lý, POIs, Hiện vật, Phân khu & Tuyến tham quan)
 */

const fs = require('fs');
const path = require('path');
const siteData = require('../data/siteData.js');

class SiteModel {
  constructor() {
    this.siteData = siteData;
  }

  getSiteData() {
    return this.siteData;
  }

  getCenter() {
    return this.siteData.center || { lat: 20.99965, lng: 105.84280 };
  }

  saveSiteData({ siteCode, siteName, locationName, center, zoom, zones, pois, artifacts, tourRoute }, dbService) {
    if (siteCode) this.siteData.siteCode = siteCode;
    if (siteName) this.siteData.siteName = siteName;
    if (locationName) this.siteData.locationName = locationName;
    if (center) this.siteData.center = center;
    if (zoom) this.siteData.zoom = zoom;
    if (zones) this.siteData.zones = zones;
    if (pois) this.siteData.pois = pois;
    if (artifacts) this.siteData.artifacts = artifacts;
    if (tourRoute) this.siteData.tourRoute = tourRoute;

    const fileContent = `/**
 * 2Guide - Dữ liệu thực địa: ${this.siteData.siteName || 'Khu Di Tích'}
 * Cập nhật tự động từ 2Guide Map Studio lúc ${new Date().toLocaleString('vi-VN')}
 */

module.exports = ${JSON.stringify(this.siteData, null, 2)};
`;

    fs.writeFileSync(path.join(__dirname, '..', 'data', 'siteData.js'), fileContent, 'utf8');

    if (dbService && typeof dbService.saveSiteData === 'function') {
      dbService.saveSiteData(this.siteData);
    }

    return this.siteData;
  }
}

module.exports = new SiteModel();
