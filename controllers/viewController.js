/**
 * 2Guide - Controller: ViewController
 * Điều hướng và phục vụ các giao diện HTML người dùng, quản lý và công cụ
 */

const path = require('path');
const fs = require('fs');
const { ADMIN_SECRET_KEY } = require('../config/appConfig');

const publicDir = path.join(__dirname, '..', 'public');

class ViewController {
  renderUser(req, res) {
    res.sendFile(path.join(publicDir, 'user.html'));
  }

  renderAdmin(req, res) {
    try {
      const indexPath = path.join(publicDir, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');
      const injection = `<script>window.__ADMIN_KEY__ = ${JSON.stringify(ADMIN_SECRET_KEY)};</script>\n</head>`;
      html = html.replace('</head>', injection);
      res.send(html);
    } catch (e) {
      res.sendFile(path.join(publicDir, 'index.html'));
    }
  }

  renderSimulate(req, res) {
    res.sendFile(path.join(publicDir, 'simulate.html'));
  }

  renderEditor(req, res) {
    try {
      const editorPath = path.join(publicDir, 'editor.html');
      let html = fs.readFileSync(editorPath, 'utf8');
      const injection = `<script>window.__ADMIN_KEY__ = ${JSON.stringify(ADMIN_SECRET_KEY)};</script>\n</head>`;
      html = html.replace('</head>', injection);
      res.send(html);
    } catch (e) {
      res.sendFile(path.join(publicDir, 'editor.html'));
    }
  }

  redirectUserHtml(req, res) {
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, `/user${query}`);
  }

  redirectRoot(req, res) {
    res.redirect('/user');
  }

  blockOldAdmin(req, res) {
    res.status(404).send('Không tìm thấy trang yêu cầu (404 Not Found).');
  }
}

module.exports = new ViewController();
