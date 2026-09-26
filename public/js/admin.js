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
  let artifactLayerGroup = null;
  let tourRouteLayer = null;
  const trajectoriesLayerGroup = L.featureGroup().addTo(map);

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

      if (siteData.center) {
        map.setView([siteData.center.lat, siteData.center.lng], siteData.zoom || 18);
      }

      // Vẽ các phân khu, điểm POI, và hiện vật lịch sử
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

  // 2. KẾT NỐI WEBSOCKET REALTIME
  const getAdminKey = () => window.__ADMIN_KEY__ || localStorage.getItem('2guide_admin_key') || '';

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

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
        allHubs = msg.hubs || [];
        allGroups = msg.groups || [];
        renderAllHubsOnMap();
        renderHubsList();
        renderActiveGroups();
        renderActiveTrajectories();
        populateBroadcastTargetDropdown();
      } else if (msg.type === 'HUB_LOCATION_UPDATE') {
        const hub = msg.hub;
        if (hub) {
          const idx = allHubs.findIndex(h => h.hubId === hub.hubId);
          if (idx >= 0) allHubs[idx] = hub;
          else allHubs.push(hub);

          // Cập nhật marker trên bản đồ
          renderAllHubsOnMap();
          renderHubsList();

          // Ghi nhận tuyến đường realtime cho đoàn đang hoạt động
          if (hub.currentGroupId) {
            const grp = allGroups.find(g => g.groupId === hub.currentGroupId && g.status === 'ACTIVE');
            if (grp) {
              if (!grp.trajectories) grp.trajectories = {};
              if (!grp.trajectories[hub.hubId]) grp.trajectories[hub.hubId] = [];
              const pts = grp.trajectories[hub.hubId];
              const shouldAdd = pts.length === 0 || (
                Math.abs(pts[pts.length - 1].lat - hub.lat) > 0.000015 ||
                Math.abs(pts[pts.length - 1].lng - hub.lng) > 0.000015
              );
              if (shouldAdd) {
                pts.push({ lat: hub.lat, lng: hub.lng, timestamp: Date.now() });
                renderActiveTrajectories();
              }
            }
          }

          // Nón tầm nhìn tự động di chuyển và xoay theo du khách khi du khách di chuyển
          if (activeVisionHubId && hub.hubId === activeVisionHubId) {
            showHubVisionConeOnAdmin(hub);
          }
        }
      } else if (msg.type === 'GROUP_CREATED') {
        if (msg.hubs) {
          allHubs = msg.hubs;
        } else if (msg.group && msg.group.hubIds) {
          msg.group.hubIds.forEach(id => {
            const f = allHubs.find(h => h.hubId === id);
            if (f) f.currentGroupId = msg.group.groupId;
          });
        }
        allGroups.push(msg.group);
        renderAllHubsOnMap();
        renderActiveGroups();
        renderHubsList();
        renderActiveTrajectories();
        populateBroadcastTargetDropdown();
      } else if (msg.type === 'GROUP_ENDED') {
        if (msg.hubs) {
          allHubs = msg.hubs;
        }
        const grp = allGroups.find(g => g.groupId === msg.groupId);
        if (grp) {
          grp.status = 'ENDED';
          grp.trajectories = {}; // XÓA SẠCH VẾT DI CHUYỂN KHI KẾT THÚC ĐOÀN
          if (grp.hubIds) {
            grp.hubIds.forEach(id => {
              const f = allHubs.find(h => h.hubId === id);
              if (f) f.currentGroupId = null;
            });
          }
        }
        renderAllHubsOnMap();
        renderActiveGroups();
        renderHubsList();
        renderActiveTrajectories(); // Xóa sạch polyline trên bản đồ
        populateBroadcastTargetDropdown();
      } else if (msg.type === 'ADMIN_EMERGENCY_BROADCAST') {
        showEmergencyBanner(`[CAN THIỆP PHÁT THANH] ${msg.message}`);
      }
    } catch (e) {
      console.warn('Lỗi xử lý WS message:', e);
    }
  };

  // 3. VẼ TẤT CẢ HUBS LÊN BẢN ĐỒ
  // Đã gom nhóm = Màu xanh nước | Chưa gom nhóm = Màu xám
  let adminActiveVisionCone = null;
  let activeVisionHubId = null;

  function showHubVisionConeOnAdmin(hub) {
    if (!hub) return;
    activeVisionHubId = hub.hubId;
    adminActiveVisionCone = MapCommon.renderVisionCone(map, adminActiveVisionCone, hub.lat, hub.lng, hub.yaw || 0, 45, 5);

    // Kiểm tra xem Hub có đang hướng vào Hiện vật lịch sử nào không (Chỉ quét hiện vật, không quét POI)
    let inSightName = '';
    if (siteData && siteData.artifacts) {
      const matched = siteData.artifacts.find(t => MapCommon.isPointInVisionCone(hub.lat, hub.lng, hub.yaw || 0, t.lat, t.lng, 45, 5));
      if (matched) {
        inSightName = ` | Đang ngắm Hiện vật: <strong style="color: #fbbf24;">#${matched.number}. ${matched.name}</strong>`;
      }
    }

    // Hiển thị thanh trạng thái đang xem tầm nhìn
    let visionBanner = document.getElementById('admin-vision-tracking-banner');
    if (!visionBanner) {
      visionBanner = document.createElement('div');
      visionBanner.id = 'admin-vision-tracking-banner';
      visionBanner.style.cssText = 'position: absolute; top: 70px; left: 50%; transform: translateX(-50%); z-index: 1000; background: rgba(15, 23, 42, 0.92); color: #38bdf8; padding: 6px 14px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; border: 1px solid #0284c7; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);';
      document.body.appendChild(visionBanner);
    }
    visionBanner.innerHTML = `
      <span>Đang theo dõi tầm nhìn: <strong>${hub.hubId}</strong> (Góc xoay: ${hub.yaw || 0}°)${inSightName}</span>
      <button type="button" style="background: none; border: none; color: #f87171; cursor: pointer; font-weight: 900; font-size: 13px;" onclick="closeAdminVisionCone()" title="Đóng tầm nhìn">✕</button>
    `;
    visionBanner.style.display = 'flex';
  }

  window.closeAdminVisionCone = () => {
    activeVisionHubId = null;
    if (adminActiveVisionCone) {
      adminActiveVisionCone.remove();
      adminActiveVisionCone = null;
    }
    const visionBanner = document.getElementById('admin-vision-tracking-banner');
    if (visionBanner) visionBanner.style.display = 'none';
  };

  function renderAllHubsOnMap() {
    // TẤT CẢ CÁC MÁY HUB ĐỀU HIỆN TRÊN BẢN ĐỒ (Không cần gom nhóm vẫn hiện)
    // Hub đã gom nhóm sẽ có màu XANH NƯỚC, Hub chưa gom nhóm có màu XÁM
    const processedHubs = MapCommon.applyGridNetworkDispersion(map, allHubs);
    processedHubs.forEach(hub => {
      MapCommon.updateHubMarker(map, hubMarkers, hub, false, (h) => {
        showHubVisionConeOnAdmin(h);
      });
    });
  }

  // 4. QUẢN LÝ DANH SÁCH THẺ HUB GOM NHÓM (TAGS CÓ THỂ XÓA TẮT)
  let selectedHubIds = [];
  const selectedHubsContainer = document.getElementById('selected-hubs-container');
  const inputAddSingleHub = document.getElementById('input-add-single-hub');
  const btnAddSingleHub = document.getElementById('btn-add-single-hub');

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
            <button type="button" class="btn-remove-tag" onclick="removeSelectedHub('${id}')" title="Xóa khỏi danh sách gom nhóm">✖</button>
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
      renderHubsList(); // Lập tức loại bỏ khỏi danh sách "Hub sẵn sàng tại quầy"
    }
  };

  window.removeSelectedHub = (hubId) => {
    selectedHubIds = selectedHubIds.filter(id => id !== hubId);
    renderSelectedHubTags();
    renderHubsList(); // Lập tức xuất hiện trở lại ở danh sách "Hub sẵn sàng tại quầy"
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
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    });
  }

  // 5. HIỂN THỊ DANH SÁCH HUBS VÀ PIN THEO CA
  const allHubsContainer = document.getElementById('all-hubs-container');
  const idleHubsChips = document.getElementById('idle-hubs-chips');
  const totalHubsCount = document.getElementById('total-hubs-count');
  const countIdleHubs = document.getElementById('count-idle-hubs');

  function renderHubsList() {
    totalHubsCount.textContent = allHubs.length;

    // Lọc các Hub rảnh rỗi: Chưa thuộc đoàn nào (không có currentGroupId) VÀ Chưa nằm trong danh sách đang chọn gom nhóm
    const idleHubs = allHubs.filter(h => !h.currentGroupId && !selectedHubIds.includes(h.hubId));
    countIdleHubs.textContent = `${idleHubs.length} Hub`;

    idleHubsChips.innerHTML = idleHubs.map(h => `
      <span class="hub-badge badge-online" style="cursor: pointer;" onclick="addSelectedHub('${h.hubId}')" title="Bấm để đưa vào thẻ gom nhóm">
        + ${h.hubId} (${h.battery}%)
      </span>
    `).join('') || '<div style="font-size: 0.76rem; color: var(--text-dim);">Tất cả Hub đã được gom nhóm hoặc đang chọn.</div>';

    // Toàn bộ danh sách Hub
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

  // Định vị Hub trên map
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

  // 6. HIỂN THỊ DANH SÁCH ĐOÀN KHÁCH ĐANG HOẠT ĐỘNG
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
      renderActiveTrajectories();
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
            <button class="btn btn-secondary btn-sm" onclick="panToGroupTrajectory('${g.groupId}')" title="Xem vết di chuyển thực địa">
              Tuyến Đường
            </button>
            <button class="btn btn-secondary btn-sm" onclick="fitGroupBounds('${g.groupId}')" title="Định vị các Hub">
              Định Vị
            </button>
          </div>
        </div>

        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-bottom: 8px;">
          Các Hub trong đoàn: <strong>${g.hubIds.join(', ')}</strong>
        </div>

        <button class="btn btn-danger btn-sm btn-block" onclick="endGroupTour('${g.groupId}')">
          Kết Thúc Hành Trình (Xóa Toàn Bộ Tuyến Đường)
        </button>
      </div>
    `).join('');

    renderActiveTrajectories();
  }

  // 6.1 VẼ TUYẾN ĐƯỜNG DI CHUYỂN CỦA ĐOÀN ĐANG HOẠT ĐỘNG (CHỈ XEM TRONG PHIÊN THAM QUAN)
  function renderActiveTrajectories() {
    trajectoriesLayerGroup.clearLayers();
    const chkTraj = document.getElementById('chk-toggle-trajectories');
    if (chkTraj && !chkTraj.checked) return;

    const active = allGroups.filter(g => g.status === 'ACTIVE');
    const colors = ['#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fbbf24'];

    active.forEach((g, gIdx) => {
      const color = colors[gIdx % colors.length];
      if (g.trajectories) {
        Object.entries(g.trajectories).forEach(([hubId, pts]) => {
          if (pts && pts.length >= 2) {
            const latLngs = pts.map(p => [p.lat, p.lng]);
            const polyline = L.polyline(latLngs, {
              color: color,
              weight: 3.5,
              opacity: 0.85,
              dashArray: '6, 6',
              lineJoin: 'round'
            });
            polyline.bindPopup(`
              <div style="font-size: 0.8rem; line-height: 1.4;">
                <div style="font-weight: 700; color: ${color};">Tuyến Di Chuyển: ${g.groupName}</div>
                <div>Thiết bị Hub: <strong>${hubId}</strong></div>
                <div>Số mốc tọa độ: <strong>${pts.length} điểm</strong></div>
                <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Tuyến đường chỉ hiển thị trong phiên tham quan và bị xóa sạch khi kết thúc.</div>
              </div>
            `);
            trajectoriesLayerGroup.addLayer(polyline);
          }
        });
      }
    });
  }

  // Định vị toàn bộ tuyến đường di chuyển của đoàn
  window.panToGroupTrajectory = (groupId) => {
    const grp = allGroups.find(g => g.groupId === groupId);
    if (!grp) return;

    const allPts = [];
    if (grp.trajectories) {
      Object.values(grp.trajectories).forEach(pts => {
        if (pts && pts.length > 0) {
          pts.forEach(p => allPts.push([p.lat, p.lng]));
        }
      });
    }

    if (allPts.length >= 2) {
      map.fitBounds(L.latLngBounds(allPts).pad(0.3));
    } else {
      window.fitGroupBounds(groupId);
    }
  };

  // Định vị toàn bộ các Hub trong đoàn trên bản đồ
  window.fitGroupBounds = (groupId) => {
    const grp = allGroups.find(g => g.groupId === groupId);
    if (!grp || !grp.hubIds || grp.hubIds.length === 0) return;
    const memberHubs = allHubs.filter(h => grp.hubIds.includes(h.hubId));
    if (memberHubs.length > 0) {
      const latLngs = memberHubs.map(h => [h.lat, h.lng]);
      map.fitBounds(L.latLngBounds(latLngs).pad(0.35));
    }
  };

  // Kết thúc hành trình cho đoàn khách (XÓA SẠCH VẾT DI CHUYỂN)
  window.endGroupTour = async (groupId) => {
    if (!confirm('Bạn có chắc chắn muốn kết thúc hành trình cho đoàn này? Thiết bị Hub sẽ được giải phóng và toàn bộ dữ liệu tuyến đường di chuyển của đoàn sẽ bị xóa sạch khỏi hệ thống.')) {
      return;
    }

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
        if (grp) {
          grp.status = 'ENDED';
          grp.trajectories = {};
        }
        renderActiveGroups();
        renderActiveTrajectories();
        alert(data.message);
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      alert('Lỗi kết nối tới server: ' + err.message);
    }
  };

  // 7. GOM NHÓM THIẾT BỊ HUB CHO ĐOÀN KHÁCH (DÙNG DANH SÁCH THẺ)
  const btnCreateGroup = document.getElementById('btn-create-group');
  btnCreateGroup.addEventListener('click', async () => {
    const groupName = document.getElementById('input-group-name').value.trim();

    if (selectedHubIds.length === 0) {
      alert('Vui lòng chọn hoặc thêm ít nhất 1 Hub vào danh sách thẻ để gom nhóm!');
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
        // Cập nhật ngay lập tức currentGroupId cho các hub này trong allHubs
        hubIds.forEach(id => {
          const found = allHubs.find(h => h.hubId === id);
          if (found) {
            found.currentGroupId = data.data.groupId;
          }
        });

        // Xóa danh sách thẻ đang chọn
        selectedHubIds = [];
        renderSelectedHubTags();
        renderHubsList(); // Các hub đã gom nhóm sẽ biến mất khỏi quầy rảnh rỗi

        alert(`Đã gom nhóm thành công cho đoàn "${data.data.groupName}" gồm các Hub: ${hubIds.join(', ')}!\nKhách chỉ cần mở máy Hub của mình là tự động kết nối.`);
        
        // Reset form
        document.getElementById('input-group-name').value = '';

        // Tự động chuyển sang tab "Đoàn Đang Hoạt Động"
        const tabGroupsBtn = document.querySelector('.sidebar-tabs .tab-item[data-tab="tab-groups"]');
        if (tabGroupsBtn) tabGroupsBtn.click();
      } else {
        alert('Lỗi gom nhóm đoàn: ' + data.error);
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      btnCreateGroup.disabled = false;
      btnCreateGroup.textContent = 'Lưu & Gom Nhóm Hub';
    }
  });

  // 8. BẬT/TẮT LỚP POI & HIỆN VẬT LỊCH SỬ (ARTIFACTS)
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

  // 9. BẬT/TẮT LỚP PHÂN KHU & TUYẾN THAM QUAN & TUYẾN ĐƯỜNG ĐOÀN
  const chkZones = document.getElementById('chk-toggle-zones');
  const chkRoute = document.getElementById('chk-toggle-route');
  const chkTrajectories = document.getElementById('chk-toggle-trajectories');

  if (chkZones) {
    chkZones.addEventListener('change', () => {
      if (zoneLayerGroup) {
        if (chkZones.checked) map.addLayer(zoneLayerGroup);
        else map.removeLayer(zoneLayerGroup);
      }
    });
  }

  if (chkRoute) {
    chkRoute.addEventListener('change', () => {
      if (tourRouteLayer) {
        if (chkRoute.checked) map.addLayer(tourRouteLayer);
        else map.removeLayer(tourRouteLayer);
      }
    });
  }

  if (chkTrajectories) {
    chkTrajectories.addEventListener('change', () => {
      renderActiveTrajectories();
    });
  }

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

