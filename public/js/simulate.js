/**
 * 2Guide - simulate.js
 * Bộ giả lập di chuyển thực địa (theo đường thẳng) cho 1 Hub chỉ định & mô phỏng cả đoàn
 * Bảo mật: Chỉ khởi tạo Bản đồ Leaflet và tải dữ liệu 26 Hubs khi đã xác thực Secret Key (BQL hoặc ESP32)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. MÀN HÌNH KHÓA XÁC THỰC MÃ BÍ MẬT TRẠM GIẢ LẬP
  const authOverlay = document.getElementById('sim-auth-lock-overlay');
  const inputKey = document.getElementById('input-sim-auth-key');
  const btnSubmitAuth = document.getElementById('btn-submit-sim-auth');
  const authErrorMsg = document.getElementById('sim-auth-error-msg');
  const authCard = authOverlay ? authOverlay.querySelector('.auth-lock-card') : null;
  const btnToggleVis = document.getElementById('btn-toggle-sim-key-vis');
  const btnLockScreen = document.getElementById('btn-sim-lock-screen');

  if (btnLockScreen) {
    btnLockScreen.addEventListener('click', () => {
      window.location.reload();
    });
  }

  if (btnToggleVis && inputKey) {
    let isShowing = false;
    btnToggleVis.addEventListener('click', () => {
      isShowing = !isShowing;
      inputKey.type = isShowing ? 'text' : 'password';
      inputKey.classList.toggle('is-password', !isShowing);
      const svg = document.getElementById('sim-svg-eye');
      if (svg) {
        svg.innerHTML = isShowing
          ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>'
          : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }

  async function handleSimAuthSubmit() {
    const entered = (inputKey ? inputKey.value : '').trim();
    if (!entered) {
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Vui lòng nhập mã bí mật xác thực!';
        authErrorMsg.style.display = 'block';
      }
      return;
    }

    if (btnSubmitAuth) {
      btnSubmitAuth.disabled = true;
      btnSubmitAuth.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 6px;">Đang xác thực bảo mật...</span>';
    }

    try {
      const res = await fetch('/api/simulate/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: entered, adminKey: entered, key: entered })
      });
      const data = await res.json();
      if (data.success) {
        // Gỡ màn hình khóa khỏi DOM
        if (authOverlay) authOverlay.remove();

        // Mở hiển thị thanh điều hướng và khung ứng dụng
        const topNav = document.getElementById('sim-top-navbar');
        const mainApp = document.getElementById('sim-main-app');
        if (topNav) topNav.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'flex';

        // Khởi động bản đồ và nạp toàn bộ dữ liệu 26 Hubs
        initSimulateApp(entered);
      } else {
        if (authErrorMsg) {
          authErrorMsg.textContent = data.error || 'Mã bí mật trạm giả lập không chính xác!';
          authErrorMsg.style.display = 'block';
        }
        if (authCard) {
          authCard.classList.remove('shake');
          void authCard.offsetWidth;
          authCard.classList.add('shake');
        }
        if (btnSubmitAuth) {
          btnSubmitAuth.disabled = false;
          btnSubmitAuth.textContent = 'Xác Thực & Mở Trạm Giả Lập';
        }
        if (inputKey) {
          inputKey.value = '';
          inputKey.focus();
        }
      }
    } catch (e) {
      console.error('Lỗi xác thực trạm giả lập:', e);
      if (authErrorMsg) {
        authErrorMsg.textContent = 'Lỗi kết nối máy chủ! Vui lòng thử lại.';
        authErrorMsg.style.display = 'block';
      }
      if (btnSubmitAuth) {
        btnSubmitAuth.disabled = false;
        btnSubmitAuth.textContent = 'Xác Thực & Mở Trạm Giả Lập';
      }
    }
  }

  if (btnSubmitAuth) {
    btnSubmitAuth.addEventListener('click', handleSimAuthSubmit);
  }

  if (inputKey) {
    inputKey.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSimAuthSubmit();
    });
    inputKey.focus();
  }

  // 2. KHỞI TẠO TOÀN BỘ ỨNG DỤNG SAU KHI XÁC THỰC THÀNH CÔNG
  function initSimulateApp(verifiedSecretKey) {
    const authHeaders = {
      'Content-Type': 'application/json',
      'X-Admin-Secret': verifiedSecretKey,
      'X-Device-Secret': verifiedSecretKey
    };

    const map = MapCommon.initMap('sim-map', [20.99965, 105.84280], 18);
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const hubMarkers = {};
    let allHubs = [];
    let isSimulatingGroup = false;
    let groupSimInterval = null;

    // Biến phục vụ di chuyển tuyến tính cho 1 User
    let isLinearWalking = false;
    let linearWalkInterval = null;
    let chosenHubId = 'NEU001';
    let chosenDirectionDeg = 90; // Mặc định hướng Đông
    let pointA = null;
    let pointB = null;
    let markerPointA = null;
    let markerPointB = null;
    let lineAB = null;
    let simActiveVisionCone = null;
    let walkTrailPoints = [];
    let walkTrailLine = null;

    // DOM Elements
    const selectLinearHub = document.getElementById('sim-linear-hub');
    const selectLinearMode = document.getElementById('sim-linear-mode');
    const simDirectionBox = document.getElementById('sim-direction-box');
    const simPointsBox = document.getElementById('sim-points-box');
    const simPointsStatus = document.getElementById('sim-points-status');
    const inputLinearSpeed = document.getElementById('sim-linear-speed');
    const btnToggleLinearWalk = document.getElementById('btn-toggle-linear-walk');
    const simLogBox = document.getElementById('sim-log-box');
    const chkAutoFollow = document.getElementById('chk-auto-follow');
    const simHubGroupText = document.getElementById('sim-hub-group-text');
    const simHubQuickGroupBtn = document.getElementById('sim-hub-quick-group-btn');
    const btnQuickCreateGroup = document.getElementById('btn-quick-create-group');

    const btnToggleSim = document.getElementById('btn-toggle-sim');
    const simStatus = document.getElementById('sim-status');

    function updateHubGroupInfo(hub) {
      if (!simHubGroupText) return;
      if (!hub) {
        simHubGroupText.textContent = 'Chưa chọn Hub';
        simHubGroupText.style.color = 'var(--text-dim)';
        if (simHubQuickGroupBtn) simHubQuickGroupBtn.style.display = 'none';
        return;
      }
      if (hub.currentGroupId) {
        simHubGroupText.textContent = `Đang thuộc đoàn "${hub.currentGroupId}" (Hiển thị ghim Màu Xanh Nước trên bản đồ BQL)`;
        simHubGroupText.style.color = '#38bdf8';
        if (simHubQuickGroupBtn) simHubQuickGroupBtn.style.display = 'none';
      } else {
        simHubGroupText.textContent = 'Chưa gom nhóm (Hiển thị ghim Màu Xám trên bản đồ BQL)';
        simHubGroupText.style.color = '#94a3b8';
        if (simHubQuickGroupBtn) simHubQuickGroupBtn.style.display = 'block';
      }
    }

    if (btnQuickCreateGroup) {
      btnQuickCreateGroup.addEventListener('click', async () => {
        try {
          const targetHub = allHubs.find(h => h.hubId === chosenHubId);
          if (!targetHub) return;

          btnQuickCreateGroup.disabled = true;
          btnQuickCreateGroup.textContent = 'Đang tạo đoàn...';

          const res = await fetch('/api/groups/create', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              groupName: `Đoàn Thử Nghiệm ${targetHub.hubId}`,
              leaderName: 'Test Giả Lập',
              hubIds: [targetHub.hubId]
            })
          });

          const json = await res.json();
          if (json.success) {
            targetHub.currentGroupId = json.data.groupId;
            updateHubGroupInfo(targetHub);
            logMessage(`[ĐÃ GOM NHÓM] Đã gán ${targetHub.hubId} vào ${json.data.groupId}. Ghim trên bản đồ BQL sẽ chuyển sang Màu Xanh Nước!`);
          } else {
            alert('Không thể tạo đoàn: ' + (json.error || 'Lỗi'));
          }
        } catch (e) {
          console.error('Lỗi tạo đoàn nhanh:', e);
        } finally {
          btnQuickCreateGroup.disabled = false;
          btnQuickCreateGroup.textContent = 'Gán Nhanh Vào Đoàn (Chuyển Sang Ghim Màu Xanh Nước)';
        }
      });
    }

    // 1. TẢI DỮ LIỆU KHUÔN VIÊN NEU
    async function loadSiteData() {
      try {
        const res = await fetch('/api/site-data');
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.center) {
            map.setView([json.data.center.lat, json.data.center.lng], json.data.zoom || 18);
          }
          MapCommon.renderZones(map, json.data.zones);
          MapCommon.renderPOIs(map, json.data.pois);
          if (json.data.artifacts) {
            MapCommon.renderArtifacts(map, json.data.artifacts);
          }
        }
      } catch (e) {
        console.error('Lỗi site data:', e);
      }
    }

    // 2. TẢI DANH SÁCH HUBS (Sử dụng Header xác thực)
    async function loadHubsData() {
      try {
        const res = await fetch('/api/hubs', {
          headers: authHeaders
        });
        const json = await res.json();
        if (json.success && json.data) {
          allHubs = json.data;
          selectLinearHub.innerHTML = allHubs.map(h => `
            <option value="${h.hubId}">${h.hubId} (Pin: ${h.battery}%)</option>
          `).join('');

          allHubs.forEach(h => {
            MapCommon.updateHubMarker(map, hubMarkers, h, false);
          });

          if (allHubs.length > 0) {
            chosenHubId = allHubs[0].hubId;
            updateHubGroupInfo(allHubs[0]);
          }
          logMessage(`[KHỞI TẠO] Nạp thành công ${allHubs.length} thiết bị Hubs từ cơ sở dữ liệu.`);
        } else {
          logMessage(`[CẢNH BÁO] Không thể nạp Hubs: ${json.error || 'Từ chối truy cập'}`);
        }
      } catch (e) {
        console.error('Lỗi hubs data:', e);
        logMessage('[LỖI] Kết nối máy chủ tải Hubs thất bại.');
      }
    }

    loadSiteData();
    loadHubsData();

    selectLinearHub.addEventListener('change', () => {
      chosenHubId = selectLinearHub.value;
      const target = allHubs.find(h => h.hubId === chosenHubId);
      if (target) {
        map.setView([target.lat, target.lng], 19);
        if (hubMarkers[chosenHubId]) hubMarkers[chosenHubId].openPopup();
        updateHubGroupInfo(target);
      }
    });

    // Chuyển đổi mode đi thẳng
    selectLinearMode.addEventListener('change', () => {
      if (selectLinearMode.value === 'direction') {
        simDirectionBox.style.display = 'block';
        simPointsBox.style.display = 'none';
        clearABMarkers();
      } else {
        simDirectionBox.style.display = 'none';
        simPointsBox.style.display = 'block';
        simPointsStatus.textContent = 'Hãy click điểm thứ nhất trên bản đồ để đặt Điểm A (Xuất phát)';
      }
    });

    // Chọn nút hướng
    const dirButtons = document.querySelectorAll('.btn-dir');
    dirButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dirButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chosenDirectionDeg = parseInt(btn.getAttribute('data-dir'));
      });
    });

    // Click chọn 2 điểm A và B trên map
    map.on('click', (e) => {
      if (selectLinearMode.value !== 'points') return;

      if (!pointA) {
        pointA = e.latlng;
        if (markerPointA) map.removeLayer(markerPointA);
        markerPointA = L.marker(pointA, {
          icon: L.divIcon({
            className: 'point-marker',
            html: '<div style="background:#22c55e;color:#fff;font-weight:900;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);">A</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        }).addTo(map);
        simPointsStatus.textContent = 'Điểm A đã chọn. Hãy click điểm thứ hai để đặt Điểm B (Đích đến).';
      } else if (!pointB) {
        pointB = e.latlng;
        if (markerPointB) map.removeLayer(markerPointB);
        markerPointB = L.marker(pointB, {
          icon: L.divIcon({
            className: 'point-marker',
            html: '<div style="background:#ef4444;color:#fff;font-weight:900;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);">B</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        }).addTo(map);

        if (lineAB) map.removeLayer(lineAB);
        lineAB = L.polyline([pointA, pointB], {
          color: '#f59e0b',
          weight: 3,
          dashArray: '6, 6'
        }).addTo(map);

        simPointsStatus.textContent = 'Đã chọn xong A và B. Bấm "Bắt Đầu Đi Thẳng" để di chuyển!';
      } else {
        // Reset lại chọn lại điểm A
        clearABMarkers();
        pointA = e.latlng;
        markerPointA = L.marker(pointA, {
          icon: L.divIcon({
            className: 'point-marker',
            html: '<div style="background:#22c55e;color:#fff;font-weight:900;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;">A</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        }).addTo(map);
        simPointsStatus.textContent = 'Điểm A đã chọn. Hãy click đặt Điểm B.';
      }
    });

    function clearABMarkers() {
      pointA = null;
      pointB = null;
      if (markerPointA) { map.removeLayer(markerPointA); markerPointA = null; }
      if (markerPointB) { map.removeLayer(markerPointB); markerPointB = null; }
      if (lineAB) { map.removeLayer(lineAB); lineAB = null; }
    }

    // 3. ĐIỀU KHIỂN MÔ PHỎNG ĐI THẲNG CHO 1 HUB CHỈ ĐỊNH
    btnToggleLinearWalk.addEventListener('click', () => {
      if (isLinearWalking) {
        stopLinearWalk();
      } else {
        startLinearWalk();
      }
    });

    function startLinearWalk() {
      chosenHubId = selectLinearHub.value;
      const targetHub = allHubs.find(h => h.hubId === chosenHubId);
      if (!targetHub) {
        alert('Không tìm thấy Hub: ' + chosenHubId);
        return;
      }

      const speedMps = parseFloat(inputLinearSpeed.value) || 2.0;
      const METERS_PER_DEG_LAT = 111000;
      const mode = selectLinearMode.value;

      if (mode === 'points') {
        if (!pointA || !pointB) {
          alert('Vui lòng click chọn 2 điểm A và B trên bản đồ trước!');
          return;
        }
        // Đặt Hub về điểm A
        targetHub.lat = pointA.lat;
        targetHub.lng = pointA.lng;
      }

      isLinearWalking = true;
      btnToggleLinearWalk.textContent = 'Dừng Đi Thẳng';
      btnToggleLinearWalk.className = 'btn btn-danger btn-block';

      map.setView([targetHub.lat, targetHub.lng], 19);

      // Khởi tạo vệt đường đi (Trail)
      if (walkTrailLine) {
        map.removeLayer(walkTrailLine);
        walkTrailLine = null;
      }
      walkTrailPoints = [[targetHub.lat, targetHub.lng]];
      walkTrailLine = L.polyline(walkTrailPoints, {
        color: '#06b6d4',
        weight: 4,
        opacity: 0.9,
        dashArray: '5, 5'
      }).addTo(map);

      let stepCount = 0;

      linearWalkInterval = setInterval(async () => {
        if (!isLinearWalking) return;

        const radLat = targetHub.lat * Math.PI / 180;
        const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(radLat);

        if (mode === 'direction') {
          // Đi thẳng theo góc hướng cố định
          const headingRad = (chosenDirectionDeg * Math.PI) / 180;
          const dLat = (speedMps * Math.cos(headingRad)) / METERS_PER_DEG_LAT;
          const dLng = (speedMps * Math.sin(headingRad)) / metersPerDegLng;

          targetHub.lat += dLat;
          targetHub.lng += dLng;
          targetHub.yaw = chosenDirectionDeg;

        } else if (mode === 'points') {
          // Đi thẳng từ A đến B
          const dLatTotal = pointB.lat - targetHub.lat;
          const dLngTotal = pointB.lng - targetHub.lng;
          const distMeters = Math.sqrt(
            Math.pow(dLatTotal * METERS_PER_DEG_LAT, 2) +
            Math.pow(dLngTotal * metersPerDegLng, 2)
          );

          if (distMeters < speedMps) {
            // Đã tới đích B
            targetHub.lat = pointB.lat;
            targetHub.lng = pointB.lng;
            MapCommon.updateHubMarker(map, hubMarkers, targetHub, false);
            await sendTelemetryPacket(targetHub);
            logMessage(`[ĐẾN ĐÍCH] Hub ${targetHub.hubId} đã hoàn thành quãng đường A ➔ B!`);
            stopLinearWalk();
            return;
          }

          // Tính góc hướng đi
          const headingRad = Math.atan2(dLngTotal * metersPerDegLng, dLatTotal * METERS_PER_DEG_LAT);
          targetHub.yaw = Math.round((headingRad * 180 / Math.PI + 360) % 360);

          const dLat = (speedMps * Math.cos(headingRad)) / METERS_PER_DEG_LAT;
          const dLng = (speedMps * Math.sin(headingRad)) / metersPerDegLng;

          targetHub.lat += dLat;
          targetHub.lng += dLng;
        }

        // Giảm nhẹ pin mô phỏng
        stepCount++;
        if (stepCount % 20 === 0 && targetHub.battery > 5) {
          targetHub.battery -= 1;
        }

        // 1. Cập nhật marker ngay lập tức trên UI mô phỏng
        MapCommon.updateHubMarker(map, hubMarkers, targetHub, false);

        // 2. Cập nhật nón tầm nhìn trên bản đồ mô phỏng (Chuẩn 45 độ, 5m đồng bộ với User & Quản lý)
        simActiveVisionCone = MapCommon.renderVisionCone(map, simActiveVisionCone, targetHub.lat, targetHub.lng, targetHub.yaw, 45, 5);

        // 3. Cập nhật vệt đường đi (Trail Line)
        walkTrailPoints.push([targetHub.lat, targetHub.lng]);
        if (walkTrailLine) {
          walkTrailLine.setLatLngs(walkTrailPoints);
        }

        // 4. Tự động lia Camera theo Hub nếu được bật
        if (chkAutoFollow && chkAutoFollow.checked) {
          map.panTo([targetHub.lat, targetHub.lng], { animate: true, duration: 0.6 });
        }

        // 5. Gửi gói tin telemetry lên Server
        await sendTelemetryPacket(targetHub);

      }, 1000); // 1 giây 1 bước
    }

    function stopLinearWalk() {
      isLinearWalking = false;
      if (linearWalkInterval) clearInterval(linearWalkInterval);
      btnToggleLinearWalk.textContent = 'Bắt Đầu Đi Thẳng';
      btnToggleLinearWalk.className = 'btn btn-primary btn-block';
      if (simActiveVisionCone) {
        simActiveVisionCone.remove();
        simActiveVisionCone = null;
      }
    }

    // 4. MÔ PHỎNG CẢ ĐOÀN KHÁCH
    btnToggleSim.addEventListener('click', () => {
      if (isSimulatingGroup) {
        stopGroupSim();
      } else {
        startGroupSim();
      }
    });

    function startGroupSim() {
      isSimulatingGroup = true;
      simStatus.textContent = 'Đang chạy mô phỏng (1.5s/gói tin)';
      simStatus.style.color = 'var(--accent-green)';
      btnToggleSim.textContent = 'Dừng Cả Đoàn';
      btnToggleSim.className = 'btn btn-danger btn-block';

      const simHubs = allHubs.slice(0, 5);

      const headings = simHubs.map(() => ({
        dLat: (Math.random() - 0.45) * 0.00003,
        dLng: (Math.random() - 0.5) * 0.00003
      }));

      groupSimInterval = setInterval(async () => {
        for (let i = 0; i < simHubs.length; i++) {
          const hub = simHubs[i];
          const heading = headings[i];

          hub.lat += heading.dLat;
          hub.lng += heading.dLng;

          // Giữ khách quanh khuôn viên NEU
          if (hub.lat > 21.00050 || hub.lat < 20.99850) heading.dLat *= -1;
          if (hub.lng > 105.84450 || hub.lng < 105.84150) heading.dLng *= -1;

          hub.yaw = (hub.yaw + Math.floor((Math.random() - 0.5) * 20) + 360) % 360;

          await sendTelemetryPacket(hub);
        }
      }, 1500);
    }

    function stopGroupSim() {
      isSimulatingGroup = false;
      if (groupSimInterval) clearInterval(groupSimInterval);
      simStatus.textContent = 'Đang dừng';
      simStatus.style.color = 'var(--accent-red)';
      btnToggleSim.textContent = 'Bắt Đầu Cả Đoàn';
      btnToggleSim.className = 'btn btn-secondary btn-block';
    }

    // 5. GỬI GÓI TIN TELEMETRY
    async function sendTelemetryPacket(hub) {
      const espKey = (verifiedSecretKey === 'bql_sec_2026_x89a3f') ? 'esp_sec_2026_98a72b' : verifiedSecretKey;
      try {
        const res = await fetch('/api/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Secret': espKey
          },
          body: JSON.stringify({
            hubId: hub.hubId,
            lat: hub.lat,
            lng: hub.lng,
            alt: hub.alt || 15,
            yaw: hub.yaw || 0,
            battery: hub.battery || 95,
            secretKey: espKey
          })
        });

        const json = await res.json();
        if (json.success) {
          MapCommon.updateHubMarker(map, hubMarkers, hub, false);
          logMessage(`[${new Date().toLocaleTimeString()}] ${hub.hubId} ➔ (${hub.lat.toFixed(5)}, ${hub.lng.toFixed(5)}) | Yaw: ${hub.yaw}° | Pin: ${hub.battery}%`);
        }
      } catch (e) {
        console.warn('Lỗi gửi telemetry:', e);
      }
    }

    function logMessage(text) {
      const line = document.createElement('div');
      line.textContent = text;
      simLogBox.appendChild(line);
      simLogBox.scrollTop = simLogBox.scrollHeight;
    }
  }
});
