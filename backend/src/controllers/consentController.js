/**
 * Consent Controller
 * Manages patient consent for doctor access to medical records.
 * Supports: grant, revoke, time-limited access, and listing consents.
 */

const { PrismaClient } = require('@prisma/client');
const auditService = require('../services/auditService');

const prisma = new PrismaClient();

/**
 * Grant consent to a doctor
 * Only patients can grant consent for their own records
 */
async function grantConsent(req, res) {
    try {
        const { doctorId, recordId, expiresAt } = req.body;
        const patientId = req.user.id;

        // Verify doctor exists and is actually a doctor
        const doctor = await prisma.user.findUnique({
            where: { id: doctorId },
            select: { id: true, name: true, role: true },
        });

        if (!doctor || doctor.role !== 'DOCTOR') {
            return res.status(400).json({ error: 'Invalid doctor ID or user is not a doctor' });
        }

        // If recordId provided, verify it belongs to the patient
        if (recordId) {
            const record = await prisma.medicalRecord.findUnique({
                where: { id: recordId },
                select: { patientId: true },
            });

            if (!record || record.patientId !== patientId) {
                return res.status(400).json({ error: 'Record not found or does not belong to you' });
            }
        }

        // Check for existing active consent
        const existingConsent = await prisma.consent.findFirst({
            where: {
                patientId,
                doctorId,
                recordId: recordId || null,
                status: 'ACTIVE',
            },
        });

        if (existingConsent) {
            return res.status(409).json({
                error: 'Active consent already exists for this doctor and record',
                consentId: existingConsent.id,
            });
        }

        const consent = await prisma.consent.create({
            data: {
                patientId,
                doctorId,
                recordId: recordId || null,
                status: 'ACTIVE',
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
            include: {
                doctor: { select: { id: true, name: true, email: true } },
            },
        });

        await auditService.logAccess({
            userId: patientId,
            recordId: recordId || null,
            action: 'GRANT_CONSENT',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: `Granted consent to doctor ${doctor.name} (${doctorId})${expiresAt ? ` until ${expiresAt}` : ''}`,
        });

        res.status(201).json({
            message: 'Consent granted successfully',
            consent: {
                id: consent.id,
                doctorId: consent.doctorId,
                doctorName: consent.doctor.name,
                recordId: consent.recordId,
                status: consent.status,
                expiresAt: consent.expiresAt,
                createdAt: consent.createdAt,
            },
        });
    } catch (err) {
        console.error('Grant consent error:', err);
        res.status(500).json({ error: 'Failed to grant consent' });
    }
}

/**
 * Revoke a consent
 */
async function revokeConsent(req, res) {
    try {
        const consentId = req.params.id;
        const patientId = req.user.id;

        const consent = await prisma.consent.findUnique({
            where: { id: consentId },
        });

        if (!consent) {
            return res.status(404).json({ error: 'Consent not found' });
        }

        if (consent.patientId !== patientId) {
            return res.status(403).json({ error: 'You can only revoke your own consents' });
        }

        if (consent.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'Consent is not active' });
        }

        const updated = await prisma.consent.update({
            where: { id: consentId },
            data: {
                status: 'REVOKED',
                revokedAt: new Date(),
            },
        });

        await auditService.logAccess({
            userId: patientId,
            recordId: consent.recordId || null,
            action: 'REVOKE_CONSENT',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: `Revoked consent ${consentId} for doctor ${consent.doctorId}`,
        });

        res.json({ message: 'Consent revoked successfully', consent: updated });
    } catch (err) {
        console.error('Revoke consent error:', err);
        res.status(500).json({ error: 'Failed to revoke consent' });
    }
}

/**
 * List consents for the current user
 * Patients see consents they've given, doctors see consents received
 */
async function getMyConsents(req, res) {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let consents;
        if (role === 'PATIENT') {
            consents = await prisma.consent.findMany({
                where: { patientId: userId },
                include: {
                    doctor: { select: { id: true, name: true, email: true } },
                    record: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
        } else if (role === 'DOCTOR') {
            consents = await prisma.consent.findMany({
                where: { doctorId: userId },
                include: {
                    patient: { select: { id: true, name: true, email: true } },
                    record: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
        } else {
            // Admin sees all
            consents = await prisma.consent.findMany({
                include: {
                    patient: { select: { id: true, name: true, email: true } },
                    doctor: { select: { id: true, name: true, email: true } },
                    record: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
        }

        // Auto-expire time-limited consents
        const now = new Date();
        for (const consent of consents) {
            if (consent.status === 'ACTIVE' && consent.expiresAt && consent.expiresAt < now) {
                await prisma.consent.update({
                    where: { id: consent.id },
                    data: { status: 'EXPIRED' },
                });
                consent.status = 'EXPIRED';
            }
        }

        res.json({ consents });
    } catch (err) {
        console.error('Get consents error:', err);
        res.status(500).json({ error: 'Failed to fetch consents' });
    }
}

/**
 * List all doctors (for patients to select when granting consent)
 */
async function listDoctors(req, res) {
    try {
        const doctors = await prisma.user.findMany({
            where: { role: 'DOCTOR' },
            select: { id: true, name: true, email: true, attributes: true },
            orderBy: { name: 'asc' },
        });
        res.json({ doctors });
    } catch (err) {
        console.error('List doctors error:', err);
        res.status(500).json({ error: 'Failed to list doctors' });
    }
}

module.exports = { grantConsent, revokeConsent, getMyConsents, listDoctors };
