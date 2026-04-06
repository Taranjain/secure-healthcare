/**
 * Auth Controller
 * Handles registration, login, JWT issuance, MFA setup, and token refresh.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const mfaService = require('../services/mfaService');
const auditService = require('../services/auditService');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

/**
 * Register a new user
 */
async function register(req, res) {
    try {
        const { email, password, name, role, attributes } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password with bcrypt
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                role,
                attributes: attributes || {},
                mfaEnabled: false,
            },
            select: { id: true, email: true, name: true, role: true, attributes: true, mfaEnabled: true },
        });

        // If role requires MFA, generate secret and return QR
        let mfa = null;
        if (mfaService.isMFARequired(role)) {
            const { secret, otpauthUrl } = mfaService.generateSecret(email);
            const qrCode = await mfaService.generateQRCode(otpauthUrl);

            await prisma.user.update({
                where: { id: user.id },
                data: { mfaSecret: secret, mfaEnabled: true },
            });

            user.mfaEnabled = true;
            mfa = { qrCode, secret, message: 'Scan this QR code with your authenticator app' };
        }

        res.status(201).json({
            message: 'Registration successful',
            user,
            mfa,
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

/**
 * Login - verify credentials and issue JWT or MFA challenge
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // If MFA is enabled, return a temp token for MFA verification
        if (user.mfaEnabled && user.mfaSecret) {
            const tempToken = jwt.sign(
                { userId: user.id, mfaPending: true },
                config.jwtSecret,
                { expiresIn: '5m' }
            );

            return res.json({
                mfaRequired: true,
                tempToken,
                message: 'Please provide your MFA code',
            });
        }

        // No MFA required - issue tokens directly
        const tokens = generateTokens(user);

        await auditService.logAccess({
            userId: user.id,
            action: 'LOGIN',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: 'Login without MFA',
        });

        res.json({
            message: 'Login successful',
            user: sanitizeUser(user),
            ...tokens,
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

/**
 * Verify MFA token and issue JWT
 */
async function verifyMFA(req, res) {
    try {
        const { token, tempToken } = req.body;

        // Verify temp token
        let decoded;
        try {
            decoded = jwt.verify(tempToken, config.jwtSecret);
        } catch {
            return res.status(401).json({ error: 'MFA session expired, please login again' });
        }

        if (!decoded.mfaPending) {
            return res.status(400).json({ error: 'Invalid MFA session' });
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.mfaSecret) {
            return res.status(401).json({ error: 'User not found or MFA not configured' });
        }

        // Verify TOTP
        const isValid = mfaService.verifyToken(token, user.mfaSecret);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid MFA code' });
        }

        const tokens = generateTokens(user);

        await auditService.logAccess({
            userId: user.id,
            action: 'LOGIN',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: 'Login with MFA verified',
        });

        res.json({
            message: 'MFA verification successful',
            user: sanitizeUser(user),
            ...tokens,
        });
    } catch (err) {
        console.error('MFA verification error:', err);
        res.status(500).json({ error: 'MFA verification failed' });
    }
}

/**
 * Setup MFA for current user
 */
async function setupMFA(req, res) {
    try {
        const user = req.user;
        const { secret, otpauthUrl } = mfaService.generateSecret(user.email);
        const qrCode = await mfaService.generateQRCode(otpauthUrl);

        await prisma.user.update({
            where: { id: user.id },
            data: { mfaSecret: secret, mfaEnabled: true },
        });

        res.json({
            message: 'MFA setup successful. Scan the QR code with your authenticator app.',
            qrCode,
            secret,
        });
    } catch (err) {
        console.error('MFA setup error:', err);
        res.status(500).json({ error: 'MFA setup failed' });
    }
}

/**
 * Refresh access token
 */
async function refreshToken(req, res) {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expired, please login again' });
        }
        res.status(401).json({ error: 'Invalid refresh token' });
    }
}

/**
 * Get current user profile
 */
async function getProfile(req, res) {
    res.json({ user: req.user });
}

// Helper: generate access and refresh tokens
function generateTokens(user) {
    const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
        { userId: user.id },
        config.jwtRefreshSecret,
        { expiresIn: config.jwtRefreshExpiresIn }
    );

    return { accessToken, refreshToken };
}

// Helper: strip sensitive fields from user object
function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        attributes: user.attributes,
        mfaEnabled: user.mfaEnabled,
    };
}

module.exports = { register, login, verifyMFA, setupMFA, refreshToken, getProfile };
