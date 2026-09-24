/**
 * 2Guide - map-common.js
 * Bản đồ Leaflet 2D, Lớp vệ tinh Google Maps, Phân khu di tích, Tuyến tham quan & Icon chỉ vị trí (Location Pointer Pin)
 */

const MapCommon = {
  // 1. KHỞI TẠO BẢN ĐỒ CƠ SỞ
  initMap(containerId = 'map', center = [21.02534, 105.84655], zoom = 19) {
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

  // 3. VẼ ĐƯỜNG TUYẾN THAM QUAN (VISITING ROUTE - THEO SƠ ĐỒ)
  renderTourRoute(map, tourRoute) {
    if (!tourRoute || !Array.isArray(tourRoute) || tourRoute.length < 2) return null;

    const routePolyline = L.polyline(tourRoute, {
      color: '#f97316', // Màu cam nổi bật theo sơ đồ tham quan
      weight: 3.5,
      opacity: 0.85,
      dashArray: '8, 8',
      lineJoin: 'round'
    }).addTo(map);

    routePolyline.bindPopup(`
      <div style="font-size: 0.8rem; font-weight: 700; color: #f97316;">
        Tuyến Tham Quan Khuyên Dùng (Từ Điểm 1 đến Điểm 20)
      </div>
    `);

    return routePolyline;
  },

  // 4. VẼ 20 ĐIỂM DI TÍCH (POIs) - DÙNG ICON CHỈ VỊ TRÍ CHUYÊN NGHIỆP (LOCATION PIN)
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
          ${poi.frenchName ? `<div style="font-size: 0.72rem; color: #94a3b8; font-style: italic; margin-bottom: 4px;">${poi.frenchName}</div>` : ''}
          <div class="poi-popup-zone">${poi.zoneName} ${poi.floor ? `(Tầng ${poi.floor})` : ''}</div>
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

  // 5. CẬP NHẬT MARKER CỦA HUB - ICON CHỈ VỊ TRÍ CÓ MŨI KIM NHỌN (LOCATION PIN)
  updateHubMarker(map, markerMap, hub, isSelf = false) {
    const { hubId, lat, lng, yaw, battery } = hub;

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
        </div>
      `;
    } else {
      // ICON CHỈ VỊ TRÍ CỦA THÀNH VIÊN KHÁC TRONG ĐOÀN - Ghim giọt nước xanh Cyan có 3 số cuối Hub ID
      iconSize = [32, 40];
      iconAnchor = [16, 40];
      const shortId = hubId.substring(hubId.length - 3);
      iconHtml = `
        <div class="member-pin-wrapper" title="Thành viên đoàn ${hubId}">
          <svg class="member-pin-svg" width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="38" rx="8" ry="2.5" fill="rgba(0,0,0,0.35)"/>
            <path d="M16 0C7.16 0 0 7.16 0 16C0 26 14.1 38.8 15.3 39.9C15.7 40.2 16.3 40.2 16.7 39.9C17.9 38.8 32 26 32 16C32 7.16 24.84 0 16 0Z" fill="#0ea5e9" stroke="#ffffff" stroke-width="1.8"/>
            <circle cx="16" cy="16" r="9.5" fill="#0f172a"/>
            <text x="16" y="20" font-size="8.5" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" text-anchor="middle" fill="#38bdf8">${shortId}</text>
          </svg>
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
      markerMap[hubId].setLatLng([lat, lng]);
      markerMap[hubId].setIcon(customIcon);
    } else {
      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      markerMap[hubId] = marker;
    }

    const popupContent = `
      <div style="font-size: 0.8rem; line-height: 1.4;">
        <div style="font-weight: 700; color: ${isSelf ? 'var(--accent-amber)' : 'var(--accent-cyan)'}; margin-bottom: 2px;">
          ${isSelf ? 'VỊ TRÍ CỦA BẠN' : 'THÀNH VIÊN TRONG ĐOÀN'}
        </div>
        <div>Mã Thiết Bị: <strong>${hubId}</strong></div>
        <div>Dung lượng pin: <strong>${battery !== undefined ? battery + '%' : '---'}</strong></div>
        <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
      </div>
    `;

    markerMap[hubId].bindPopup(popupContent);
    return markerMap[hubId];
  },

  // 6. PHÁT ÂM THANH THUYẾT MINH
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
