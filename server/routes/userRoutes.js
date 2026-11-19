const express = require('express');
const router = express.Router();

const { getUsers } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

/**
 * User Management Routes — InSearch Sai University
 *
 * Route Configuration:
 * - GET /api/users : Protected admin-only user directory with search & pagination
 */

router.get('/', protect, authorize('admin'), getUsers);

module.exports = router;
