/**
 * Medical Records Routes
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const recordController = require('../controllers/recordController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { checkConsent } = require('../middleware/consent');
const { createRecordValidation, uuidParam } = require('../middleware/validator');

// Configure multer for file uploads
const upload = multer({
    dest: '/tmp/healthcare-uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/gif',
            'text/plain',
            'application/dicom',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed. Supported: PDF, PNG, JPG, GIF, TXT, DICOM'));
        }
    },
});

// Patient routes
router.post(
    '/',
    authenticate,
    authorize('PATIENT'),
    upload.single('file'),
    createRecordValidation,
    recordController.createRecord
);

router.get('/my', authenticate, authorize('PATIENT'), recordController.getMyRecords);

// Doctor routes
router.get(
    '/accessible',
    authenticate,
    authorize('DOCTOR'),
    recordController.getAccessibleRecords
);

// Shared routes (consent-protected)
router.get(
    '/:id',
    authenticate,
    authorize('PATIENT', 'DOCTOR', 'ADMIN'),
    uuidParam,
    checkConsent,
    recordController.getRecord
);

router.get(
    '/:id/download',
    authenticate,
    authorize('PATIENT', 'DOCTOR'),
    uuidParam,
    checkConsent,
    recordController.downloadRecord
);

router.delete(
    '/:id',
    authenticate,
    authorize('PATIENT'),
    uuidParam,
    recordController.deleteRecord
);

module.exports = router;
