/**
 * 2Guide - admin.js
 * Logic giao diện điều hành Ban Quản Lý Di Tích
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. KHỞI TẠO BẢN ĐỒ VÀ DỮ LIỆU KHU DI TÍCH
  const map = MapCommon.initMap('map');
  const hubMarkers = {}; // { [hubId]: L.Marker }
  let zoneLayerGroup = null;
  let poiLayerGroup = null;
  let heatLayer = null;
  let tourRouteLayer = null;

  let siteData = null;
  let allHubs = [];
  let allGroups = [];

  // Lấy dữ liệu khu di tích
  try {
    const res = await fetch('/api/site-data');
    const json = await res.json();
    if (json.success && json.data) {
      siteData = json.data;
      document.getElementById('site-name-display').textContent = siteData.siteName;
      document.title = `2Guide - BQL ${siteData.siteName}`;

      // Vẽ các phân khu & điểm POI
      zoneLayerGroup = MapCommon.renderZones(map, siteData.zones);
      poiLayerGroup = MapCommon.renderPOIs(map, siteData.pois);
      if (siteData.tourRoute) {
        tourRouteLayer = MapCommon.renderTourRoute(map, siteData.tourRoute);
      }
    }
  } catch (err) {
    console.error('Lỗi nạp site data:', err);
  }

  // 2. KẾT NỐI WEBSOCKET REALTIME
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('[Admin WS] Đã kết nối máy chủ realtime');
    ws.send(JSON.stringify({ type: 'REGISTER_ADMIN' }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'INIT_ADMIN_STATE') {
        allHubs = msg.hubs || [];
        allGroups = msg.groups || [];
        renderAllHubsOnMap();
        renderHubsList();
        renderActiveGroups();
        populateBroadcastTargetDropdown();
      } else if (msg.type === 'HUB_LOCATION_UPDATE') {
        const hub = msg.hub;
        if (hub) {
          const idx = allHubs.findIndex(h => h.hubId === hub.hubId);
          if (idx >= 0) allHubs[idx] = hub;
          else allHubs.push(hub);

          // Cập nhật marker trên bản đồ
          MapCommon.updateHubMarker(map, hubMarkers, hub, false);
          renderHubsList();
        }
      } else if (msg.type === 'GROUP_CREATED') {
        allGroups.push(msg.group);
        renderActiveGroups();
        renderHubsList();
        populateBroadcastTargetDropdown();
      } else if (msg.type === 'GROUP_ENDED') {
        const grp = allGroups.find(g => g.groupId === msg.groupId);
        if (grp) grp.status = 'ENDED';
        renderActiveGroups();
        renderHubsList();
        populateBroadcastTargetDropdown();
        // Nếu đang bật heatmap thì reload lại điểm nhiệt mới
        if (document.getElementById('chk-toggle-heatmap').checked) {
          loadHeatmapData();
        }
      } else if (msg.type === 'ADMIN_EMERGENCY_BROADCAST') {
        showEmergencyBanner(`[CAN THIỆP PHÁT THANH] ${msg.message}`);
      }
    } catch (e) {
      console.warn('Lỗi xử lý WS message:', e);
    }
  };

  // 3. VẼ TẤT CẢ HUBS LÊN BẢN ĐỒ
  function renderAllHubsOnMap() {
    allHubs.forEach(hub => {
      MapCommon.updateHubMarker(map, hubMarkers, hub, false);
    });
  }

  // 4. HIỂN THỊ DANH SÁCH HUBS VÀ PIN THEO CA
  const allHubsContainer = document.getElementById('all-hubs-container');
  const idleHubsChips = document.getElementById('idle-hubs-chips');
  const totalHubsCount = document.getElementById('total-hubs-count');
  const countIdleHubs = document.getElementById('count-idle-hubs');

  function renderHubsList() {
    totalHubsCount.textContent = allHubs.length;

    // Lọc các Hub rảnh rỗi (idle) để nhân viên tiện chọn khi phát cho đoàn
    const idleHubs = allHubs.filter(h => !h.currentGroupId);
    countIdleHubs.textContent = `${idleHubs.length} Hub`;

    idleHubsChips.innerHTML = idleHubs.map(h => `
      <span class="hub-badge badge-online" style="cursor: pointer;" onclick="appendHubToInput('${h.hubId}')" title="Bấm để thêm vào danh sách phát">
        + ${h.hubId} (${h.battery}%)
      </span>
    `).join('') || '<div style="font-size: 0.76rem; color: var(--text-dim);">Tất cả Hub đang được phát hoặc đang sạc.</div>';

    // Toàn bộ danh sách Hub
    allHubsContainer.innerHTML = allHubs.map(h => {
      const isOnline = (Date.now() - h.lastSeen) < 180000; // online trong 3 phút qua
      const isAssigned = !!h.currentGroupId;

      return `
        <div class="hub-row">
          <div>
            <span class="hub-id">${h.hubId}</span>
            <span class="hub-badge ${isOnline ? 'badge-online' : 'badge-offline'}">
              ${isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            ${isAssigned ? '<span class="hub-badge badge-active">ĐANG ĐI ĐOÀN</span>' : ''}
          </div>
          <div>
            <span class="battery-tag ${h.battery < 20 ? 'battery-low' : ''}">Pin: ${h.battery}%</span>
            <button class="btn btn-secondary btn-sm" style="margin-left: 6px;" onclick="panToHub('${h.hubId}')">
              Định vị
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Thêm Hub vào ô input khi click chip
  window.appendHubToInput = (hubId) => {
    const input = document.getElementById('input-hub-ids');
    const curVal = input.value.trim();
    const ids = curVal ? curVal.split(',').map(s => s.trim()) : [];
    if (!ids.includes(hubId)) {
      ids.push(hubId);
      input.value = ids.join(', ');
      document.getElementById('input-member-count').value = ids.length;
    }
  };

  // Định vị Hub trên map
  window.panToHub = (hubId) => {
    const hub = allHubs.find(h => h.hubId === hubId);
    if (hub && hubMarkers[hubId]) {
      map.setView([hub.lat, hub.lng], 19);
      hubMarkers[hubId].openPopup();
    }
  };

  // 5. HIỂN THỊ DANH SÁCH ĐOÀN KHÁCH ĐANG HOẠT ĐỘNG
  const activeGroupsContainer = document.getElementById('active-groups-container');
  const activeGroupsCount = document.getElementById('active-groups-count');

  function renderActiveGroups() {
    const active = allGroups.filter(g => g.status === 'ACTIVE');
    activeGroupsCount.textContent = `${active.length} Đoàn`;

    if (active.length === 0) {
      activeGroupsContainer.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-dim); text-align: center; padding: 20px 0;">
          Hiện chưa có đoàn khách nào đang tham quan thực địa.
        </div>
      `;
      return;
    }

    activeGroupsContainer.innerHTML = active.map(g => `
      <div class="card-section" style="padding: 10px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <strong style="color: var(--accent-cyan); font-size: 0.86rem;">${g.groupName}</strong>
            <div style="font-size: 0.74rem; color: var(--text-dim);">
              Khởi hành: ${new Date(g.createdAt).toLocaleTimeString('vi-VN')} | ${g.memberCount} thành viên
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="showQrModal('${g.groupId}')">
            Xem QR
          </button>
        </div>

        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 8px;">
          Các Hub trong đoàn: <strong>${g.hubIds.join(', ')}</strong>
        </div>

        <button class="btn btn-danger btn-sm btn-block" onclick="endGroupTour('${g.groupId}')">
          Kết Thúc Hành Trình (Lưu Vào Bản Đồ Nhiệt)
        </button>
      </div>
    `).join('');
  }

  // Kết thúc hành trình cho đoàn khách
  window.endGroupTour = async (groupId) => {
    if (!confirm('Bạn có chắc chắn muốn kết thúc hành trình cho đoàn này? Dữ liệu di chuyển sẽ được tích hợp vào bản đồ nhiệt và phiên của khách sẽ được đóng.')) {
      return;
    }

    try {
      const res = await fetch(`/api/groups/${groupId}/end`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      alert('Lỗi kết nối tới server: ' + err.message);
    }
  };

  // 6. TẠO ĐOÀN KHÁCH MỚI & XUẤT MÃ QR 1 LẦN
  const btnCreateGroup = document.getElementById('btn-create-group');
  btnCreateGroup.addEventListener('click', async () => {
    const groupName = document.getElementById('input-group-name').value.trim();
    const memberCount = parseInt(document.getElementById('input-member-count').value) || 1;
    const hubIdsRaw = document.getElementById('input-hub-ids').value.trim();

    if (!hubIdsRaw) {
      alert('Vui lòng nhập ít nhất 1 mã Hub phát cho đoàn!');
      return;
    }

    const hubIds = hubIdsRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    btnCreateGroup.disabled = true;
    btnCreateGroup.textContent = 'Đang khởi tạo mã QR...';

    try {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: groupName || `Đoàn ${hubIds[0]} + ${hubIds.length - 1} khách`,
          memberCount,
          hubIds
        })
      });

      const data = await res.json();
      if (data.success) {
        // Mở modal hiển thị mã QR
        displayQrModal(data.data);
        // Reset form
        document.getElementById('input-group-name').value = '';
        document.getElementById('input-hub-ids').value = '';
      } else {
        alert('Lỗi tạo đoàn: ' + data.error);
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      btnCreateGroup.disabled = false;
      btnCreateGroup.textContent = 'Tạo Đoàn & Xuất Mã QR Cho Khách';
    }
  });

  // 7. MODAL HIỂN THỊ MÃ QR ĐOÀN
  const modalQr = document.getElementById('modal-qr');
  const modalQrImage = document.getElementById('modal-qr-image');
  const modalGroupInfo = document.getElementById('modal-group-info');
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
  const btnPrintQr = document.getElementById('btn-print-qr');

  function displayQrModal(group) {
    modalGroupInfo.innerHTML = `Đoàn: <strong>${group.groupName}</strong> | Số lượng: <strong>${group.memberCount} người (${group.hubIds.length} Hubs)</strong>`;
    modalQrImage.src = group.qrCodeDataUrl;
    modalQr.style.display = 'flex';
  }

  window.showQrModal = (groupId) => {
    const grp = allGroups.find(g => g.groupId === groupId);
    if (grp) displayQrModal(grp);
  };

  btnCloseQrModal.onclick = () => { modalQr.style.display = 'none'; };
  btnPrintQr.onclick = () => {
    const win = window.open('');
    win.document.write(`
      <html><head><title>Mã QR Đoàn Khách 2Guide</title></head>
      <body style="text-align: center; font-family: sans-serif; padding: 20px;">
        <h2>${modalGroupInfo.textContent}</h2>
        <img src="${modalQrImage.src}" style="width: 320px; height: 320px;" />
        <p>Quét mã bằng camera điện thoại để truy cập bản đồ di tích và vị trí đoàn</p>
      </body></html>
    `);
    win.print();
  };

  // 8. ĐIỀU KHIỂN BẢN ĐỒ NHIỆT (HEATMAP)
  const chkHeatmap = document.getElementById('chk-toggle-heatmap');
  const heatmapFilterBox = document.getElementById('heatmap-filter-box');
  const selectHeatmapRange = document.getElementById('select-heatmap-range');

  chkHeatmap.addEventListener('change', () => {
    if (chkHeatmap.checked) {
      heatmapFilterBox.style.display = 'flex';
      loadHeatmapData();
    } else {
      heatmapFilterBox.style.display = 'none';
      if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
      }
    }
  });

  selectHeatmapRange.addEventListener('change', () => {
    if (chkHeatmap.checked) loadHeatmapData();
  });

  async function loadHeatmapData() {
    const timeRange = selectHeatmapRange.value;
    try {
      const res = await fetch(`/api/heatmap?timeRange=${timeRange}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (heatLayer) map.removeLayer(heatLayer);

        // Tạo layer bản đồ nhiệt với Leaflet.heat
        heatLayer = L.heatLayer(json.data, {
          radius: 22,
          blur: 14,
          maxZoom: 19,
          gradient: { 0.4: '#3b82f6', 0.65: '#10b981', 0.85: '#f59e0b', 1.0: '#ef4444' }
        }).addTo(map);
      }
    } catch (e) {
      console.warn('Lỗi nạp dữ liệu heatmap:', e);
    }
  }

  // 9. BẬT/TẮT LỚP PHÂN KHU & POI & TUYẾN THAM QUAN
  const chkZones = document.getElementById('chk-toggle-zones');
  const chkPois = document.getElementById('chk-toggle-pois');
  const chkRoute = document.getElementById('chk-toggle-route');
  const selectFloorFilter = document.getElementById('select-floor-filter');

  chkZones.addEventListener('change', () => {
    if (zoneLayerGroup) {
      if (chkZones.checked) map.addLayer(zoneLayerGroup);
      else map.removeLayer(zoneLayerGroup);
    }
  });

  chkPois.addEventListener('change', () => {
    if (poiLayerGroup) {
      if (chkPois.checked) map.addLayer(poiLayerGroup);
      else map.removeLayer(poiLayerGroup);
    }
  });

  if (chkRoute) {
    chkRoute.addEventListener('change', () => {
      if (tourRouteLayer) {
        if (chkRoute.checked) map.addLayer(tourRouteLayer);
        else map.removeLayer(tourRouteLayer);
      }
    });
  }

  if (selectFloorFilter) {
    selectFloorFilter.addEventListener('change', () => {
      if (!siteData || !siteData.pois) return;
      if (poiLayerGroup) map.removeLayer(poiLayerGroup);

      const val = selectFloorFilter.value;
      let filtered = siteData.pois;
      if (val === 'floor-1') filtered = siteData.pois.filter(p => p.floor === 1 || p.number <= 15);
      else if (val === 'floor-2') filtered = siteData.pois.filter(p => p.floor === 2 || p.number >= 16);

      poiLayerGroup = MapCommon.renderPOIs(map, filtered);
      if (chkPois.checked) map.addLayer(poiLayerGroup);
    });
  }

  // 10. GHI NHẬN MỨC PIN ĐẦU CA & CUỐI CA THEO GIỜ HÀNH CHÍNH
  const btnShiftStart = document.getElementById('btn-record-shift-start');
  const btnShiftEnd = document.getElementById('btn-record-shift-end');

  async function recordShiftBattery(shiftType) {
    const records = allHubs.map(h => ({ hubId: h.hubId, battery: h.battery }));
    try {
      const res = await fetch('/api/hubs/shift-battery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftType, records })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      }
    } catch (e) {
      alert('Lỗi ghi nhận pin: ' + e.message);
    }
  }

  btnShiftStart.onclick = () => recordShiftBattery('start');
  btnShiftEnd.onclick = () => recordShiftBattery('end');

  // 11. PHÁT THANH / CAN THIỆP LUỒNG TÍN HIỆU
  const selectBroadcastTarget = document.getElementById('select-broadcast-target');
  const btnSendBroadcast = document.getElementById('btn-send-broadcast');
  const inputBroadcastMessage = document.getElementById('input-broadcast-message');

  function populateBroadcastTargetDropdown() {
    selectBroadcastTarget.innerHTML = `
      <option value="ALL_HUBS">Toàn Bộ Thiết Bị & Khách Tham Quan (Toàn Khu)</option>
    `;
    // Thêm các đoàn đang hoạt động
    allGroups.filter(g => g.status === 'ACTIVE').forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.groupId;
      opt.textContent = `Đoàn: ${g.groupName} (${g.hubIds.length} Hubs)`;
      selectBroadcastTarget.appendChild(opt);
    });
    // Thêm từng Hub cụ thể
    allHubs.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.hubId;
      opt.textContent = `Thiết Bị Cụ Thể: ${h.hubId}`;
      selectBroadcastTarget.appendChild(opt);
    });
  }

  btnSendBroadcast.addEventListener('click', async () => {
    const target = selectBroadcastTarget.value;
    const message = inputBroadcastMessage.value.trim();
    const urgency = document.getElementById('select-broadcast-urgency').value;

    if (!message) {
      alert('Vui lòng nhập nội dung thông báo!');
      return;
    }

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: target === 'ALL_HUBS' ? 'ALL_HUBS' : (target.startsWith('GRP_') ? 'SPECIFIC_GROUP' : 'SPECIFIC_HUB'),
          targetId: target,
          message,
          urgency
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Đã phát lệnh can thiệp luồng tín hiệu thành công!');
        inputBroadcastMessage.value = '';
      }
    } catch (e) {
      alert('Lỗi gửi thông báo: ' + e.message);
    }
  });

  // Hiển thị banner khẩn cấp
  function showEmergencyBanner(text) {
    const banner = document.getElementById('emergency-banner');
    const bannerText = document.getElementById('emergency-banner-text');
    bannerText.textContent = text;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 8000);
  }

  // 12. TAB SWITCHING
  const tabButtons = document.querySelectorAll('.sidebar-tabs .tab-item');
  const tabPanels = document.querySelectorAll('.sidebar-content .tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.getAttribute('data-tab'));
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
});

