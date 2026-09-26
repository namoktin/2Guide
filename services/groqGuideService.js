const fs = require('fs');
const dotenv = require('dotenv');
const siteData = require('../data/siteData.js');

/**
 * Service Trợ Lý Hướng Dẫn Viên AI Thông Minh (Groq Cloud LLM)
 * Tích hợp nhận diện phân khu thực tế, phân tích tầm nhìn không gian 360° (Yaw),
 * chỉ dẫn đường đi theo hướng mắt nhìn của du khách, và giải thích sâu sắc các mốc lịch sử.
 */
class GroqGuideService {
  constructor() {
    this.refreshEnv();
  }

  refreshEnv() {
    try {
      const envConfig = dotenv.parse(fs.readFileSync('.env'));
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
    } catch (e) {}

    this.apiKey = (process.env.GROQ_API_KEY || '').trim();
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  }

  setApiKey(key) {
    if (key && key.trim()) {
      this.apiKey = key.trim();
      process.env.GROQ_API_KEY = this.apiKey;
    }
  }

  /**
   * 1. Xác định Phân Khu mà người dùng đang đứng
   * Sử dụng thuật toán Ray-Casting (Point in Polygon)
   */
  findCurrentZone(lat, lng) {
    if (!lat || !lng || !siteData.zones || siteData.zones.length === 0) return null;

    // Kiểm tra xem điểm có nằm trong polygon của zone không
    for (const zone of siteData.zones) {
      if (zone.polygon && Array.isArray(zone.polygon) && zone.polygon.length >= 3) {
        if (this.isPointInsidePolygon(lat, lng, zone.polygon)) {
          return {
            id: zone.id,
            name: zone.name,
            shortName: zone.shortName || zone.name,
            floor: zone.floor || 1,
            isInside: true
          };
        }
      }
    }

    // Nếu đang ở ngoài ranh giới (trên đường đi/sân), tìm phân khu gần nhất
    let nearestZone = null;
    let minZoneDist = Infinity;

    siteData.zones.forEach(zone => {
      if (zone.polygon && zone.polygon.length > 0) {
        // Tính tâm của polygon
        const centerLat = zone.polygon.reduce((sum, p) => sum + p[0], 0) / zone.polygon.length;
        const centerLng = zone.polygon.reduce((sum, p) => sum + p[1], 0) / zone.polygon.length;

        const dLat = (centerLat - lat) * 111000;
        const dLng = (centerLng - lng) * 111000 * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        if (dist < minZoneDist) {
          minZoneDist = dist;
          nearestZone = {
            id: zone.id,
            name: zone.name,
            shortName: zone.shortName || zone.name,
            distanceMeters: Math.round(dist),
            isInside: false
          };
        }
      }
    });

    return nearestZone;
  }

  isPointInsidePolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];

      const intersect = ((yi > lng) !== (yj > lng)) &&
          (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * 2. Phân tích Không Gian & Tầm Nhìn 360° theo góc Yaw của Hub
   * Xác định những gì đang nằm ở:
   * - Trực diện phía trước mặt
   * - Phía trước bên phải / bên trái
   * - Ngay bên phải / bên trái
   * - Phía sau lưng
   */
  analyzeSpatialVision(lat, lng, yaw = 0) {
    if (!lat || !lng) return { nearestPoi: null, visionTargets: [], allSurroundings: [] };

    const targets = [
      ...(siteData.pois || []).map(p => ({ ...p, type: 'POI' })),
      ...(siteData.artifacts || []).map(a => ({ ...a, type: 'ARTIFACT' }))
    ];

    const analyzed = targets.map(target => {
      const dLat = (target.lat - lat) * 111000;
      const dLng = (target.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180);
      const distance = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));

      // Góc phương vị la bàn từ người dùng đến mục tiêu (0° = Bắc, 90° = Đông, 180° = Nam, 270° = Tây)
      const bearing = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

      // Góc lệch so với góc yaw (hướng mắt nhìn của du khách)
      let diff = (bearing - yaw) % 360;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      // Phân loại vị trí tương đối theo mắt nhìn du khách
      let relativePosition = '';
      let isDirectFront = false;

      if (Math.abs(diff) <= 25) {
        relativePosition = 'ngay phía trước mặt bạn';
        isDirectFront = true;
      } else if (diff > 25 && diff <= 65) {
        relativePosition = 'chếch phía trước bên tay phải của bạn';
      } else if (diff > 65 && diff <= 115) {
        relativePosition = 'ngay bên tay phải của bạn';
      } else if (diff > 115 && diff <= 155) {
        relativePosition = 'chếch phía sau bên tay phải của bạn';
      } else if (diff >= -65 && diff < -25) {
        relativePosition = 'chếch phía trước bên tay trái của bạn';
      } else if (diff >= -115 && diff < -65) {
        relativePosition = 'ngay bên tay trái của bạn';
      } else if (diff >= -155 && diff < -115) {
        relativePosition = 'chếch phía sau bên tay trái của bạn';
      } else {
        relativePosition = 'ngay phía sau lưng bạn';
      }

      return {
        ...target,
        distance,
        bearing: Math.round(bearing),
        relativeDiff: Math.round(diff),
        relativePosition,
        isDirectFront
      };
    });

    // Sắp xếp theo khoảng cách gần nhất
    analyzed.sort((a, b) => a.distance - b.distance);

    const nearestPoi = analyzed.find(t => t.type === 'POI') || analyzed[0] || null;
    const directFrontTargets = analyzed.filter(t => t.isDirectFront && t.distance <= 50);
    const nearbySurroundings = analyzed.slice(0, 6);

    return {
      nearestPoi,
      directFrontTargets,
      nearbySurroundings
    };
  }

  /**
   * 3. Sinh câu trả lời thông minh dựa trên ngữ cảnh thực địa, tầm nhìn và mốc lịch sử
   */
  async generateResponse(userQuestion, context = {}) {
    this.refreshEnv();
    const startTime = Date.now();

    if (!userQuestion || !userQuestion.trim()) {
      return {
        reply: "Tôi chưa nghe rõ câu hỏi. Bạn hãy thử nói lại hoặc gõ câu hỏi vào ô chat nhé!",
        provider: "Local Validator",
        latencyMs: 0,
        success: false
      };
    }

    const { lat, lng, yaw, hubId } = context;

    // Phân tích vị trí phân khu & tầm nhìn
    const currentZone = this.findCurrentZone(lat, lng);
    const spatialInfo = this.analyzeSpatialVision(lat, lng, yaw);
    const yawDir = this.getYawDirection(yaw || 0);

    // Chuẩn bị thông tin ngữ cảnh thực tế cho Prompt
    let contextStr = `\n[NGỮ CẢNH THỰC ĐỊA HIỆN TẠI CỦA KHÁCH THAM QUAN]:`;
    if (hubId) contextStr += `\n- Mã thiết bị Hub: ${hubId}`;
    if (lat && lng) contextStr += `\n- Tọa độ GPS: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
    if (yaw !== undefined) contextStr += `\n- Hướng nhìn la bàn hiện tại của du khách: ${yaw}° (hướng ${yawDir})`;

    // Thông tin phân khu
    if (currentZone) {
      if (currentZone.isInside) {
        contextStr += `\n- Vị trí hiện tại: Du khách ĐANG ĐỨNG BÊN TRONG: "${currentZone.name}" (${currentZone.shortName}).`;
      } else {
        contextStr += `\n- Vị trí hiện tại: Du khách đang ở khu vực lân cận, gần nhất là "${currentZone.name}" (cách khoảng ${currentZone.distanceMeters}m).`;
      }
    }

    // Các điểm nằm ngay trong tầm nhìn trước mắt
    if (spatialInfo.directFrontTargets.length > 0) {
      contextStr += `\n- Phía trước mặt du khách (trong tầm nhìn trực diện hướng ${yawDir}):`;
      spatialInfo.directFrontTargets.forEach(t => {
        contextStr += `\n  + ${t.name} (cách ${t.distance}m, ${t.relativePosition})`;
      });
    }

    // Các điểm xung quanh 360 độ theo hướng nhìn du khách
    if (spatialInfo.nearbySurroundings.length > 0) {
      contextStr += `\n- Vị trí các điểm tham quan lân cận theo hướng mắt nhìn của du khách:`;
      spatialInfo.nearbySurroundings.forEach(t => {
        contextStr += `\n  + ${t.name}: cách ${t.distance}m, đang nằm ${t.relativePosition}.`;
      });
    }

    const systemPrompt = `Bạn là Trợ Lý Hướng Dẫn Viên Ảo AI chuyên nghiệp tại Trường Đại Học Kinh Tế Quốc Dân (NEU, Hà Nội).
Du khách đang cầm thiết bị Hub định vị và đi dạo trong khuôn viên trường (207 Giải Phóng & Phố Trần Đại Nghĩa).

NHIỆM VỤ QUAN TRỌNG CỦA BẠN:
1. BIẾT RÕ KHÁCH ĐANG Ở KHU NÀO:
   - Hãy cho du khách biết họ đang đứng ở phân khu nào (Ví dụ: "Hiện bạn đang ở Tòa nhà Thế kỷ A2...", "Bạn đang đứng ở khu Thư viện Phạm Văn Đồng...").

2. CHỈ DẪN ĐƯỜNG ĐI DỰA VÀO TẦM NHÌN (HƯỚNG NHÌN YAW):
   - Khi du khách hỏi đường ("đi thế nào", "đường đến...", "phía trước có gì", "rẽ đâu", "ở đâu"): Bạn PHẢI chỉ dẫn dựa vào hướng mắt họ đang nhìn hiện tại (Ví dụ: "Theo hướng bạn đang nhìn về hướng ${yawDir}: Ngay phía trước mặt bạn khoảng ...m là..., để đến Thư viện bạn hãy quay sang bên tay phải và đi thẳng khoảng ...m").
   - Hướng dẫn rất cụ thể, trực quan (rẽ trái, rẽ phải, đi thẳng, quay lại sau lưng) kết hợp khoảng cách mét.

3. GIẢI THÍCH SÂU SẮC CÁC MỐC LỊCH SỬ KHI ĐƯỢC HỎI:
   - Năm 1956: Thành lập Trường Kinh tế Tài chính theo Nghị định 678-TTg của Chính phủ. Chiếc Chuông đồng khai giảng truyền thống đầu tiên được rung lên, đánh dấu khởi đầu sứ mệnh đào tạo kinh tế của nước nhà.
   - Năm 1961 (21/11/1961): Chủ tịch Hồ Chí Minh về thăm trường, Người ân cần căn dặn thầy trò: "Phải đào tạo những cán bộ kinh tế vừa hồng vừa chuyên". Tượng Bác Hồ được dựng trang trọng tại Khu Hiệu bộ A1 để đời đời ghi nhớ.
   - Năm 1972: Thời kỳ kháng chiến chống Mỹ cứu nước, hàng trăm cán bộ, giảng viên và sinh viên NEU xếp bút nghiên lên đường ra chiến trường (Bia tưởng niệm sinh viên NEU ra trận đặt tại A1).
   - Năm 1986: Mốc son đất nước bước vào công cuộc Đổi Mới. Cố Thủ tướng Phạm Văn Đồng - Hiệu trưởng danh dự đầu tiên - đã định hướng đổi mới giáo dục kinh tế. Bia đá khắc lời dạy của Người đặt tại Thư viện.
   - Năm 2016: Đại lễ kỷ niệm 60 năm thành lập trường, bức phù điêu hoành tráng "60 Năm Phát Triển & Khát Vọng" được khánh thành tại Đại sảnh Tòa nhà A2.
   - Năm 2017: Khánh thành Tòa Nhà Thế Kỷ A2 - công trình biểu tượng hiện đại với giếng trời khổng lồ, hệ thống thang cuốn và phòng học thông minh chuẩn quốc tế.
   - Năm 2021: Kỷ niệm 65 năm ngày truyền thống trường, Trống Đồng Kỷ Niệm được trao tặng đặt tại Thư viện Phạm Văn Đồng.

4. PHONG CÁCH TRẢ LỜI:
   - Thân thiện, nhiệt huyết, tự hào, súc tích (khoảng 3 - 5 câu), vừa vặn để đọc to qua tai nghe hoặc loa của Hub.
   - Tuyệt đối không dùng emoji hoặc icon.
${contextStr}`;

    // Gọi API Groq nếu có key
    if (this.apiKey && this.apiKey.length > 10) {
      const modelsToTry = [this.model, 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      const uniqueModels = [...new Set(modelsToTry.filter(Boolean))];

      for (const currentModel of uniqueModels) {
        try {
          console.log(`[Groq AI Guide] Model ${currentModel} trả lời: "${userQuestion}"`);

          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userQuestion }
              ],
              temperature: 0.6,
              max_tokens: 650
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            console.warn(`[Groq] Lỗi ${currentModel} (${response.status}):`, errText);
            continue;
          }

          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          const latencyMs = Date.now() - startTime;

          if (reply) {
            return {
              reply,
              provider: `Groq Cloud (${currentModel})`,
              latencyMs,
              currentZone: currentZone ? currentZone.name : null,
              nearestPoi: spatialInfo.nearestPoi ? { id: spatialInfo.nearestPoi.id, number: spatialInfo.nearestPoi.number, name: spatialInfo.nearestPoi.name } : null,
              success: true
            };
          }
        } catch (err) {
          console.warn(`[Groq] Lỗi kết nối model ${currentModel}:`, err.message);
        }
      }
    }

    // Fallback thông minh nếu offline hoặc API lỗi
    const zoneName = currentZone ? currentZone.name : 'Khuôn viên Đại học';
    const nearest = spatialInfo.nearestPoi;
    let fallbackText = `Hiện bạn đang ở khu vực ${zoneName}. `;

    if (nearest) {
      fallbackText += `Theo hướng nhìn của bạn, ${nearest.name} đang ở ${nearest.relativePosition} (khoảng cách ~${nearest.distance}m). ${nearest.description}`;
    } else {
      fallbackText += `Bạn đang hướng về phía ${yawDir}. Hãy hỏi tôi về hướng đi đến các tòa nhà hoặc các mốc lịch sử như năm 1956 thành lập trường, 1961 Bác Hồ về thăm, hay năm 2017 khánh thành Tòa nhà Thế Kỷ A2 nhé!`;
    }

    return {
      reply: fallbackText,
      provider: "Smart Navigation Engine",
      latencyMs: Date.now() - startTime,
      currentZone: currentZone ? currentZone.name : null,
      nearestPoi: nearest ? { id: nearest.id, number: nearest.number, name: nearest.name } : null,
      success: true
    };
  }

  getYawDirection(yaw) {
    const deg = (yaw % 360 + 360) % 360;
    if (deg >= 337.5 || deg < 22.5) return 'Bắc';
    if (deg >= 22.5 && deg < 67.5) return 'Đông Bắc';
    if (deg >= 67.5 && deg < 112.5) return 'Đông';
    if (deg >= 112.5 && deg < 157.5) return 'Đông Nam';
    if (deg >= 157.5 && deg < 202.5) return 'Nam';
    if (deg >= 202.5 && deg < 247.5) return 'Tây Nam';
    if (deg >= 247.5 && deg < 292.5) return 'Tây';
    return 'Tây Bắc';
  }
}

module.exports = new GroqGuideService();
