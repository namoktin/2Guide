/**
 * 2Guide - user.js
 * Cổng Khách Tham Quan: Bản Đồ Realtime, Điểm POI, Phân Khu, Tuyến Đường, Tự Động Lia Camera, Trợ Lý AI
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Chuẩn hóa mã Hub (Hỗ trợ 001, 1, NEU001, HUB-001 -> NEU001)
  function normalizeHubId(id) {
    if (!id) return 'NEU001';
    let s = String(id).trim().toUpperCase();
    if (s.startsWith('HUB-')) s = s.replace('HUB-', '');
    else if (s.startsWith('HUB')) s = s.replace('HUB', '');
    if (s.startsWith('NEU')) {
      const num = s.slice(3);
      if (/^\d+$/.test(num)) return 'NEU' + num.padStart(3, '0');
      return s;
    }
    if (/^\d+$/.test(s)) {
      return 'NEU' + s.padStart(3, '0');
    }
    return s;
  }

  const urlParams = new URLSearchParams(window.location.search);
  let myHubId = normalizeHubId(urlParams.get('hubId') || localStorage.getItem('2guide_current_hub_id') || 'NEU001');

  // Khởi tạo bản đồ Leaflet
  const map = MapCommon.initMap('user-map', [20.99965, 105.84280], 18);
  if (map.zoomControl) {
    map.zoomControl.setPosition('bottomleft');
  }

  // Đảm bảo Leaflet tính toán đúng kích thước khung bản đồ trên mọi thiết bị di động
  setTimeout(() => {
    map.invalidateSize();
  }, 200);
  window.addEventListener('resize', () => {
    map.invalidateSize();
  });

  const hubMarkers = {}; // { [hubId]: L.Marker }
  
  let currentGroupData = null;
  let groupMembers = [];
  let myHubData = { hubId: myHubId, lat: 20.99965, lng: 105.84280, yaw: 0, battery: 100 };
  let currentYaw = 0;

  let siteData = null;
  let tourRouteLayer = null;
  let currentPoi = null;
  let userVisionCone = null;

  const USER_FOV_ANGLE = 45;       // Góc mở nón tầm nhìn 45 độ (tập trung vào hiện vật)
  const USER_FOV_DISTANCE = 5;     // Giảm bán kính nón tầm nhìn xuống 5m theo yêu cầu

  // Vẽ nón tầm nhìn (Vision Cone) của chính Hub người dùng theo góc yaw
  function renderUserVisionCone() {
    if (!myHubData || myHubData.lat === undefined || myHubData.lng === undefined) return;
    const yawAngle = (myHubData.yaw !== undefined) ? myHubData.yaw : currentYaw;
    userVisionCone = MapCommon.renderVisionCone(
      map,
      userVisionCone,
      myHubData.lat,
      myHubData.lng,
      yawAngle,
      USER_FOV_ANGLE,
      USER_FOV_DISTANCE
    );
  }

  // DOM Elements
  const inputMyHubId = document.getElementById('input-my-hub-id');
  const btnSaveHubId = document.getElementById('btn-save-hub-id');
  const displayGroupName = document.getElementById('display-group-name');
  const displaySiteName = document.getElementById('display-site-name');
  const membersListBar = document.getElementById('members-list-bar');

  // Search DOM Elements
  const inputSearchHub = document.getElementById('input-search-hub');
  const btnSearchHub = document.getElementById('btn-search-hub');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const groupHubsDatalist = document.getElementById('group-hubs-datalist');
  const searchFeedbackToast = document.getElementById('search-feedback-toast');

  // AI DOM Elements
  const aiChatDrawer = document.getElementById('ai-chat-drawer');
  const btnToggleAiChat = document.getElementById('btn-toggle-ai-chat');
  const btnCloseAiChat = document.getElementById('btn-close-ai-chat');
  const chatMessages = document.getElementById('chat-messages');
  const inputAiChat = document.getElementById('input-ai-chat');
  const btnSendAiChat = document.getElementById('btn-send-ai-chat');
  const btnMicRecord = document.getElementById('btn-mic-record');
  const aiStatusIndicator = document.getElementById('ai-status-indicator');

  inputMyHubId.value = myHubId;

  // 1. TẢI DỮ LIỆU ĐỊA ĐIỂM (PHÂN KHU, TUYẾN THAM QUAN, ĐIỂM POI)
  try {
    const resSite = await fetch('/api/site-data');
    const jsonSite = await resSite.json();
    if (jsonSite.success && jsonSite.data) {
      siteData = jsonSite.data;
      if (displaySiteName) {
        displaySiteName.textContent = siteData.siteName ? ` | ${siteData.siteName}` : '';
      }
      document.title = `2Guide - ${siteData.siteName || 'Bản Đồ Tham Quan'}`;

      if (siteData.center) {
        map.setView([siteData.center.lat, siteData.center.lng], siteData.zoom || 18);
      }

      // Vẽ phân khu
      if (siteData.zones) {
        MapCommon.renderZones(map, siteData.zones);
      }

      // Vẽ tuyến tham quan khuyên dùng (cố định)
      if (siteData.tourRoute) {
        tourRouteLayer = MapCommon.renderTourRoute(map, siteData.tourRoute);
      }

      // Lưu ý: POI không xuất hiện trên bản đồ người dùng theo yêu cầu, nhưng vẫn lưu trong siteData để phục vụ AI
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu di tích:', err);
  }

  // 2. TẢI THÔNG TIN HUB CỦA BẢN THÂN VÀ ĐOÀN
  await loadHubInfo(myHubId);

  async function loadHubInfo(hubId) {
    try {
      const res = await fetch(`/api/hubs/${encodeURIComponent(hubId)}/info`);
      const json = await res.json();

      if (!json.success || !json.data) return;

      const data = json.data;
      myHubData = data.hub || myHubData;
      currentYaw = myHubData.yaw || 0;

      if (data.isGrouped && data.group) {
        currentGroupData = data.group;
        displayGroupName.textContent = data.group.groupName;
        groupMembers = data.members || [myHubData];
      } else {
        currentGroupData = null;
        displayGroupName.textContent = 'Khách Tham Quan Tự Do';
        groupMembers = [myHubData];
      }

      // Vẽ các thành viên kèm thuật toán tách mạng lưới (Grid Network Dispersion)
      renderMembersWithGridNetwork();

      // Vẽ nón tầm nhìn của chính Hub người dùng
      renderUserVisionCone();

      // Kết nối WebSocket
      connectWebSocket();

      // Pan camera đến vị trí của mình
      panToSelf();
    } catch (err) {
      console.error('Lỗi nạp thông tin Hub:', err);
    }
  }

  // Đổi Hub ID
  btnSaveHubId.addEventListener('click', () => {
    const rawVal = inputMyHubId.value;
    const newId = normalizeHubId(rawVal);
    if (!newId) {
      alert('Vui lòng nhập mã Hub ID của bạn!');
      return;
    }
    myHubId = newId;
    inputMyHubId.value = myHubId;
    localStorage.setItem('2guide_current_hub_id', myHubId);
    
    // Xóa marker cũ
    Object.values(hubMarkers).forEach(m => map.removeLayer(m));
    for (const k in hubMarkers) delete hubMarkers[k];

    loadHubInfo(myHubId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'REGISTER_USER',
        groupId: currentGroupData ? currentGroupData.groupId : 'SOLO',
        myHubId: myHubId
      }));
    }
  });

  inputMyHubId.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSaveHubId.click();
  });

  // 3. THUẬT TOÁN TÁCH MẠNG LƯỚI KHI NHIỀU NGƯỜI ĐỨNG GẦN NHAU
  function renderMembersWithGridNetwork() {
    const processedMembers = MapCommon.applyGridNetworkDispersion(map, groupMembers, myHubId);

    processedMembers.forEach(member => {
      const isSelf = (normalizeHubId(member.hubId) === myHubId);
      MapCommon.updateHubMarker(map, hubMarkers, member, isSelf);
    });

    // Render danh sách chip ngang trên bản đồ
    if (membersListBar) {
      membersListBar.innerHTML = processedMembers.map(m => {
        const isSelf = (normalizeHubId(m.hubId) === myHubId);
        const isCol = m.isCollided ? ' (Mạng lưới)' : '';
        return `
          <div class="member-chip ${isSelf ? 'active-self' : ''}" onclick="window.panToMember('${m.hubId}')">
            ${isSelf ? 'BẠN' : m.hubId} - ${m.battery || 100}%${isCol}
          </div>
        `;
      }).join('');
    }

    // Cập nhật gợi ý tìm kiếm thiết bị
    updateHubSearchDatalist();
  }

  function updateHubSearchDatalist() {
    if (!groupHubsDatalist) return;
    groupHubsDatalist.innerHTML = groupMembers.map(m => {
      const isSelf = (normalizeHubId(m.hubId) === myHubId);
      return `<option value="${m.hubId}">${isSelf ? '(Bạn) ' : ''}Pin: ${m.battery || 100}%</option>`;
    }).join('');
  }

  function showSearchToast(text, type = 'success') {
    if (!searchFeedbackToast) return;
    searchFeedbackToast.textContent = text;
    searchFeedbackToast.className = `search-feedback-toast ${type}`;
    searchFeedbackToast.style.display = 'block';
    setTimeout(() => {
      if (searchFeedbackToast) searchFeedbackToast.style.display = 'none';
    }, 3500);
  }

  window.panToMember = (hubId) => {
    const cleanId = normalizeHubId(hubId);
    const member = groupMembers.find(m => normalizeHubId(m.hubId) === cleanId) || groupMembers.find(m => m.hubId === hubId);
    if (member && hubMarkers[member.hubId]) {
      map.setView([member.lat, member.lng], 19, { animate: true });
      hubMarkers[member.hubId].openPopup();
    }
  };

  function panToSelf() {
    if (myHubData && myHubData.lat && myHubData.lng) {
      map.setView([myHubData.lat, myHubData.lng], 19, { animate: true });
      if (hubMarkers[myHubId]) {
        hubMarkers[myHubId].openPopup();
      }
    }
  }

  const btnLocateSelf = document.getElementById('btn-locate-self');
  if (btnLocateSelf) {
    btnLocateSelf.addEventListener('click', panToSelf);
  }

  const btnFitGroup = document.getElementById('btn-fit-group');
  if (btnFitGroup) {
    btnFitGroup.addEventListener('click', () => {
      if (!groupMembers || groupMembers.length === 0) return;
      const latLngs = groupMembers.map(m => [m.lat, m.lng]);
      map.fitBounds(L.latLngBounds(latLngs).pad(0.3));
    });
  }

  // TÌM KIẾM THIẾT BỊ NÂNG CAO
  if (inputSearchHub) {
    inputSearchHub.addEventListener('input', () => {
      if (btnClearSearch) {
        btnClearSearch.style.display = inputSearchHub.value.trim() ? 'block' : 'none';
      }
    });
    inputSearchHub.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearchMember();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      inputSearchHub.value = '';
      btnClearSearch.style.display = 'none';
      inputSearchHub.focus();
    });
  }

  function doSearchMember() {
    const rawQuery = inputSearchHub ? inputSearchHub.value.trim() : '';
    if (!rawQuery) {
      showSearchToast('Vui lòng nhập mã Hub cần tìm (ví dụ: 002, NEU002)', 'warning');
      if (inputSearchHub) inputSearchHub.focus();
      return;
    }

    const upperQuery = rawQuery.toUpperCase();
    const normQuery = normalizeHubId(rawQuery);

    const foundMember = groupMembers.find(m => {
      const mId = m.hubId.toUpperCase();
      return mId === normQuery || mId.includes(upperQuery) || mId.endsWith(upperQuery);
    });

    if (foundMember) {
      window.panToMember(foundMember.hubId);
      const isSelf = (normalizeHubId(foundMember.hubId) === myHubId);
      let distStr = '';
      if (!isSelf && myHubData && myHubData.lat && foundMember.lat) {
        const dist = Math.round(map.distance([myHubData.lat, myHubData.lng], [foundMember.lat, foundMember.lng]));
        distStr = ` (Cách bạn ~${dist}m)`;
      }
      showSearchToast(`Đã định vị ${foundMember.hubId}${isSelf ? ' - Vị trí của bạn' : distStr}!`, 'success');
    } else {
      const available = groupMembers.map(m => m.hubId).join(', ');
      showSearchToast(`Không tìm thấy Hub "${rawQuery}". Trong đoàn gồm: ${available || 'Chưa có'}`, 'warning');
    }
  }

  if (btnSearchHub) {
    btnSearchHub.addEventListener('click', doSearchMember);
  }

  // 4. TRỢ LÝ HƯỚNG DẪN VIÊN AI (CHAT & VOICE STT)
  if (btnToggleAiChat) {
    btnToggleAiChat.addEventListener('click', () => {
      const isAlreadyOpen = aiChatDrawer.classList.contains('open');
      if (isAlreadyOpen) {
        aiChatDrawer.classList.remove('open');
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } else {
        closePoiSheet();
        aiChatDrawer.classList.add('open');
      }
    });
  }

  if (btnCloseAiChat) {
    btnCloseAiChat.addEventListener('click', () => {
      aiChatDrawer.classList.remove('open');
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    });
  }

  window.sendQuickPrompt = (text) => {
    inputAiChat.value = text;
    sendAiMessage();
  };

  if (btnSendAiChat) {
    btnSendAiChat.addEventListener('click', () => {
      sendAiMessage();
    });
  }

  if (inputAiChat) {
    inputAiChat.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendAiMessage();
    });
  }

  async function sendAiMessage() {
    const question = inputAiChat.value.trim();
    if (!question) return;

    inputAiChat.value = '';
    appendChatMessage('user', question);
    aiStatusIndicator.textContent = 'AI đang suy nghĩ...';

    const loadingBubble = appendChatMessage('ai', 'Đang kết nối kho dữ liệu thuyết minh...');

    try {
      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          lat: myHubData.lat,
          lng: myHubData.lng,
          yaw: currentYaw,
          hubId: myHubId
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const reply = json.data.reply;
        loadingBubble.innerHTML = `
          <div class="meta">${json.data.provider || 'AI Guide'} ${json.data.nearestPoi ? `| Gần: Điểm ${json.data.nearestPoi.number}` : ''}</div>
          ${reply}
        `;
        aiStatusIndicator.textContent = 'Sẵn sàng';
      } else {
        loadingBubble.textContent = json.error || 'Có lỗi xảy ra khi hỏi AI. Vui lòng thử lại!';
        aiStatusIndicator.textContent = 'Lỗi';
      }
    } catch (err) {
      loadingBubble.textContent = 'Không thể kết nối đến máy chủ AI: ' + err.message;
      aiStatusIndicator.textContent = 'Mất kết nối';
    }
  }

  function appendChatMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    if (sender === 'user') {
      bubble.innerHTML = `<div class="meta">BẠN (${myHubId})</div>${text}`;
    } else {
      bubble.textContent = text;
    }
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
  }

  // MICROPHONE (VOICE STT)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isListening = true;
      btnMicRecord.classList.add('listening');
      btnMicRecord.textContent = 'Đang Nghe...';
      aiStatusIndicator.textContent = 'Đang lắng nghe giọng nói...';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        inputAiChat.value = transcript.trim();
        sendAiMessage();
      }
    };

    recognition.onerror = (event) => {
      console.warn('Lỗi SpeechRecognition:', event.error);
      stopListening();
      if (event.error === 'not-allowed') {
        alert('Vui lòng cấp quyền truy cập Microphone trong trình duyệt của bạn!');
      }
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function stopListening() {
    isListening = false;
    if (btnMicRecord) {
      btnMicRecord.classList.remove('listening');
      btnMicRecord.textContent = 'Nói Mic';
    }
    if (aiStatusIndicator) {
      aiStatusIndicator.textContent = 'Sẵn sàng';
    }
  }

  if (btnMicRecord) {
    btnMicRecord.addEventListener('click', () => {
      if (!SpeechRecognition) {
        alert('Trình duyệt hiện tại của bạn không hỗ trợ nhận diện giọng nói Web Speech. Hãy dùng Chrome hoặc Edge để nói chuyện nhé!');
        return;
      }

      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          recognition.stop();
        }
      }
    });
  }

  // 5. BOTTOM SHEET XEM THUYẾT MINH POI
  const poiSheet = document.getElementById('poi-sheet');
  const sheetPoiTitle = document.getElementById('sheet-poi-title');
  const sheetPoiZone = document.getElementById('sheet-poi-zone');
  const sheetPoiDesc = document.getElementById('sheet-poi-desc');
  const btnClosePoiSheet = document.getElementById('btn-close-poi-sheet');
  const btnPlayPoiAudio = document.getElementById('btn-play-poi-audio');
  const userFabContainer = document.querySelector('.user-fab-container');

  function openPoiSheet(item) {
    if (!item) return;
    if (aiChatDrawer && aiChatDrawer.classList.contains('open')) {
      aiChatDrawer.classList.remove('open');
    }

    currentPoi = item;
    const isArtifact = item.isArtifact || (item.id && item.id.startsWith('NEU_ART_'));
    const prefix = isArtifact ? 'Hiện vật #' : '';
    if (sheetPoiTitle) sheetPoiTitle.textContent = `${prefix}${item.number}. ${item.name}`;
    if (sheetPoiZone) {
      sheetPoiZone.textContent = `${item.category || item.zoneName || 'Khu Di Tích'} ${item.year ? `(Niên đại: ${item.year})` : (item.floor ? `(Tầng ${item.floor})` : '')}`;
    }
    if (sheetPoiDesc) sheetPoiDesc.textContent = item.description || item.audioGuide || 'Chưa có thông tin mô tả chi tiết.';
    
    if (poiSheet) {
      poiSheet.classList.add('open');
    }

    if (userFabContainer) {
      userFabContainer.classList.add('hidden-by-sheet');
    }
  }

  function closePoiSheet() {
    if (!poiSheet || !poiSheet.classList.contains('open')) return;
    poiSheet.classList.remove('open');
    if (userFabContainer) {
      userFabContainer.classList.remove('hidden-by-sheet');
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  if (btnClosePoiSheet) {
    btnClosePoiSheet.addEventListener('click', closePoiSheet);
  }

  if (btnPlayPoiAudio) {
    btnPlayPoiAudio.addEventListener('click', () => {
      if (!currentPoi) return;
      const poiNum = currentPoi.number || 1;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'POI_GAZE_TRIGGER',
          hubId: myHubId,
          poiNumber: poiNum,
          secretKey: ESP32_SECRET_KEY
        }));
      }
      fetch('/api/hubs/gaze-poi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Secret': ESP32_SECRET_KEY
        },
        body: JSON.stringify({
          hubId: myHubId,
          poiNumber: poiNum,
          secretKey: ESP32_SECRET_KEY
        })
      }).catch(() => {});
      updateGazeToast(`🎧 Đang kích hoạt phát thuyết minh 3D Hiện vật #${poiNum} trên Hub!`, true);
    });
  }

  map.on('click', () => {
    closePoiSheet();
  });

  // Hỗ trợ vuốt xuống (Swipe Down) để đóng Bottom Sheet trên điện thoại
  function setupSwipeDownDismiss(element, dismissCallback) {
    if (!element) return;
    let touchStartY = 0;
    let touchCurrentY = 0;

    element.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchCurrentY = touchStartY;
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      touchCurrentY = e.touches[0].clientY;
    }, { passive: true });

    element.addEventListener('touchend', () => {
      const deltaY = touchCurrentY - touchStartY;
      if (deltaY > 60) {
        dismissCallback();
      }
    }, { passive: true });
  }

  setupSwipeDownDismiss(poiSheet, closePoiSheet);
  setupSwipeDownDismiss(aiChatDrawer, () => {
    if (aiChatDrawer) aiChatDrawer.classList.remove('open');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  });

  document.querySelectorAll('.sheet-drag-handle').forEach(handle => {
    handle.addEventListener('click', (e) => {
      const parentSheet = e.target.closest('.poi-bottom-sheet, .ai-chat-drawer');
      if (parentSheet === poiSheet) {
        closePoiSheet();
      } else if (parentSheet === aiChatDrawer) {
        aiChatDrawer.classList.remove('open');
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      }
    });
  });

  // ============================================================
  // ĐIỀU KHIỂN ÂM LƯỢNG KHÁCH & ĐỘNG CƠ ÂM THANH 3D KHÔNG GIAN (HRTF)
  // Quy luật:
  // - Khách cài đặt âm lượng gốc: V_khách (mặc định 50%)
  // - Ở rìa tầm nhìn (10m): V_min = V_khách - 20% (tối thiểu 1%)
  // - Ở sát hiện vật (<= 0.3m = 30cm): V_max = V_khách + 50% (tối đa 100%)
  // - Khi di chuyển: Âm lượng nội suy mượt mà từ V_min đến V_max
  // - Tọa độ 3D HRTF: Panning Trái / Phải / Trước / Sau xoay theo la bàn
  // ============================================================
  // ĐIỀU CHỈNH ÂM LƯỢNG TAI NGHE THIẾT BỊ PHẦN CỨNG HUB
  // (Web User KHÔNG phát âm thanh - User chỉ xem văn bản text do AI trả về.
  //  Âm thanh thuyết minh do chip DAC PCM5102A trên Hub phát ra tai nghe vật lý)
  // ============================================================
  let userBaseVolume = parseInt(localStorage.getItem('2guide_master_vol')) || 50;
  const sliderMasterVol = document.getElementById('slider-master-volume');
  const displayMasterVol = document.getElementById('display-master-vol');

  if (sliderMasterVol && displayMasterVol) {
    sliderMasterVol.value = userBaseVolume;
    displayMasterVol.textContent = `${userBaseVolume}%`;

    sliderMasterVol.addEventListener('input', (e) => {
      userBaseVolume = parseInt(e.target.value) || 50;
      displayMasterVol.textContent = `${userBaseVolume}%`;
      localStorage.setItem('2guide_master_vol', userBaseVolume);

      // Đồng bộ mức âm lượng qua WebSocket xuống thiết bị phần cứng ESP32
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'SET_VOLUME',
          hubId: myHubId,
          volume: userBaseVolume,
          secretKey: ESP32_SECRET_KEY
        }));
      }
    });
  }

  // Tắt toàn bộ luồng tổng hợp giọng nói Web Speech trên Web User nếu có
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Mã bí mật ESP32 bảo mật truyền thông hai chiều
  const ESP32_SECRET_KEY = urlParams.get('secret') || localStorage.getItem('2guide_esp32_secret') || 'esp_sec_2026_98a72b';

  // 6. TỰ ĐỘNG GỬI MÃ SỐ HIỆN VẬT VỀ ESP32 KHI NẰM TRONG TẦM NHÌN (1.5 GIÂY) & HIỂN THỊ TEXT TRÊN WEB
  let visionTargetItem = null;
  let visionTargetStartTime = 0;
  let visionHasTriggered = false;
  let userGazeToast = null;

  function updateGazeToast(text, isSuccess = false) {
    if (!userGazeToast) {
      userGazeToast = document.createElement('div');
      userGazeToast.id = 'user-gaze-hud-toast';
      userGazeToast.style.cssText = 'position: fixed; top: 68px; left: 50%; transform: translateX(-50%); z-index: 500; background: rgba(15, 23, 42, 0.95); border: 1px solid #38bdf8; border-radius: 20px; padding: 6px 16px; font-size: 0.8rem; font-weight: 700; color: #f8fafc; box-shadow: 0 4px 16px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 8px; backdrop-filter: blur(8px); pointer-events: none; transition: all 0.2s ease;';
      document.body.appendChild(userGazeToast);
    }
    userGazeToast.innerHTML = text;
    userGazeToast.style.borderColor = isSuccess ? '#10b981' : '#38bdf8';
    userGazeToast.style.display = 'flex';
  }

  function hideGazeToast() {
    if (userGazeToast) {
      userGazeToast.style.display = 'none';
    }
  }

  const spatialHud = document.getElementById('spatial-audio-hud');
  const hudPoiName = document.getElementById('hud-poi-name');
  const hudDistance = document.getElementById('hud-distance');
  const hudDirection = document.getElementById('hud-direction');
  const hudActualVol = document.getElementById('hud-actual-vol');
  const btnStopSpatialAudio = document.getElementById('btn-stop-spatial-audio');

  if (btnStopSpatialAudio) {
    btnStopSpatialAudio.addEventListener('click', () => {
      if (spatialHud) spatialHud.style.display = 'none';
    });
  }

  function checkPoiInVisionCone() {
    if (!siteData || !myHubData || myHubData.lat === undefined || myHubData.lng === undefined) return;

    // CHỈ QUÉT HIỆN VẬT LỊCH SỬ (artifacts), TUYỆT ĐỐI KHÔNG QUÉT POI
    const allTargets = siteData.artifacts || [];
    if (allTargets.length === 0) return;

    const userLat = myHubData.lat;
    const userLng = myHubData.lng;
    const userYaw = (myHubData.yaw !== undefined) ? myHubData.yaw : currentYaw;

    // CHỈ TÌM HIỆN VẬT NẰM TRONG TẦM NHÌN (USER_FOV_ANGLE = 45 độ, USER_FOV_DISTANCE = 5m)
    // TUYỆT ĐỐI KHÔNG kích hoạt nếu hiện vật ở gần nhưng KHÔNG nằm trong tầm nhìn!
    const inSight = allTargets.find(p => 
      MapCommon.isPointInVisionCone(userLat, userLng, userYaw, p.lat, p.lng, USER_FOV_ANGLE, USER_FOV_DISTANCE)
    );

    if (inSight) {
      const spatial = MapCommon.calculateSpatialParams(userLat, userLng, userYaw, inSight.lat, inSight.lng);
      const dynVol = MapCommon.calculateDynamicVolume(userBaseVolume, spatial.distance, USER_FOV_DISTANCE, 0.3);

      if (displayMasterVol) {
        displayMasterVol.innerHTML = `<span style="color: #38bdf8; font-weight: 800;">${dynVol.volumePercent}%</span> <span style="font-size: 0.65rem; color: #94a3b8;">(~${spatial.distance.toFixed(1)}m)</span>`;
      }

      if (spatialHud) {
        spatialHud.style.display = 'block';
        if (hudPoiName) hudPoiName.textContent = inSight.name;
        if (hudDistance) hudDistance.textContent = `Cự ly: ${spatial.distance.toFixed(1)}m`;
        const dirText = Math.abs(spatial.relativeAngle) <= 10 ? '0° Chính Diện' : `${Math.round(Math.abs(spatial.relativeAngle))}° ${spatial.relativeAngle >= 0 ? 'Phải' : 'Trái'}`;
        if (hudDirection) hudDirection.textContent = `Hướng: ${dirText}`;
        if (hudActualVol) hudActualVol.textContent = `${dynVol.volumePercent}% (To hơn khi lại gần)`;
      }

      if (!visionTargetItem || visionTargetItem.id !== inSight.id) {
        visionTargetItem = inSight;
        visionTargetStartTime = Date.now();
        visionHasTriggered = false;
        updateGazeToast(`🎯 Đang nhìn: <strong style="color: #fbbf24;">${inSight.name}</strong> (~${spatial.distance.toFixed(1)}m | Âm lượng: ${dynVol.volumePercent}%) (Khóa mục tiêu: 1.5s)`);
      } else {
        const elapsed = Date.now() - visionTargetStartTime;

        if (!visionHasTriggered) {
          if (elapsed < 1500) {
            const remain = ((1500 - elapsed) / 1000).toFixed(1);
            updateGazeToast(`🎯 Đang nhìn: <strong style="color: #fbbf24;">${inSight.name}</strong> (~${spatial.distance.toFixed(1)}m | Âm lượng: ${dynVol.volumePercent}%) (Khóa: ${remain}s)`);
          } else {
            // ĐÃ NHÌN ĐỦ 1.5 GIÂY (1500ms) - KÍCH HOẠT PHÁT ESP32 & MỞ TEXT TRÊN WEB
            visionHasTriggered = true;
            const poiNum = inSight.number || 1;

            updateGazeToast(`✅ Đã khóa mục tiêu: <strong style="color: #10b981;">${inSight.name}</strong> (~${spatial.distance.toFixed(1)}m | ${dynVol.volumePercent}%)`, true);
            console.log(`[USER FOV] Hiện vật #${poiNum} ("${inSight.name}") vào tầm nhìn 1.5s -> Kích hoạt phát trên ESP32 & hiển thị text.`);

            // 1. Tự động mở Bottom Sheet thông tin thuyết minh văn bản cho du khách đọc
            openPoiSheet(inSight);

            // 2. Gửi qua WebSocket (kèm mã bảo mật) tới ESP32 để kích hoạt DAC PCM5102A
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'POI_GAZE_TRIGGER',
                hubId: myHubId,
                poiNumber: poiNum,
                secretKey: ESP32_SECRET_KEY
              }));
            }

            // 3. Gửi qua REST API đồng bộ
            fetch('/api/hubs/gaze-poi', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Device-Secret': ESP32_SECRET_KEY
              },
              body: JSON.stringify({
                hubId: myHubId,
                poiNumber: poiNum,
                secretKey: ESP32_SECRET_KEY
              })
            }).catch(() => {});
          }
        }
      }
    } else {
      // HIỆN VẬT KHÔNG NẰM TRONG TẦM NHÌN: TẮT HOÀN TOÀN HUD VÀ KHÔNG KÍCH HOẠT PHÁT
      if (displayMasterVol) {
        displayMasterVol.textContent = `${userBaseVolume}%`;
      }
      if (spatialHud) {
        spatialHud.style.display = 'none';
      }
      if (visionTargetItem) {
        visionTargetItem = null;
        visionTargetStartTime = 0;
        visionHasTriggered = false;
        hideGazeToast();
      }
    }
  }

  setInterval(checkPoiInVisionCone, 250);

  // 7. KẾT NỐI WEBSOCKET REALTIME & CỐ ĐỊNH LIA CAMERA THEO TỪNG BƯỚC CHÂN
  let ws = null;

  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'REGISTER_USER',
        groupId: currentGroupData ? currentGroupData.groupId : 'SOLO',
        myHubId: myHubId
      }));
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('[User WS] Đã kết nối WebSocket với máy chủ');
      const userLiveIndicator = document.getElementById('user-live-indicator');
      if (userLiveIndicator) {
        userLiveIndicator.textContent = '● Trực tiếp';
        userLiveIndicator.style.color = '#22c55e';
      }
      ws.send(JSON.stringify({
        type: 'REGISTER_USER',
        groupId: currentGroupData ? currentGroupData.groupId : 'SOLO',
        myHubId: myHubId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'HUB_LOCATION_UPDATE') {
          const { hubId, lat, lng, yaw, battery } = msg;
          const cleanHubId = normalizeHubId(hubId);

          let target = groupMembers.find(x => normalizeHubId(x.hubId) === cleanHubId);
          if (target) {
            target.lat = lat;
            target.lng = lng;
            if (yaw !== undefined) target.yaw = yaw;
            if (battery !== undefined) target.battery = battery;
          } else {
            target = { hubId: cleanHubId, lat, lng, yaw: yaw || 0, battery: battery || 100 };
            groupMembers.push(target);
          }

          if (cleanHubId === myHubId) {
            const posChanged = (
              myHubData.lat === undefined ||
              Math.abs(myHubData.lat - lat) > 0.00002 ||
              Math.abs(myHubData.lng - lng) > 0.00002
            );

            myHubData.lat = lat;
            myHubData.lng = lng;
            if (yaw !== undefined) myHubData.yaw = yaw;
            if (battery !== undefined) myHubData.battery = battery;

            // CỐ ĐỊNH LIA CAMERA THEO BƯỚC CHÂN (Chỉ khi di chuyển tọa độ GPS, tránh giật khi xoay la bàn thời gian thực)
            if (posChanged) {
              map.panTo([lat, lng], { animate: true, duration: 0.6 });
            }

            // Cập nhật và xoay nón tầm nhìn theo góc yaw mới của chính mình
            renderUserVisionCone();

            checkPoiInVisionCone();
          }

          renderMembersWithGridNetwork();
        } else if (msg.type === 'ADMIN_EMERGENCY_BROADCAST') {
          showEmergencyBanner(`[BAN QUẢN LÝ THÔNG BÁO] ${msg.message}`);
        } else if (msg.type === 'AI_DIALOGUE_UPDATE') {
          const cleanHubId = normalizeHubId(msg.hubId);
          if (!myHubId || cleanHubId === myHubId || !msg.hubId || myHubId === 'NEU001' || cleanHubId === 'NEU001') {
            console.log('[AI DIALOGUE REALTIME]', msg);
            // Tự động mở khung chat AI nếu đang đóng
            if (aiChatDrawer && !aiChatDrawer.classList.contains('open')) {
              closePoiSheet();
              aiChatDrawer.classList.add('open');
            }
            if (msg.userQuestion) {
              appendChatMessage('user', msg.userQuestion);
            }
            if (msg.aiReply) {
              const bubble = appendChatMessage('ai', msg.aiReply);
              bubble.innerHTML = `
                <div class="meta">${msg.provider || 'AI Guide (Từ Thiết Bị)'} ${msg.nearestPoi ? `| Gần: Điểm ${msg.nearestPoi.number}` : ''}</div>
                ${msg.aiReply}
              `;
              if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
              if (aiStatusIndicator) {
                aiStatusIndicator.textContent = 'Đã nhận câu trả lời';
                setTimeout(() => {
                  if (aiStatusIndicator && aiStatusIndicator.textContent === 'Đã nhận câu trả lời') {
                    aiStatusIndicator.textContent = 'Sẵn sàng';
                  }
                }, 4000);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Lỗi xử lý WS message:', e);
      }
    };
  }

  function showEmergencyBanner(text) {
    const banner = document.getElementById('emergency-banner');
    const bannerText = document.getElementById('emergency-banner-text');
    if (banner && bannerText) {
      bannerText.textContent = text;
      banner.style.display = 'block';
      setTimeout(() => { banner.style.display = 'none'; }, 10000);
    }
  }
});
