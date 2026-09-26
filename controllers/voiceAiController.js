/**
 * 2Guide - Controller: VoiceAiController
 * Xử lý âm thanh từ Microphone INMP441, Whisper STT, Groq AI LLM và tạo luồng âm thanh TTS cho DAC PCM5102A
 */

const groqGuideService = require('../services/groqGuideService');
const hubModel = require('../models/hubModel');
const siteModel = require('../models/siteModel');
const socketManager = require('../websocket/socketManager');
const { ESP32_SECRET_KEY, GROQ_API_KEY, PORT } = require('../config/appConfig');
const { attachEsp32Headers } = require('../middlewares/esp32AuthMiddleware');

// Tạo luồng âm thanh WAV chuẩn cho DAC PCM5102A khi TTS ngoài bị chặn
function generateWavChimeBuffer(durationSeconds = 2.0) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Tạo âm chuông thông báo êm dịu (chime 523Hz C5 -> 659Hz E5)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const f = t < 0.4 ? 523.25 : 659.25;
    const env = Math.exp(-2.5 * (t % 0.8));
    const sample = Math.sin(2 * Math.PI * f * t) * 0.28 * env;
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

// Tách đoạn văn thành các câu ngắn (< 160 ký tự) để Google TTS không bị lỗi HTTP 400
function splitTextIntoChunks(text, maxLength = 160) {
  if (!text) return [];
  const clean = text.replace(/[*#_`]/g, '').trim();
  const sentences = clean.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [clean];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((currentChunk + ' ' + trimmed).length <= maxLength) {
      currentChunk = currentChunk ? (currentChunk + ' ' + trimmed) : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (trimmed.length <= maxLength) {
        currentChunk = trimmed;
      } else {
        const words = trimmed.split(' ');
        currentChunk = '';
        for (const w of words) {
          if ((currentChunk + ' ' + w).length <= maxLength) {
            currentChunk = currentChunk ? (currentChunk + ' ' + w) : w;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = w;
          }
        }
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Tổng hợp giọng nói tiếng Việt đầy đủ cho toàn bộ câu trả lời AI bằng cách nối các audio buffer
async function fetchVietnameseTtsAudio(text) {
  try {
    const chunks = splitTextIntoChunks(text, 160);
    if (!chunks.length) return null;

    const buffers = [];
    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=vi&client=gtx`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });
      if (res.ok && (res.headers.get('content-type') || '').includes('audio')) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 100) buffers.push(buf);
      }
    }

    if (buffers.length > 0) {
      return Buffer.concat(buffers);
    }
  } catch (err) {
    console.warn('[TTS Engine] Lỗi tổng hợp giọng nói đa đoạn:', err.message);
  }
  return null;
}

class VoiceAiController {
  // Helper nội bộ xử lý âm thanh INMP441 qua Whisper STT và Groq AI
  async _processAudioData(audioBuffer, { hubId, lat, lng, yaw }, host, protocol) {
    let recognizedText = '';
    const apiKey = GROQ_API_KEY;

    // 1. Chuyển đổi giọng nói thành văn bản (Speech-to-Text) qua Groq Whisper API
    if (apiKey && apiKey.length > 10) {
      try {
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/wav' });
        formData.append('file', blob, 'audio.wav');
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'vi');

        const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData
        });

        if (whisperRes.ok) {
          const wData = await whisperRes.json();
          recognizedText = wData.text ? wData.text.trim() : '';
          console.log(`[Whisper STT] Nhận diện câu hỏi từ Hub ${hubId}: "${recognizedText}"`);
        } else {
          console.warn('[Whisper STT] Groq Whisper trả về lỗi:', await whisperRes.text());
        }
      } catch (err) {
        console.warn('[Whisper STT] Lỗi gọi Whisper API:', err.message);
      }
    }

    if (!recognizedText) {
      recognizedText = 'Giới thiệu về địa điểm trước mặt tôi trong khuôn viên trường';
    }

    // 2. Chuyển câu hỏi cho Groq AI Hướng Dẫn Viên NEU
    const aiResult = await groqGuideService.generateResponse(recognizedText, {
      lat,
      lng,
      yaw,
      hubId
    });

    // Phát sóng realtime đoạn text câu hỏi và câu trả lời AI cho Web Khách (user.html)
    socketManager.broadcastAiDialogue({
      hubId,
      userQuestion: recognizedText,
      aiReply: aiResult.reply,
      provider: aiResult.provider,
      nearestPoi: aiResult.nearestPoi
    });

    const ttsUrl = `${protocol}://${host}/api/voice/tts?text=${encodeURIComponent(aiResult.reply)}&secret=${encodeURIComponent(ESP32_SECRET_KEY)}`;

    return {
      hubId,
      secretKey: ESP32_SECRET_KEY,
      authStatus: 'VERIFIED',
      recognizedText,
      aiReply: aiResult.reply,
      ttsUrl,
      nearestPoi: aiResult.nearestPoi,
      audioBytesReceived: audioBuffer.length
    };
  }

  // POST /api/chat/ask (Dành cho web user chat trên user.html)
  async askChat(req, res) {
    try {
      const { question, lat, lng, yaw, hubId } = req.body;

      if (!question || !question.trim()) {
        return res.status(400).json({ success: false, error: 'Câu hỏi không được để trống' });
      }

      const hub = hubId ? hubModel.getById(hubId) : null;
      if (hub) {
        if (lat !== undefined) hub.lat = Number(lat);
        if (lng !== undefined) hub.lng = Number(lng);
        if (yaw !== undefined) hub.yaw = Number(yaw);
      }

      const center = siteModel.getCenter();
      const aiResult = await groqGuideService.generateResponse(question.trim(), {
        lat: Number(lat) || (hub && hub.lat) || center.lat,
        lng: Number(lng) || (hub && hub.lng) || center.lng,
        yaw: yaw !== undefined ? Number(yaw) : (hub && hub.yaw) || 0,
        hubId: hubId || 'Khách lẻ'
      });

      // Phát sóng realtime câu hỏi và câu trả lời AI cho Web Khách (user.html)
      socketManager.broadcastAiDialogue({
        hubId: hubId || 'Khách lẻ',
        userQuestion: question.trim(),
        aiReply: aiResult.reply,
        provider: aiResult.provider,
        nearestPoi: aiResult.nearestPoi
      });

      res.json({
        success: true,
        data: aiResult
      });
    } catch (err) {
      console.error('[Chat AI] Lỗi xử lý câu hỏi:', err);
      res.status(500).json({ success: false, error: 'Lỗi xử lý trợ lý AI: ' + err.message });
    }
  }

  // POST /api/inmp441/audio
  async handleInmp441Audio(req, res) {
    try {
      const audioBuffer = req.file ? req.file.buffer : (Buffer.isBuffer(req.body) ? req.body : null);

      if (!audioBuffer || audioBuffer.length < 100) {
        return res.status(400).json({
          success: false,
          error: 'Chưa nhận được dữ liệu nhị phân của file .wav trong trường "audio" (hoặc kích thước file < 100 bytes)'
        });
      }

      const center = siteModel.getCenter();
      const hubId = req.body?.hubId || req.query.hubId || req.headers['x-hub-id'] || 'NEU001';
      const lat = parseFloat(req.body?.lat || req.query.lat || req.headers['x-lat'] || center.lat);
      const lng = parseFloat(req.body?.lng || req.query.lng || req.headers['x-lng'] || center.lng);
      const yaw = parseFloat(req.body?.yaw || req.query.yaw || req.headers['x-yaw'] || 0);

      const host = req.get('host') || `localhost:${PORT}`;
      const protocol = req.protocol || 'http';

      console.log(`[INMP441 Multipart] Nhận file "${req.file ? req.file.originalname : 'audio.wav'}" (${audioBuffer.length} bytes) từ Hub ${hubId} [XÁC THỰC THÀNH CÔNG]`);

      const result = await this._processAudioData(audioBuffer, { hubId, lat, lng, yaw }, host, protocol);

      // Đính kèm mã bí mật và text câu hỏi / câu trả lời vào headers để client luôn đọc được
      attachEsp32Headers(res);
      res.setHeader('Access-Control-Expose-Headers', 'X-Device-Secret, X-Auth-Status, X-Recognized-Text, X-AI-Reply, X-Nearest-Poi, Content-Type, Content-Length');
      res.setHeader('X-Recognized-Text', encodeURIComponent(result.recognizedText || ''));
      res.setHeader('X-AI-Reply', encodeURIComponent(result.aiReply || ''));
      res.setHeader('X-Nearest-Poi', encodeURIComponent(result.nearestPoi ? `${result.nearestPoi.number}. ${result.nearestPoi.name}` : 'Khuôn viên'));

      // Hỗ trợ chế độ phản hồi trực tiếp luồng nhị phân MP3/WAV nếu ESP32 yêu cầu (Direct Binary Mode)
      if (req.query.returnBinaryAudio === 'true' || req.headers['x-return-binary'] === 'true' || req.body?.returnBinaryAudio === 'true') {
        try {
          const ttsBuffer = await fetchVietnameseTtsAudio(result.aiReply);
          if (ttsBuffer && ttsBuffer.length > 500) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', ttsBuffer.length);
            console.log(`[INMP441 -> DAC] Xuất luồng MP3 giọng nói AI tiếng Việt thành công: ${ttsBuffer.length} bytes`);
            return res.send(ttsBuffer);
          }
        } catch (errTts) {
          console.warn('[INMP441] Lỗi tạo binary TTS trực tiếp:', errTts.message);
        }

        // Fallback: Tạo luồng âm thanh WAV chuẩn nếu mất kết nối mạng TTS
        const fallbackWav = generateWavChimeBuffer(2.0);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', fallbackWav.length);
        return res.send(fallbackWav);
      }

      res.json({
        success: true,
        secretKey: ESP32_SECRET_KEY,
        authStatus: 'VERIFIED',
        endpoint: '/api/inmp441/audio',
        fileReceived: req.file ? {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : null,
        ...result
      });
    } catch (err) {
      console.error('[INMP441 Multipart API] Lỗi xử lý âm thanh:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/voice/ask (Cổng raw audio tương thích)
  async handleVoiceAsk(req, res) {
    try {
      const center = siteModel.getCenter();
      const hubId = req.query.hubId || req.headers['x-hub-id'] || 'NEU001';
      const lat = parseFloat(req.query.lat || req.headers['x-lat'] || center.lat);
      const lng = parseFloat(req.query.lng || req.headers['x-lng'] || center.lng);
      const yaw = parseFloat(req.query.yaw || req.headers['x-yaw'] || 0);

      const audioBuffer = Buffer.isBuffer(req.body) ? req.body : null;

      if (!audioBuffer || audioBuffer.length < 100) {
        return res.status(400).json({
          success: false,
          error: 'Chưa nhận được dữ liệu nhị phân .wav từ microphone INMP441 hoặc file quá nhỏ'
        });
      }

      const host = req.get('host') || `localhost:${PORT}`;
      const protocol = req.protocol || 'http';

      const result = await this._processAudioData(audioBuffer, { hubId, lat, lng, yaw }, host, protocol);
      attachEsp32Headers(res);
      res.setHeader('Access-Control-Expose-Headers', 'X-Device-Secret, X-Auth-Status, X-Recognized-Text, X-AI-Reply, X-Nearest-Poi, Content-Type, Content-Length');
      res.setHeader('X-Recognized-Text', encodeURIComponent(result.recognizedText || ''));
      res.setHeader('X-AI-Reply', encodeURIComponent(result.aiReply || ''));
      res.json({
        success: true,
        secretKey: ESP32_SECRET_KEY,
        authStatus: 'VERIFIED',
        ...result
      });
    } catch (err) {
      console.error('[Voice API] Lỗi xử lý âm thanh INMP441:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/voice/tts
  async streamTts(req, res) {
    try {
      const text = req.query.text || 'Chào mừng bạn đến với Trường Đại Học Kinh Tế Quốc Dân';
      const ttsBuffer = await fetchVietnameseTtsAudio(text);

      if (ttsBuffer && ttsBuffer.length > 500) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', ttsBuffer.length);
        attachEsp32Headers(res);
        return res.send(ttsBuffer);
      }

      // Fallback: Tạo luồng âm thanh WAV chuẩn nếu mất kết nối mạng
      const chimeBuffer = generateWavChimeBuffer(2.0);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', chimeBuffer.length);
      attachEsp32Headers(res);
      return res.send(chimeBuffer);
    } catch (err) {
      console.error('[TTS API] Lỗi tạo luồng TTS:', err);
      const chimeBuffer = generateWavChimeBuffer(1.5);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', chimeBuffer.length);
      attachEsp32Headers(res);
      return res.send(chimeBuffer);
    }
  }
}

module.exports = new VoiceAiController();
