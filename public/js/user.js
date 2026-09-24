/**
 * 2Guide - user.js
 * Logic giao diện Khách Tham Quan Theo Đoàn (Di tích Nhà tù Hỏa Lò)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  let identifier = urlParams.get('token') || urlParams.get('groupId');

  if (!identifier) {
    identifier = localStorage.getItem('2guide_saved_token');
  }

  // Khởi tạo bản đồ trung tâm tại Nhà tù Hỏa Lò
  const map = MapCommon.initMap('user-map', [21.02534, 105.84655], 19);
  const hubMarkers = {}; // { [hubId]: L.Marker }
  let groupData = null;
  let myHubId = null;
  let currentPoi = null;

  let siteData = null;
  let poiMarkersGroup = null;
  let tourRouteLayer = null;
  let isRouteVisible = true;

  // 1. TẢI DỮ LIỆU KHU DI TÍCH (20 POIs & PHÂN KHU HỎA LÒ)
  try {
    const resSite = await fetch('/api/site-data');
    const jsonSite = await resSite.json();
    if (jsonSite.success && jsonSite.data) {
      siteData = jsonSite.data;
      document.getElementById('display-site-name').textContent = ` | ${siteData.siteName}`;
      document.title = `2Guide - ${siteData.siteName}`;

      // Vẽ phân khu di tích
      MapCommon.renderZones(map, siteData.zones);

      // Vẽ tuyến tham quan khuyên dùng (nối từ điểm 1 đến điểm 20)
      if (siteData.tourRoute) {
        tourRouteLayer = MapCommon.renderTourRoute(map, siteData.tourRoute);
      }

      // Vẽ 20 điểm di tích (POIs) với icon chỉ vị trí
      poiMarkersGroup = MapCommon.renderPOIs(map, siteData.pois, (poi) => {
        openPoiSheet(poi);
      });
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu di tích:', err);
  }

  // 2. NẠP DỮ LIỆU ĐOÀN CỦA KHÁCH (CÔ LẬP THEO TOKEN DÙNG 1 LẦN)
  if (!identifier) {
    promptForGroupToken();
    return;
  }

  await loadGroupData(identifier);

  async function loadGroupData(tokenOrId) {
    try {
      const res = await fetch(`/api/groups/${tokenOrId}`);
      const json = await res.json();

      if (!json.success) {
        document.body.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; color: #fff;">
            <div style="font-size: 2rem; color: var(--accent-amber); margin-bottom: 12px;">2GUIDE</div>
            <h3 style="color: var(--accent-amber); margin-bottom: 10px;">Thông Báo Hành Trình</h3>
            <p style="color: #94a3b8; max-width: 400px; margin: 0 auto 20px;">
              ${json.message || 'Mã QR không hợp lệ, đã hết hạn hoặc đoàn khách đã kết thúc hành trình.'}
            </p>
            <button onclick="localStorage.removeItem('2guide_saved_token'); window.location.href='/user.html';" class="btn btn-primary">
              Quét Mã QR Đoàn Khác
            </button>
          </div>
        `;
        return;
      }

      groupData = json.data;
      localStorage.setItem('2guide_saved_token', groupData.token || groupData.groupId);
      document.getElementById('display-group-name').textContent = groupData.groupName;

      // Cập nhật modal QR của chính đoàn mình
      const myQrImg = document.getElementById('my-group-qr-img');
      const myQrInfo = document.getElementById('my-group-qr-info');
      if (myQrImg && groupData.qrCodeDataUrl) {
        myQrImg.src = groupData.qrCodeDataUrl;
        myQrInfo.innerHTML = `Đoàn: <strong>${groupData.groupName}</strong> (${groupData.hubIds.length} người)`;
      }

      // Kiểm tra Hub ID cá nhân
      const savedHubId = localStorage.getItem(`2guide_my_hub_${groupData.groupId}`);
      if (savedHubId && groupData.hubIds.includes(savedHubId)) {
        setMyHub(savedHubId);
      } else {
        showSelectHubModal();
      }

      // Vẽ vị trí các thành viên trong đoàn
      renderGroupMembers();

      // Kết nối WebSocket nhận cập nhật vị trí thời gian thực
      connectWebSocket();

    } catch (err) {
      console.error('Lỗi tải thông tin đoàn:', err);
    }
  }

  function promptForGroupToken() {
    const manualToken = prompt('Vui lòng nhập Mã Token hoặc Mã Đoàn trên phiếu vé (hoặc quét mã QR):');
    if (manualToken && manualToken.trim()) {
      window.location.search = `?token=${encodeURIComponent(manualToken.trim())}`;
    }
  }

  // 3. XÁC NHẬN SỐ ID HUB CỦA BẢN THÂN
  const modalSelectHub = document.getElementById('modal-select-hub');
  const hubOptionsGrid = document.getElementById('hub-options-grid');
  const inputManualHubId = document.getElementById('input-manual-hub-id');
  const btnConfirmMyHub = document.getElementById('btn-confirm-my-hub');

  function showSelectHubModal() {
    if (!groupData) return;

    hubOptionsGrid.innerHTML = groupData.hubIds.map(id => `
      <button class="btn btn-secondary btn-sm" onclick="selectHubOption('${id}')" style="min-width: 80px; font-weight: 700;">
        ${id}
      </button>
    `).join('');

    modalSelectHub.style.display = 'flex';
  }

  window.selectHubOption = (hubId) => {
    inputManualHubId.value = hubId;
  };

  btnConfirmMyHub.addEventListener('click', () => {
    const chosen = inputManualHubId.value.trim().toUpperCase();
    if (!chosen) {
      alert('Vui lòng chọn hoặc nhập mã Hub ID của bạn!');
      return;
    }
    setMyHub(chosen);
    modalSelectHub.style.display = 'none';
  });

  document.getElementById('btn-change-my-hub').addEventListener('click', () => {
    showSelectHubModal();
  });

  function setMyHub(hubId) {
    myHubId = hubId;
    if (groupData) {
      localStorage.setItem(`2guide_my_hub_${groupData.groupId}`, hubId);
    }
    document.getElementById('display-my-hub-id').textContent = hubId;

    renderGroupMembers();

    if (ws && ws.readyState === WebSocket.OPEN && groupData) {
      ws.send(JSON.stringify({
        type: 'REGISTER_USER',
        groupId: groupData.groupId,
        myHubId: myHubId
      }));
    }

    panToSelf();
  }

  // 4. VẼ VỊ TRÍ CÁC THÀNH VIÊN TRONG ĐOÀN VỚI ICON CHỈ VỊ TRÍ
  const membersListBar = document.getElementById('members-list-bar');

  function renderGroupMembers() {
    if (!groupData || !groupData.members) return;

    groupData.members.forEach(member => {
      const isSelf = (member.hubId === myHubId);
      MapCommon.updateHubMarker(map, hubMarkers, member, isSelf);
    });

    membersListBar.innerHTML = groupData.members.map(m => {
      const isSelf = (m.hubId === myHubId);
      return `
        <div class="member-chip ${isSelf ? 'active-self' : ''}" onclick="panToMember('${m.hubId}')">
          ${isSelf ? 'BẠN' : m.hubId} (${m.battery || 100}%)
        </div>
      `;
    }).join('');
  }

  window.panToMember = (hubId) => {
    const member = (groupData.members || []).find(m => m.hubId === hubId);
    if (member && hubMarkers[hubId]) {
      map.setView([member.lat, member.lng], 20, { animate: true });
      hubMarkers[hubId].openPopup();
    }
  };

  function panToSelf() {
    if (!myHubId) return;
    panToMember(myHubId);
  }
  document.getElementById('btn-locate-self').addEventListener('click', panToSelf);

  document.getElementById('btn-fit-group').addEventListener('click', () => {
    if (!groupData || !groupData.members || groupData.members.length === 0) return;
    const latLngs = groupData.members.map(m => [m.lat, m.lng]);
    map.fitBounds(L.latLngBounds(latLngs).pad(0.25));
  });

  // 5. TÌM KIẾM THÀNH VIÊN THEO ID HUB
  const inputSearchHub = document.getElementById('input-search-hub');
  const btnSearchHub = document.getElementById('btn-search-hub');

  function doSearchMember() {
    const query = inputSearchHub.value.trim().toUpperCase();
    if (!query) return;

    const matched = (groupData.members || []).find(m => m.hubId.includes(query));
    if (matched) {
      panToMember(matched.hubId);
    } else {
      alert(`Không tìm thấy thành viên có mã "${query}" trong đoàn của bạn!`);
    }
  }

  btnSearchHub.addEventListener('click', doSearchMember);
  inputSearchHub.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearchMember();
  });

  // 6. XEM MÃ QR CỦA CHÍNH ĐOÀN MÌNH (ĐỂ CHIA SẺ VỚI THÀNH VIÊN TRONG ĐOÀN)
  const modalGroupQr = document.getElementById('modal-group-qr');
  const btnShowMyQr = document.getElementById('btn-show-my-qr');
  const btnCloseMyGroupQr = document.getElementById('btn-close-my-group-qr');

  if (btnShowMyQr && modalGroupQr) {
    btnShowMyQr.addEventListener('click', () => {
      modalGroupQr.style.display = 'flex';
    });
    btnCloseMyGroupQr.addEventListener('click', () => {
      modalGroupQr.style.display = 'none';
    });
  }

  // 7. LỌC MẶT BẰNG (TẤT CẢ / TẦNG 1 / TẦNG 2) & TUYẾN THAM QUAN
  const filterButtons = document.querySelectorAll('.floor-filter-bar .filter-btn[data-filter]');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterType = btn.getAttribute('data-filter');
      applyFloorFilter(filterType);
    });
  });

  function applyFloorFilter(filterType) {
    if (!siteData || !siteData.pois) return;

    if (poiMarkersGroup) {
      map.removeLayer(poiMarkersGroup);
    }

    let filteredPois = siteData.pois;
    if (filterType === 'floor-1') {
      filteredPois = siteData.pois.filter(p => p.floor === 1 || p.number <= 15);
    } else if (filterType === 'floor-2') {
      filteredPois = siteData.pois.filter(p => p.floor === 2 || p.number >= 16);
    }

    poiMarkersGroup = MapCommon.renderPOIs(map, filteredPois, (poi) => {
      openPoiSheet(poi);
    });
  }

  const btnToggleRoute = document.getElementById('btn-toggle-tour-route');
  if (btnToggleRoute) {
    btnToggleRoute.addEventListener('click', () => {
      if (!tourRouteLayer) return;
      isRouteVisible = !isRouteVisible;
      if (isRouteVisible) {
        map.addLayer(tourRouteLayer);
        btnToggleRoute.classList.add('active');
      } else {
        map.removeLayer(tourRouteLayer);
        btnToggleRoute.classList.remove('active');
      }
    });
    btnToggleRoute.classList.add('active');
  }

  // 8. BOTTOM SHEET XEM THUYẾT MINH POI
  const poiSheet = document.getElementById('poi-sheet');
  const sheetPoiTitle = document.getElementById('sheet-poi-title');
  const sheetPoiZone = document.getElementById('sheet-poi-zone');
  const sheetPoiDesc = document.getElementById('sheet-poi-desc');
  const btnClosePoiSheet = document.getElementById('btn-close-poi-sheet');
  const btnPlayPoiAudio = document.getElementById('btn-play-poi-audio');

  function openPoiSheet(poi) {
    currentPoi = poi;
    sheetPoiTitle.textContent = `${poi.number}. ${poi.name}`;
    sheetPoiZone.textContent = `${poi.zoneName} ${poi.floor ? `(Tầng ${poi.floor})` : ''}`;
    sheetPoiDesc.textContent = poi.description;
    poiSheet.classList.add('open');
  }

  btnClosePoiSheet.addEventListener('click', () => {
    poiSheet.classList.remove('open');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  });

  btnPlayPoiAudio.addEventListener('click', () => {
    if (currentPoi && currentPoi.audioGuide) {
      MapCommon.speakText(currentPoi.audioGuide);
    }
  });

  // 9. WEBSOCKET KẾT NỐI REALTIME
  let ws = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('[User WS] Đã kết nối WebSocket');
      if (groupData) {
        ws.send(JSON.stringify({
          type: 'REGISTER_USER',
          groupId: groupData.groupId,
          myHubId: myHubId
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'HUB_LOCATION_UPDATE') {
          const { hubId, lat, lng, yaw, battery } = msg;
          if (groupData && groupData.members) {
            const m = groupData.members.find(x => x.hubId === hubId);
            if (m) {
              m.lat = lat;
              m.lng = lng;
              m.yaw = yaw;
              m.battery = battery;
              const isSelf = (hubId === myHubId);
              MapCommon.updateHubMarker(map, hubMarkers, m, isSelf);
            }
          }
        } else if (msg.type === 'GROUP_ENDED') {
          alert(msg.message || 'Hành trình tham quan của đoàn đã kết thúc!');
          window.location.reload();
        } else if (msg.type === 'ADMIN_EMERGENCY_BROADCAST') {
          showEmergencyBanner(`[BAN QUẢN LÝ THÔNG BÁO] ${msg.message}`);
          MapCommon.speakText(`Ban Quản Lý thông báo: ${msg.message}`);
        }
      } catch (e) {
        console.warn('Lỗi xử lý WS message:', e);
      }
    };
  }

  function showEmergencyBanner(text) {
    const banner = document.getElementById('emergency-banner');
    const bannerText = document.getElementById('emergency-banner-text');
    bannerText.textContent = text;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 10000);
  }
});
