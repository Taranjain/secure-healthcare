/**
 * Consent Enforcement Middleware
 * 
 * Checks that a doctor has active, non-expired consent 
 * from the patient who owns a specific record before allowing access.
 * Patients always have access to their own records.
 * Admins can view records for auditing purposes.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check consent before allowing record access
 * Expects req.params.id to be the record ID
 */
async function checkConsent(req, res, next) {
    try {
        const recordId = req.params.id;
        const user = req.user;

        if (!recordId) {
            return next(); // No specific record, let the controller handle
        }

        // Fetch the record to find the owner
        const record = await prisma.medicalRecord.findUnique({
            where: { id: recordId },
            select: { patientId: true },
        });

        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }

        // Patient can always access their own records
        if (user.id === record.patientId) {
            return next();
        }

        // Admin can view any record for audit
        if (user.role === 'ADMIN') {
            return next();
        }

        // Doctor must have active consent
        if (user.role === 'DOCTOR') {
            const consent = await prisma.consent.findFirst({
                where: {
                    doctorId: user.id,
                    patientId: record.patientId,
                    status: 'ACTIVE',
                    AND: [
                        {
                            OR: [
                                { recordId: null },    // Blanket consent for all records
                                { recordId: recordId }, // Specific record consent
                            ],
                        },
                        {
                            OR: [
                                { expiresAt: null },                          // No expiry
                                { expiresAt: { gt: new Date() } },            // Not expired
                            ],
                        },
                    ],
                },
            });

            if (!consent) {
                return res.status(403).json({
                    error: 'Access denied: No active consent from patient',
                    message: 'You need explicit patient consent to access this record',
                });
            }

            // Attach consent info for audit
            req.consent = consent;
            return next();
        }

        return res.status(403).json({ error: 'Access denied' });
    } catch (err) {
        console.error('Consent check error:', err);
        return res.status(500).json({ error: 'Consent verification failed' });
    }
}

module.exports = { checkConsent };
