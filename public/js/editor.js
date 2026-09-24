/**
 * 2Guide - editor.js
 * Studio Biên Tập Bản Đồ Di Tích: Kéo thả POI, vẽ vùng phân khu (Polygon), vẽ tuyến đường tham quan
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. KHỞI TẠO BẢN ĐỒ
  const map = MapCommon.initMap('editor-map', [21.02534, 105.84655], 19);

  let siteData = null;
  let pois = [];
  let zones = [];
  let tourRoute = [];

  let currentMode = 'poi'; // 'poi' | 'zone' | 'route'
  let selectedPoi = null;
  let selectedZone = null;

  // Lớp vẽ trên bản đồ
  const poiLayerGroup = L.featureGroup().addTo(map);
  const zoneLayerGroup = L.featureGroup().addTo(map);
  let routePolyline = null;
  const routeWaypointGroup = L.featureGroup().addTo(map);

  // Biến phục vụ vẽ vùng (Zone Drawing)
  let isDrawingZone = false;
  let tempZonePoints = [];
  let tempZoneLine = null;

  // Biến phục vụ vẽ tuyến (Route Drawing)
  let isDrawingRoute = false;

  // 2. NẠP DỮ LIỆU HIỆN TẠI TỪ SERVER
  await loadCurrentSiteData();

  async function loadCurrentSiteData() {
    try {
      const res = await fetch('/api/site-data');
      const json = await res.json();
      if (json.success && json.data) {
        siteData = json.data;
        pois = siteData.pois || [];
        zones = siteData.zones || [];
        tourRoute = siteData.tourRoute || [];

        renderAllOnMap();
        renderPoiList();
        renderZoneList();
        updateRoutePointCount();

        if (pois.length > 0) selectPoi(pois[0]);
      }
    } catch (e) {
      console.error('Lỗi tải site data:', e);
    }
  }

  // 3. VẼ TẤT CẢ LÊN BẢN ĐỒ
  function renderAllOnMap() {
    renderPoiMarkers();
    renderZonePolygons();
    renderRoutePolyline();
  }

  // --- VẼ CÁC ĐIỂM POI VỚI KHẢ NĂNG KÉO THẢ (DRAGGABLE) ---
  function renderPoiMarkers() {
    poiLayerGroup.clearLayers();

    pois.forEach(poi => {
      const pinHtml = `
        <div class="poi-pin-wrapper" title="${poi.number}. ${poi.name}">
          <div class="poi-pin-badge" style="display: block;">${poi.number}. ${poi.name}</div>
          <svg class="poi-pin-svg" width="30" height="38" viewBox="0 0 30 38" fill="none">
            <ellipse cx="15" cy="36" rx="8" ry="2.5" fill="rgba(0,0,0,0.35)"/>
            <path d="M15 0C6.72 0 0 6.72 0 15C0 24.5 13.2 36.8 14.4 37.9C14.7 38.2 15.3 38.2 15.6 37.9C16.8 36.8 30 24.5 30 15C30 6.72 23.28 0 15 0Z" fill="#b91c1c" stroke="#ffffff" stroke-width="1.6"/>
            <circle cx="15" cy="15" r="9" fill="#7f1d1d"/>
            <text x="15" y="19" font-size="11" font-weight="900" font-family="sans-serif" text-anchor="middle" fill="#fef08a">${poi.number}</text>
          </svg>
        </div>
      `;

      const poiIcon = L.divIcon({
        className: 'editor-poi-pin',
        html: pinHtml,
        iconSize: [30, 38],
        iconAnchor: [15, 38]
      });

      // BẬT TÍNH NĂNG KÉO THẢ (DRAGGABLE = TRUE)
      const marker = L.marker([poi.lat, poi.lng], {
        icon: poiIcon,
        draggable: true
      });

      // Khi người dùng kéo thả ghim đến vị trí mới
      marker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        poi.lat = Number(newLatLng.lat.toFixed(6));
        poi.lng = Number(newLatLng.lng.toFixed(6));
        if (selectedPoi && selectedPoi.id === poi.id) {
          document.getElementById('input-poi-lat').value = poi.lat;
          document.getElementById('input-poi-lng').value = poi.lng;
        }
        renderPoiList();
      });

      marker.on('click', () => {
        selectPoi(poi);
      });

      poiLayerGroup.addLayer(marker);
    });
  }

  // --- VẼ CÁC VÙNG PHÂN KHU (ZONES) ---
  function renderZonePolygons() {
    zoneLayerGroup.clearLayers();

    zones.forEach(zone => {
      const polygon = L.polygon(zone.polygon, {
        color: zone.color || '#3b82f6',
        weight: 2,
        fillColor: zone.color || '#3b82f6',
        fillOpacity: 0.18,
        dashArray: '5, 5'
      });

      polygon.bindTooltip(zone.shortName || zone.name, {
        permanent: true,
        direction: 'center',
        className: 'zone-label-tooltip'
      });

      polygon.on('click', () => {
        selectZone(zone);
      });

      zoneLayerGroup.addLayer(polygon);
    });
  }

  // --- VẼ TUYẾN ĐƯỜNG THAM QUAN (TOUR ROUTE) & CÁC NÚT ĐIỀU CHỈNH ---
  function renderRoutePolyline() {
    if (routePolyline) map.removeLayer(routePolyline);
    routeWaypointGroup.clearLayers();

    if (!tourRoute || tourRoute.length < 2) return;

    routePolyline = L.polyline(tourRoute, {
      color: '#f97316',
      weight: 4,
      opacity: 0.9,
      dashArray: '8, 8',
      lineJoin: 'round'
    }).addTo(map);

    // Tạo các nút tròn có thể kéo thả để uốn cong tuyến đường
    if (currentMode === 'route') {
      tourRoute.forEach((pt, idx) => {
        const handle = L.circleMarker(pt, {
          radius: 5,
          color: '#ffffff',
          weight: 2,
          fillColor: '#f97316',
          fillOpacity: 1,
          draggable: true
        });

        // Hỗ trợ kéo thả nút tuyến đường
        let isDragging = false;
        handle.on('mousedown', () => { isDragging = true; map.dragging.disable(); });
        map.on('mousemove', (e) => {
          if (isDragging) {
            handle.setLatLng(e.latlng);
            tourRoute[idx] = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
            routePolyline.setLatLngs(tourRoute);
          }
        });
        map.on('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            map.dragging.enable();
            updateRoutePointCount();
          }
        });

        routeWaypointGroup.addLayer(handle);
      });
    }
  }

  // 4. CHUYỂN ĐỔI CHẾ ĐỘ BIÊN TẬP
  const modeButtons = document.querySelectorAll('.mode-btn');
  const panels = {
    poi: document.getElementById('panel-poi'),
    zone: document.getElementById('panel-zone'),
    route: document.getElementById('panel-route')
  };

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentMode = btn.getAttribute('data-mode');
      Object.keys(panels).forEach(k => {
        panels[k].style.display = (k === currentMode) ? 'block' : 'none';
      });

      cancelZoneDrawing();
      isDrawingRoute = false;
      hideHint();

      // Render lại tuyến đường để bật/tắt các handle kéo nút
      renderRoutePolyline();
    });
  });

  // 5. XỬ LÝ SỰ KIỆN CLICK TRÊN BẢN ĐỒ THEO TỪNG CHẾ ĐỘ
  map.on('click', (e) => {
    const lat = Number(e.latlng.lat.toFixed(6));
    const lng = Number(e.latlng.lng.toFixed(6));

    // CHẾ ĐỘ 1: VẼ ĐIỂM POI
    if (currentMode === 'poi') {
      if (isAddingPoiMode) {
        // Thêm điểm mới tại vị trí click
        const nextNum = pois.length > 0 ? (Math.max(...pois.map(p => p.number || 0)) + 1) : 1;
        const newPoi = {
          id: `poi-${nextNum}`,
          number: nextNum,
          name: `Điểm số ${nextNum}`,
          frenchName: '',
          zoneId: 'zone-1',
          zoneName: 'Khu Trưng Bày',
          floor: 1,
          lat,
          lng,
          description: 'Mô tả tóm tắt điểm di tích...',
          audioGuide: `Chào mừng quý khách đến với điểm số ${nextNum}.`
        };

        pois.push(newPoi);
        renderPoiMarkers();
        renderPoiList();
        selectPoi(newPoi);
        setAddingPoiMode(false);
      }
    }

    // CHẾ ĐỘ 2: VẼ VÙNG PHÂN KHU (POLYGON)
    else if (currentMode === 'zone' && isDrawingZone) {
      tempZonePoints.push([lat, lng]);

      // Vẽ đường nối tạm thời
      if (tempZoneLine) map.removeLayer(tempZoneLine);
      tempZoneLine = L.polyline(tempZonePoints, { color: '#06b6d4', weight: 2, dashArray: '4, 4' }).addTo(map);

      showHint(`Đã chọn ${tempZonePoints.length} đỉnh. Bấm tiếp để thêm đỉnh hoặc bấm "Khép Kín Vùng" để hoàn tất.`);
    }

    // CHẾ ĐỘ 3: VẼ TUYẾN ĐƯỜNG
    else if (currentMode === 'route' && isDrawingRoute) {
      tourRoute.push([lat, lng]);
      renderRoutePolyline();
      updateRoutePointCount();
    }
  });

  // 6. LOGIC BIÊN TẬP POI (CHỌN, SỬA, XÓA)
  let isAddingPoiMode = false;
  const btnAddPoiMode = document.getElementById('btn-add-poi-mode');

  btnAddPoiMode.addEventListener('click', () => {
    setAddingPoiMode(!isAddingPoiMode);
  });

  function setAddingPoiMode(enable) {
    isAddingPoiMode = enable;
    if (enable) {
      btnAddPoiMode.textContent = 'Hủy Thêm';
      btnAddPoiMode.className = 'btn btn-secondary btn-sm';
      showHint('Hãy bấm vào vị trí bất kỳ trên bản đồ để đặt điểm POI mới');
    } else {
      btnAddPoiMode.textContent = '+ Thêm Điểm Mới';
      btnAddPoiMode.className = 'btn btn-primary btn-sm';
      hideHint();
    }
  }

  function selectPoi(poi) {
    selectedPoi = poi;
    document.getElementById('input-poi-number').value = poi.number || '';
    document.getElementById('input-poi-name').value = poi.name || '';
    document.getElementById('input-poi-french').value = poi.frenchName || '';
    document.getElementById('input-poi-zone').value = poi.zoneName || '';
    document.getElementById('select-poi-floor').value = poi.floor || 1;
    document.getElementById('input-poi-lat').value = poi.lat || '';
    document.getElementById('input-poi-lng').value = poi.lng || '';
    document.getElementById('input-poi-desc').value = poi.description || '';
    document.getElementById('input-poi-audio').value = poi.audioGuide || '';

    // Highlight row trong danh sách
    document.querySelectorAll('.poi-item-row').forEach(r => r.classList.remove('selected'));
    const targetRow = document.getElementById(`poi-row-${poi.id}`);
    if (targetRow) targetRow.classList.add('selected');

    map.setView([poi.lat, poi.lng], 20, { animate: true });
  }

  // Cập nhật POI
  document.getElementById('btn-update-poi').addEventListener('click', () => {
    if (!selectedPoi) {
      alert('Vui lòng chọn một điểm POI trước khi cập nhật!');
      return;
    }

    selectedPoi.number = parseInt(document.getElementById('input-poi-number').value) || selectedPoi.number;
    selectedPoi.name = document.getElementById('input-poi-name').value.trim() || selectedPoi.name;
    selectedPoi.frenchName = document.getElementById('input-poi-french').value.trim();
    selectedPoi.zoneName = document.getElementById('input-poi-zone').value.trim();
    selectedPoi.floor = parseInt(document.getElementById('select-poi-floor').value) || 1;
    selectedPoi.lat = parseFloat(document.getElementById('input-poi-lat').value) || selectedPoi.lat;
    selectedPoi.lng = parseFloat(document.getElementById('input-poi-lng').value) || selectedPoi.lng;
    selectedPoi.description = document.getElementById('input-poi-desc').value.trim();
    selectedPoi.audioGuide = document.getElementById('input-poi-audio').value.trim();

    renderPoiMarkers();
    renderPoiList();
    alert(`Đã cập nhật điểm số ${selectedPoi.number}: ${selectedPoi.name}!`);
  });

  // Xóa POI
  document.getElementById('btn-delete-poi').addEventListener('click', () => {
    if (!selectedPoi) return;
    if (confirm(`Bạn có chắc chắn muốn xóa điểm số ${selectedPoi.number}: "${selectedPoi.name}"?`)) {
      pois = pois.filter(p => p.id !== selectedPoi.id);
      selectedPoi = null;
      renderPoiMarkers();
      renderPoiList();
      if (pois.length > 0) selectPoi(pois[0]);
    }
  });

  function renderPoiList() {
    const listEl = document.getElementById('list-all-pois');
    document.getElementById('count-poi-display').textContent = pois.length;

    listEl.innerHTML = pois.map(p => `
      <div id="poi-row-${p.id}" class="edit-item-row poi-item-row ${selectedPoi && selectedPoi.id === p.id ? 'selected' : ''}" onclick="window.selectPoiById('${p.id}')">
        <div>
          <strong style="color: var(--accent-amber);">${p.number}.</strong>
          <span>${p.name}</span>
          <span style="font-size: 0.68rem; color: var(--text-dim); margin-left: 4px;">(T${p.floor || 1})</span>
        </div>
        <div style="font-size: 0.68rem; color: var(--accent-cyan); font-family: monospace;">
          ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}
        </div>
      </div>
    `).join('');
  }

  window.selectPoiById = (id) => {
    const p = pois.find(x => x.id === id);
    if (p) selectPoi(p);
  };

  // 7. LOGIC BIÊN TẬP VÙNG PHÂN KHU (ZONES)
  const btnStartZoneDraw = document.getElementById('btn-start-zone-draw');
  const btnFinishZoneDraw = document.getElementById('btn-finish-zone-draw');
  const btnCancelZoneDraw = document.getElementById('btn-cancel-zone-draw');

  btnStartZoneDraw.addEventListener('click', () => {
    isDrawingZone = true;
    tempZonePoints = [];
    showHint('Bấm liên tiếp lên bản đồ để đánh dấu các đỉnh của khu vực...');
  });

  btnFinishZoneDraw.addEventListener('click', () => {
    if (tempZonePoints.length < 3) {
      alert('Một vùng phân khu (Polygon) cần ít nhất 3 đỉnh!');
      return;
    }

    const zoneName = document.getElementById('input-zone-name').value.trim() || `Phân Khu ${zones.length + 1}`;
    const shortName = document.getElementById('input-zone-short').value.trim() || zoneName;
    const color = document.getElementById('input-zone-color').value || '#3b82f6';
    const floor = parseInt(document.getElementById('select-zone-floor').value) || 1;

    const newZone = {
      id: `zone-${Date.now()}`,
      name: zoneName,
      shortName: shortName,
      color: color,
      floor: floor,
      polygon: tempZonePoints
    };

    zones.push(newZone);
    cancelZoneDrawing();
    renderZonePolygons();
    renderZoneList();
    selectZone(newZone);
  });

  btnCancelZoneDraw.addEventListener('click', cancelZoneDrawing);

  function cancelZoneDrawing() {
    isDrawingZone = false;
    tempZonePoints = [];
    if (tempZoneLine) {
      map.removeLayer(tempZoneLine);
      tempZoneLine = null;
    }
    hideHint();
  }

  function selectZone(zone) {
    selectedZone = zone;
    document.getElementById('input-zone-name').value = zone.name || '';
    document.getElementById('input-zone-short').value = zone.shortName || '';
    document.getElementById('input-zone-color').value = zone.color || '#3b82f6';
    document.getElementById('select-zone-floor').value = zone.floor || 1;

    document.querySelectorAll('.zone-item-row').forEach(r => r.classList.remove('selected'));
    const targetRow = document.getElementById(`zone-row-${zone.id}`);
    if (targetRow) targetRow.classList.add('selected');

    if (zone.polygon && zone.polygon.length > 0) {
      map.fitBounds(L.polygon(zone.polygon).getBounds().pad(0.3));
    }
  }

  // Cập nhật Zone
  document.getElementById('btn-update-zone').addEventListener('click', () => {
    if (!selectedZone) {
      alert('Vui lòng chọn một vùng trước khi cập nhật!');
      return;
    }
    selectedZone.name = document.getElementById('input-zone-name').value.trim() || selectedZone.name;
    selectedZone.shortName = document.getElementById('input-zone-short').value.trim() || selectedZone.shortName;
    selectedZone.color = document.getElementById('input-zone-color').value || selectedZone.color;
    selectedZone.floor = parseInt(document.getElementById('select-zone-floor').value) || 1;

    renderZonePolygons();
    renderZoneList();
    alert(`Đã cập nhật phân khu "${selectedZone.name}"!`);
  });

  // Xóa Zone
  document.getElementById('btn-delete-zone').addEventListener('click', () => {
    if (!selectedZone) return;
    if (confirm(`Bạn có chắc chắn muốn xóa phân khu "${selectedZone.name}"?`)) {
      zones = zones.filter(z => z.id !== selectedZone.id);
      selectedZone = null;
      renderZonePolygons();
      renderZoneList();
    }
  });

  function renderZoneList() {
    const listEl = document.getElementById('list-all-zones');
    document.getElementById('count-zone-display').textContent = zones.length;

    listEl.innerHTML = zones.map(z => `
      <div id="zone-row-${z.id}" class="edit-item-row zone-item-row ${selectedZone && selectedZone.id === z.id ? 'selected' : ''}" onclick="window.selectZoneById('${z.id}')">
        <div>
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${z.color}; margin-right: 6px;"></span>
          <strong>${z.shortName || z.name}</strong>
        </div>
        <div style="font-size: 0.68rem; color: var(--text-dim);">
          ${z.polygon ? z.polygon.length : 0} đỉnh
        </div>
      </div>
    `).join('');
  }

  window.selectZoneById = (id) => {
    const z = zones.find(x => x.id === id);
    if (z) selectZone(z);
  };

  // 8. LOGIC BIÊN TẬP TUYẾN THAM QUAN (TOUR ROUTE)
  const btnAutoConnect = document.getElementById('btn-auto-connect-route');
  const btnStartRouteDraw = document.getElementById('btn-start-route-draw');
  const btnClearRoute = document.getElementById('btn-clear-route');

  // Nối tự động theo thứ tự các điểm POI (1 -> 20)
  btnAutoConnect.addEventListener('click', () => {
    if (pois.length < 2) {
      alert('Cần ít nhất 2 điểm POI để tự động tạo tuyến đường tham quan!');
      return;
    }

    // Sắp xếp POI theo thứ tự số tăng dần
    const sorted = [...pois].sort((a, b) => (a.number || 0) - (b.number || 0));
    tourRoute = sorted.map(p => [p.lat, p.lng]);

    renderRoutePolyline();
    updateRoutePointCount();
    alert(`Đã tự động nối tuyến đường qua ${tourRoute.length} điểm POI! Bạn có thể kéo thả các nút tròn màu cam để uốn lượn đường đi theo ý muốn.`);
  });

  btnStartRouteDraw.addEventListener('click', () => {
    isDrawingRoute = !isDrawingRoute;
    if (isDrawingRoute) {
      btnStartRouteDraw.textContent = 'Dừng Bấm Thêm Nút';
      btnStartRouteDraw.className = 'btn btn-secondary btn-sm';
      showHint('Hãy bấm lên bản đồ để thêm các khúc quanh/lối rẽ trên tuyến tham quan...');
    } else {
      btnStartRouteDraw.textContent = 'Bấm Thêm Nút Điểm';
      btnStartRouteDraw.className = 'btn btn-primary btn-sm';
      hideHint();
    }
  });

  btnClearRoute.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa tuyến đường tham quan hiện tại?')) {
      tourRoute = [];
      renderRoutePolyline();
      updateRoutePointCount();
    }
  });

  function updateRoutePointCount() {
    const countEl = document.getElementById('route-points-count');
    if (countEl) countEl.textContent = tourRoute.length;
  }

  // 9. LƯU VÀO HỆ THỐNG & XUẤT FILE JSON
  const btnSaveServer = document.getElementById('btn-save-server');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnResetDefault = document.getElementById('btn-reset-default');

  btnSaveServer.addEventListener('click', async () => {
    btnSaveServer.disabled = true;
    btnSaveServer.textContent = 'Đang lưu...';

    const payload = {
      siteCode: siteData?.siteCode || 'NHL',
      siteName: siteData?.siteName || 'Khu Di Tích Lịch Sử Nhà Tù Hỏa Lò',
      locationName: siteData?.locationName || 'Số 1 Phố Hỏa Lò, Hoàn Kiếm, Hà Nội',
      center: siteData?.center || { lat: 21.02534, lng: 105.84655 },
      zoom: siteData?.zoom || 19,
      zones: zones,
      pois: pois,
      tourRoute: tourRoute
    };

    try {
      const res = await fetch('/api/editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã lưu thành công dữ liệu bản đồ vào hệ thống! Cả Ban Quản Lý và Cổng Khách Tham Quan đã nhận dữ liệu mới.');
      } else {
        alert('Lỗi lưu dữ liệu: ' + data.error);
      }
    } catch (e) {
      alert('Lỗi kết nối tới server: ' + e.message);
    } finally {
      btnSaveServer.disabled = false;
      btnSaveServer.textContent = 'Lưu Vào Hệ Thống';
    }
  });

  btnExportJson.addEventListener('click', () => {
    const payload = {
      siteCode: siteData?.siteCode || 'NHL',
      siteName: siteData?.siteName || 'Khu Di Tích Lịch Sử Nhà Tù Hỏa Lò',
      center: siteData?.center || { lat: 21.02534, lng: 105.84655 },
      zones,
      pois,
      tourRoute
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siteData_${siteData?.siteCode || 'NHL'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnResetDefault.addEventListener('click', async () => {
    if (confirm('Bạn có muốn khôi phục lại dữ liệu gốc 20 điểm di tích Nhà tù Hỏa Lò?')) {
      await loadCurrentSiteData();
      alert('Đã khôi phục dữ liệu gốc!');
    }
  });

  // 10. TIỆN ÍCH HIỂN THỊ TỌA ĐỘ VÀ BANNER
  const coordStatus = document.getElementById('coord-status');
  map.on('mousemove', (e) => {
    coordStatus.textContent = `Lat: ${e.latlng.lat.toFixed(6)} | Lng: ${e.latlng.lng.toFixed(6)} | Zoom: ${map.getZoom()}`;
  });

  const drawingHint = document.getElementById('drawing-hint');
  function showHint(text) {
    drawingHint.textContent = text;
    drawingHint.style.display = 'block';
  }
  function hideHint() {
    drawingHint.style.display = 'none';
  }
});
