/**
 * 2Guide - Controller: ViewController
 * Điều hướng giao diện người dùng, quản trị & biên tập
 * Áp dụng cơ chế vô hiệu hóa Cache và xóa sạch Cookie để luôn bắt buộc nhập Secret Key khi vào / F5 reload
 */

const path = require('path');
const {
  ADMIN_SECRET_PATH,
  EDITOR_SECRET_PATH
} = require('../config/appConfig');

const publicDir = path.join(__dirname, '..', 'public');

class ViewController {
  // 1. Cổng khách tham quan: Công khai
  renderUser(req, res) {
    res.sendFile(path.join(publicDir, 'user.html'));
  }

  // 2. Cổng giả lập tín hiệu GPS & Pin (MÃ BÍ MẬT): Ngăn cache để luôn hiện màn hình khóa khi F5
  renderSimulate(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.sendFile(path.join(publicDir, 'simulate.html'));
  }


  // 3. Cổng Ban Quản Lý (MÃ BÍ MẬT): Ngăn cache và xóa cookie để luôn hiện màn hình khóa
  renderAdmin(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Set-Cookie', 'admin_session_key=; Path=/; Max-Age=0');
    return res.sendFile(path.join(publicDir, 'index.html'));
  }

  // 4. Studio Biên Tập (MÃ BÍ MẬT): Ngăn cache và xóa cookie để luôn hiện màn hình khóa
  renderEditor(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Set-Cookie', 'editor_session_key=; Path=/; Max-Age=0');
    return res.sendFile(path.join(publicDir, 'editor.html'));
  }

  // Chặn đường dẫn quản lý công khai
  blockPublicAdmin(req, res) {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>404 - Không Tìm Thấy Trang</title>
        <style>
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07090e; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { text-align: center; max-width: 440px; padding: 40px 32px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); }
          h1 { color: #ef4444; font-size: 1.8rem; margin: 0 0 12px; font-weight: 800; }
          p { color: #94a3b8; font-size: 0.9rem; line-height: 1.6; margin: 0 0 24px; }
          a { display: inline-block; padding: 11px 24px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 9px; font-weight: 700; font-size: 0.88rem; transition: background 0.2s; }
          a:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>404 - Truy Cập Bị Chặn</h1>
          <p>Đường dẫn công khai đã được chuyển sang cổng điều hành bảo mật đa tầng. Vui lòng sử dụng liên kết điều hành được cấp quyền.</p>
          <a href="/user">Quay Về Cổng Tham Quan</a>
        </div>
      </body>
      </html>
    `);
  }

  // Chặn đường dẫn editor công khai
  blockPublicEditor(req, res) {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>404 - Không Tìm Thấy Trang</title>
        <style>
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07090e; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { text-align: center; max-width: 440px; padding: 40px 32px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); }
          h1 { color: #ef4444; font-size: 1.8rem; margin: 0 0 12px; font-weight: 800; }
          p { color: #94a3b8; font-size: 0.9rem; line-height: 1.6; margin: 0 0 24px; }
          a { display: inline-block; padding: 11px 24px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 9px; font-weight: 700; font-size: 0.88rem; transition: background 0.2s; }
          a:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>404 - Truy Cập Bị Chặn</h1>
          <p>Đường dẫn biên tập công khai đã được chuyển sang cổng bảo mật đa tầng. Vui lòng sử dụng liên kết kỹ thuật viên được cấp quyền.</p>
          <a href="/user">Quay Về Cổng Tham Quan</a>
        </div>
      </body>
      </html>
    `);
  }

  redirectUserHtml(req, res) {
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, `/user${query}`);
  }

  redirectRoot(req, res) {
    res.redirect('/user');
  }
}

module.exports = new ViewController();
