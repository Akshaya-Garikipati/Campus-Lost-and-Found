const express = require('express');
const router = express.Router();

const { register, login, getMe, demoLogin } = require('../controllers/authController');
const { protect, validateRegister, validateLogin } = require('../middleware/auth');

/**
 * Authentication Routes — InSearch Sai University
 *
 * Route Configuration:
 * - POST /api/auth/register   : Public student account registration
 * - POST /api/auth/login      : Public credential verification & JWT issuance
 * - POST /api/auth/demo-login : Demo/presentation JWT issuance
 * - GET  /api/auth/me         : Protected profile lookup for session verification
 */

// Student Registration
router.post('/register', validateRegister, register);

// User Login (Student & Admin)
router.post('/login', validateLogin, login);

// Demo / Quick Login (Student & Admin)
router.post('/demo-login', demoLogin);

// Authenticated User Profile
router.get('/me', protect, getMe);

module.exports = router;
