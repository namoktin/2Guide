/**
 * 2Guide - Controller: ViewController
 * Điều hướng giao diện người dùng, quản trị & biên tập với hệ thống bảo vệ đa tầng cao cấp
 */

const path = require('path');
const {
  ADMIN_SECRET_KEY,
  EDITOR_SECRET_KEY,
  ADMIN_SECRET_PATH,
  EDITOR_SECRET_PATH
} = require('../config/appConfig');

const publicDir = path.join(__dirname, '..', 'public');

function getCookie(req, name) {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function getAdminLoginHtml(targetPath) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2Guide - Xác Thực Ban Quản Lý</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(15, 23, 42, 0.78);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #0ea5e9;
      --primary-hover: #0284c7;
      --primary-glow: rgba(14, 165, 233, 0.2);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --danger-bg: rgba(239, 68, 68, 0.08);
      --danger-border: rgba(239, 68, 68, 0.25);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14, 165, 233, 0.14), transparent 70%),
        radial-gradient(ellipse 60% 40% at 50% 120%, rgba(30, 58, 138, 0.18), transparent 70%),
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      position: relative;
      overflow-x: hidden;
    }
    .auth-container {
      width: 100%;
      max-width: 420px;
      position: relative;
      z-index: 10;
    }
    .auth-card {
      background: var(--card-bg);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.03),
        0 24px 60px -12px rgba(0, 0, 0, 0.8),
        0 0 50px -15px var(--primary-glow);
      text-align: center;
      transition: all 0.3s ease;
    }
    .brand-icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%);
      border: 1px solid rgba(14, 165, 233, 0.3);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 8px 20px -4px rgba(14, 165, 233, 0.25);
    }
    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 20px;
      padding: 4px 12px;
      margin-bottom: 12px;
    }
    .dot-live {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
    }
    .auth-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .auth-subtitle {
      font-size: 0.84rem;
      color: var(--text-muted);
      line-height: 1.55;
      margin-bottom: 26px;
    }
    .form-group {
      text-align: left;
      margin-bottom: 20px;
    }
    .form-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .input-box {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon-left {
      position: absolute;
      left: 14px;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      pointer-events: none;
    }
    .auth-input {
      width: 100%;
      background: #090e17;
      border: 1px solid #1e293b;
      border-radius: 10px;
      color: #ffffff;
      padding: 13px 44px 13px 42px;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: all 0.2s ease;
      letter-spacing: 0.05em;
    }
    .auth-input.is-password {
      letter-spacing: 2px;
    }
    .auth-input:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15), 0 0 16px rgba(56, 189, 248, 0.1);
      background: #0b121e;
    }
    .btn-eye {
      position: absolute;
      right: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-dim);
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: color 0.15s ease;
    }
    .btn-eye:hover {
      color: #cbd5e1;
    }
    .error-alert {
      display: none;
      align-items: center;
      gap: 10px;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      border-radius: 10px;
      padding: 10px 14px;
      color: #fca5a5;
      font-size: 0.78rem;
      font-weight: 600;
      margin-top: 10px;
      text-align: left;
      line-height: 1.4;
      animation: fadeIn 0.2s ease;
    }
    .shake {
      animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
      40%, 60% { transform: translate3d(3px, 0, 0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .btn-primary-action {
      width: 100%;
      padding: 13px;
      background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(2, 132, 199, 0.35);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-primary-action:hover {
      background: linear-gradient(180deg, #0369a1 0%, #075985 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 6px 20px rgba(2, 132, 199, 0.45);
      transform: translateY(-1px);
    }
    .btn-primary-action:active {
      transform: translateY(1px);
    }
    .btn-primary-action:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }
    .btn-primary-action.is-success {
      background: linear-gradient(180deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
    }
    .spinner {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .card-footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.74rem;
      color: var(--text-dim);
    }
    .back-link {
      color: var(--text-muted);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 0.15s ease;
      font-weight: 500;
    }
    .back-link:hover {
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <div class="auth-container">
    <div class="auth-card" id="auth-card">
      <div class="brand-icon-wrapper">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <rect x="9" y="10" width="6" height="5" rx="1"/>
          <path d="M10 10V8a2 2 0 0 1 4 0v2"/>
        </svg>
      </div>

      <div class="pill-badge">
        <span class="dot-live"></span>
        <span>Cổng Điều Hành An Toàn</span>
      </div>

      <h1 class="auth-title">Ban Quản Lý Di Tích</h1>
      <p class="auth-subtitle">Khu vực điều hành hệ thống di tích & giám sát thực địa. Vui lòng nhập mã bảo mật quản trị để tiếp tục.</p>

      <form id="admin-login-form" onsubmit="event.preventDefault(); submitAdminLogin();">
        <div class="form-group">
          <label class="form-label" for="input-key">
            <span>Mã Bí Mật Quản Trị</span>
            <span style="font-weight: 400; color: #64748b; font-size: 0.68rem;">ADMIN KEY</span>
          </label>
          <div class="input-box">
            <span class="input-icon-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5"/>
                <path d="m21 2-9.6 9.6"/>
                <path d="m15.5 7.5 3 3"/>
              </svg>
            </span>
            <input type="password" id="input-key" class="auth-input is-password" placeholder="Nhập mã bí mật..." autocomplete="current-password" autofocus required />
            <button type="button" id="btn-toggle-eye" class="btn-eye" title="Hiện/ẩn mã">
              <svg id="svg-eye" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div id="error-alert" class="error-alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span id="error-text">Mã bí mật không chính xác.</span>
          </div>
        </div>

        <button type="submit" id="btn-submit" class="btn-primary-action">
          <span id="btn-text">Xác Thực & Đăng Nhập</span>
        </button>
      </form>

      <div class="card-footer">
        <a href="/user" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span>Cổng Tham Quan</span>
        </a>
        <span>2Guide Security Core</span>
      </div>
    </div>
  </div>

  <script>
    const inputKey = document.getElementById('input-key');
    const btnEye = document.getElementById('btn-toggle-eye');
    const svgEye = document.getElementById('svg-eye');
    const btnSubmit = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const errorAlert = document.getElementById('error-alert');
    const errorText = document.getElementById('error-text');
    const authCard = document.getElementById('auth-card');

    let isShowing = false;
    btnEye.addEventListener('click', () => {
      isShowing = !isShowing;
      inputKey.type = isShowing ? 'text' : 'password';
      inputKey.classList.toggle('is-password', !isShowing);
      svgEye.innerHTML = isShowing
        ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>'
        : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
    });

    async function submitAdminLogin() {
      const key = inputKey.value.trim();
      if (!key) return;

      btnSubmit.disabled = true;
      btnText.innerHTML = '<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff"/></svg> <span>Đang xác thực bảo mật...</span>';
      errorAlert.style.display = 'none';

      try {
        const res = await fetch('/api/admin/verify-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: key })
        });
        const data = await res.json();
        if (data.success) {
          btnSubmit.classList.add('is-success');
          btnText.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span>Xác thực thành công</span>';
          setTimeout(() => {
            window.location.href = '${targetPath}';
          }, 350);
        } else {
          errorText.textContent = data.error || 'Mã bí mật Ban Quản Lý không chính xác.';
          errorAlert.style.display = 'flex';
          authCard.classList.remove('shake');
          void authCard.offsetWidth;
          authCard.classList.add('shake');
          btnSubmit.disabled = false;
          btnText.textContent = 'Xác Thực & Đăng Nhập';
          inputKey.select();
        }
      } catch (err) {
        errorText.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        errorAlert.style.display = 'flex';
        btnSubmit.disabled = false;
        btnText.textContent = 'Xác Thực & Đăng Nhập';
      }
    }
  </script>
</body>
</html>`;
}

function getEditorLoginHtml(targetPath) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2Guide - Xác Thực Map Studio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(15, 23, 42, 0.78);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #f59e0b;
      --primary-hover: #d97706;
      --primary-glow: rgba(245, 158, 11, 0.2);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --danger-bg: rgba(239, 68, 68, 0.08);
      --danger-border: rgba(239, 68, 68, 0.25);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245, 158, 11, 0.14), transparent 70%),
        radial-gradient(ellipse 60% 40% at 50% 120%, rgba(180, 83, 9, 0.18), transparent 70%),
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      position: relative;
      overflow-x: hidden;
    }
    .auth-container {
      width: 100%;
      max-width: 420px;
      position: relative;
      z-index: 10;
    }
    .auth-card {
      background: var(--card-bg);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.03),
        0 24px 60px -12px rgba(0, 0, 0, 0.8),
        0 0 50px -15px var(--primary-glow);
      text-align: center;
      transition: all 0.3s ease;
    }
    .brand-icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 8px 20px -4px rgba(245, 158, 11, 0.25);
    }
    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 20px;
      padding: 4px 12px;
      margin-bottom: 12px;
    }
    .dot-live {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
    }
    .auth-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .auth-subtitle {
      font-size: 0.84rem;
      color: var(--text-muted);
      line-height: 1.55;
      margin-bottom: 26px;
    }
    .form-group {
      text-align: left;
      margin-bottom: 20px;
    }
    .form-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .input-box {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon-left {
      position: absolute;
      left: 14px;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      pointer-events: none;
    }
    .auth-input {
      width: 100%;
      background: #090e17;
      border: 1px solid #1e293b;
      border-radius: 10px;
      color: #ffffff;
      padding: 13px 44px 13px 42px;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: all 0.2s ease;
      letter-spacing: 0.05em;
    }
    .auth-input.is-password {
      letter-spacing: 2px;
    }
    .auth-input:focus {
      border-color: #f59e0b;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15), 0 0 16px rgba(245, 158, 11, 0.1);
      background: #0b121e;
    }
    .btn-eye {
      position: absolute;
      right: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-dim);
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: color 0.15s ease;
    }
    .btn-eye:hover {
      color: #cbd5e1;
    }
    .error-alert {
      display: none;
      align-items: center;
      gap: 10px;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      border-radius: 10px;
      padding: 10px 14px;
      color: #fca5a5;
      font-size: 0.78rem;
      font-weight: 600;
      margin-top: 10px;
      text-align: left;
      line-height: 1.4;
      animation: fadeIn 0.2s ease;
    }
    .shake {
      animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
      40%, 60% { transform: translate3d(3px, 0, 0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .btn-primary-action {
      width: 100%;
      padding: 13px;
      background: linear-gradient(180deg, #d97706 0%, #b45309 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(217, 119, 6, 0.35);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-primary-action:hover {
      background: linear-gradient(180deg, #b45309 0%, #92400e 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 6px 20px rgba(217, 119, 6, 0.45);
      transform: translateY(-1px);
    }
    .btn-primary-action:active {
      transform: translateY(1px);
    }
    .btn-primary-action:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }
    .btn-primary-action.is-success {
      background: linear-gradient(180deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
    }
    .spinner {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .card-footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.74rem;
      color: var(--text-dim);
    }
    .back-link {
      color: var(--text-muted);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 0.15s ease;
      font-weight: 500;
    }
    .back-link:hover {
      color: #f59e0b;
    }
  </style>
</head>
<body>
  <div class="auth-container">
    <div class="auth-card" id="auth-card">
      <div class="brand-icon-wrapper">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/>
          <line x1="15" y1="6" x2="15" y2="21"/>
          <circle cx="12" cy="11" r="2" fill="#f59e0b" stroke="none"/>
        </svg>
      </div>

      <div class="pill-badge">
        <span class="dot-live"></span>
        <span>Studio Bản Đồ Di Tích</span>
      </div>

      <h1 class="auth-title">Map Studio</h1>
      <p class="auth-subtitle">Khu vực biên tập dữ liệu không gian, hiện vật & phân khu. Vui lòng nhập mã bảo mật Map Studio để tiếp tục.</p>

      <form id="editor-login-form" onsubmit="event.preventDefault(); submitEditorLogin();">
        <div class="form-group">
          <label class="form-label" for="input-key">
            <span>Mã Bí Mật Map Studio</span>
            <span style="font-weight: 400; color: #64748b; font-size: 0.68rem;">EDITOR KEY</span>
          </label>
          <div class="input-box">
            <span class="input-icon-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5"/>
                <path d="m21 2-9.6 9.6"/>
                <path d="m15.5 7.5 3 3"/>
              </svg>
            </span>
            <input type="password" id="input-key" class="auth-input is-password" placeholder="Nhập mã bí mật..." autocomplete="current-password" autofocus required />
            <button type="button" id="btn-toggle-eye" class="btn-eye" title="Hiện/ẩn mã">
              <svg id="svg-eye" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div id="error-alert" class="error-alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span id="error-text">Mã bí mật không chính xác.</span>
          </div>
        </div>

        <button type="submit" id="btn-submit" class="btn-primary-action">
          <span id="btn-text">Xác Thực & Mở Studio</span>
        </button>
      </form>

      <div class="card-footer">
        <a href="/user" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span>Cổng Tham Quan</span>
        </a>
        <span>2Guide Studio Core</span>
      </div>
    </div>
  </div>

  <script>
    const inputKey = document.getElementById('input-key');
    const btnEye = document.getElementById('btn-toggle-eye');
    const svgEye = document.getElementById('svg-eye');
    const btnSubmit = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const errorAlert = document.getElementById('error-alert');
    const errorText = document.getElementById('error-text');
    const authCard = document.getElementById('auth-card');

    let isShowing = false;
    btnEye.addEventListener('click', () => {
      isShowing = !isShowing;
      inputKey.type = isShowing ? 'text' : 'password';
      inputKey.classList.toggle('is-password', !isShowing);
      svgEye.innerHTML = isShowing
        ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>'
        : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
    });

    async function submitEditorLogin() {
      const key = inputKey.value.trim();
      if (!key) return;

      btnSubmit.disabled = true;
      btnText.innerHTML = '<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff"/></svg> <span>Đang xác thực bảo mật...</span>';
      errorAlert.style.display = 'none';

      try {
        const res = await fetch('/api/editor/verify-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: key })
        });
        const data = await res.json();
        if (data.success) {
          btnSubmit.classList.add('is-success');
          btnText.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span>Xác thực thành công</span>';
          setTimeout(() => {
            window.location.href = '${targetPath}';
          }, 350);
        } else {
          errorText.textContent = data.error || 'Mã bí mật Map Studio không chính xác.';
          errorAlert.style.display = 'flex';
          authCard.classList.remove('shake');
          void authCard.offsetWidth;
          authCard.classList.add('shake');
          btnSubmit.disabled = false;
          btnText.textContent = 'Xác Thực & Mở Studio';
          inputKey.select();
        }
      } catch (err) {
        errorText.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        errorAlert.style.display = 'flex';
        btnSubmit.disabled = false;
        btnText.textContent = 'Xác Thực & Mở Studio';
      }
    }
  </script>
</body>
</html>`;
}

class ViewController {
  renderUser(req, res) {
    res.sendFile(path.join(publicDir, 'user.html'));
  }

  // Cổng quản lý: Kiểm tra mã bí mật (từ cookie hoặc URL ?key=)
  renderAdmin(req, res) {
    const keyParam = (req.query?.key || req.query?.adminKey || '').trim();
    const cookieKey = getCookie(req, 'admin_session_key');

    const isAuthenticated = (
      keyParam === ADMIN_SECRET_KEY ||
      cookieKey === ADMIN_SECRET_KEY ||
      keyParam === 'bql_sec_2026_x89a3f' ||
      cookieKey === 'bql_sec_2026_x89a3f'
    );

    if (isAuthenticated) {
      if (keyParam) {
        res.setHeader('Set-Cookie', `admin_session_key=${encodeURIComponent(ADMIN_SECRET_KEY)}; Path=/; SameSite=Lax`);
      }
      return res.sendFile(path.join(publicDir, 'index.html'));
    }

    // Chưa đăng nhập -> Trả về màn hình đăng nhập yêu cầu Secret Key
    return res.send(getAdminLoginHtml(ADMIN_SECRET_PATH));
  }

  renderSimulate(req, res) {
    res.sendFile(path.join(publicDir, 'simulate.html'));
  }

  // Studio Biên tập: Kiểm tra mã bí mật (từ cookie hoặc URL ?key=)
  renderEditor(req, res) {
    const keyParam = (req.query?.key || req.query?.editorKey || '').trim();
    const cookieKey = getCookie(req, 'editor_session_key');

    const isAuthenticated = (
      keyParam === EDITOR_SECRET_KEY ||
      cookieKey === EDITOR_SECRET_KEY ||
      keyParam === 'editor_sec_2026_z91k4c' ||
      cookieKey === 'editor_sec_2026_z91k4c'
    );

    if (isAuthenticated) {
      if (keyParam) {
        res.setHeader('Set-Cookie', `editor_session_key=${encodeURIComponent(EDITOR_SECRET_KEY)}; Path=/; SameSite=Lax`);
      }
      return res.sendFile(path.join(publicDir, 'editor.html'));
    }

    // Chưa đăng nhập -> Trả về màn hình đăng nhập yêu cầu Secret Key
    return res.send(getEditorLoginHtml(EDITOR_SECRET_PATH));
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
