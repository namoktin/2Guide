/**
 * 2Guide - Middleware: RateLimitMiddleware
 * Giới hạn tần suất request (Rate Limiting Shield) theo địa chỉ IP
 * Ngăn chặn tấn công DoS, Spam dồn dập và bảo vệ Quota Groq AI LLM
 */

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 5000; // Khung thời gian trượt (mặc định 5s)
  const max = options.max || 40;            // Số lượng request tối đa trong khung giờ
  const message = options.message || 'Cảnh báo: Tần suất gửi request vượt quá mức cho phép. Vui lòng đợi trong giây lát!';

  // Lưu trữ bộ đếm IP trong RAM: { ip: [timestamp1, timestamp2, ...] }
  const requests = new Map();

  // Tự động dọn dẹp các bản ghi quá hạn mỗi phút để chống rò rỉ RAM
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, valid);
      }
    }
  }, 60000);

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();

    let timestamps = requests.get(ip) || [];
    // Lọc bỏ các timestamp ngoài khung cửa sổ trượt
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= max) {
      const retryAfterSec = Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        status: 429,
        error: message,
        retryAfterSeconds: retryAfterSec
      });
    }

    timestamps.push(now);
    requests.set(ip, timestamps);
    next();
  };
}

// 1. Giới hạn chung toàn bộ API: Tối đa 60 requests / 5 giây
const generalRateLimiter = createRateLimiter({
  windowMs: 5000,
  max: 60,
  message: 'Cảnh báo: Tần suất gửi request vượt quá mức cho phép. Máy chủ tạm khóa kết nối.'
});

// 2. Giới hạn Trợ Lý AI: Tối đa 10 câu hỏi / 10 giây (bảo vệ Quota Groq LLM)
const aiRateLimiter = createRateLimiter({
  windowMs: 10000,
  max: 10,
  message: 'Cảnh báo: Bạn đang hỏi AI quá nhanh dồn dập. Vui lòng đợi trong giây lát!'
});

module.exports = {
  createRateLimiter,
  generalRateLimiter,
  aiRateLimiter
};
