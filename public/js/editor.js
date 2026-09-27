/**
 * 2Guide - editor.js
 * Studio Biên Tập Bản Đồ Di Tích: Kéo thả POI & Hiện Vật, vẽ vùng phân khu (Polygon)
 * Tính năng thông minh: 
 *  - Click trực tiếp lên bất kỳ điểm nào trên bản đồ để thêm POI / Hiện vật mới
 *  - Bấm vào mục đang chọn trong danh sách hoặc trên map để HỦY CHỌN (Deselect / Toggle)
 *  - Click / rê chuột trên bản đồ hoàn toàn tự do, tuyệt đối không bị nhảy hay chạy theo chuột
 * Bảo mật: Chỉ khởi tạo Bản đồ Leaflet và kích hoạt công cụ khi đã xác thực đúng Secret Key của Map Studio.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. MÀN HÌNH KHÓA XÁC THỰC MÃ BÍ MẬT MAP STUDIO
  const authOverlay = document.getElementById('editor-auth-lock-overlay');
  const inputKey = document.getElementById('input-editor-auth-key');
  const btnSubmitAuth = document.getElementById('btn-submit-editor-auth');
  const authErrorMsg = document.getElementById('editor-auth-error-msg');
  const authCard = authOverlay ? authOverlay.querySelector('.auth-lock-card') : null;
  const btnToggleVis = document.getElementById('btn-toggle-editor-key-vis');

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
      btnSubmitAuth.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 6px;">Đang xác thực bảo mật...</span>';
    }

    try {
      const res = await fetch('/api/editor/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorKey: entered, key: entered })
      });
      const data = await res.json();
      if (data.success) {
        // Gỡ màn hình khóa khỏi DOM
        if (authOverlay) authOverlay.remove();

        // Mở hiển thị thanh điều hướng và khung Studio
        const topNav = document.getElementById('editor-top-navbar');
        const mainApp = document.getElementById('editor-main-app');
        if (topNav) topNav.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'flex';

        // Khởi động Studio biên tập bản đồ
        initEditorDashboard(entered);
      } else {
        if (authErrorMsg) {
          authErrorMsg.textContent = data.error || 'Mã bí mật Map Studio không chính xác!';
          authErrorMsg.style.display = 'block';
        }
        if (authCard) {
          authCard.classList.remove('shake');
          void authCard.offsetWidth;
          authCard.classList.add('shake');
        }
        if (btnSubmitAuth) {
          btnSubmitAuth.disabled = false;
          btnSubmitAuth.innerHTML = 'Xác Thực & Mở Studio';
        }
        if (inputKey) inputKey.select();
      }
    } catch (e) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Lỗi kết nối máy chủ xác thực: ' + e.message;
        authErrorMsg.style.display = 'block';
      }
      if (btnSubmitAuth) {
        btnSubmitAuth.disabled = false;
        btnSubmitAuth.innerHTML = 'Xác Thực & Mở Studio';
      }
    }
  }

  if (btnSubmitAuth) btnSubmitAuth.addEventListener('click', handleEditorAuthSubmit);
  if (inputKey) {
    inputKey.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleEditorAuthSubmit();
    });
    setTimeout(() => inputKey.focus(), 150);
  }
});

/**
 * 2. KHỞI TẠO STUDIO BIÊN TẬP (CHỈ CHẠY SAU KHI ĐÃ NHẬP ĐÚNG KEY)
 */
async function initEditorDashboard(secretKey) {
  const getEditorKey = () => secretKey;

  // Nút Khóa Studio (Tải lại trang và xóa sạch RAM)
  const btnLockScreen = document.getElementById('btn-editor-lock-screen');
  if (btnLockScreen) {
    btnLockScreen.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Khởi tạo Bản đồ Leaflet
  const map = MapCommon.initMap('editor-map', [20.99965, 105.84280], 18);

  let siteData = null;
  let pois = [];
  let artifacts = [];
  let zones = [];

  let currentMode = 'poi'; // 'poi' | 'artifact' | 'zone'
  let selectedPoi = null;
  let selectedArtifact = null;
  let selectedZone = null;

  // Trạng thái chờ click trên map để thêm mới
  let isPlacingPoi = false;
  let isPlacingArtifact = false;

  // Lớp vẽ trên bản đồ
  const poiLayerGroup = L.featureGroup().addTo(map);
  const artifactLayerGroup = L.featureGroup().addTo(map);
  const zoneLayerGroup = L.featureGroup().addTo(map);

  // Biến phục vụ vẽ vùng (Zone Drawing)
  let isDrawingZone = false;
  let tempZonePoints = [];
  let tempZoneLine = null;

  // 3. NẠP DỮ LIỆU HIỆN TẠI TỪ SERVER
  await loadCurrentSiteData();

  async function loadCurrentSiteData() {
    try {
      const res = await fetch('/api/site-data');
      const json = await res.json();
      if (json.success && json.data) {
        siteData = json.data;
        pois = Array.isArray(siteData.pois) ? siteData.pois : [];
        artifacts = Array.isArray(siteData.artifacts) ? siteData.artifacts : [];
        zones = Array.isArray(siteData.zones) ? siteData.zones : [];

        if (siteData.center && siteData.center.lat && siteData.center.lng) {
          map.setView([siteData.center.lat, siteData.center.lng], siteData.zoom || 18);
        }

        populateZoneSelectDropdowns();
        renderAllOnMap();
        renderPoiList();
        renderArtifactList();
        renderZoneList();

        // Mặc định không bắt buộc chọn gì để form luôn sạch sẽ
        deselectPoi();
        deselectArtifact();
      }
    } catch (e) {
      console.error('[Editor] Lỗi tải site data:', e);
    }
  }

  function populateZoneSelectDropdowns() {
    const selPoiZone = document.getElementById('select-poi-zone');
    const selArtZone = document.getElementById('select-art-zone');
    const optionsHtml = zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');

    if (selPoiZone) selPoiZone.innerHTML = optionsHtml;
    if (selArtZone) selArtZone.innerHTML = optionsHtml;
  }

  function renderAllOnMap() {
    renderPoiMarkers();
    renderArtifactMarkers();
    renderZonePolygons();
  }

  // --- VẼ CÁC ĐIỂM DI TÍCH (POIs) VỚI KHẢ NĂNG KÉO THẢ ---
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

      const marker = L.marker([poi.lat, poi.lng], {
        icon: poiIcon,
        draggable: true
      }).addTo(poiLayerGroup);

      marker.on('click', () => {
        if (isPlacingPoi || isPlacingArtifact) return;
        switchMode('poi');
        // Toggle: Bấm vào POI đang chọn thì bỏ chọn
        if (selectedPoi && selectedPoi.id === poi.id) {
          deselectPoi();
        } else {
          selectPoi(poi);
        }
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        poi.lat = parseFloat(newPos.lat.toFixed(6));
        poi.lng = parseFloat(newPos.lng.toFixed(6));
        if (selectedPoi && selectedPoi.id === poi.id) {
          const latEl = document.getElementById('input-poi-lat');
          const lngEl = document.getElementById('input-poi-lng');
          if (latEl) latEl.value = poi.lat;
          if (lngEl) lngEl.value = poi.lng;
        }
        renderPoiList();
        showHint(`Đã dời vị trí "${poi.name}" sang [${poi.lat}, ${poi.lng}]`);
      });
    });
  }

  // --- VẼ HIỆN VẬT LỊCH SỬ (ARTIFACTS) VỚI TÍNH NĂNG KÉO THẢ ---
  function renderArtifactMarkers() {
    artifactLayerGroup.clearLayers();

    artifacts.forEach(art => {
      const iconHtml = `
        <div class="artifact-pin-wrapper" title="${art.name}">
          <div class="artifact-pin-badge">${art.name}</div>
          <svg class="artifact-pin-svg" width="28" height="36" viewBox="0 0 30 38" fill="none">
            <ellipse cx="15" cy="36" rx="8" ry="2.5" fill="rgba(0,0,0,0.35)"/>
            <path d="M15 0C6.72 0 0 6.72 0 15C0 24.5 13.2 36.8 14.4 37.9C14.7 38.2 15.3 38.2 15.6 37.9C16.8 36.8 30 24.5 30 15C30 6.72 23.28 0 15 0Z" fill="#d97706" stroke="#ffffff" stroke-width="1.6"/>
            <circle cx="15" cy="15" r="8" fill="#78350f"/>
            <text x="15" y="19" font-size="10" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" text-anchor="middle" fill="#ffffff">★</text>
          </svg>
        </div>
      `;

      const artIcon = L.divIcon({
        className: 'editor-artifact-pin',
        html: iconHtml,
        iconSize: [28, 36],
        iconAnchor: [14, 36]
      });

      const marker = L.marker([art.lat, art.lng], {
        icon: artIcon,
        draggable: true
      }).addTo(artifactLayerGroup);

      marker.on('click', () => {
        if (isPlacingPoi || isPlacingArtifact) return;
        switchMode('artifact');
        // Toggle: Bấm vào hiện vật đang chọn thì bỏ chọn
        if (selectedArtifact && selectedArtifact.id === art.id) {
          deselectArtifact();
        } else {
          selectArtifact(art);
        }
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        art.lat = parseFloat(newPos.lat.toFixed(6));
        art.lng = parseFloat(newPos.lng.toFixed(6));
        if (selectedArtifact && selectedArtifact.id === art.id) {
          const latEl = document.getElementById('input-art-lat');
          const lngEl = document.getElementById('input-art-lng');
          if (latEl) latEl.value = art.lat;
          if (lngEl) lngEl.value = art.lng;
        }
        renderArtifactList();
        showHint(`Đã dời hiện vật "${art.name}" sang [${art.lat}, ${art.lng}]`);
      });
    });
  }

  // --- VẼ VÙNG PHÂN KHU (ZONES - POLYGONS) ---
  function renderZonePolygons() {
    zoneLayerGroup.clearLayers();

    zones.forEach(zone => {
      if (!zone.polygon || zone.polygon.length < 3) return;

      const poly = L.polygon(zone.polygon, {
        color: zone.color || '#3b82f6',
        fillColor: zone.color || '#3b82f6',
        fillOpacity: (selectedZone && selectedZone.id === zone.id) ? 0.35 : 0.15,
        weight: (selectedZone && selectedZone.id === zone.id) ? 3 : 1.5,
        dashArray: '4, 4'
      }).addTo(zoneLayerGroup);

      poly.bindTooltip(zone.shortName || zone.name, {
        permanent: true,
        direction: 'center',
        className: 'zone-label-tooltip'
      });

      poly.on('click', () => {
        if (isPlacingPoi || isPlacingArtifact) return;
        switchMode('zone');
        // Toggle: Bấm vào phân khu đang chọn thì bỏ chọn
        if (selectedZone && selectedZone.id === zone.id) {
          deselectZone();
        } else {
          selectZone(zone);
        }
      });
    });
  }

  // 4. CHUYỂN ĐỔI CHẾ ĐỘ BIÊN TẬP
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchMode(btn.dataset.mode);
    });
  });

  function switchMode(mode) {
    currentMode = mode;
    modeButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    const panelPoi = document.getElementById('panel-poi');
    const panelArtifact = document.getElementById('panel-artifact');
    const panelZone = document.getElementById('panel-zone');

    if (panelPoi) panelPoi.style.display = (mode === 'poi') ? 'block' : 'none';
    if (panelArtifact) panelArtifact.style.display = (mode === 'artifact') ? 'block' : 'none';
    if (panelZone) panelZone.style.display = (mode === 'zone') ? 'block' : 'none';

    if (mode !== 'poi' && isPlacingPoi) setPlacingPoiMode(false);
    if (mode !== 'artifact' && isPlacingArtifact) setPlacingArtifactMode(false);
    if (mode !== 'zone' && isDrawingZone) cancelZoneDrawing();

    hideHint();
  }

  // 5. CÁC HÀM QUẢN LÝ CHẾ ĐỘ CLICK ĐẶT ĐIỂM TRÊN BẢN ĐỒ
  function setPlacingPoiMode(active) {
    isPlacingPoi = active;
    if (active) {
      if (isPlacingArtifact) setPlacingArtifactMode(false);
      if (isDrawingZone) cancelZoneDrawing();
      map.getContainer().style.cursor = 'crosshair';
      if (btnAddPoiMode) {
        btnAddPoiMode.textContent = '✕ Hủy Thêm POI';
        btnAddPoiMode.style.background = '#475569';
        btnAddPoiMode.style.borderColor = '#94a3b8';
        btnAddPoiMode.style.color = '#ffffff';
      }
      showHint('🎯 Hãy bấm vào bất kỳ chỗ nào trên bản đồ để đặt điểm POI mới');
    } else {
      map.getContainer().style.cursor = '';
      if (btnAddPoiMode) {
        btnAddPoiMode.textContent = '+ Thêm POI Mới';
        btnAddPoiMode.style.background = '';
        btnAddPoiMode.style.borderColor = '#ef4444';
        btnAddPoiMode.style.color = '#ef4444';
      }
      hideHint();
    }
  }

  function setPlacingArtifactMode(active) {
    isPlacingArtifact = active;
    if (active) {
      if (isPlacingPoi) setPlacingPoiMode(false);
      if (isDrawingZone) cancelZoneDrawing();
      map.getContainer().style.cursor = 'crosshair';
      if (btnAddArtifactMode) {
        btnAddArtifactMode.textContent = '✕ Hủy Thêm Hiện Vật';
        btnAddArtifactMode.style.background = '#475569';
        btnAddArtifactMode.style.borderColor = '#94a3b8';
        btnAddArtifactMode.style.color = '#ffffff';
      }
      showHint('🎯 Hãy bấm vào bất kỳ chỗ nào trên bản đồ để đặt Hiện vật mới');
    } else {
      map.getContainer().style.cursor = '';
      if (btnAddArtifactMode) {
        btnAddArtifactMode.textContent = '+ Thêm Hiện Vật Mới';
        btnAddArtifactMode.style.background = '';
        btnAddArtifactMode.style.borderColor = '#d97706';
        btnAddArtifactMode.style.color = '#fbbf24';
      }
      hideHint();
    }
  }

  // 6. XỬ LÝ CLICK TRÊN BẢN ĐỒ (CHỈ TẠO ĐIỂM KHI ĐANG BẬT CHẾ ĐỘ THÊM MỚI)
  map.on('click', (e) => {
    const lat = parseFloat(e.latlng.lat.toFixed(6));
    const lng = parseFloat(e.latlng.lng.toFixed(6));

    // A. ĐẶT POI MỚI TẠI VỊ TRÍ CLICK
    if (isPlacingPoi) {
      const nextNum = pois.length > 0 ? (Math.max(...pois.map(p => p.number || 0)) + 1) : 1;
      const newPoi = {
        id: `${siteData?.siteCode || 'NEU'}_POI_${String(nextNum).padStart(2, '0')}`,
        number: nextNum,
        name: `Điểm tham quan ${nextNum}`,
        englishName: `Visiting Point ${nextNum}`,
        zoneId: zones[0]?.id || 'ZONE_A1',
        zoneName: zones[0]?.name || 'Khu A1',
        floor: 1,
        lat: lat,
        lng: lng,
        description: 'Mô tả tóm tắt điểm di tích...',
        audioGuide: `Chào mừng bạn đến với điểm tham quan số ${nextNum}.`
      };
      pois.push(newPoi);
      renderPoiMarkers();
      renderPoiList();
      selectPoi(newPoi);
      setPlacingPoiMode(false);
      showHint(`✅ Đã thêm POI #${nextNum} tại vị trí [${lat}, ${lng}]!`);
      return;
    }

    // B. ĐẶT HIỆN VẬT MỚI TẠI VỊ TRÍ CLICK
    if (isPlacingArtifact) {
      const nextNum = artifacts.length > 0 ? (Math.max(...artifacts.map(a => a.number || 0)) + 1) : 1;
      const newArt = {
        id: `${siteData?.siteCode || 'NEU'}_ART_${String(nextNum).padStart(2, '0')}`,
        number: nextNum,
        name: `Hiện vật số ${nextNum}`,
        category: 'Kỷ Vật',
        zoneId: zones[0]?.id || 'ZONE_A2',
        zoneName: zones[0]?.name || 'Tòa Nhà Thế Kỷ A2',
        year: '2026',
        lat: lat,
        lng: lng,
        description: 'Mô tả tóm tắt lịch sử hiện vật...',
        audioGuide: `Chào mừng bạn đến với hiện vật số ${nextNum}.`
      };
      artifacts.push(newArt);
      renderArtifactMarkers();
      renderArtifactList();
      selectArtifact(newArt);
      setPlacingArtifactMode(false);
      showHint(`✅ Đã thêm Hiện vật #${nextNum} tại vị trí [${lat}, ${lng}]!`);
      return;
    }

    // C. VẼ VÙNG PHÂN KHU (ZONE POLYGON)
    if (currentMode === 'zone' && isDrawingZone) {
      tempZonePoints.push([lat, lng]);
      if (tempZoneLine) map.removeLayer(tempZoneLine);
      tempZoneLine = L.polyline(tempZonePoints, { color: '#3b82f6', weight: 2, dashArray: '3, 3' }).addTo(map);
      showHint(`Đã thêm đỉnh thứ ${tempZonePoints.length}. Bấm tiếp hoặc bấm "Khép Kín Vùng".`);
      return;
    }

    // KHI CLICK BÌNH THƯỜNG TRÊN MAP: KHÔNG LÀM GÌ CẢ!
    // Tuyệt đối không thay đổi tọa độ của POI hay Hiện vật, để người dùng tự do kéo rê và zoom bản đồ!
  });

  // 7. THAO TÁC ĐIỂM THAM QUAN (POIs)
  function selectPoi(poi) {
    selectedPoi = poi;
    if (!poi) return;

    const numEl = document.getElementById('input-poi-number');
    const nameEl = document.getElementById('input-poi-name');
    const engEl = document.getElementById('input-poi-eng');
    const zoneEl = document.getElementById('select-poi-zone');
    const floorEl = document.getElementById('input-poi-floor');
    const latEl = document.getElementById('input-poi-lat');
    const lngEl = document.getElementById('input-poi-lng');
    const descEl = document.getElementById('input-poi-desc');
    const audioEl = document.getElementById('input-poi-audio');

    if (numEl) numEl.value = poi.number ?? 1;
    if (nameEl) nameEl.value = poi.name || '';
    if (engEl) engEl.value = poi.englishName || poi.nameEn || '';
    if (zoneEl) zoneEl.value = poi.zoneId || '';
    if (floorEl) floorEl.value = poi.floor || 1;
    if (latEl) latEl.value = poi.lat ?? '';
    if (lngEl) lngEl.value = poi.lng ?? '';
    if (descEl) descEl.value = poi.description || '';
    if (audioEl) audioEl.value = poi.audioGuide || '';

    document.querySelectorAll('#list-all-pois .edit-item-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.id === poi.id);
    });
  }

  function deselectPoi() {
    selectedPoi = null;
    const numEl = document.getElementById('input-poi-number');
    const nameEl = document.getElementById('input-poi-name');
    const engEl = document.getElementById('input-poi-eng');
    const zoneEl = document.getElementById('select-poi-zone');
    const floorEl = document.getElementById('input-poi-floor');
    const latEl = document.getElementById('input-poi-lat');
    const lngEl = document.getElementById('input-poi-lng');
    const descEl = document.getElementById('input-poi-desc');
    const audioEl = document.getElementById('input-poi-audio');

    if (numEl) numEl.value = '';
    if (nameEl) nameEl.value = '';
    if (engEl) engEl.value = '';
    if (zoneEl) zoneEl.value = '';
    if (floorEl) floorEl.value = '1';
    if (latEl) latEl.value = '';
    if (lngEl) lngEl.value = '';
    if (descEl) descEl.value = '';
    if (audioEl) audioEl.value = '';

    document.querySelectorAll('#list-all-pois .edit-item-row').forEach(row => {
      row.classList.remove('selected');
    });
    showHint('Đã bỏ chọn POI.');
  }

  const btnAddPoiMode = document.getElementById('btn-add-poi-mode');
  if (btnAddPoiMode) {
    btnAddPoiMode.addEventListener('click', () => {
      setPlacingPoiMode(!isPlacingPoi);
    });
  }

  const btnUpdatePoi = document.getElementById('btn-update-poi');
  if (btnUpdatePoi) {
    btnUpdatePoi.addEventListener('click', () => {
      if (!selectedPoi) {
        alert('Vui lòng chọn một điểm POI trước khi cập nhật!');
        return;
      }
      const numEl = document.getElementById('input-poi-number');
      const nameEl = document.getElementById('input-poi-name');
      const engEl = document.getElementById('input-poi-eng');
      const zoneEl = document.getElementById('select-poi-zone');
      const floorEl = document.getElementById('input-poi-floor');
      const latEl = document.getElementById('input-poi-lat');
      const lngEl = document.getElementById('input-poi-lng');
      const descEl = document.getElementById('input-poi-desc');
      const audioEl = document.getElementById('input-poi-audio');

      if (numEl) selectedPoi.number = parseInt(numEl.value, 10) || selectedPoi.number;
      if (nameEl) selectedPoi.name = nameEl.value.trim() || selectedPoi.name;
      if (engEl) selectedPoi.englishName = engEl.value.trim();
      if (zoneEl) {
        selectedPoi.zoneId = zoneEl.value;
        const matchedZone = zones.find(z => z.id === zoneEl.value);
        if (matchedZone) selectedPoi.zoneName = matchedZone.name;
      }
      if (floorEl) selectedPoi.floor = parseInt(floorEl.value, 10) || 1;
      if (latEl && !isNaN(parseFloat(latEl.value))) selectedPoi.lat = parseFloat(latEl.value);
      if (lngEl && !isNaN(parseFloat(lngEl.value))) selectedPoi.lng = parseFloat(lngEl.value);
      if (descEl) selectedPoi.description = descEl.value.trim();
      if (audioEl) selectedPoi.audioGuide = audioEl.value.trim();

      renderPoiMarkers();
      renderPoiList();
      showHint(`Đã cập nhật POI: ${selectedPoi.name}`);
    });
  }

  const btnDeletePoi = document.getElementById('btn-delete-poi');
  if (btnDeletePoi) {
    btnDeletePoi.addEventListener('click', () => {
      if (!selectedPoi) return;
      if (confirm(`Bạn có chắc chắn muốn xóa điểm POI "${selectedPoi.name}"?`)) {
        pois = pois.filter(p => p.id !== selectedPoi.id);
        deselectPoi();
        renderPoiMarkers();
        renderPoiList();
        showHint('Đã xóa điểm POI.');
      }
    });
  }

  function renderPoiList() {
    const listEl = document.getElementById('list-all-pois');
    const countEl = document.getElementById('count-poi-display');
    if (countEl) countEl.textContent = pois.length;
    if (!listEl) return;

    listEl.innerHTML = pois.map(p => `
      <div class="edit-item-row ${selectedPoi && selectedPoi.id === p.id ? 'selected' : ''}" data-id="${p.id}" onclick="selectPoiById('${p.id}')">
        <div>
          <strong style="color: #ef4444;">${p.number}.</strong> ${p.name}
        </div>
        <div style="font-size: 0.68rem; color: var(--text-dim);">
          [${p.lat}, ${p.lng}]
        </div>
      </div>
    `).join('');
  }

  window.selectPoiById = (id) => {
    // Bấm vào POI đang chọn -> HỦY CHỌN (Toggle Deselect)
    if (selectedPoi && selectedPoi.id === id) {
      deselectPoi();
      return;
    }
    const p = pois.find(x => x.id === id);
    if (p) {
      selectPoi(p);
      map.setView([p.lat, p.lng], 19);
    }
  };

  // 8. THAO TÁC HIỆN VẬT LỊCH SỬ (ARTIFACTS)
  function selectArtifact(art) {
    selectedArtifact = art;
    if (!art) return;

    const numEl = document.getElementById('input-art-number');
    const nameEl = document.getElementById('input-art-name');
    const catEl = document.getElementById('input-art-category');
    const yearEl = document.getElementById('input-art-year');
    const zoneEl = document.getElementById('select-art-zone');
    const latEl = document.getElementById('input-art-lat');
    const lngEl = document.getElementById('input-art-lng');
    const descEl = document.getElementById('input-art-desc');
    const audioEl = document.getElementById('input-art-audio');

    if (numEl) numEl.value = art.number ?? 1;
    if (nameEl) nameEl.value = art.name || '';
    if (catEl) catEl.value = art.category || '';
    if (yearEl) yearEl.value = art.year || '';
    if (zoneEl) zoneEl.value = art.zoneId || '';
    if (latEl) latEl.value = art.lat ?? '';
    if (lngEl) lngEl.value = art.lng ?? '';
    if (descEl) descEl.value = art.description || '';
    if (audioEl) audioEl.value = art.audioGuide || '';

    document.querySelectorAll('#list-all-artifacts .edit-item-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.id === art.id);
    });
  }

  function deselectArtifact() {
    selectedArtifact = null;
    const numEl = document.getElementById('input-art-number');
    const nameEl = document.getElementById('input-art-name');
    const catEl = document.getElementById('input-art-category');
    const yearEl = document.getElementById('input-art-year');
    const zoneEl = document.getElementById('select-art-zone');
    const latEl = document.getElementById('input-art-lat');
    const lngEl = document.getElementById('input-art-lng');
    const descEl = document.getElementById('input-art-desc');
    const audioEl = document.getElementById('input-art-audio');

    if (numEl) numEl.value = '';
    if (nameEl) nameEl.value = '';
    if (catEl) catEl.value = '';
    if (yearEl) yearEl.value = '';
    if (zoneEl) zoneEl.value = '';
    if (latEl) latEl.value = '';
    if (lngEl) lngEl.value = '';
    if (descEl) descEl.value = '';
    if (audioEl) audioEl.value = '';

    document.querySelectorAll('#list-all-artifacts .edit-item-row').forEach(row => {
      row.classList.remove('selected');
    });
    showHint('Đã bỏ chọn hiện vật.');
  }

  const btnAddArtifactMode = document.getElementById('btn-add-artifact-mode');
  if (btnAddArtifactMode) {
    btnAddArtifactMode.addEventListener('click', () => {
      setPlacingArtifactMode(!isPlacingArtifact);
    });
  }

  const btnUpdateArtifact = document.getElementById('btn-update-artifact');
  if (btnUpdateArtifact) {
    btnUpdateArtifact.addEventListener('click', () => {
      if (!selectedArtifact) {
        alert('Vui lòng chọn một hiện vật trước khi cập nhật!');
        return;
      }
      const numEl = document.getElementById('input-art-number');
      const nameEl = document.getElementById('input-art-name');
      const catEl = document.getElementById('input-art-category');
      const yearEl = document.getElementById('input-art-year');
      const zoneEl = document.getElementById('select-art-zone');
      const latEl = document.getElementById('input-art-lat');
      const lngEl = document.getElementById('input-art-lng');
      const descEl = document.getElementById('input-art-desc');
      const audioEl = document.getElementById('input-art-audio');

      if (numEl) selectedArtifact.number = parseInt(numEl.value, 10) || selectedArtifact.number;
      if (nameEl) selectedArtifact.name = nameEl.value.trim() || selectedArtifact.name;
      if (catEl) selectedArtifact.category = catEl.value.trim();
      if (yearEl) selectedArtifact.year = yearEl.value.trim();
      if (zoneEl) {
        selectedArtifact.zoneId = zoneEl.value;
        const matchedZone = zones.find(z => z.id === zoneEl.value);
        if (matchedZone) selectedArtifact.zoneName = matchedZone.name;
      }
      if (latEl && !isNaN(parseFloat(latEl.value))) selectedArtifact.lat = parseFloat(latEl.value);
      if (lngEl && !isNaN(parseFloat(lngEl.value))) selectedArtifact.lng = parseFloat(lngEl.value);
      if (descEl) selectedArtifact.description = descEl.value.trim();
      if (audioEl) selectedArtifact.audioGuide = audioEl.value.trim();

      renderArtifactMarkers();
      renderArtifactList();
      showHint(`Đã cập nhật hiện vật: ${selectedArtifact.name}`);
    });
  }

  const btnDeleteArtifact = document.getElementById('btn-delete-artifact');
  if (btnDeleteArtifact) {
    btnDeleteArtifact.addEventListener('click', () => {
      if (!selectedArtifact) return;
      if (confirm(`Bạn có chắc chắn muốn xóa hiện vật "${selectedArtifact.name}"?`)) {
        artifacts = artifacts.filter(a => a.id !== selectedArtifact.id);
        deselectArtifact();
        renderArtifactMarkers();
        renderArtifactList();
        showHint('Đã xóa hiện vật.');
      }
    });
  }

  function renderArtifactList() {
    const listEl = document.getElementById('list-all-artifacts');
    const countEl = document.getElementById('count-artifact-display');
    if (countEl) countEl.textContent = artifacts.length;
    if (!listEl) return;

    listEl.innerHTML = artifacts.map(a => `
      <div class="edit-item-row ${selectedArtifact && selectedArtifact.id === a.id ? 'selected' : ''}" data-id="${a.id}" onclick="selectArtifactById('${a.id}')">
        <div>
          <strong style="color: #fbbf24;">★</strong> ${a.name} (${a.category || 'Hiện vật'})
        </div>
        <div style="font-size: 0.68rem; color: var(--text-dim);">
          [${a.lat}, ${a.lng}]
        </div>
      </div>
    `).join('');
  }

  window.selectArtifactById = (id) => {
    // Bấm vào hiện vật đang chọn -> HỦY CHỌN (Toggle Deselect)
    if (selectedArtifact && selectedArtifact.id === id) {
      deselectArtifact();
      return;
    }
    const a = artifacts.find(x => x.id === id);
    if (a) {
      selectArtifact(a);
      map.setView([a.lat, a.lng], 19);
    }
  };

  // 9. THAO TÁC VÙNG PHÂN KHU (ZONES)
  function selectZone(zone) {
    selectedZone = zone;
    if (!zone) return;

    const nameEl = document.getElementById('input-zone-name');
    const shortEl = document.getElementById('input-zone-short');
    const colorEl = document.getElementById('input-zone-color');
    const floorEl = document.getElementById('select-zone-floor');

    if (nameEl) nameEl.value = zone.name || '';
    if (shortEl) shortEl.value = zone.shortName || '';
    if (colorEl) colorEl.value = zone.color || '#3b82f6';
    if (floorEl) floorEl.value = zone.floor || 1;

    document.querySelectorAll('#list-all-zones .edit-item-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.id === zone.id);
    });

    renderZonePolygons();
  }

  function deselectZone() {
    selectedZone = null;
    const nameEl = document.getElementById('input-zone-name');
    const shortEl = document.getElementById('input-zone-short');
    const colorEl = document.getElementById('input-zone-color');
    const floorEl = document.getElementById('select-zone-floor');

    if (nameEl) nameEl.value = '';
    if (shortEl) shortEl.value = '';
    if (colorEl) colorEl.value = '#3b82f6';
    if (floorEl) floorEl.value = '1';

    document.querySelectorAll('#list-all-zones .edit-item-row').forEach(row => {
      row.classList.remove('selected');
    });
    renderZonePolygons();
    showHint('Đã bỏ chọn phân khu.');
  }

  const btnStartZoneDraw = document.getElementById('btn-start-zone-draw');
  if (btnStartZoneDraw) {
    btnStartZoneDraw.addEventListener('click', () => {
      isDrawingZone = true;
      tempZonePoints = [];
      if (tempZoneLine) map.removeLayer(tempZoneLine);
      tempZoneLine = null;
      showHint('Bắt đầu vẽ vùng: Bấm các điểm trên bản đồ để tạo đa giác ranh giới.');
    });
  }

  const btnFinishZoneDraw = document.getElementById('btn-finish-zone-draw');
  if (btnFinishZoneDraw) {
    btnFinishZoneDraw.addEventListener('click', () => {
      if (tempZonePoints.length < 3) {
        alert('Một vùng phân khu cần ít nhất 3 đỉnh để khép kín!');
        return;
      }

      const nameEl = document.getElementById('input-zone-name');
      const shortEl = document.getElementById('input-zone-short');
      const colorEl = document.getElementById('input-zone-color');
      const floorEl = document.getElementById('select-zone-floor');

      const newZone = {
        id: `ZONE_${Date.now()}`,
        name: (nameEl ? nameEl.value.trim() : '') || `Phân Khu Mới ${zones.length + 1}`,
        shortName: (shortEl ? shortEl.value.trim() : '') || `Khu ${zones.length + 1}`,
        color: (colorEl ? colorEl.value : '') || '#3b82f6',
        floor: parseInt(floorEl ? floorEl.value : 1, 10) || 1,
        polygon: [...tempZonePoints]
      };

      zones.push(newZone);
      cancelZoneDrawing();
      populateZoneSelectDropdowns();
      renderZonePolygons();
      renderZoneList();
      selectZone(newZone);
      showHint(`Đã tạo thành công phân khu "${newZone.name}"!`);
    });
  }

  const btnCancelZoneDraw = document.getElementById('btn-cancel-zone-draw');
  if (btnCancelZoneDraw) btnCancelZoneDraw.addEventListener('click', cancelZoneDrawing);

  function cancelZoneDrawing() {
    isDrawingZone = false;
    tempZonePoints = [];
    if (tempZoneLine) {
      map.removeLayer(tempZoneLine);
      tempZoneLine = null;
    }
    hideHint();
  }

  const btnUpdateZone = document.getElementById('btn-update-zone');
  if (btnUpdateZone) {
    btnUpdateZone.addEventListener('click', () => {
      if (!selectedZone) {
        alert('Vui lòng chọn một phân khu trước khi cập nhật!');
        return;
      }
      const nameEl = document.getElementById('input-zone-name');
      const shortEl = document.getElementById('input-zone-short');
      const colorEl = document.getElementById('input-zone-color');
      const floorEl = document.getElementById('select-zone-floor');

      if (nameEl) selectedZone.name = nameEl.value.trim();
      if (shortEl) selectedZone.shortName = shortEl.value.trim();
      if (colorEl) selectedZone.color = colorEl.value;
      if (floorEl) selectedZone.floor = parseInt(floorEl.value, 10) || 1;

      populateZoneSelectDropdowns();
      renderZonePolygons();
      renderZoneList();
      showHint(`Đã cập nhật phân khu: ${selectedZone.name}`);
    });
  }

  const btnDeleteZone = document.getElementById('btn-delete-zone');
  if (btnDeleteZone) {
    btnDeleteZone.addEventListener('click', () => {
      if (!selectedZone) return;
      if (confirm(`Bạn có chắc chắn muốn xóa phân khu "${selectedZone.name}"?`)) {
        zones = zones.filter(z => z.id !== selectedZone.id);
        deselectZone();
        populateZoneSelectDropdowns();
        renderZonePolygons();
        renderZoneList();
        showHint('Đã xóa phân khu.');
      }
    });
  }

  function renderZoneList() {
    const listEl = document.getElementById('list-all-zones');
    const countEl = document.getElementById('count-zone-display');
    if (countEl) countEl.textContent = zones.length;
    if (!listEl) return;

    listEl.innerHTML = zones.map(z => `
      <div class="edit-item-row ${selectedZone && selectedZone.id === z.id ? 'selected' : ''}" data-id="${z.id}" onclick="selectZoneById('${z.id}')">
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
    // Bấm vào phân khu đang chọn -> HỦY CHỌN
    if (selectedZone && selectedZone.id === id) {
      deselectZone();
      return;
    }
    const z = zones.find(x => x.id === id);
    if (z) {
      selectZone(z);
      if (z.polygon && z.polygon.length > 0) {
        const bounds = L.latLngBounds(z.polygon);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  };

  // 10. LƯU VÀO HỆ THỐNG & XUẤT FILE JSON
  const btnSaveServer = document.getElementById('btn-save-server');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnResetDefault = document.getElementById('btn-reset-default');

  if (btnSaveServer) {
    btnSaveServer.addEventListener('click', async () => {
      btnSaveServer.disabled = true;
      btnSaveServer.textContent = 'Đang lưu...';

      const payload = {
        siteCode: siteData?.siteCode || 'NEU',
        siteName: siteData?.siteName || 'Trường Đại Học Kinh Tế Quốc Dân (NEU)',
        englishName: siteData?.englishName || 'National Economics University Campus',
        locationName: siteData?.locationName || '207 Đường Giải Phóng, Hà Nội',
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
            'X-Editor-Secret': getEditorKey()
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
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const payload = {
        siteCode: siteData?.siteCode || 'NEU',
        siteName: siteData?.siteName || 'Trường Đại Học Kinh Tế Quốc Dân (NEU)',
        englishName: siteData?.englishName || 'National Economics University Campus',
        locationName: siteData?.locationName || '207 Đường Giải Phóng, Hà Nội',
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
  }

  if (btnResetDefault) {
    btnResetDefault.addEventListener('click', async () => {
      if (confirm('Bạn có muốn tải lại dữ liệu từ hệ thống?')) {
        await loadCurrentSiteData();
        alert('Đã tải lại dữ liệu thành công!');
      }
    });
  }

  // Tiện ích hiển thị tọa độ
  const coordStatus = document.getElementById('coord-status');
  map.on('mousemove', (e) => {
    if (coordStatus) {
      coordStatus.textContent = `Lat: ${e.latlng.lat.toFixed(6)} | Lng: ${e.latlng.lng.toFixed(6)} | Zoom: ${map.getZoom()}`;
    }
  });

  const drawingHint = document.getElementById('drawing-hint');
  function showHint(text) {
    if (drawingHint) {
      drawingHint.textContent = text;
      drawingHint.style.display = 'block';
    }
  }
  function hideHint() {
    if (drawingHint) {
      drawingHint.style.display = 'none';
    }
  }

  // Cập nhật lại kích thước hiển thị bản đồ
  setTimeout(() => { if (map) map.invalidateSize(); }, 80);
  setTimeout(() => { if (map) map.invalidateSize(); }, 250);
}
