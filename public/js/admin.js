/**
 * 2Guide - admin.js
 * Logic giao diện điều hành Ban Quản Lý Di Tích
 * Bảo mật: Chỉ khởi tạo Bản đồ Leaflet và tải dữ liệu 26 Hubs khi đã xác thực đúng Secret Key.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. MÀN HÌNH KHÓA XÁC THỰC MÃ BÍ MẬT BAN QUẢN LÝ
  const authOverlay = document.getElementById('admin-auth-lock-overlay');
  const inputKey = document.getElementById('input-admin-auth-key');
  const btnSubmitAuth = document.getElementById('btn-submit-admin-auth');
  const authErrorMsg = document.getElementById('admin-auth-error-msg');
  const authCard = authOverlay ? authOverlay.querySelector('.auth-lock-card') : null;
  const btnToggleVis = document.getElementById('btn-toggle-admin-key-vis');

  if (btnToggleVis && inputKey) {
    let isShowing = false;
    btnToggleVis.addEventListener('click', () => {
      isShowing = !isShowing;
      inputKey.type = isShowing ? 'text' : 'password';
      inputKey.classList.toggle('is-password', !isShowing);
      const svg = document.getElementById('admin-svg-eye');
      if (svg) {
        svg.innerHTML = isShowing
          ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>'
          : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }

  async function handleAdminAuthSubmit() {
    const entered = (inputKey ? inputKey.value : '').trim();
    if (!entered) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Vui lòng nhập mã bí mật quản trị!';
        authErrorMsg.style.display = 'block';
      }
      return;
    }

    if (btnSubmitAuth) {
      btnSubmitAuth.disabled = true;
      btnSubmitAuth.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 6px;">Đang xác thực bảo mật...</span>';
    }

    try {
      const res = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: entered, key: entered })
      });
      const data = await res.json();
      if (data.success) {
        // Gỡ màn hình khóa khỏi DOM
        if (authOverlay) authOverlay.remove();

        // Mở hiển thị thanh điều hướng và khung ứng dụng
        const topNav = document.getElementById('admin-top-navbar');
        const mainApp = document.getElementById('admin-main-app');
        if (topNav) topNav.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'flex';

        // Khởi động bản đồ và nạp toàn bộ dữ liệu 26 Hubs
        initAdminDashboard(entered);
      } else {
        if (authErrorMsg) {
          authErrorMsg.textContent = data.error || 'Mã bí mật Ban Quản Lý không chính xác!';
          authErrorMsg.style.display = 'block';
        }
        if (authCard) {
          authCard.classList.remove('shake');
          void authCard.offsetWidth;
          authCard.classList.add('shake');
        }
        if (btnSubmitAuth) {
          btnSubmitAuth.disabled = false;
          btnSubmitAuth.innerHTML = 'Xác Thực & Mở Giao Diện';
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
        btnSubmitAuth.innerHTML = 'Xác Thực & Mở Giao Diện';
      }
    }
  }

  if (btnSubmitAuth) btnSubmitAuth.addEventListener('click', handleAdminAuthSubmit);
  if (inputKey) {
    inputKey.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAdminAuthSubmit();
    });
    setTimeout(() => inputKey.focus(), 150);
  }
});

/**
 * 2. KHỞI TẠO ỨNG DỤNG BQL (CHỈ CHẠY SAU KHI ĐÃ NHẬP ĐÚNG KEY)
 */
async function initAdminDashboard(secretKey) {
  const getAdminKey = () => secretKey;

  // Nút Khóa Màn Hình (Tải lại trang và xóa sạch RAM)
  const btnLockScreen = document.getElementById('btn-admin-lock-screen');
  if (btnLockScreen) {
    btnLockScreen.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Khởi tạo Leaflet Map
  const map = MapCommon.initMap('map');
  const hubMarkers = {}; // { [hubId]: L.Marker }
  let zoneLayerGroup = null;
  let poiLayerGroup = null;
  let artifactLayerGroup = null;
  let tourRouteLayer = null;
  const trajectoriesLayerGroup = L.featureGroup().addTo(map);

  let siteData = null;
  let allHubs = [];
  let allGroups = [];
  let selectedHubIds = [];
  let adminActiveVisionCone = null;
  let activeVisionHubId = null;

  // DOM Elements
  const allHubsContainer = document.getElementById('all-hubs-container');
  const idleHubsChips = document.getElementById('idle-hubs-chips');
  const totalHubsCount = document.getElementById('total-hubs-count');
  const countIdleHubs = document.getElementById('count-idle-hubs');
  const activeGroupsContainer = document.getElementById('active-groups-container');
  const activeGroupsCount = document.getElementById('active-groups-count');
  const selectedHubsContainer = document.getElementById('selected-hubs-container');
  const inputAddSingleHub = document.getElementById('input-add-single-hub');
  const btnAddSingleHub = document.getElementById('btn-add-single-hub');
  const btnCreateGroup = document.getElementById('btn-create-group');
  const selectBroadcastTarget = document.getElementById('select-broadcast-target');
  const btnSendBroadcast = document.getElementById('btn-send-broadcast');
  const inputBroadcastMessage = document.getElementById('input-broadcast-message');
  const selectBroadcastUrgency = document.getElementById('select-broadcast-urgency');

  // Lấy dữ liệu khuôn viên & phân khu
  try {
    const res = await fetch('/api/site-data');
    const json = await res.json();
    if (json.success && json.data) {
      siteData = json.data;
      const elSiteName = document.getElementById('site-name-display');
      if (elSiteName) elSiteName.textContent = siteData.siteName;
      document.title = `2Guide - BQL ${siteData.siteName}`;

      if (siteData.center) {
        map.setView([siteData.center.lat, siteData.center.lng], siteData.zoom || 18);
      }

      zoneLayerGroup = MapCommon.renderZones(map, siteData.zones);
      if (siteData.pois && siteData.pois.length > 0) {
        poiLayerGroup = MapCommon.renderPOIs(map, siteData.pois);
      }
      if (siteData.artifacts) {
        artifactLayerGroup = MapCommon.renderArtifacts(map, siteData.artifacts);
      }
      if (siteData.tourRoute) {
        tourRouteLayer = MapCommon.renderTourRoute(map, siteData.tourRoute);
      }
    }
  } catch (err) {
    console.error('Lỗi nạp site data:', err);
  }

  // Tải danh sách Hubs & Đoàn khách từ REST API với mã bí mật
  async function loadAdminData() {
    try {
      const authHeaders = {
        'X-Admin-Secret': getAdminKey(),
        'Authorization': `Bearer ${getAdminKey()}`
      };
      const [resHubs, resGroups] = await Promise.all([
        fetch('/api/hubs', { headers: authHeaders }),
        fetch('/api/groups', { headers: authHeaders })
      ]);
      const jsonHubs = await resHubs.json();
      const jsonGroups = await resGroups.json();

      if (jsonHubs.success && Array.isArray(jsonHubs.data)) {
        allHubs = jsonHubs.data;
      }
      if (jsonGroups.success && Array.isArray(jsonGroups.data)) {
        allGroups = jsonGroups.data;
      }

      renderAllHubsOnMap();
      renderHubsList();
      renderActiveGroups();
      populateBroadcastTargetDropdown();
    } catch (e) {
      console.warn('[Admin Data] Lỗi nạp dữ liệu ban đầu:', e);
    }
  }

  // WebSocket thời gian thực
  let ws = null;
  function connectAdminWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('[Admin WS] Đã kết nối máy chủ realtime');
      ws.send(JSON.stringify({
        type: 'REGISTER_ADMIN',
        adminKey: getAdminKey()
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'INIT_ADMIN_STATE') {
          if (Array.isArray(msg.hubs)) allHubs = msg.hubs;
          if (Array.isArray(msg.groups)) allGroups = msg.groups;
          renderAllHubsOnMap();
          renderHubsList();
          renderActiveGroups();
          populateBroadcastTargetDropdown();
        } else if (msg.type === 'HUB_LOCATION_UPDATE') {
          const hub = msg.hub;
          if (hub) {
            const idx = allHubs.findIndex(h => h.hubId === hub.hubId);
            if (idx >= 0) allHubs[idx] = { ...allHubs[idx], ...hub };
            else allHubs.push(hub);

            MapCommon.updateHubMarker(map, hubMarkers, hub, false, (h) => {
              showHubVisionConeOnAdmin(h);
            });
            renderHubsList();
          }
        } else if (msg.type === 'GROUP_CREATED') {
          const newGroup = msg.group;
          if (newGroup) {
            const idx = allGroups.findIndex(g => g.groupId === newGroup.groupId);
            if (idx >= 0) allGroups[idx] = newGroup;
            else allGroups.push(newGroup);

            if (newGroup.hubIds) {
              newGroup.hubIds.forEach(id => {
                const found = allHubs.find(h => h.hubId === id);
                if (found) found.currentGroupId = newGroup.groupId;
              });
            }
            renderActiveGroups();
            renderHubsList();
            renderAllHubsOnMap();
            populateBroadcastTargetDropdown();
          }
        } else if (msg.type === 'GROUP_ENDED') {
          const groupId = msg.groupId;
          const grp = allGroups.find(g => g.groupId === groupId);
          if (grp) grp.status = 'ENDED';
          allHubs.forEach(h => {
            if (h.currentGroupId === groupId) h.currentGroupId = null;
          });
          renderActiveGroups();
          renderHubsList();
          renderAllHubsOnMap();
          populateBroadcastTargetDropdown();
        }
      } catch (err) {
        console.error('[Admin WS] Lỗi xử lý tin nhắn:', err);
      }
    };

    ws.onclose = () => {
      console.warn('[Admin WS] Mất kết nối, tự động kết nối lại sau 3s...');
      setTimeout(() => { if (secretKey) connectAdminWebSocket(); }, 3000);
    };
  }

  // Vẽ hình quạt tầm nhìn IMU
  function showHubVisionConeOnAdmin(hub) {
    if (adminActiveVisionCone) {
      adminActiveVisionCone.remove();
      adminActiveVisionCone = null;
    }
    adminActiveVisionCone = MapCommon.createVisionCone(map, hub.lat, hub.lng, hub.yaw || 0, 22, 65, {
      color: '#38bdf8',
      fillColor: '#38bdf8',
      fillOpacity: 0.28,
      weight: 1.5,
      dashArray: '3, 3'
    });
  }

  function renderAllHubsOnMap() {
    const processedHubs = MapCommon.applyGridNetworkDispersion(map, allHubs);
    processedHubs.forEach(hub => {
      MapCommon.updateHubMarker(map, hubMarkers, hub, false, (h) => {
        showHubVisionConeOnAdmin(h);
      });
    });
  }

  function renderSelectedHubTags() {
    if (!selectedHubsContainer) return;
    if (selectedHubIds.length === 0) {
      selectedHubsContainer.innerHTML = `
        <span id="empty-selected-hint" style="font-size: 0.74rem; color: var(--text-dim);">
          Chưa chọn Hub nào. Bấm vào danh sách rảnh rỗi bên dưới để thêm...
        </span>
      `;
    } else {
      selectedHubsContainer.innerHTML = selectedHubIds.map(id => {
        const h = allHubs.find(x => x.hubId === id);
        const bat = h ? `${h.battery}%` : '---';
        return `
          <div class="hub-tag-item">
            <span>${id} (${bat})</span>
            <button type="button" class="btn-remove-tag" onclick="removeSelectedHub('${id}')" title="Xóa khỏi danh sách">✖</button>
          </div>
        `;
      }).join('');
    }
  }

  window.addSelectedHub = (hubId) => {
    const upperId = (hubId || '').trim().toUpperCase();
    if (!upperId) return;
    if (!selectedHubIds.includes(upperId)) {
      selectedHubIds.push(upperId);
      renderSelectedHubTags();
      renderHubsList();
    }
  };

  window.removeSelectedHub = (hubId) => {
    selectedHubIds = selectedHubIds.filter(id => id !== hubId);
    renderSelectedHubTags();
    renderHubsList();
  };

  if (btnAddSingleHub && inputAddSingleHub) {
    const handleAdd = () => {
      const val = inputAddSingleHub.value.trim().toUpperCase();
      if (val) {
        window.addSelectedHub(val);
        inputAddSingleHub.value = '';
      }
    };
    btnAddSingleHub.addEventListener('click', handleAdd);
    inputAddSingleHub.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    });
  }

  function renderHubsList() {
    if (totalHubsCount) totalHubsCount.textContent = allHubs.length;

    const idleHubs = allHubs.filter(h => !h.currentGroupId && !selectedHubIds.includes(h.hubId));
    if (countIdleHubs) countIdleHubs.textContent = `${idleHubs.length} Hub`;

    if (idleHubsChips) {
      idleHubsChips.innerHTML = idleHubs.map(h => `
        <span class="hub-badge badge-online" style="cursor: pointer;" onclick="addSelectedHub('${h.hubId}')" title="Bấm để đưa vào thẻ gom nhóm">
          + ${h.hubId} (${h.battery}%)
        </span>
      `).join('') || '<div style="font-size: 0.76rem; color: var(--text-dim);">Tất cả Hub đã được gom nhóm hoặc đang chọn.</div>';
    }

    if (allHubsContainer) {
      allHubsContainer.innerHTML = allHubs.map(h => {
        const isOnline = (Date.now() - h.lastSeen) < 180000;
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
  }

  window.panToHub = (hubId) => {
    const hub = allHubs.find(h => h.hubId === hubId);
    if (hub) {
      activeVisionHubId = hub.hubId;
      renderAllHubsOnMap();
      map.setView([hub.lat, hub.lng], 19);
      if (hubMarkers[hubId]) hubMarkers[hubId].openPopup();
      showHubVisionConeOnAdmin(hub);
    }
  };

  function renderActiveGroups() {
    const active = allGroups.filter(g => g.status === 'ACTIVE');
    if (activeGroupsCount) activeGroupsCount.textContent = `${active.length} Đoàn`;

    if (!activeGroupsContainer) return;
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
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm" onclick="fitGroupBounds('${g.groupId}')" title="Định vị các Hub">
              Định Vị
            </button>
          </div>
        </div>

        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 8px;">
          Các Hub trong đoàn: <strong>${g.hubIds.join(', ')}</strong>
        </div>

        <button class="btn btn-danger btn-sm btn-block" onclick="endGroupTour('${g.groupId}')">
          Kết Thúc Hành Trình
        </button>
      </div>
    `).join('');
  }

  window.fitGroupBounds = (groupId) => {
    const grp = allGroups.find(g => g.groupId === groupId);
    if (!grp || !grp.hubIds || grp.hubIds.length === 0) return;
    const memberHubs = allHubs.filter(h => grp.hubIds.includes(h.hubId));
    if (memberHubs.length > 0) {
      const latLngs = memberHubs.map(h => [h.lat, h.lng]);
      map.fitBounds(L.latLngBounds(latLngs).pad(0.35));
    }
  };

  window.endGroupTour = async (groupId) => {
    if (!confirm('Bạn có chắc chắn muốn kết thúc hành trình cho đoàn này?')) return;

    try {
      const res = await fetch(`/api/groups/${groupId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': getAdminKey()
        },
        body: JSON.stringify({ adminKey: getAdminKey() })
      });
      const data = await res.json();
      if (data.success) {
        const grp = allGroups.find(g => g.groupId === groupId);
        if (grp) grp.status = 'ENDED';
        renderActiveGroups();
        alert(data.message);
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      alert('Lỗi kết nối tới server: ' + err.message);
    }
  };

  if (btnCreateGroup) {
    btnCreateGroup.addEventListener('click', async () => {
      const groupName = document.getElementById('input-group-name').value.trim();
      if (selectedHubIds.length === 0) {
        alert('Vui lòng chọn ít nhất 1 Hub để gom nhóm!');
        return;
      }

      const hubIds = [...selectedHubIds];
      btnCreateGroup.disabled = true;
      btnCreateGroup.textContent = 'Đang lưu gom nhóm...';

      try {
        const res = await fetch('/api/groups/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Secret': getAdminKey()
          },
          body: JSON.stringify({
            groupName: groupName || `Đoàn ${hubIds[0]} (${hubIds.length} khách)`,
            memberCount: hubIds.length,
            hubIds,
            adminKey: getAdminKey()
          })
        });

        const data = await res.json();
        if (data.success) {
          hubIds.forEach(id => {
            const found = allHubs.find(h => h.hubId === id);
            if (found) found.currentGroupId = data.data.groupId;
          });

          selectedHubIds = [];
          renderSelectedHubTags();
          renderHubsList();
          alert(`Đã gom nhóm thành công cho đoàn "${data.data.groupName}"!`);
          document.getElementById('input-group-name').value = '';

          const tabGroupsBtn = document.querySelector('.sidebar-tabs .tab-item[data-tab="tab-groups"]');
          if (tabGroupsBtn) tabGroupsBtn.click();
        } else {
          alert('Lỗi gom nhóm: ' + data.error);
        }
      } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
      } finally {
        btnCreateGroup.disabled = false;
        btnCreateGroup.textContent = 'Lưu & Gom Nhóm Hub';
      }
    });
  }

  // Tùy chọn hiển thị lớp bản đồ
  const chkPois = document.getElementById('chk-toggle-pois');
  if (chkPois) {
    chkPois.addEventListener('change', () => {
      if (poiLayerGroup) {
        if (chkPois.checked) map.addLayer(poiLayerGroup);
        else map.removeLayer(poiLayerGroup);
      }
    });
  }

  const chkArtifacts = document.getElementById('chk-toggle-artifacts');
  if (chkArtifacts) {
    chkArtifacts.addEventListener('change', () => {
      if (artifactLayerGroup) {
        if (chkArtifacts.checked) map.addLayer(artifactLayerGroup);
        else map.removeLayer(artifactLayerGroup);
      }
    });
  }

  const chkZones = document.getElementById('chk-toggle-zones');
  if (chkZones) {
    chkZones.addEventListener('change', () => {
      if (zoneLayerGroup) {
        if (chkZones.checked) map.addLayer(zoneLayerGroup);
        else map.removeLayer(zoneLayerGroup);
      }
    });
  }

  const chkRoute = document.getElementById('chk-toggle-route');
  if (chkRoute) {
    chkRoute.addEventListener('change', () => {
      if (tourRouteLayer) {
        if (chkRoute.checked) map.addLayer(tourRouteLayer);
        else map.removeLayer(tourRouteLayer);
      }
    });
  }

  // Phát thanh khẩn cấp
  function populateBroadcastTargetDropdown() {
    if (!selectBroadcastTarget) return;
    const currentVal = selectBroadcastTarget.value;
    let html = '<option value="ALL_HUBS">Toàn Bộ Thiết Bị & Khách Tham Quan</option>';

    const activeGroups = allGroups.filter(g => g.status === 'ACTIVE');
    if (activeGroups.length > 0) {
      html += '<optgroup label="--- Gửi Theo Đoàn Khách ---">';
      activeGroups.forEach(g => {
        html += `<option value="GRP_${g.groupId}">Đoàn: ${g.groupName} (${g.memberCount} máy)</option>`;
      });
      html += '</optgroup>';
    }

    if (allHubs.length > 0) {
      html += '<optgroup label="--- Gửi Đích Danh Từng Hub ---">';
      allHubs.forEach(h => {
        html += `<option value="${h.hubId}">Thiết Bị Hub ${h.hubId} (Pin: ${h.battery}%)</option>`;
      });
      html += '</optgroup>';
    }

    selectBroadcastTarget.innerHTML = html;
    if (currentVal) selectBroadcastTarget.value = currentVal;
  }

  if (btnSendBroadcast) {
    btnSendBroadcast.addEventListener('click', async () => {
      const target = selectBroadcastTarget.value;
      const message = inputBroadcastMessage.value.trim();
      const urgency = selectBroadcastUrgency.value;

      if (!message) {
        alert('Vui lòng nhập nội dung thông báo!');
        return;
      }

      try {
        const res = await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Secret': getAdminKey()
          },
          body: JSON.stringify({
            targetType: target === 'ALL_HUBS' ? 'ALL_HUBS' : (target.startsWith('GRP_') ? 'SPECIFIC_GROUP' : 'SPECIFIC_HUB'),
            targetId: target,
            message,
            urgency,
            adminKey: getAdminKey()
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
  }

  // Chuyển Tab Sidebar
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

  // Khởi động nạp dữ liệu và kết nối WebSocket
  await loadAdminData();
  connectAdminWebSocket();
  setTimeout(() => { if (map) map.invalidateSize(); }, 80);
  setTimeout(() => { if (map) map.invalidateSize(); }, 250);
}
