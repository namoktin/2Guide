/**
 * 2Guide - map-common.js
 * Bản đồ Leaflet 2D, Lớp vệ tinh Google Maps, Phân khu di tích, Tuyến tham quan & Icon chỉ vị trí (Location Pointer Pin)
 */

const MapCommon = {
  // 1. KHỞI TẠO BẢN ĐỒ CƠ SỞ (MẶC ĐỊNH KHUÔN VIÊN NEU)
  initMap(containerId = 'map', center = [20.99965, 105.84280], zoom = 18) {
    const map = L.map(containerId, {
      center: center,
      zoom: zoom,
      minZoom: 16,
      maxZoom: 22,
      zoomControl: true
    });

    // Google Maps Vệ Tinh (Hybrid)
    const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      attribution: 'Google Maps Satellite'
    });

    // Google Maps Đường Phố (Roadmap)
    const googleRoadmap = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      attribution: 'Google Maps'
    });

    // CartoDB Voyager
    const cartoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: 'CartoDB'
    });

    googleHybrid.addTo(map);

    const baseLayers = {
      "Google Vệ Tinh (Hybrid)": googleHybrid,
      "Google Đường Phố": googleRoadmap,
      "CartoDB Bản Đồ Sáng": cartoVoyager
    };

    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

    return map;
  },

  // 2. VẼ CÁC PHÂN KHU DI TÍCH (ZONES)
  renderZones(map, zones) {
    const zoneLayers = L.featureGroup().addTo(map);

    zones.forEach(zone => {
      const polygon = L.polygon(zone.polygon, {
        color: zone.color || '#3b82f6',
        weight: 2,
        fillColor: zone.color || '#3b82f6',
        fillOpacity: 0.16,
        dashArray: '5, 5'
      });

      polygon.bindTooltip(zone.shortName || zone.name, {
        permanent: true,
        direction: 'center',
        className: 'zone-label-tooltip'
      });

      polygon.bindPopup(`
        <div style="padding: 4px;">
          <div style="font-weight: 700; color: ${zone.color}; margin-bottom: 4px;">${zone.name}</div>
          <div style="font-size: 0.76rem; color: #94a3b8;">${zone.floor ? `Mặt bằng: Tầng ${zone.floor}` : ''}</div>
        </div>
      `);

      zoneLayers.addLayer(polygon);
    });

    return zoneLayers;
  },

  // 3. VẼ ĐƯỜNG TUYẾN THAM QUAN (ĐÃ VÔ HIỆU HÓA HOÀN TOÀN THEO YÊU CẦU)
  renderTourRoute(map, tourRoute) {
    return null;
  },

  // 4. VẼ CÁC ĐIỂM DI TÍCH (POIs) - DÙNG ICON CHỈ VỊ TRÍ CHUYÊN NGHIỆP (LOCATION PIN)
  renderPOIs(map, pois, onPoiSelect = null) {
    const poiGroup = L.featureGroup().addTo(map);

    pois.forEach(poi => {
      // Icon ghim vị trí giọt nước (Teardrop Location Pin) có mũi kim nhọn cắm xuống tọa độ
      const pinHtml = `
        <div class="poi-pin-wrapper" title="${poi.number}. ${poi.name}">
          <div class="poi-pin-badge">${poi.number}. ${poi.name}</div>
          <svg class="poi-pin-svg" width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="15" cy="36" rx="8" ry="2.5" fill="rgba(0,0,0,0.35)"/>
            <path d="M15 0C6.72 0 0 6.72 0 15C0 24.5 13.2 36.8 14.4 37.9C14.7 38.2 15.3 38.2 15.6 37.9C16.8 36.8 30 24.5 30 15C30 6.72 23.28 0 15 0Z" fill="#b91c1c" stroke="#ffffff" stroke-width="1.6"/>
            <circle cx="15" cy="15" r="9" fill="#7f1d1d"/>
            <text x="15" y="19" font-size="11" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" text-anchor="middle" fill="#fef08a">${poi.number}</text>
          </svg>
        </div>
      `;

      const poiIcon = L.divIcon({
        className: 'custom-poi-marker',
        html: pinHtml,
        iconSize: [30, 38],
        iconAnchor: [15, 38],   // Đỉnh kim cắm chính xác tại (15, 38)
        popupAnchor: [0, -36]
      });

      const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon });

      const popupHtml = `
        <div style="padding: 4px; max-width: 280px;">
          <div class="poi-popup-title">${poi.number}. ${poi.name}</div>
          ${poi.englishName ? `<div style="font-size: 0.72rem; color: #94a3b8; font-style: italic; margin-bottom: 4px;">${poi.englishName}</div>` : ''}
          <div class="poi-popup-zone">${poi.zoneName || 'Khuôn Viên NEU'} ${poi.floor ? `(Tầng ${poi.floor})` : ''}</div>
          <div class="poi-popup-desc">${poi.description}</div>
          ${poi.audioGuide ? `
            <button class="btn btn-primary btn-sm btn-block btn-read-poi" style="margin-top: 8px;" data-poi-id="${poi.id}">
              Nghe Thuyết Minh POI
            </button>
          ` : ''}
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onPoiSelect) onPoiSelect(poi);
      });

      poiGroup.addLayer(marker);
    });

    map.on('popupopen', () => {
      const btn = document.querySelector('.btn-read-poi');
      if (btn) {
        btn.onclick = () => {
          const poiId = btn.getAttribute('data-poi-id');
          const targetPoi = pois.find(p => p.id === poiId);
          if (targetPoi && targetPoi.audioGuide) {
            MapCommon.speakText(targetPoi.audioGuide);
          }
        };
      }
    });

    return poiGroup;
  },

  // 4.1 VẼ CÁC HIỆN VẬT LỊCH SỬ & VĂN HÓA (ARTIFACTS / EXHIBITS)
  renderArtifacts(map, artifacts, onArtifactSelect = null) {
    if (!artifacts || !Array.isArray(artifacts)) return null;
    const artGroup = L.featureGroup().addTo(map);

    artifacts.forEach(art => {
      // Ghim Hiện Vật màu Vàng Hổ Phách với huy hiệu biểu tượng kim cương
      const pinHtml = `
        <div class="artifact-pin-wrapper" title="[Hiện Vật] ${art.name}">
          <div class="artifact-pin-badge">[Hiện Vật] ${art.name}</div>
          <svg class="artifact-pin-svg" width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="14" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.4)"/>
            <path d="M14 0C6.27 0 0 6.27 0 14C0 23 12.3 34.8 13.4 35.9C13.7 36.2 14.3 36.2 14.6 35.9C15.7 34.8 28 23 28 14C28 6.27 21.73 0 14 0Z" fill="#d97706" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="14" cy="14" r="8" fill="#78350f"/>
            <polygon points="14,8 19,14 14,20 9,14" fill="#fbbf24"/>
          </svg>
        </div>
      `;

      const artIcon = L.divIcon({
        className: 'custom-artifact-marker',
        html: pinHtml,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -34]
      });

      const marker = L.marker([art.lat, art.lng], { icon: artIcon });

      const popupHtml = `
        <div style="padding: 4px; max-width: 290px;">
          <div style="font-size: 0.7rem; color: #fbbf24; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            [HIỆN VẬT] ${art.category || 'Di Tích'}
          </div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #f59e0b; margin-bottom: 4px;">${art.name}</div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-bottom: 4px;">
            ${art.location ? `Vị trí: <strong>${art.location}</strong>` : ''} 
            ${art.year ? ` | Niên đại: <strong>${art.year}</strong>` : ''}
          </div>
          ${art.material ? `<div style="font-size: 0.72rem; color: #cbd5e1; margin-bottom: 6px;">Chất liệu: <em>${art.material}</em></div>` : ''}
          <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${art.description}</div>
          ${art.audioGuide ? `
            <button class="btn btn-secondary btn-sm btn-block btn-read-artifact" style="margin-top: 8px; border-color: #d97706; color: #fbbf24;" data-art-id="${art.id}">
              Nghe Thuyết Minh Hiện Vật
            </button>
          ` : ''}
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onArtifactSelect) onArtifactSelect(art);
      });

      artGroup.addLayer(marker);
    });

    map.on('popupopen', () => {
      const btn = document.querySelector('.btn-read-artifact');
      if (btn) {
        btn.onclick = () => {
          const artId = btn.getAttribute('data-art-id');
          const targetArt = artifacts.find(a => a.id === artId);
          if (targetArt && targetArt.audioGuide) {
            MapCommon.speakText(targetArt.audioGuide);
          }
        };
      }
    });

    return artGroup;
  },

  // 5. CẬP NHẬT MARKER CỦA HUB - ICON CHỈ VỊ TRÍ CÓ MŨI KIM NHỌN (LOCATION PIN)
  // 5. THUẬT TOÁN TÁCH MẠNG LƯỚI KHI NHIỀU NGƯỜI ĐỨNG GẦN NHAU (GRID NETWORK DISPERSION)
  // Khi nhiều du khách đứng sát nhau hoặc cùng 1 chỗ (< 4m), tách bung ra theo ma trận mạng lưới kèm đường spider line
  gridLinesGroup: null,

  applyGridNetworkDispersion(map, hubsList, selfHubId = null) {
    if (!hubsList || hubsList.length === 0) return [];

    if (!this.gridLinesGroup && map) {
      this.gridLinesGroup = L.featureGroup().addTo(map);
    }
    if (this.gridLinesGroup) {
      this.gridLinesGroup.clearLayers();
    }

    const result = hubsList.map(h => ({
      ...h,
      realLat: h.lat,
      realLng: h.lng,
      displayLat: h.lat,
      displayLng: h.lng,
      isCollided: false,
      clusterCount: 1,
      clusterMembers: [h.hubId]
    }));

    const THRESHOLD_METERS = 4.0;
    const METERS_PER_DEG_LAT = 111000;

    // 1. Nhóm các điểm gần nhau thành từng cụm
    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < result.length; i++) {
      if (visited.has(result[i].hubId)) continue;

      const cluster = [result[i]];
      visited.add(result[i].hubId);

      for (let j = i + 1; j < result.length; j++) {
        if (visited.has(result[j].hubId)) continue;

        const dLat = (result[i].lat - result[j].lat) * METERS_PER_DEG_LAT;
        const dLng = (result[i].lng - result[j].lng) * METERS_PER_DEG_LAT * Math.cos(result[i].lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        if (dist <= THRESHOLD_METERS) {
          cluster.push(result[j]);
          visited.add(result[j].hubId);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    // 2. Bố trí tách theo MẠNG LƯỚI (GRID MATRIX LAYOUT)
    clusters.forEach(cluster => {
      const N = cluster.length;
      const centerLat = cluster.reduce((sum, c) => sum + c.lat, 0) / N;
      const centerLng = cluster.reduce((sum, c) => sum + c.lng, 0) / N;
      const memberIds = cluster.map(c => c.hubId);

      // Xác định số cột của ma trận lưới
      const cols = N <= 2 ? 2 : (N <= 4 ? 2 : (N <= 6 ? 3 : (N <= 9 ? 3 : 4)));
      const rows = Math.ceil(N / cols);

      // Khoảng cách giữa các nút mạng lưới (~ 5.5 mét để các ghim tách bạch rõ ràng)
      const cellSpacingMeters = 5.5;
      const spacingLat = cellSpacingMeters / METERS_PER_DEG_LAT;
      const spacingLng = cellSpacingMeters / (METERS_PER_DEG_LAT * Math.cos(centerLat * Math.PI / 180));

      // Không vẽ bất kỳ điểm tâm hay đường nét nét đứt spider line nào theo yêu cầu người dùng
      cluster.forEach((hub, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;

        // Căn tâm ma trận lưới
        const offsetX = (col - (cols - 1) / 2) * spacingLng;
        const offsetY = ((rows - 1) / 2 - row) * spacingLat;

        hub.realLat = centerLat;
        hub.realLng = centerLng;
        hub.displayLat = centerLat + offsetY;
        hub.displayLng = centerLng + offsetX;
        hub.isCollided = true;
        hub.clusterCount = N;
        hub.clusterMembers = memberIds;
      });
    });

    return result;
  },

  // Giữ alias tương thích
  applyMicroOffsets(hubsList, selfHubId = null) {
    return this.applyGridNetworkDispersion(null, hubsList, selfHubId);
  },

  // 6. CẬP NHẬT MARKER CỦA HUB - GHIM VỊ TRÍ MŨI KIM NHỌN + CHỐNG ĐÈ CHỒNG
  updateHubMarker(map, markerMap, hub, isSelf = false, onMarkerClick = null) {
    const { hubId, lat, lng, displayLat, displayLng, yaw, battery, isCollided, clusterCount, clusterMembers } = hub;
    const finalLat = (displayLat !== undefined) ? displayLat : lat;
    const finalLng = (displayLng !== undefined) ? displayLng : lng;

    let iconHtml = '';
    let iconSize = [30, 38];
    let iconAnchor = [15, 38];

    if (isSelf) {
      // ICON CHỈ VỊ TRÍ CỦA "BẢN THÂN" - Ghim giọt nước vàng cam rực rỡ có gợn sóng radar
      iconSize = [38, 48];
      iconAnchor = [19, 48];
      iconHtml = `
        <div class="self-pin-wrapper" title="Vị trí của BẠN (${hubId})">
          <div class="self-ground-ripple"></div>
          <svg class="self-pin-svg" width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="19" cy="46" rx="10" ry="3" fill="rgba(0,0,0,0.4)"/>
            <path d="M19 0C8.5 0 0 8.5 0 19C0 31 16.6 46.5 18.2 47.9C18.6 48.2 19.4 48.2 19.8 47.9C21.4 46.5 38 31 38 19C38 8.5 29.5 0 19 0Z" fill="#f59e0b" stroke="#ffffff" stroke-width="2.2"/>
            <circle cx="19" cy="19" r="11" fill="#78350f"/>
            <text x="19" y="23" font-size="9" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" text-anchor="middle" fill="#ffffff">BẠN</text>
          </svg>
          ${isCollided ? `<div style="position: absolute; top: -6px; right: -6px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; border-radius: 10px; padding: 1px 5px; border: 1px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.5);">Mạng Lưới ${clusterCount}</div>` : ''}
        </div>
      `;
    } else {
      // Phân biệt màu sắc: Đã gom nhóm = Màu Xanh Nước | Chưa gom nhóm = Màu Xám
      iconSize = [32, 40];
      iconAnchor = [16, 40];
      const shortId = hubId.substring(hubId.length - 3);
      const isGrouped = !!hub.currentGroupId;

      // Màu xanh nước cho Hub đã gom nhóm, màu xám cho Hub chưa gom nhóm
      const pinColor = isGrouped ? '#0ea5e9' : '#64748b';
      const pinStroke = isGrouped ? '#ffffff' : '#cbd5e1';
      const circleColor = isGrouped ? '#0f172a' : '#334155';
      const textColor = isGrouped ? '#38bdf8' : '#f1f5f9';
      const groupTitle = isGrouped ? `Đoàn: ${hub.currentGroupId}` : 'Chưa gom nhóm (Tại quầy)';

      iconHtml = `
        <div class="member-pin-wrapper" title="${hubId} - ${groupTitle}">
          <svg class="member-pin-svg" width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="38" rx="8" ry="2.5" fill="rgba(0,0,0,0.35)"/>
            <path d="M16 0C7.16 0 0 7.16 0 16C0 26 14.1 38.8 15.3 39.9C15.7 40.2 16.3 40.2 16.7 39.9C17.9 38.8 32 26 32 16C32 7.16 24.84 0 16 0Z" fill="${pinColor}" stroke="${pinStroke}" stroke-width="1.8"/>
            <circle cx="16" cy="16" r="9.5" fill="${circleColor}"/>
            <text x="16" y="20" font-size="8.5" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" text-anchor="middle" fill="${textColor}">${shortId}</text>
          </svg>
          ${isCollided ? `<div style="position: absolute; top: -5px; right: -5px; background: ${isGrouped ? '#0369a1' : '#475569'}; color: #fff; font-size: 8px; font-weight: 700; border-radius: 8px; padding: 1px 4px; border: 1px solid #fff;">${clusterCount}</div>` : ''}
        </div>
      `;
    }

    const customIcon = L.divIcon({
      className: 'custom-hub-marker-container',
      html: iconHtml,
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: [0, -iconSize[1] + 4]
    });

    if (markerMap[hubId]) {
      markerMap[hubId].setLatLng([finalLat, finalLng]);
      markerMap[hubId].setIcon(customIcon);
    } else {
      const marker = L.marker([finalLat, finalLng], {
        icon: customIcon,
        zIndexOffset: isSelf ? 1000 : 100
      }).addTo(map);
      markerMap[hubId] = marker;
    }

    if (isSelf && markerMap[hubId].setZIndexOffset) {
      markerMap[hubId].setZIndexOffset(1000);
    }

    let clusterNote = '';
    if (isCollided && clusterMembers && clusterMembers.length > 1) {
      clusterNote = `
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #334155; font-size: 0.72rem; color: #f59e0b;">
          <strong>Đã tách mạng lưới (${clusterCount} người cùng vị trí):</strong>
          <div style="color: #94a3b8; margin-top: 2px;">${clusterMembers.join(', ')}</div>
        </div>
      `;
    }

    // Popup không hiện thông số chữ yaw hay tọa độ x,y, chỉ hiện thông tin ID thiết bị và pin
    const popupContent = `
      <div style="font-size: 0.8rem; line-height: 1.4;">
        <div style="font-weight: 700; color: ${isSelf ? 'var(--accent-amber)' : 'var(--accent-cyan)'}; margin-bottom: 2px;">
          ${isSelf ? 'VỊ TRÍ CỦA BẠN' : 'THÀNH VIÊN TRONG ĐOÀN'}
        </div>
        <div>Mã Thiết Bị: <strong>${hubId}</strong></div>
        <div>Dung lượng pin: <strong>${battery !== undefined ? battery + '%' : '---'}</strong></div>
        <div style="margin-top: 2px;">Hướng nhìn: <strong style="color: #fbbf24;">${Math.round(((Number(yaw) || 0) % 360 + 360) % 360)}°</strong></div>
        ${clusterNote}
      </div>
    `;

    markerMap[hubId].bindPopup(popupContent);

    // Gắn sự kiện khi click marker (dùng cho Admin để hiển thị nón góc nhìn)
    markerMap[hubId].off('click');
    markerMap[hubId].on('click', (e) => {
      try {
        markerMap[hubId].openPopup();
      } catch (err) {}
      if (onMarkerClick) {
        onMarkerClick(hub, e);
      }
    });

    return markerMap[hubId];
  },

  // 7. VẼ & XOAY NÓN TẦM NHÌN (FOV VISION CONE TRÊN BẢN ĐỒ 2D)
  // Chuẩn 5m, góc mở 45°, màu vàng hổ phách sáng (#fbbf24) viền và nền vàng ấm (#f59e0b)
  createVisionCone(map, lat, lng, yaw = 0, distanceMeters = 5, fovAngle = 45, options = {}) {
    let dist = distanceMeters;
    let fov = fovAngle;
    if (dist > fov && fov <= 20) {
      fov = distanceMeters;
      dist = fovAngle;
    }
    return this.renderVisionCone(map, null, lat, lng, yaw, fov, dist, options);
  },

  renderVisionCone(map, currentConeObj, lat, lng, yaw = 0, fovAngle = 45, distanceMeters = 5, options = {}) {
    const cLat = parseFloat(lat);
    const cLng = parseFloat(lng);
    const cYaw = parseFloat(yaw) || 0;
    const cFov = parseFloat(fovAngle) || 45;
    const cDist = parseFloat(distanceMeters) || 5;

    const METERS_PER_DEG_LAT = 111000;
    const radCenter = (cLat * Math.PI) / 180;
    const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * Math.cos(radCenter);

    const calcPoints = (targetLat, targetLng, targetYaw, targetFov, targetDist) => {
      const pLat = parseFloat(targetLat);
      const pLng = parseFloat(targetLng);
      const pYaw = parseFloat(targetYaw) || 0;
      const pFov = parseFloat(targetFov) || 45;
      const pDist = parseFloat(targetDist) || 5;

      const pRadCenter = (pLat * Math.PI) / 180;
      const degLng = METERS_PER_DEG_LAT * Math.cos(pRadCenter);

      const pts = [[pLat, pLng]];
      const halfFov = pFov / 2;
      const segments = 16;

      for (let i = 0; i <= segments; i++) {
        const currentAngleDeg = (pYaw - halfFov) + (pFov * i / segments);
        const rad = (currentAngleDeg * Math.PI) / 180;
        const dLat = (pDist * Math.cos(rad)) / METERS_PER_DEG_LAT;
        const dLng = (pDist * Math.sin(rad)) / degLng;
        pts.push([pLat + dLat, pLng + dLng]);
      }
      pts.push([pLat, pLng]);
      return pts;
    };

    const points = calcPoints(cLat, cLng, cYaw, cFov, cDist);

    if (currentConeObj && currentConeObj.conePolygon && map && map.hasLayer(currentConeObj.conePolygon)) {
      currentConeObj.conePolygon.setLatLngs(points);
      currentConeObj.lat = cLat;
      currentConeObj.lng = cLng;
      currentConeObj.yaw = cYaw;
      return currentConeObj;
    }

    const polyOptions = {
      color: (options && options.color) || '#fbbf24',
      weight: (options && options.weight) !== undefined ? options.weight : 1.5,
      opacity: (options && options.opacity) !== undefined ? options.opacity : 0.85,
      fillColor: (options && options.fillColor) || '#f59e0b',
      fillOpacity: (options && options.fillOpacity) !== undefined ? options.fillOpacity : 0.22,
      interactive: false
    };

    const conePolygon = L.polygon(points, polyOptions).addTo(map);

    try {
      if (conePolygon.bringToFront) conePolygon.bringToFront();
    } catch (e) {}

    const coneObj = {
      conePolygon,
      sightLine: null,
      lat: cLat,
      lng: cLng,
      yaw: cYaw,
      fovAngle: cFov,
      distanceMeters: cDist,
      setVision(newLat, newLng, newYaw, newFov, newDist) {
        const f = (newFov !== undefined) ? newFov : this.fovAngle;
        const d = (newDist !== undefined) ? newDist : this.distanceMeters;
        const newPts = calcPoints(newLat, newLng, newYaw, f, d);
        if (this.conePolygon && map && map.hasLayer(this.conePolygon)) {
          this.conePolygon.setLatLngs(newPts);
        }
        this.lat = newLat;
        this.lng = newLng;
        this.yaw = newYaw;
        return this;
      },
      remove() {
        if (this.conePolygon && map && map.hasLayer(this.conePolygon)) {
          map.removeLayer(this.conePolygon);
        }
        this.conePolygon = null;
      }
    };

    return coneObj;
  },

  // 7.1 KIỂM TRA ĐIỂM CÓ NẰM TRONG NÓN TẦM NHÌN (VISION CONE FOV) HAY KHÔNG
  // Dùng để kích hoạt tự động gửi số thứ tự hiện vật khi nhìn vào POI trong 3s (Tầm nhìn chuẩn 5m)
  isPointInVisionCone(userLat, userLng, userYaw = 0, targetLat, targetLng, fovAngle = 45, maxDistanceMeters = 5) {
    if (!userLat || !userLng || !targetLat || !targetLng) return false;

    const METERS_PER_DEG_LAT = 111000;
    const radCenter = (userLat * Math.PI) / 180;
    const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * Math.cos(radCenter);

    const dLatMeters = (targetLat - userLat) * METERS_PER_DEG_LAT;
    const dLngMeters = (targetLng - userLng) * METERS_PER_DEG_LNG;
    const dist = Math.sqrt(dLatMeters * dLatMeters + dLngMeters * dLngMeters);

    // Nếu khoảng cách vượt quá tầm nhìn tối đa (mặc định 5m)
    if (dist > maxDistanceMeters) return false;

    // Góc từ vị trí người dùng đến điểm mục tiêu (0 = Bắc, 90 = Đông, 180 = Nam, 270 = Tây)
    let bearing = Math.atan2(dLngMeters, dLatMeters) * (180 / Math.PI);
    bearing = (bearing + 360) % 360;

    // Chênh lệch góc giữa hướng nhìn (Yaw) và góc mục tiêu
    const cleanYaw = (Number(userYaw) || 0) % 360;
    let diff = Math.abs(bearing - cleanYaw);
    if (diff > 180) diff = 360 - diff;

    // Nằm trong nón tầm nhìn nếu góc chênh lệch <= một nửa góc mở FOV (45° / 2 = 22.5°)
    return diff <= (fovAngle / 2);
  },

  // 7.2 TÍNH TOÁN THÔNG SỐ KHÔNG GIAN 3D (KHOẢNG CÁCH, GÓC LỆCH VÀ TỌA ĐỘ TƯƠNG ĐỐI REL_X, REL_Z)
  calculateSpatialParams(userLat, userLng, userYaw = 0, targetLat, targetLng) {
    if (!userLat || !userLng || !targetLat || !targetLng) {
      return { distance: 0, bearing: 0, relativeAngle: 0, relX: 0, relZ: 0 };
    }

    const METERS_PER_DEG_LAT = 111000;
    const radCenter = (userLat * Math.PI) / 180;
    const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * Math.cos(radCenter);

    const dLatMeters = (targetLat - userLat) * METERS_PER_DEG_LAT;
    const dLngMeters = (targetLng - userLng) * METERS_PER_DEG_LNG;
    const distance = Math.max(0.05, Math.sqrt(dLatMeters * dLatMeters + dLngMeters * dLngMeters));

    // Góc la bàn từ người dùng đến mục tiêu (0 = Bắc, 90 = Đông, 180 = Nam, 270 = Tây)
    let bearing = Math.atan2(dLngMeters, dLatMeters) * (180 / Math.PI);
    bearing = (bearing + 360) % 360;

    // Góc lệch tương đối so với hướng mặt (Yaw): [-180° đến +180°]
    // > 0 là vật ở bên Phải, < 0 là vật ở bên Trái, ~0 là ở Chính Diện
    const cleanYaw = (Number(userYaw) || 0) % 360;
    let relAngle = bearing - cleanYaw;
    while (relAngle > 180) relAngle -= 360;
    while (relAngle < -180) relAngle += 360;

    // Tọa độ không gian 3D Web Audio (Quy chuẩn: +X = Phải, -X = Trái, -Z = Trước, +Z = Sau)
    const relRad = (relAngle * Math.PI) / 180;
    const relX = distance * Math.sin(relRad);
    const relZ = -distance * Math.cos(relRad);

    return {
      distance,
      bearing,
      relativeAngle: relAngle,
      relX,
      relZ
    };
  },

  // 7.3 TÍNH TOÁN ÂM LƯỢNG ĐỘNG THEO KHOẢNG CÁCH (DYNAMIC 3D DISTANCE VOLUME)
  // Rìa (5m): V_min = V_khách - 20% (tối thiểu 1%)
  // Sát vật (<= 0.3m = 30cm): V_max = V_khách + 50% (tối đa 100%)
  calculateDynamicVolume(baseVolumePercent, distanceMeters, maxDistance = 5, minDistance = 0.3) {
    const baseVol = Math.max(1, Math.min(100, Number(baseVolumePercent) || 50));
    const vMin = Math.max(1, baseVol - 20);
    const vMax = Math.min(100, baseVol + 50);

    const d = Math.max(minDistance, Math.min(maxDistance, distanceMeters));
    const progress = (maxDistance - d) / (maxDistance - minDistance); // 0 (ở rìa 10m) -> 1 (ở sát 0.3m)
    const currentVol = vMin + progress * (vMax - vMin);

    return {
      volumePercent: Math.round(currentVol),
      volumeGain: currentVol / 100,
      vMin,
      vMax,
      progress
    };
  },

  // 8. PHÁT ÂM THANH THUYẾT MINH
  speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
};
