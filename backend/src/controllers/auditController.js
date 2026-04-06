/**
 * Audit Controller
 * Provides endpoints for viewing access logs and blockchain verification.
 */

const auditService = require('../services/auditService');
const blockchainService = require('../services/blockchainService');

/**
 * Get access logs
 * Patients see logs for their records, admins see all
 */
async function getLogs(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        let result;
        if (req.user.role === 'ADMIN') {
            result = await auditService.getAllLogs(limit, offset);
        } else if (req.user.role === 'PATIENT') {
            result = await auditService.getLogsForPatient(req.user.id, limit, offset);
        } else {
            // Doctors see their own access logs
            const logs = await auditService.getLogsByUser(req.user.id, limit, offset);
            result = { logs, total: logs.length };
        }

        res.json(result);
    } catch (err) {
        console.error('Get logs error:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
}

/**
 * Get blockchain blocks
 */
async function getBlockchain(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const blocks = await blockchainService.getChain(limit);

        // Convert BigInt to string for JSON serialization
        const serializedBlocks = blocks.map(b => ({
            ...b,
            timestamp: b.timestamp.toString(),
        }));

        res.json({ blocks: serializedBlocks });
    } catch (err) {
        console.error('Get blockchain error:', err);
        res.status(500).json({ error: 'Failed to fetch blockchain' });
    }
}

/**
 * Verify blockchain integrity
 */
async function verifyBlockchain(req, res) {
    try {
        const result = await blockchainService.verifyChain();
        res.json(result);
    } catch (err) {
        console.error('Verify blockchain error:', err);
        res.status(500).json({ error: 'Blockchain verification failed' });
    }
}

module.exports = { getLogs, getBlockchain, verifyBlockchain };
