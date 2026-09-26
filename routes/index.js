/**
 * 2Guide - Master Router
 * Gom toàn bộ view routes và API routes vào ứng dụng Express
 */

const express = require('express');
const router = express.Router();

const viewRoutes = require('./viewRoutes');
const apiRoutes = require('./apiRoutes');

// Mount API routes dưới tiền tố /api
router.use('/api', apiRoutes);

// Mount View routes
router.use('/', viewRoutes);

module.exports = router;
