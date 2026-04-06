/**
 * Audit Routes
 */
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Access logs
router.get(
    '/logs',
    authenticate,
    authorize('PATIENT', 'DOCTOR', 'ADMIN'),
    auditController.getLogs
);

// Blockchain (admin only for full chain, all users for verification)
router.get(
    '/blockchain',
    authenticate,
    authorize('ADMIN'),
    auditController.getBlockchain
);

router.get(
    '/blockchain/verify',
    authenticate,
    authorize('ADMIN', 'DOCTOR', 'PATIENT'),
    auditController.verifyBlockchain
);

module.exports = router;
