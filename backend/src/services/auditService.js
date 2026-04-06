/**
 * Audit Service
 * 
 * Creates immutable access logs and records them on the blockchain.
 * Every data access event is tracked with who, what, when, and from where.
 */

const { PrismaClient } = require('@prisma/client');
const blockchainService = require('./blockchainService');

const prisma = new PrismaClient();

/**
 * Log an access event and add it to the blockchain
 * @param {Object} params
 * @param {string} params.userId - Who performed the action
 * @param {string} [params.recordId] - Which record was accessed
 * @param {string} params.action - What action was performed
 * @param {string} [params.ipAddress] - Client IP
 * @param {string} [params.userAgent] - Client user agent
 * @param {string} [params.details] - Additional details
 * @returns {Object} Created access log
 */
async function logAccess({ userId, recordId, action, ipAddress, userAgent, details }) {
    // Add to blockchain first
    const blockData = {
        userId,
        recordId: recordId || null,
        action,
        timestamp: new Date().toISOString(),
        ipAddress: ipAddress || 'unknown',
    };

    let blockchainHash = null;
    try {
        const block = await blockchainService.addBlock(blockData);
        blockchainHash = block.hash;
    } catch (err) {
        console.error('⚠️ Failed to add audit log to blockchain:', err.message);
        // Continue logging even if blockchain fails
    }

    // Create access log entry (append-only - no update/delete operations exposed)
    const log = await prisma.accessLog.create({
        data: {
            userId,
            recordId: recordId || null,
            action,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            details: details || null,
            blockchainHash,
        },
    });

    return log;
}

/**
 * Get access logs for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Max entries
 * @param {number} offset - Pagination offset
 * @returns {Array} Access logs
 */
async function getLogsByUser(userId, limit = 50, offset = 0) {
    return prisma.accessLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
            record: { select: { id: true, title: true } },
        },
    });
}

/**
 * Get access logs for a specific record
 * @param {string} recordId - Record ID
 * @param {number} limit - Max entries
 * @returns {Array} Access logs
 */
async function getLogsByRecord(recordId, limit = 50) {
    return prisma.accessLog.findMany({
        where: { recordId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
            user: { select: { id: true, name: true, email: true, role: true } },
        },
    });
}

/**
 * Get all access logs (admin only)
 * @param {number} limit
 * @param {number} offset
 * @returns {Array} Access logs
 */
async function getAllLogs(limit = 100, offset = 0) {
    const [logs, total] = await Promise.all([
        prisma.accessLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset,
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                record: { select: { id: true, title: true } },
            },
        }),
        prisma.accessLog.count(),
    ]);

    return { logs, total };
}

/**
 * Get logs for records owned by a specific patient
 * @param {string} patientId 
 * @param {number} limit 
 * @param {number} offset 
 * @returns {Object} logs and total
 */
async function getLogsForPatient(patientId, limit = 50, offset = 0) {
    const [logs, total] = await Promise.all([
        prisma.accessLog.findMany({
            where: {
                record: { patientId },
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset,
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                record: { select: { id: true, title: true } },
            },
        }),
        prisma.accessLog.count({
            where: {
                record: { patientId },
            },
        }),
    ]);

    return { logs, total };
}

module.exports = {
    logAccess,
    getLogsByUser,
    getLogsByRecord,
    getAllLogs,
    getLogsForPatient,
};
