/**
 * MFA Service - TOTP-based Multi-Factor Authentication
 * 
 * Uses otplib for TOTP generation/verification.
 * MFA is required for DOCTOR and ADMIN roles.
 * Supports QR code generation for authenticator apps.
 */

const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const config = require('../config');

/**
 * Generate a new MFA secret for a user
 * @param {string} email - User's email for QR label
 * @returns {{ secret: string, otpauthUrl: string }}
 */
function generateSecret(email) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, config.mfaIssuer, secret);
    return { secret, otpauthUrl };
}

/**
 * Generate a QR code data URL for the MFA secret
 * @param {string} otpauthUrl - OTP auth URL
 * @returns {Promise<string>} Base64 data URL of QR code
 */
async function generateQRCode(otpauthUrl) {
    return QRCode.toDataURL(otpauthUrl);
}

/**
 * Verify a TOTP code against a secret
 * @param {string} token - 6-digit OTP code
 * @param {string} secret - User's MFA secret
 * @returns {boolean} Whether the token is valid
 */
function verifyToken(token, secret) {
    return authenticator.verify({ token, secret });
}

/**
 * Check if MFA is required for a given role
 * @param {string} role - User role
 * @returns {boolean}
 */
function isMFARequired(role) {
    return ['DOCTOR', 'ADMIN'].includes(role);
}

module.exports = {
    generateSecret,
    generateQRCode,
    verifyToken,
    isMFARequired,
};
