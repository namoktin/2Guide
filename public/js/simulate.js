/**
 * 2Guide - simulate.js
 * Logic giả lập gửi tín hiệu GPS & Pin từ các thiết bị Hub thực địa (Nhà tù Hỏa Lò)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const map = MapCommon.initMap('sim-map', [21.02534, 105.84655], 19);
  const hubMarkers = {};
  let allHubs = [];
  let simInterval = null;
  let isSimulating = false;

  // 1. TẢI DỮ LIỆU KHU DI TÍCH
  try {
    const res = await fetch('/api/site-data');
    const json = await res.json();
    if (json.success && json.data) {
      MapCommon.renderZones(map, json.data.zones);
      MapCommon.renderPOIs(map, json.data.pois);
      if (json.data.tourRoute) {
        MapCommon.renderTourRoute(map, json.data.tourRoute);
      }
    }
  } catch (e) {
    console.error('Lỗi site data:', e);
  }

  // 2. TẢI DANH SÁCH HUBS
  const selectHub = document.getElementById('sim-select-hub');
  try {
    const res = await fetch('/api/hubs');
    const json = await res.json();
    if (json.success && json.data) {
      allHubs = json.data;
      selectHub.innerHTML = allHubs.map(h => `
        <option value="${h.hubId}">${h.hubId} (Pin: ${h.battery}%)</option>
      `).join('');

      allHubs.forEach(h => {
        MapCommon.updateHubMarker(map, hubMarkers, h, false);
      });
    }
  } catch (e) {
    console.error('Lỗi hubs data:', e);
  }

  // Khi click trên bản đồ thì điền tọa độ vào form
  map.on('click', (e) => {
    document.getElementById('sim-input-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('sim-input-lng').value = e.latlng.lng.toFixed(6);
  });

  // 3. GỬI TỌA ĐỘ THỦ CÔNG
  const btnSendManual = document.getElementById('btn-send-manual');
  btnSendManual.addEventListener('click', async () => {
    const hubId = selectHub.value;
    const lat = parseFloat(document.getElementById('sim-input-lat').value);
    const lng = parseFloat(document.getElementById('sim-input-lng').value);
    const yaw = parseFloat(document.getElementById('sim-input-yaw').value);
    const battery = parseInt(document.getElementById('sim-input-battery').value);

    await sendTelemetryPacket({ hubId, lat, lng, yaw, battery, alt: 12 });
  });

  // 4. MÔ PHỎNG BƯỚC ĐI TỰ ĐỘNG CỦA DU KHÁCH
  const btnToggleSim = document.getElementById('btn-toggle-sim');
  const simStatus = document.getElementById('sim-status');

  btnToggleSim.addEventListener('click', () => {
    if (isSimulating) {
      stopSimulation();
    } else {
      startSimulation();
    }
  });

  function startSimulation() {
    isSimulating = true;
    simStatus.textContent = 'Đang chạy mô phỏng (1.5s/gói tin)';
    simStatus.style.color = 'var(--accent-green)';
    btnToggleSim.textContent = 'Dừng Mô Phỏng';
    btnToggleSim.className = 'btn btn-danger btn-block';

    const simHubs = allHubs.slice(0, 6);

    const headings = simHubs.map(() => ({
      dLat: (Math.random() - 0.45) * 0.00003,
      dLng: (Math.random() - 0.5) * 0.00003
    }));

    simInterval = setInterval(async () => {
      for (let i = 0; i < simHubs.length; i++) {
        const hub = simHubs[i];
        const heading = headings[i];

        hub.lat += heading.dLat;
        hub.lng += heading.dLng;

        // Giữ khách di chuyển trong khuôn viên Nhà tù Hỏa Lò
        if (hub.lat > 21.02565 || hub.lat < 21.02510) heading.dLat *= -1;
        if (hub.lng > 105.84725 || hub.lng < 105.84600) heading.dLng *= -1;

        hub.yaw = (hub.yaw + Math.floor((Math.random() - 0.5) * 20) + 360) % 360;

        await sendTelemetryPacket(hub);
      }
    }, 1500);
  }

  function stopSimulation() {
    isSimulating = false;
    if (simInterval) clearInterval(simInterval);
    simStatus.textContent = 'Đang dừng';
    simStatus.style.color = 'var(--accent-red)';
    btnToggleSim.textContent = 'Bắt Đầu Mô Phỏng Di Chuyển';
    btnToggleSim.className = 'btn btn-primary btn-block';
  }

  // Gửi gói tin telemetry lên backend
  const simLogBox = document.getElementById('sim-log-box');
  async function sendTelemetryPacket(hub) {
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubId: hub.hubId,
          lat: hub.lat,
          lng: hub.lng,
          alt: hub.alt || 12,
          yaw: hub.yaw || 0,
          battery: hub.battery || 95
        })
      });

      const json = await res.json();
      if (json.success) {
        MapCommon.updateHubMarker(map, hubMarkers, hub, false);

        const timeStr = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.textContent = `[${timeStr}] ${hub.hubId} -> (${hub.lat.toFixed(5)}, ${hub.lng.toFixed(5)}) | Pin: ${hub.battery}%`;
        simLogBox.appendChild(line);
        simLogBox.scrollTop = simLogBox.scrollHeight;
      }
    } catch (e) {
      console.warn('Lỗi gửi telemetry:', e);
    }
  }
});
