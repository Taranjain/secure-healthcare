/**
 * Admin Routes
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/users', authenticate, authorize('ADMIN'), adminController.listUsers);
router.get('/dashboard', authenticate, authorize('ADMIN'), adminController.getDashboard);

module.exports = router;
