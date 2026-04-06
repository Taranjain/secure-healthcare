/**
 * Configuration module
 * Loads and validates environment variables
 */

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',

  // Encryption
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY,

  // MFA
  mfaIssuer: process.env.MFA_ISSUER || 'HealthcarePlatform',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // File upload
  uploadDir: '/app/uploads',
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

// Validate required config
const required = ['jwtSecret', 'jwtRefreshSecret', 'masterEncryptionKey'];
for (const key of required) {
  if (!config[key]) {
    console.error(`Missing required config: ${key}`);
    process.exit(1);
  }
}

module.exports = config;
