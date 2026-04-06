/**
 * Encryption Service - AES-256-GCM
 * Provides envelope encryption for medical records.
 * 
 * Architecture:
 *   Master Key (from env) -> encrypts per-record DEK
 *   DEK (Data Encryption Key) -> encrypts actual data
 *   Each record gets a unique DEK for isolation
 */

const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128-bit IV for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag
const KEY_LENGTH = 32;  // 256-bit key

/**
 * Derive 32-byte key from hex master key
 */
function getMasterKey() {
    const key = Buffer.from(config.masterEncryptionKey, 'hex');
    if (key.length !== KEY_LENGTH) {
        throw new Error('Master encryption key must be 32 bytes (64 hex characters)');
    }
    return key;
}

/**
 * Generate a random Data Encryption Key (DEK)
 * @returns {Buffer} 32-byte random key
 */
function generateDEK() {
    return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string|Buffer} plaintext - Data to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @returns {{ encrypted: string, iv: string, tag: string }}
 */
function encrypt(plaintext, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(
        typeof plaintext === 'string' ? plaintext : plaintext.toString('utf8'),
        'utf8',
        'hex'
    );
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
    };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedHex - Hex-encoded ciphertext
 * @param {string} ivHex - Hex-encoded IV
 * @param {string} tagHex - Hex-encoded auth tag
 * @param {Buffer} key - 32-byte decryption key
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedHex, ivHex, tagHex, key) {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Encrypt a DEK with the master key (envelope encryption)
 * @param {Buffer} dek - Data Encryption Key
 * @returns {string} Encrypted DEK as combined hex string (iv:tag:encrypted)
 */
function encryptDEK(dek) {
    const masterKey = getMasterKey();
    const { encrypted, iv, tag } = encrypt(dek.toString('hex'), masterKey);
    return `${iv}:${tag}:${encrypted}`;
}

/**
 * Decrypt a DEK with the master key
 * @param {string} encryptedDEK - Combined hex string from encryptDEK
 * @returns {Buffer} Decrypted DEK
 */
function decryptDEK(encryptedDEK) {
    const masterKey = getMasterKey();
    const [iv, tag, encrypted] = encryptedDEK.split(':');
    const dekHex = decrypt(encrypted, iv, tag, masterKey);
    return Buffer.from(dekHex, 'hex');
}

/**
 * Encrypt file buffer
 * @param {Buffer} fileBuffer - File data
 * @returns {{ encryptedBuffer: Buffer, iv: string, tag: string, encryptedKey: string }}
 */
function encryptFile(fileBuffer) {
    const dek = generateDEK();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);

    const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        encryptedBuffer: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        encryptedKey: encryptDEK(dek),
    };
}

/**
 * Decrypt file buffer
 * @param {Buffer} encryptedBuffer - Encrypted file data
 * @param {string} ivHex - Hex IV
 * @param {string} tagHex - Hex auth tag
 * @param {string} encryptedKey - Envelope-encrypted DEK
 * @returns {Buffer} Decrypted file data
 */
function decryptFile(encryptedBuffer, ivHex, tagHex, encryptedKey) {
    const dek = decryptDEK(encryptedKey);
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

/**
 * Encrypt text data for a medical record
 * @param {string} data - Plaintext data
 * @returns {{ encryptedData, encryptionIV, encryptionTag, encryptedKey }}
 */
function encryptRecord(data) {
    const dek = generateDEK();
    const { encrypted, iv, tag } = encrypt(data, dek);

    return {
        encryptedData: encrypted,
        encryptionIV: iv,
        encryptionTag: tag,
        encryptedKey: encryptDEK(dek),
    };
}

/**
 * Decrypt a medical record
 * @param {{ encryptedData, encryptionIV, encryptionTag, encryptedKey }} record
 * @returns {string} Decrypted data
 */
function decryptRecord(record) {
    const dek = decryptDEK(record.encryptedKey);
    return decrypt(record.encryptedData, record.encryptionIV, record.encryptionTag, dek);
}

module.exports = {
    generateDEK,
    encrypt,
    decrypt,
    encryptDEK,
    decryptDEK,
    encryptFile,
    decryptFile,
    encryptRecord,
    decryptRecord,
};
