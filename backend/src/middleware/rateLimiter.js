/**
 * Rate Limiter Middleware
 * Prevents brute-force and abuse.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

// General API rate limiting
const apiLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: Math.floor(config.rateLimitMax / 5),
    message: { error: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Very strict limiter for MFA verification
const mfaLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: Math.floor(config.rateLimitMax / 20),
    message: { error: 'Too many MFA attempts, please wait before trying again' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, mfaLimiter };
