/**
 * 2Guide - Middleware: Multer Memory Storage cho Audio INMP441
 */

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn 10MB
});

module.exports = upload;
