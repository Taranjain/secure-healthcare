/**
 * Input Validation Middleware
 * Uses express-validator for request validation and sanitization.
 */

const { body, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(e => ({
                field: e.path,
                message: e.msg,
            })),
        });
    }
    next();
}

// Auth validators
const registerValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain a number')
        .matches(/[!@#$%^&*]/).withMessage('Password must contain a special character'),
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('role').isIn(['PATIENT', 'DOCTOR', 'ADMIN']).withMessage('Role must be PATIENT, DOCTOR, or ADMIN'),
    body('attributes').optional().isObject().withMessage('Attributes must be an object'),
    handleValidationErrors,
];

const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    handleValidationErrors,
];

const mfaValidation = [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit OTP required'),
    body('tempToken').notEmpty().withMessage('Temporary token required'),
    handleValidationErrors,
];

// Record validators
const createRecordValidation = [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required (max 200 chars)'),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('data').optional().trim(),
    body('abePolicy').optional().isObject().withMessage('ABE policy must be an object'),
    handleValidationErrors,
];

// Consent validators
const createConsentValidation = [
    body('doctorId').isUUID().withMessage('Valid doctor ID required'),
    body('recordId').optional({ nullable: true }).isUUID().withMessage('Valid record ID required'),
    body('expiresAt').optional({ nullable: true }).isISO8601().withMessage('Valid ISO date required for expiry'),
    handleValidationErrors,
];

// UUID param validator
const uuidParam = [
    param('id').isUUID().withMessage('Valid UUID required'),
    handleValidationErrors,
];

module.exports = {
    registerValidation,
    loginValidation,
    mfaValidation,
    createRecordValidation,
    createConsentValidation,
    uuidParam,
    handleValidationErrors,
};
