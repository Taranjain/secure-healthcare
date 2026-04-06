/**
 * Consent Routes
 */
const express = require('express');
const router = express.Router();
const consentController = require('../controllers/consentController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { createConsentValidation, uuidParam } = require('../middleware/validator');

// Patient grants consent
router.post(
    '/',
    authenticate,
    authorize('PATIENT'),
    createConsentValidation,
    consentController.grantConsent
);

// List user's consents (patient: given, doctor: received)
router.get(
    '/my',
    authenticate,
    authorize('PATIENT', 'DOCTOR', 'ADMIN'),
    consentController.getMyConsents
);

// Patient revokes consent
router.patch(
    '/:id/revoke',
    authenticate,
    authorize('PATIENT'),
    uuidParam,
    consentController.revokeConsent
);

// List doctors (for consent UI)
router.get(
    '/doctors',
    authenticate,
    authorize('PATIENT'),
    consentController.listDoctors
);

module.exports = router;
