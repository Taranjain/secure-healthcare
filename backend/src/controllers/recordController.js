/**
 * Medical Record Controller
 * Handles CRUD operations for encrypted medical records.
 * All data is encrypted before storage and decrypted only for authorized users.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const encryptionService = require('../services/encryptionService');
const abeService = require('../services/abeService');
const auditService = require('../services/auditService');
const config = require('../config');

const prisma = new PrismaClient();

/**
 * Upload and encrypt a medical record
 * Only patients can upload their own records
 */
async function createRecord(req, res) {
    try {
        const { title, description, data, abePolicy } = req.body;
        const patientId = req.user.id;

        // Validate ABE policy if provided
        if (abePolicy && Object.keys(abePolicy).length > 0) {
            const policyCheck = abeService.validatePolicy(abePolicy);
            if (!policyCheck.valid) {
                return res.status(400).json({ error: policyCheck.error });
            }
        }

        let encryptedResult;
        let filePath = null;
        let fileType = null;

        // Handle file upload
        if (req.file) {
            const fileBuffer = fs.readFileSync(req.file.path);
            const { encryptedBuffer, iv, tag, encryptedKey } = encryptionService.encryptFile(fileBuffer);

            // Save encrypted file
            const encFileName = `${Date.now()}_${req.file.originalname}.enc`;
            filePath = path.join(config.uploadDir, encFileName);
            fs.writeFileSync(filePath, encryptedBuffer);
            fileType = req.file.mimetype;

            // Remove temp upload
            fs.unlinkSync(req.file.path);

            // For text data alongside a file, encrypt with its OWN key/IV/tag
            // so that decryptRecord() can decrypt it consistently.
            // The file has its own separate encryption context stored in the filePath.
            if (data) {
                encryptedResult = encryptionService.encryptRecord(data);
            } else {
                // No text data — store the file's encryption metadata
                encryptedResult = {
                    encryptedData: '',
                    encryptionIV: iv,
                    encryptionTag: tag,
                    encryptedKey,
                };
            }
        } else if (data) {
            // Text-only record
            encryptedResult = encryptionService.encryptRecord(data);
        } else {
            return res.status(400).json({ error: 'Either file or data must be provided' });
        }

        const record = await prisma.medicalRecord.create({
            data: {
                patientId,
                title,
                description: description || null,
                encryptedData: encryptedResult.encryptedData,
                encryptionIV: encryptedResult.encryptionIV,
                encryptionTag: encryptedResult.encryptionTag,
                encryptedKey: encryptedResult.encryptedKey,
                fileType,
                filePath,
                abePolicy: abePolicy || {},
            },
            select: {
                id: true, title: true, description: true, fileType: true,
                abePolicy: true, createdAt: true,
            },
        });

        // Audit log
        await auditService.logAccess({
            userId: patientId,
            recordId: record.id,
            action: 'UPLOAD',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: `Uploaded record: ${title}`,
        });

        res.status(201).json({ message: 'Record created and encrypted', record });
    } catch (err) {
        console.error('Create record error:', err);
        res.status(500).json({ error: 'Failed to create record' });
    }
}

/**
 * List patient's own records
 */
async function getMyRecords(req, res) {
    try {
        const records = await prisma.medicalRecord.findMany({
            where: { patientId: req.user.id },
            select: {
                id: true, title: true, description: true, fileType: true,
                abePolicy: true, createdAt: true, updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ records });
    } catch (err) {
        console.error('Get records error:', err);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
}

/**
 * Get records accessible to a doctor (via active consent)
 */
async function getAccessibleRecords(req, res) {
    try {
        const doctorId = req.user.id;

        // Find all active consents for this doctor
        const consents = await prisma.consent.findMany({
            where: {
                doctorId,
                status: 'ACTIVE',
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                patient: { select: { id: true, name: true, email: true } },
            },
        });

        // Get unique patient IDs and specific record IDs
        const patientIds = [...new Set(consents.filter(c => !c.recordId).map(c => c.patientId))];
        const specificRecordIds = consents.filter(c => c.recordId).map(c => c.recordId);

        const records = await prisma.medicalRecord.findMany({
            where: {
                OR: [
                    { patientId: { in: patientIds } },
                    { id: { in: specificRecordIds } },
                ],
            },
            select: {
                id: true, title: true, description: true, fileType: true,
                abePolicy: true, createdAt: true,
                patient: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ records });
    } catch (err) {
        console.error('Get accessible records error:', err);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
}

/**
 * View a specific record (decrypted)
 * Consent is checked by middleware before reaching here
 */
async function getRecord(req, res) {
    try {
        const record = await prisma.medicalRecord.findUnique({
            where: { id: req.params.id },
            include: {
                patient: { select: { id: true, name: true, email: true } },
            },
        });

        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }

        // ABE policy check for doctors
        if (req.user.role === 'DOCTOR' && record.abePolicy && Object.keys(record.abePolicy).length > 0) {
            const policyResult = abeService.checkPolicy(req.user, record.abePolicy);
            if (!policyResult.allowed) {
                return res.status(403).json({
                    error: 'Access denied by attribute policy',
                    reason: policyResult.reason,
                });
            }
        }

        // Decrypt data
        let decryptedData = null;
        if (record.encryptedData) {
            try {
                decryptedData = encryptionService.decryptRecord(record);
            } catch (e) {
                console.error('Decryption error:', e);
                decryptedData = '[Decryption failed]';
            }
        }

        // Audit log
        await auditService.logAccess({
            userId: req.user.id,
            recordId: record.id,
            action: 'VIEW',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: `Viewed record: ${record.title}`,
        });

        res.json({
            record: {
                id: record.id,
                title: record.title,
                description: record.description,
                data: decryptedData,
                fileType: record.fileType,
                hasFile: !!record.filePath,
                abePolicy: record.abePolicy,
                createdAt: record.createdAt,
                patient: record.patient,
            },
        });
    } catch (err) {
        console.error('Get record error:', err);
        res.status(500).json({ error: 'Failed to fetch record' });
    }
}

/**
 * Download decrypted file
 */
async function downloadRecord(req, res) {
    try {
        const record = await prisma.medicalRecord.findUnique({
            where: { id: req.params.id },
        });

        if (!record || !record.filePath) {
            return res.status(404).json({ error: 'File not found' });
        }

        // ABE policy check
        if (req.user.role === 'DOCTOR' && record.abePolicy && Object.keys(record.abePolicy).length > 0) {
            const policyResult = abeService.checkPolicy(req.user, record.abePolicy);
            if (!policyResult.allowed) {
                return res.status(403).json({ error: 'Access denied by attribute policy', reason: policyResult.reason });
            }
        }

        // Read and decrypt file
        const encryptedBuffer = fs.readFileSync(record.filePath);
        const decryptedBuffer = encryptionService.decryptFile(
            encryptedBuffer,
            record.encryptionIV,
            record.encryptionTag,
            record.encryptedKey
        );

        // Audit log
        await auditService.logAccess({
            userId: req.user.id,
            recordId: record.id,
            action: 'DOWNLOAD',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: `Downloaded file for record: ${record.title}`,
        });

        res.set('Content-Type', record.fileType || 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${record.title}"`);
        res.send(decryptedBuffer);
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
    }
}

/**
 * Delete a record (patient only, own records)
 */
async function deleteRecord(req, res) {
    try {
        const record = await prisma.medicalRecord.findUnique({
            where: { id: req.params.id },
        });

        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }

        if (record.patientId !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own records' });
        }

        // Delete encrypted file from disk
        if (record.filePath && fs.existsSync(record.filePath)) {
            fs.unlinkSync(record.filePath);
        }

        await prisma.medicalRecord.delete({ where: { id: req.params.id } });

        await auditService.logAccess({
            userId: req.user.id,
            recordId: req.params.id,
            action: 'DELETE',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: `Deleted record: ${record.title}`,
        });

        res.json({ message: 'Record deleted successfully' });
    } catch (err) {
        console.error('Delete record error:', err);
        res.status(500).json({ error: 'Failed to delete record' });
    }
}

module.exports = {
    createRecord,
    getMyRecords,
    getAccessibleRecords,
    getRecord,
    downloadRecord,
    deleteRecord,
};
