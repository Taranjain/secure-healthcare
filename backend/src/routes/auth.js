/**
 * Auth Routes
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, mfaLimiter } = require('../middleware/rateLimiter');
const { registerValidation, loginValidation, mfaValidation } = require('../middleware/validator');

// Public routes
router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);
router.post('/verify-mfa', mfaLimiter, mfaValidation, authController.verifyMFA);
router.post('/refresh', authController.refreshToken);

// Protected routes
router.post('/setup-mfa', authenticate, authController.setupMFA);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
