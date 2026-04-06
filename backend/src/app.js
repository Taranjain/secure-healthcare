/**
 * Express Application Setup
 * Configures middleware, routes, and Swagger documentation.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const recordRoutes = require('./routes/records');
const consentRoutes = require('./routes/consents');
const auditRoutes = require('./routes/audit');
const adminRoutes = require('./routes/admin');

const app = express();

// ───── Security Middleware ─────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ───── General Middleware ─────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(apiLimiter);

// ───── Swagger Documentation ─────
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Secure Healthcare Data Sharing Platform API',
            version: '1.0.0',
            description: 'API for secure, privacy-preserving medical record sharing',
        },
        servers: [{ url: `http://localhost:${config.port}`, description: 'Development' }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: [],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Manually add API paths to swagger spec
swaggerSpec.paths = {
    '/api/auth/register': {
        post: {
            tags: ['Auth'],
            summary: 'Register a new user',
            security: [],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['email', 'password', 'name', 'role'],
                            properties: {
                                email: { type: 'string', format: 'email' },
                                password: { type: 'string', minLength: 8 },
                                name: { type: 'string' },
                                role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'] },
                                attributes: { type: 'object' },
                            },
                        },
                    },
                },
            },
            responses: { 201: { description: 'User registered' }, 409: { description: 'Email exists' } },
        },
    },
    '/api/auth/login': {
        post: {
            tags: ['Auth'],
            summary: 'Login',
            security: [],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['email', 'password'],
                            properties: {
                                email: { type: 'string' },
                                password: { type: 'string' },
                            },
                        },
                    },
                },
            },
            responses: { 200: { description: 'Login success or MFA required' } },
        },
    },
    '/api/auth/verify-mfa': {
        post: {
            tags: ['Auth'],
            summary: 'Verify MFA OTP',
            security: [],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['token', 'tempToken'],
                            properties: {
                                token: { type: 'string', minLength: 6, maxLength: 6 },
                                tempToken: { type: 'string' },
                            },
                        },
                    },
                },
            },
            responses: { 200: { description: 'MFA verified, tokens issued' } },
        },
    },
    '/api/records': {
        post: {
            tags: ['Records'],
            summary: 'Upload encrypted medical record',
            requestBody: {
                content: {
                    'multipart/form-data': {
                        schema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                                data: { type: 'string' },
                                file: { type: 'string', format: 'binary' },
                                abePolicy: { type: 'string' },
                            },
                        },
                    },
                },
            },
            responses: { 201: { description: 'Record created' } },
        },
    },
    '/api/records/my': {
        get: { tags: ['Records'], summary: 'List own records (patient)', responses: { 200: { description: 'Records list' } } },
    },
    '/api/records/accessible': {
        get: { tags: ['Records'], summary: 'List accessible records (doctor)', responses: { 200: { description: 'Records list' } } },
    },
    '/api/records/{id}': {
        get: {
            tags: ['Records'],
            summary: 'View decrypted record',
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Decrypted record' }, 403: { description: 'No consent' } },
        },
    },
    '/api/consents': {
        post: {
            tags: ['Consents'],
            summary: 'Grant consent to a doctor',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['doctorId'],
                            properties: {
                                doctorId: { type: 'string', format: 'uuid' },
                                recordId: { type: 'string', format: 'uuid' },
                                expiresAt: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            },
            responses: { 201: { description: 'Consent granted' } },
        },
    },
    '/api/consents/my': {
        get: { tags: ['Consents'], summary: 'List consents', responses: { 200: { description: 'Consents list' } } },
    },
    '/api/consents/{id}/revoke': {
        patch: {
            tags: ['Consents'],
            summary: 'Revoke consent',
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Consent revoked' } },
        },
    },
    '/api/audit/logs': {
        get: {
            tags: ['Audit'],
            summary: 'Get access logs',
            parameters: [
                { in: 'query', name: 'limit', schema: { type: 'integer' } },
                { in: 'query', name: 'offset', schema: { type: 'integer' } },
            ],
            responses: { 200: { description: 'Access logs' } },
        },
    },
    '/api/audit/blockchain': {
        get: { tags: ['Audit'], summary: 'View blockchain (admin)', responses: { 200: { description: 'Blockchain blocks' } } },
    },
    '/api/audit/blockchain/verify': {
        get: { tags: ['Audit'], summary: 'Verify blockchain integrity', responses: { 200: { description: 'Verification result' } } },
    },
    '/api/admin/users': {
        get: { tags: ['Admin'], summary: 'List all users', responses: { 200: { description: 'Users list' } } },
    },
    '/api/admin/dashboard': {
        get: { tags: ['Admin'], summary: 'Dashboard statistics', responses: { 200: { description: 'Stats' } } },
    },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ───── API Routes ─────
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);

// ───── Health Check ─────
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ───── Error Handling ─────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    if (err.message && err.message.includes('File type not allowed')) {
        return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;
