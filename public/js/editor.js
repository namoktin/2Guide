/**
 * 2Guide - editor.js
 * Studio Biên Tập Bản Đồ Di Tích: Kéo thả POI & Hiện Vật, vẽ vùng phân khu (Polygon), vẽ tuyến đường tham quan
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. KHỞI TẠO BẢN ĐỒ
  const map = MapCommon.initMap('editor-map', [20.99965, 105.84280], 18);

  let siteData = null;
  let pois = [];
  let artifacts = [];
  let zones = [];
  let currentMode = 'poi'; // 'poi' | 'artifact' | 'zone'
  let selectedPoi = null;
  let selectedArtifact = null;
  let selectedZone = null;

  // Lớp vẽ trên bản đồ
  const poiLayerGroup = L.featureGroup().addTo(map);
  const artifactLayerGroup = L.featureGroup().addTo(map);
  const zoneLayerGroup = L.featureGroup().addTo(map);

  // Biến phục vụ vẽ vùng (Zone Drawing)
  let isDrawingZone = false;
  let tempZonePoints = [];
  let tempZoneLine = null;

  // 2. NẠP DỮ LIỆU HIỆN TẠI TỪ SERVER
  await loadCurrentSiteData();

  async function loadCurrentSiteData() {
    try {
      const res = await fetch('/api/site-data');
      const json = await res.json();
      if (json.success && json.data) {
        siteData = json.data;
        pois = siteData.pois || [];
        artifacts = siteData.artifacts || [];
        zones = siteData.zones || [];

        if (siteData.center) {
          map.setView([siteData.center.lat, siteData.center.lng], siteData.zoom || 18);
        }

        populateZoneSelectDropdown();
        renderAllOnMap();
        renderPoiList();
        renderArtifactList();
        renderZoneList();

        if (pois.length > 0) selectPoi(pois[0]);
        else if (artifacts.length > 0) selectArtifact(artifacts[0]);
      }
    } catch (e) {
      console.error('Lỗi tải site data:', e);
    }
  }

  // Đổ danh sách Phân Khu vào dropdown của POI
  function populateZoneSelectDropdown() {
    const selZone = document.getElementById('select-poi-zone');
    if (!selZone) return;
    selZone.innerHTML = zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
  }

  // 3. VẼ TẤT CẢ LÊN BẢN ĐỒ
  function renderAllOnMap() {
    renderPoiMarkers();
    renderArtifactMarkers();
    renderZonePolygons();
  }

  // --- VẼ CÁC ĐIỂM DI TÍCH (POIs) VỚI KHẢ NĂNG KÉO THẢ (DRAGGABLE) ---
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
            <text x="15" y="19" font-size="11" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" text-anchor="middle" fill="#fef08a">${poi.number}</text>
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

  // --- VẼ CÁC HIỆN VẬT LỊCH SỬ VỚI KHẢ NĂNG KÉO THẢ (DRAGGABLE) ---
  function renderArtifactMarkers() {
    artifactLayerGroup.clearLayers();

    artifacts.forEach(art => {
      const pinHtml = `
        <div class="artifact-pin-wrapper" title="[Hiện Vật] ${art.name}">
          <div class="artifact-pin-badge" style="display: block;">${art.number}. ${art.name}</div>
          <svg class="artifact-pin-svg" width="28" height="36" viewBox="0 0 28 36" fill="none">
            <ellipse cx="14" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.4)"/>
            <path d="M14 0C6.27 0 0 6.27 0 14C0 23 12.3 34.8 13.4 35.9C13.7 36.2 14.3 36.2 14.6 35.9C15.7 34.8 28 23 28 14C28 6.27 21.73 0 14 0Z" fill="#d97706" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="14" cy="14" r="8" fill="#78350f"/>
            <polygon points="14,8 19,14 14,20 9,14" fill="#fbbf24"/>
          </svg>
        </div>
      `;

      const artIcon = L.divIcon({
        className: 'editor-art-pin',
        html: pinHtml,
        iconSize: [28, 36],
        iconAnchor: [14, 36]
      });

      const marker = L.marker([art.lat, art.lng], {
        icon: artIcon,
        draggable: true
      });

      marker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        art.lat = Number(newLatLng.lat.toFixed(6));
        art.lng = Number(newLatLng.lng.toFixed(6));
        if (selectedArtifact && selectedArtifact.id === art.id) {
          document.getElementById('input-art-lat').value = art.lat;
          document.getElementById('input-art-lng').value = art.lng;
        }
        renderArtifactList();
      });

      marker.on('click', () => {
        selectArtifact(art);
      });

      artifactLayerGroup.addLayer(marker);
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

  // 4. CHUYỂN ĐỔI CHẾ ĐỘ BIÊN TẬP
  const modeButtons = document.querySelectorAll('.mode-btn');
  const panels = {
    poi: document.getElementById('panel-poi'),
    artifact: document.getElementById('panel-artifact'),
    zone: document.getElementById('panel-zone')
  };

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentMode = btn.getAttribute('data-mode');
      Object.keys(panels).forEach(k => {
        if (panels[k]) {
          panels[k].style.display = (k === currentMode) ? 'block' : 'none';
        }
      });

      setAddingPoiMode(false);
      setAddingArtifactMode(false);
      cancelZoneDrawing();
      hideHint();
    });
  });

  // 5. XỬ LÝ SỰ KIỆN CLICK TRÊN BẢN ĐỒ THEO TỪNG CHẾ ĐỘ
  map.on('click', (e) => {
    const lat = Number(e.latlng.lat.toFixed(6));
    const lng = Number(e.latlng.lng.toFixed(6));

    // CHẾ ĐỘ 0: VẼ POI
    if (currentMode === 'poi') {
      if (isAddingPoiMode) {
        const nextNum = pois.length > 0 ? (Math.max(...pois.map(p => p.number || 0)) + 1) : 1;
        const defaultZone = zones.length > 0 ? zones[0] : { id: 'ZONE_A1', name: 'Khu A1' };
        const newPoi = {
          id: `NEU_POI_${String(nextNum).padStart(2, '0')}`,
          number: nextNum,
          name: `Điểm tham quan ${nextNum}`,
          englishName: `Visiting Point ${nextNum}`,
          zoneId: defaultZone.id,
          zoneName: defaultZone.shortName || defaultZone.name,
          floor: 1,
          lat,
          lng,
          description: 'Mô tả tóm tắt điểm di tích...',
          audioGuide: `Chào mừng bạn đến với điểm tham quan số ${nextNum}.`
        };

        pois.push(newPoi);
        renderPoiMarkers();
        renderPoiList();
        selectPoi(newPoi);
        setAddingPoiMode(false);
      }
    }

    // CHẾ ĐỘ 1: VẼ HIỆN VẬT LỊCH SỬ (ARTIFACTS)
    else if (currentMode === 'artifact') {
      if (isAddingArtifactMode) {
        const nextNum = artifacts.length > 0 ? (Math.max(...artifacts.map(a => a.number || 0)) + 1) : 1;
        const newArt = {
          id: `NEU_ART_${String(nextNum).padStart(2, '0')}`,
          number: nextNum,
          name: `Hiện vật số ${nextNum}`,
          category: 'Kỷ Vật',
          zoneId: 'ZONE_A2',
          zoneName: 'Tòa Nhà Thế Kỷ A2',
          year: new Date().getFullYear().toString(),
          lat,
          lng,
          description: 'Mô tả tóm tắt lịch sử hiện vật...',
          audioGuide: `Chào mừng bạn đến với hiện vật số ${nextNum}.`
        };

        artifacts.push(newArt);
        renderArtifactMarkers();
        renderArtifactList();
        selectArtifact(newArt);
        setAddingArtifactMode(false);
      }
    }

    // CHẾ ĐỘ 2: VẼ VÙNG PHÂN KHU (POLYGON)
    else if (currentMode === 'zone' && isDrawingZone) {
      tempZonePoints.push([lat, lng]);

      if (tempZoneLine) map.removeLayer(tempZoneLine);
      tempZoneLine = L.polyline(tempZonePoints, { color: '#06b6d4', weight: 2, dashArray: '4, 4' }).addTo(map);

      showHint(`Đã chọn ${tempZonePoints.length} đỉnh. Bấm tiếp để thêm đỉnh hoặc bấm "Khép Kín Vùng" để hoàn tất.`);
    }
  });

  // 6.0 LOGIC BIÊN TẬP POI (CHỌN, SỬA, XÓA)
  let isAddingPoiMode = false;
  const btnAddPoiMode = document.getElementById('btn-add-poi-mode');

  if (btnAddPoiMode) {
    btnAddPoiMode.addEventListener('click', () => {
      setAddingPoiMode(!isAddingPoiMode);
    });
  }

  function setAddingPoiMode(enable) {
    isAddingPoiMode = enable;
    if (!btnAddPoiMode) return;
    if (enable) {
      btnAddPoiMode.textContent = 'Hủy Thêm';
      btnAddPoiMode.className = 'btn btn-secondary btn-sm';
      showHint('Hãy bấm vào vị trí bất kỳ trên bản đồ để đặt điểm POI mới');
    } else {
      btnAddPoiMode.textContent = '+ Thêm POI Mới';
      btnAddPoiMode.className = 'btn btn-secondary btn-sm';
      hideHint();
    }
  }

  function selectPoi(poi) {
    selectedPoi = poi;
    document.getElementById('input-poi-number').value = poi.number || 1;
    document.getElementById('input-poi-name').value = poi.name || '';
    document.getElementById('input-poi-eng').value = poi.englishName || '';
    document.getElementById('select-poi-zone').value = poi.zoneId || '';
    document.getElementById('input-poi-floor').value = poi.floor || 1;
    document.getElementById('input-poi-lat').value = poi.lat || '';
    document.getElementById('input-poi-lng').value = poi.lng || '';
    document.getElementById('input-poi-desc').value = poi.description || '';
    document.getElementById('input-poi-audio').value = poi.audioGuide || '';

    document.querySelectorAll('.poi-item-row').forEach(r => r.classList.remove('selected'));
    const targetRow = document.getElementById(`poi-row-${poi.id}`);
    if (targetRow) targetRow.classList.add('selected');

    map.panTo([poi.lat, poi.lng]);
  }

  // Cập nhật POI
  const btnUpdatePoi = document.getElementById('btn-update-poi');
  if (btnUpdatePoi) {
    btnUpdatePoi.addEventListener('click', () => {
      if (!selectedPoi) {
        alert('Vui lòng chọn một POI trước khi cập nhật!');
        return;
      }
      selectedPoi.number = parseInt(document.getElementById('input-poi-number').value) || selectedPoi.number;
      selectedPoi.name = document.getElementById('input-poi-name').value.trim() || selectedPoi.name;
      selectedPoi.englishName = document.getElementById('input-poi-eng').value.trim() || selectedPoi.englishName;
      selectedPoi.zoneId = document.getElementById('select-poi-zone').value;
      const targetZone = zones.find(z => z.id === selectedPoi.zoneId);
      selectedPoi.zoneName = targetZone ? (targetZone.shortName || targetZone.name) : selectedPoi.zoneName;
      selectedPoi.floor = parseInt(document.getElementById('input-poi-floor').value) || 1;
      selectedPoi.lat = parseFloat(document.getElementById('input-poi-lat').value) || selectedPoi.lat;
      selectedPoi.lng = parseFloat(document.getElementById('input-poi-lng').value) || selectedPoi.lng;
      selectedPoi.description = document.getElementById('input-poi-desc').value.trim();
      selectedPoi.audioGuide = document.getElementById('input-poi-audio').value.trim();

      renderPoiMarkers();
      renderPoiList();
      alert(`Đã cập nhật POI: "${selectedPoi.name}"!`);
    });
  }

  // Xóa POI
  const btnDeletePoi = document.getElementById('btn-delete-poi');
  if (btnDeletePoi) {
    btnDeletePoi.addEventListener('click', () => {
      if (!selectedPoi) return;
      if (confirm(`Bạn có chắc chắn muốn xóa điểm POI "${selectedPoi.name}"?`)) {
        pois = pois.filter(p => p.id !== selectedPoi.id);
        selectedPoi = null;
        renderPoiMarkers();
        renderPoiList();
        if (pois.length > 0) selectPoi(pois[0]);
      }
    });
  }

  function renderPoiList() {
    const listEl = document.getElementById('list-all-pois');
    if (!listEl) return;
    document.getElementById('count-poi-display').textContent = pois.length;

    listEl.innerHTML = pois.map(p => `
      <div id="poi-row-${p.id}" class="edit-item-row poi-item-row ${selectedPoi && selectedPoi.id === p.id ? 'selected' : ''}" onclick="window.selectPoiById('${p.id}')">
        <div>
          <strong style="color: #ef4444;">${p.number}.</strong>
          <span>${p.name}</span>
        </div>
        <div style="font-size: 0.68rem; color: var(--text-dim);">
          ${p.lat}, ${p.lng}
        </div>
      </div>
    `).join('');
  }

  window.selectPoiById = (id) => {
    const p = pois.find(x => x.id === id);
    if (p) selectPoi(p);
  };

  // 6.1 LOGIC BIÊN TẬP HIỆN VẬT LỊCH SỬ (ARTIFACTS: CHỌN, SỬA, XÓA)
  let isAddingArtifactMode = false;
  const btnAddArtifactMode = document.getElementById('btn-add-artifact-mode');

  if (btnAddArtifactMode) {
    btnAddArtifactMode.addEventListener('click', () => {
      setAddingArtifactMode(!isAddingArtifactMode);
    });
  }

  function setAddingArtifactMode(enable) {
    isAddingArtifactMode = enable;
    if (!btnAddArtifactMode) return;
    if (enable) {
      btnAddArtifactMode.textContent = 'Hủy Thêm';
      btnAddArtifactMode.className = 'btn btn-secondary btn-sm';
      showHint('Hãy bấm vào vị trí bất kỳ trên bản đồ để đặt hiện vật mới');
    } else {
      btnAddArtifactMode.textContent = '+ Thêm Hiện Vật Mới';
      btnAddArtifactMode.className = 'btn btn-secondary btn-sm';
      hideHint();
    }
  }

  function selectArtifact(art) {
    selectedArtifact = art;
    document.getElementById('input-art-number').value = art.number || 1;
    document.getElementById('input-art-name').value = art.name || '';
    document.getElementById('input-art-category').value = art.category || '';
    document.getElementById('input-art-year').value = art.year || '';
    document.getElementById('input-art-lat').value = art.lat || '';
    document.getElementById('input-art-lng').value = art.lng || '';
    document.getElementById('input-art-desc').value = art.description || '';
    document.getElementById('input-art-audio').value = art.audioGuide || '';

    document.querySelectorAll('.art-item-row').forEach(r => r.classList.remove('selected'));
    const targetRow = document.getElementById(`art-row-${art.id}`);
    if (targetRow) targetRow.classList.add('selected');

    map.panTo([art.lat, art.lng]);
  }

  // Cập nhật Hiện Vật
  document.getElementById('btn-update-artifact').addEventListener('click', () => {
    if (!selectedArtifact) {
      alert('Vui lòng chọn một hiện vật trước khi cập nhật!');
      return;
    }
    selectedArtifact.number = parseInt(document.getElementById('input-art-number').value) || selectedArtifact.number;
    selectedArtifact.name = document.getElementById('input-art-name').value.trim() || selectedArtifact.name;
    selectedArtifact.category = document.getElementById('input-art-category').value.trim() || selectedArtifact.category;
    selectedArtifact.year = document.getElementById('input-art-year').value.trim() || selectedArtifact.year;
    selectedArtifact.lat = parseFloat(document.getElementById('input-art-lat').value) || selectedArtifact.lat;
    selectedArtifact.lng = parseFloat(document.getElementById('input-art-lng').value) || selectedArtifact.lng;
    selectedArtifact.description = document.getElementById('input-art-desc').value.trim();
    selectedArtifact.audioGuide = document.getElementById('input-art-audio').value.trim();

    renderArtifactMarkers();
    renderArtifactList();
    alert(`Đã cập nhật hiện vật: "${selectedArtifact.name}"!`);
  });

  // Xóa Hiện Vật
  document.getElementById('btn-delete-artifact').addEventListener('click', () => {
    if (!selectedArtifact) return;
    if (confirm(`Bạn có chắc chắn muốn xóa hiện vật "${selectedArtifact.name}"?`)) {
      artifacts = artifacts.filter(a => a.id !== selectedArtifact.id);
      selectedArtifact = null;
      renderArtifactMarkers();
      renderArtifactList();
      if (artifacts.length > 0) selectArtifact(artifacts[0]);
    }
  });

  function renderArtifactList() {
    const listEl = document.getElementById('list-all-artifacts');
    document.getElementById('count-artifact-display').textContent = artifacts.length;

    listEl.innerHTML = artifacts.map(a => `
      <div id="art-row-${a.id}" class="edit-item-row art-item-row ${selectedArtifact && selectedArtifact.id === a.id ? 'selected' : ''}" onclick="window.selectArtById('${a.id}')">
        <div>
          <strong style="color: #fbbf24;">${a.number}.</strong>
          <span>${a.name}</span>
        </div>
        <div style="font-size: 0.68rem; color: var(--text-dim);">
          ${a.lat}, ${a.lng}
        </div>
      </div>
    `).join('');
  }

  window.selectArtById = (id) => {
    const a = artifacts.find(x => x.id === id);
    if (a) selectArtifact(a);
  };

  // 7. LOGIC BIÊN TẬP VÙNG PHÂN KHU (ZONES)
  const btnStartZone = document.getElementById('btn-start-zone-draw');
  const btnFinishZone = document.getElementById('btn-finish-zone-draw');
  const btnCancelZone = document.getElementById('btn-cancel-zone-draw');

  btnStartZone.addEventListener('click', () => {
    isDrawingZone = true;
    tempZonePoints = [];
    if (tempZoneLine) map.removeLayer(tempZoneLine);
    showHint('Bấm các điểm trên bản đồ để xác định ranh giới vùng. Khi xong bấm "Khép Kín Vùng".');
  });

  btnFinishZone.addEventListener('click', () => {
    if (tempZonePoints.length < 3) {
      alert('Vùng phân khu cần ít nhất 3 điểm tọa độ để tạo thành đa giác khép kín!');
      return;
    }

    const nextId = `ZONE_${Date.now()}`;
    const newZone = {
      id: nextId,
      name: document.getElementById('input-zone-name').value.trim() || `Phân Khu Mới ${zones.length + 1}`,
      shortName: document.getElementById('input-zone-short').value.trim() || `Khu ${zones.length + 1}`,
      color: document.getElementById('input-zone-color').value || '#3b82f6',
      floor: parseInt(document.getElementById('select-zone-floor').value) || 1,
      polygon: [...tempZonePoints]
    };

    zones.push(newZone);
    populateZoneSelectDropdown();
    renderZonePolygons();
    renderZoneList();
    selectZone(newZone);

    cancelZoneDrawing();
    alert(`Đã tạo vùng phân khu: "${newZone.name}"!`);
  });

  btnCancelZone.addEventListener('click', () => {
    cancelZoneDrawing();
  });

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

    populateZoneSelectDropdown();
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
      populateZoneSelectDropdown();
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

  // 8. LƯU VÀO HỆ THỐNG & XUẤT FILE JSON
  const btnSaveServer = document.getElementById('btn-save-server');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnResetDefault = document.getElementById('btn-reset-default');

  // --- XÁC THỰC MÃ BÍ MẬT MAP STUDIO (MỖI LẦN VÀO PHẢI NHẬP KEY) ---
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  let sessionEditorKey = getCookie('editor_session_key') || '';
  const getEditorKey = () => sessionEditorKey;

  const authOverlay = document.getElementById('editor-auth-lock-overlay');
  const inputKey = document.getElementById('input-editor-auth-key');
  const btnSubmitAuth = document.getElementById('btn-submit-editor-auth');
  const authErrorMsg = document.getElementById('editor-auth-error-msg');
  const btnToggleVis = document.getElementById('btn-toggle-editor-key-vis');
  const btnLockScreen = document.getElementById('btn-editor-lock-screen');

  if (btnToggleVis && inputKey) {
    let isShowing = false;
    btnToggleVis.addEventListener('click', () => {
      isShowing = !isShowing;
      inputKey.type = isShowing ? 'text' : 'password';
      inputKey.classList.toggle('is-password', !isShowing);
      const svg = document.getElementById('editor-svg-eye');
      if (svg) {
        svg.innerHTML = isShowing
          ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>'
          : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }

  function showLockScreen() {
    sessionEditorKey = '';
    document.cookie = 'editor_session_key=; Path=/; Max-Age=0';
    if (authOverlay) authOverlay.style.display = 'flex';
    if (btnLockScreen) btnLockScreen.style.display = 'none';
    if (inputKey) {
      inputKey.value = '';
      setTimeout(() => inputKey.focus(), 150);
    }
    if (authErrorMsg) authErrorMsg.style.display = 'none';
  }

  if (btnLockScreen) {
    btnLockScreen.addEventListener('click', showLockScreen);
  }

  async function handleEditorAuthSubmit() {
    const entered = (inputKey ? inputKey.value : '').trim();
    if (!entered) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Vui lòng nhập mã bí mật Map Studio!';
        authErrorMsg.style.display = 'block';
      }
      return;
    }

    if (btnSubmitAuth) {
      btnSubmitAuth.disabled = true;
      btnSubmitAuth.textContent = 'Đang xác thực...';
    }

    try {
      const res = await fetch('/api/editor/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorKey: entered, key: entered })
      });
      const data = await res.json();
      if (data.success) {
        sessionEditorKey = entered;
        if (authOverlay) authOverlay.style.display = 'none';
        if (btnLockScreen) btnLockScreen.style.display = 'inline-flex';
        if (authErrorMsg) authErrorMsg.style.display = 'none';
      } else {
        if (authErrorMsg) {
          authErrorMsg.textContent = data.error || 'Mã bí mật Map Studio không chính xác!';
          authErrorMsg.style.display = 'block';
        }
      }
    } catch (e) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Lỗi kết nối máy chủ xác thực: ' + e.message;
        authErrorMsg.style.display = 'block';
      }
    } finally {
      if (btnSubmitAuth) {
        btnSubmitAuth.disabled = false;
        btnSubmitAuth.textContent = 'Xác Thực & Mở Studio';
      }
    }
  }

  if (btnSubmitAuth) {
    btnSubmitAuth.addEventListener('click', handleEditorAuthSubmit);
  }
  if (inputKey) {
    inputKey.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleEditorAuthSubmit();
    });
  }

  // Khởi tạo: nếu đã có session key từ cookie đăng nhập thì mở Studio ngay, ngược lại hiện màn hình khóa
  if (sessionEditorKey) {
    if (authOverlay) authOverlay.style.display = 'none';
    if (btnLockScreen) btnLockScreen.style.display = 'inline-flex';
  } else {
    showLockScreen();
  }

  btnSaveServer.addEventListener('click', async () => {
    if (!sessionEditorKey) {
      alert('Chưa xác thực mã bí mật Map Studio! Vui lòng tải lại trang và nhập mã.');
      showLockScreen();
      return;
    }

    btnSaveServer.disabled = true;
    btnSaveServer.textContent = 'Đang lưu...';

    const payload = {
      siteCode: siteData?.siteCode || 'NEU',
      siteName: siteData?.siteName || 'Trường Đại Học Kinh Tế Quốc Dân (NEU)',
      locationName: siteData?.locationName || '207 Đường Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội',
      center: siteData?.center || { lat: 20.99965, lng: 105.84280 },
      zoom: siteData?.zoom || 18,
      zones: zones,
      pois: pois,
      artifacts: artifacts,
      tourRoute: []
    };

    try {
      const res = await fetch('/api/editor/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Editor-Secret': getEditorKey(),
          'X-Admin-Secret': getEditorKey()
        },
        body: JSON.stringify({ ...payload, editorKey: getEditorKey() })
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã lưu thành công dữ liệu bản đồ vào hệ thống! Cả Ban Quản Lý và Cổng Khách Tham Quan đã nhận dữ liệu mới.');
      } else {
        alert('Lỗi lưu dữ liệu: ' + (data.error || 'Thao tác không thành công'));
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
      siteCode: siteData?.siteCode || 'NEU',
      siteName: siteData?.siteName || 'Trường Đại Học Kinh Tế Quốc Dân (NEU)',
      locationName: siteData?.locationName || '207 Đường Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội',
      center: siteData?.center || { lat: 20.99965, lng: 105.84280 },
      zoom: siteData?.zoom || 18,
      zones,
      pois,
      artifacts,
      tourRoute: []
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siteData_${siteData?.siteCode || 'NEU'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnResetDefault.addEventListener('click', async () => {
    if (confirm('Bạn có muốn khôi phục lại dữ liệu gốc của Trường Đại Học Kinh Tế Quốc Dân (NEU)?')) {
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
