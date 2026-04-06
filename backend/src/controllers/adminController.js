/**
 * Admin Controller
 * Admin-only endpoints for user management and dashboard.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * List all users
 */
async function listUsers(req, res) {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, email: true, name: true, role: true,
                attributes: true, mfaEnabled: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ users });
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Failed to list users' });
    }
}

/**
 * Get dashboard statistics
 */
async function getDashboard(req, res) {
    try {
        const [
            totalUsers,
            totalPatients,
            totalDoctors,
            totalRecords,
            totalConsents,
            activeConsents,
            totalLogs,
            recentLogs,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: 'PATIENT' } }),
            prisma.user.count({ where: { role: 'DOCTOR' } }),
            prisma.medicalRecord.count(),
            prisma.consent.count(),
            prisma.consent.count({ where: { status: 'ACTIVE' } }),
            prisma.accessLog.count(),
            prisma.accessLog.findMany({
                orderBy: { timestamp: 'desc' },
                take: 10,
                include: {
                    user: { select: { name: true, role: true } },
                    record: { select: { title: true } },
                },
            }),
        ]);

        res.json({
            stats: {
                totalUsers,
                totalPatients,
                totalDoctors,
                totalRecords,
                totalConsents,
                activeConsents,
                totalLogs,
            },
            recentLogs,
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
}

module.exports = { listUsers, getDashboard };
