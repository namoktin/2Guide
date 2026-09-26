/**
 * 2Guide - dbService.js
 * Quản lý kết nối Cơ Sở Dữ Liệu: MongoDB Atlas (qua MONGODB_URI trong .env)
 * Kèm cơ chế Persistent Local File Store (tự động lưu vào data/db_store.json)
 * Tuyệt đối không lưu trữ dữ liệu lịch sử AI.
 * Tuyến đường di chuyển chỉ lưu trong phiên tham quan và xóa sạch khi kết thúc đoàn.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DB_FILE_PATH = path.join(__dirname, '..', 'data', 'db_store.json');

// 1. Mongoose Schema cho Thiết Bị Hub
const HubSchema = new mongoose.Schema({
  hubId: { type: String, required: true, unique: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  alt: { type: Number, default: 0 },
  yaw: { type: Number, default: 0 },
  pitch: { type: Number, default: 0 },
  roll: { type: Number, default: 0 },
  battery: { type: Number, default: 100 },
  startShiftBattery: { type: Number, default: 100 },
  endShiftBattery: { type: Number, default: null },
  lastSeen: { type: Number, default: Date.now },
  currentGroupId: { type: String, default: null },
  isOnline: { type: Boolean, default: true }
}, { timestamps: true });

// 2. Mongoose Schema cho Đoàn Khách Tham Quan (Tour Groups)
// Tuyến đường (trajectories) chỉ lưu khi đoàn hoạt động; xóa sạch khi kết thúc phiên
const TourGroupSchema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true, index: true },
  token: { type: String, index: true },
  groupName: String,
  leaderName: String,
  memberCount: Number,
  hubIds: [String],
  userAccessUrl: String,
  qrCodeDataUrl: String,
  createdAt: String,
  endedAt: String,
  status: { type: String, default: 'ACTIVE' },
  trajectories: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// 3. Mongoose Schema cho Dữ Liệu Khuôn Viên / Di Tích (Phân khu, Hiện vật, Tuyến tham quan)
const SiteDataSchema = new mongoose.Schema({
  siteCode: { type: String, default: 'NEU', unique: true },
  siteName: String,
  englishName: String,
  locationName: String,
  center: Object,
  zoom: Number,
  minZoom: Number,
  maxZoom: Number,
  zones: Array,
  pois: { type: Array, default: [] }, // Điểm di tích POIs
  artifacts: Array,                   // Đã bỏ vị trí cụ thể và chất liệu
  tourRoute: Array
}, { timestamps: true });

class DatabaseService {
  constructor() {
    this.isMongoConnected = false;
    this.mongoose = mongoose;
    this.saveTimeout = null;

    // Models
    this.HubModel = mongoose.models.Hub || mongoose.model('Hub', HubSchema);
    this.TourGroupModel = mongoose.models.TourGroup || mongoose.model('TourGroup', TourGroupSchema);
    this.SiteDataModel = mongoose.models.SiteData || mongoose.model('SiteData', SiteDataSchema);
  }

  // Khởi tạo kết nối MongoDB Atlas và đồng bộ dữ liệu ban đầu
  async init(context = {}) {
    const mongoUri = (process.env.MONGODB_URI || '').trim();

    if (mongoUri && mongoUri.startsWith('mongodb')) {
      try {
        console.log('[MongoDB Atlas] Đang kết nối tới cơ sở dữ liệu...');
        await mongoose.connect(mongoUri, {
          dbName: '2guide',
          serverSelectionTimeoutMS: 8000
        });
        this.isMongoConnected = true;
        console.log('[MongoDB Atlas] Đã kết nối MongoDB Atlas thành công (Database: 2guide)!');

        // Đồng bộ SiteData lên Atlas
        await this.syncSiteData(context.siteData);

        // Đồng bộ Hubs từ Atlas về bộ nhớ hoặc đẩy lên Atlas nếu rỗng
        await this.syncHubs(context.hubs);

        // Đồng bộ TourGroups từ Atlas về bộ nhớ
        await this.syncGroups(context.groups, context.groupTokens);

      } catch (err) {
        console.warn('[MongoDB Atlas] Lỗi kết nối MongoDB Atlas, chuyển sang lưu trữ an toàn db_store.json:', err.message);
      }
    } else {
      console.log('[Database] MONGODB_URI chưa được cấu hình. Sử dụng bộ lưu trữ an toàn data/db_store.json.');
    }

    return this.loadInitialData();
  }

  // Đồng bộ SiteData với MongoDB Atlas
  async syncSiteData(siteData) {
    if (!this.isMongoConnected || !siteData) return;
    try {
      const existing = await this.SiteDataModel.findOne({ siteCode: siteData.siteCode || 'NEU' });
      if (existing) {
        // Cập nhật in-memory siteData từ database Atlas
        siteData.siteName = existing.siteName || siteData.siteName;
        siteData.locationName = existing.locationName || siteData.locationName;
        siteData.center = existing.center || siteData.center;
        siteData.zoom = existing.zoom || siteData.zoom;
        siteData.zones = existing.zones || siteData.zones;
        if (existing.pois && existing.pois.length > 0) {
          siteData.pois = existing.pois;
        } else {
          // Nếu trên Atlas chưa có hoặc rỗng POI, đồng bộ POI hiện tại từ code lên Atlas
          await this.SiteDataModel.updateOne(
            { siteCode: siteData.siteCode || 'NEU' },
            { $set: { pois: siteData.pois || [] } }
          );
        }
        siteData.artifacts = existing.artifacts || siteData.artifacts;
        siteData.tourRoute = existing.tourRoute || siteData.tourRoute;
        console.log('[MongoDB Atlas] Đã nạp dữ liệu bản đồ từ MongoDB Atlas.');
      } else {
        // Lưu dữ liệu ban đầu lên Atlas
        const doc = {
          siteCode: siteData.siteCode || 'NEU',
          siteName: siteData.siteName,
          englishName: siteData.englishName,
          locationName: siteData.locationName,
          center: siteData.center,
          zoom: siteData.zoom,
          minZoom: siteData.minZoom,
          maxZoom: siteData.maxZoom,
          zones: siteData.zones,
          pois: siteData.pois || [],
          artifacts: siteData.artifacts,
          tourRoute: siteData.tourRoute
        };
        await this.SiteDataModel.create(doc);
        console.log('[MongoDB Atlas] Đã khởi tạo dữ liệu bản đồ mới lên MongoDB Atlas.');
      }
    } catch (e) {
      console.error('[MongoDB Atlas] Lỗi đồng bộ SiteData:', e.message);
    }
  }

  // Lưu SiteData khi người dùng biên tập trong Map Studio
  async saveSiteData(siteData) {
    if (!siteData) return;
    if (this.isMongoConnected) {
      try {
        await this.SiteDataModel.findOneAndUpdate(
          { siteCode: siteData.siteCode || 'NEU' },
          {
            siteCode: siteData.siteCode || 'NEU',
            siteName: siteData.siteName,
            locationName: siteData.locationName,
            center: siteData.center,
            zoom: siteData.zoom,
            zones: siteData.zones,
            pois: siteData.pois || [],
            artifacts: siteData.artifacts,
            tourRoute: siteData.tourRoute
          },
          { upsert: true, new: true }
        );
        console.log('[MongoDB Atlas] Đã lưu bản đồ biên tập lên MongoDB Atlas.');
      } catch (e) {
        console.error('[MongoDB Atlas] Lỗi lưu SiteData lên Atlas:', e.message);
      }
    }
  }

  // Đồng bộ Hubs với MongoDB Atlas
  async syncHubs(hubsMap) {
    if (!this.isMongoConnected || !hubsMap) return;
    try {
      const dbHubs = await this.HubModel.find({});
      if (dbHubs && dbHubs.length > 0) {
        dbHubs.forEach(h => {
          hubsMap[h.hubId] = {
            hubId: h.hubId,
            lat: h.lat,
            lng: h.lng,
            alt: h.alt || 0,
            yaw: h.yaw || 0,
            pitch: h.pitch || 0,
            roll: h.roll || 0,
            battery: h.battery || 100,
            startShiftBattery: h.startShiftBattery || 100,
            endShiftBattery: h.endShiftBattery || null,
            lastSeen: h.lastSeen || Date.now(),
            currentGroupId: h.currentGroupId || null,
            isOnline: h.isOnline !== undefined ? h.isOnline : true
          };
        });
        console.log(`[MongoDB Atlas] Đã nạp ${dbHubs.length} thiết bị Hub từ MongoDB Atlas.`);
      } else {
        // Lưu danh sách Hub ban đầu lên MongoDB Atlas
        const ops = Object.values(hubsMap).map(h => ({
          updateOne: {
            filter: { hubId: h.hubId },
            update: { $set: h },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await this.HubModel.bulkWrite(ops);
          console.log(`[MongoDB Atlas] Đã khởi tạo ${ops.length} thiết bị Hub lên MongoDB Atlas.`);
        }
      }
    } catch (e) {
      console.error('[MongoDB Atlas] Lỗi đồng bộ Hubs:', e.message);
    }
  }

  // Đồng bộ TourGroups với MongoDB Atlas
  async syncGroups(groupsMap, groupTokensMap) {
    if (!this.isMongoConnected || !groupsMap) return;
    try {
      const dbGroups = await this.TourGroupModel.find({});
      if (dbGroups && dbGroups.length > 0) {
        dbGroups.forEach(g => {
          const plain = g.toObject();
          // Nếu đoàn đã kết thúc, đảm bảo trajectories là rỗng
          if (plain.status === 'ENDED') {
            plain.trajectories = {};
          }
          groupsMap[plain.groupId] = plain;
          if (plain.token && plain.status === 'ACTIVE' && groupTokensMap) {
            groupTokensMap[plain.token] = plain.groupId;
          }
        });
        console.log(`[MongoDB Atlas] Đã nạp ${dbGroups.length} đoàn khách từ MongoDB Atlas.`);
      }
    } catch (e) {
      console.error('[MongoDB Atlas] Lỗi đồng bộ TourGroups:', e.message);
    }
  }

  // Nạp dữ liệu offline từ file db_store.json
  loadInitialData() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        console.log(`[Storage] Đã nạp từ db_store.json: ${Object.keys(parsed.groups || {}).length} đoàn, ${Object.keys(parsed.hubs || {}).length} hubs.`);
        return {
          hubs: parsed.hubs || {},
          groups: parsed.groups || {},
          groupTokens: parsed.groupTokens || {}
        };
      }
    } catch (err) {
      console.error('[Storage] Lỗi đọc db_store.json:', err.message);
    }

    return {
      hubs: {},
      groups: {},
      groupTokens: {}
    };
  }

  // Lưu trữ debounced (tránh ghi đĩa / DB quá dồn dập khi nhận telemetry)
  scheduleSave(state) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.persistData(state);
    }, 1500);
  }

  // Ghi đồng bộ ngay lập tức (tạo đoàn, kết thúc đoàn)
  saveImmediate(state) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.persistData(state);
  }

  // Thực hiện ghi dữ liệu xuống cả MongoDB Atlas và db_store.json
  async persistData(state) {
    // 1. Lưu vào file cục bộ an toàn
    this.persistToFile(state);

    // 2. Lưu vào MongoDB Atlas nếu đang kết nối
    if (this.isMongoConnected) {
      try {
        // Lưu Hubs
        if (state.hubs) {
          const hubList = Object.values(state.hubs);
          if (hubList.length > 0) {
            const ops = hubList.map(h => ({
              updateOne: {
                filter: { hubId: h.hubId },
                update: {
                  $set: {
                    lat: h.lat,
                    lng: h.lng,
                    alt: h.alt || 0,
                    yaw: h.yaw || 0,
                    battery: h.battery !== undefined ? h.battery : 100,
                    lastSeen: h.lastSeen || Date.now(),
                    currentGroupId: h.currentGroupId || null,
                    isOnline: h.isOnline !== undefined ? h.isOnline : true
                  }
                },
                upsert: true
              }
            }));
            await this.HubModel.bulkWrite(ops);
          }
        }

        // Lưu TourGroups
        if (state.groups) {
          const groupList = Object.values(state.groups);
          if (groupList.length > 0) {
            const groupOps = groupList.map(g => {
              // Quy định: Nếu đoàn đã kết thúc, xóa sạch trajectories
              const traj = (g.status === 'ENDED') ? {} : (g.trajectories || {});
              return {
                updateOne: {
                  filter: { groupId: g.groupId },
                  update: {
                    $set: {
                      token: g.token,
                      groupName: g.groupName,
                      leaderName: g.leaderName,
                      memberCount: g.memberCount,
                      hubIds: g.hubIds,
                      userAccessUrl: g.userAccessUrl,
                      qrCodeDataUrl: g.qrCodeDataUrl,
                      createdAt: g.createdAt,
                      endedAt: g.endedAt,
                      status: g.status,
                      trajectories: traj
                    }
                  },
                  upsert: true
                }
              };
            });
            await this.TourGroupModel.bulkWrite(groupOps);
          }
        }
      } catch (err) {
        console.error('[MongoDB Atlas] Lỗi cập nhật dữ liệu lên Atlas:', err.message);
      }
    }
  }

  persistToFile(state) {
    try {
      const dataToSave = {
        updatedAt: new Date().toISOString(),
        hubs: state.hubs || {},
        groups: state.groups || {},
        groupTokens: state.groupTokens || {}
      };

      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Lỗi lưu db_store.json:', err.message);
    }
  }
}

module.exports = new DatabaseService();
