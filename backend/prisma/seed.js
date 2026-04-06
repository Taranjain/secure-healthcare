/**
 * Database Seed Script
 * Creates sample users for testing:
 *   - Patient: patient@demo.com / Patient@123
 *   - Doctor:  doctor@demo.com  / Doctor@123
 *   - Admin:   admin@demo.com   / Admin@123
 * 
 * MFA is auto-configured for Doctor and Admin.
 * Run: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function seed() {
    console.log('🌱 Seeding database...');

    // Check if users already exist
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
        console.log('⏭️  Database already seeded, skipping');
        return;
    }

    // Create Patient
    const patientPassword = await bcrypt.hash('Patient@123', SALT_ROUNDS);
    const patient = await prisma.user.create({
        data: {
            email: 'patient@demo.com',
            passwordHash: patientPassword,
            name: 'John Patient',
            role: 'PATIENT',
            attributes: { bloodGroup: 'O+', allergies: ['Penicillin'] },
            mfaEnabled: false,
        },
    });
    console.log(`  ✅ Patient: patient@demo.com / Patient@123 (ID: ${patient.id})`);

    // Create Doctor with MFA
    const doctorPassword = await bcrypt.hash('Doctor@123', SALT_ROUNDS);
    const doctorMfaSecret = authenticator.generateSecret();
    const doctor = await prisma.user.create({
        data: {
            email: 'doctor@demo.com',
            passwordHash: doctorPassword,
            name: 'Dr. Sarah Smith',
            role: 'DOCTOR',
            attributes: { department: 'Cardiology', specialization: 'Interventional', licenseNo: 'MD-12345' },
            mfaEnabled: true,
            mfaSecret: doctorMfaSecret,
        },
    });
    console.log(`  ✅ Doctor: doctor@demo.com / Doctor@123 (ID: ${doctor.id})`);
    console.log(`     MFA Secret: ${doctorMfaSecret}`);
    console.log(`     (Use this secret in an authenticator app like Google Authenticator)`);

    // Create Admin with MFA
    const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
    const adminMfaSecret = authenticator.generateSecret();
    const admin = await prisma.user.create({
        data: {
            email: 'admin@demo.com',
            passwordHash: adminPassword,
            name: 'Admin User',
            role: 'ADMIN',
            attributes: { department: 'IT', accessLevel: 'full' },
            mfaEnabled: true,
            mfaSecret: adminMfaSecret,
        },
    });
    console.log(`  ✅ Admin: admin@demo.com / Admin@123 (ID: ${admin.id})`);
    console.log(`     MFA Secret: ${adminMfaSecret}`);

    // Create a sample encrypted medical record for the patient
    const crypto = require('crypto');
    const encryptionService = require('../src/services/encryptionService');

    const sampleData = JSON.stringify({
        diagnosis: 'Hypertension Stage 1',
        prescription: 'Amlodipine 5mg once daily',
        vitals: { bp: '140/90', heartRate: 78, temperature: 98.6 },
        notes: 'Patient advised lifestyle modifications including reduced sodium intake and regular exercise.',
        date: '2024-03-15',
    });

    const encrypted = encryptionService.encryptRecord(sampleData);

    const record = await prisma.medicalRecord.create({
        data: {
            patientId: patient.id,
            title: 'Annual Checkup - Cardiology Report',
            description: 'Routine annual cardiac evaluation with blood pressure assessment',
            encryptedData: encrypted.encryptedData,
            encryptionIV: encrypted.encryptionIV,
            encryptionTag: encrypted.encryptionTag,
            encryptedKey: encrypted.encryptedKey,
            abePolicy: { role: 'DOCTOR', department: 'Cardiology' },
        },
    });
    console.log(`  ✅ Sample record created: ${record.title} (ID: ${record.id})`);

    // Create another record without ABE policy
    const sampleData2 = JSON.stringify({
        diagnosis: 'General wellness checkup',
        prescription: 'Vitamin D3 supplementation',
        vitals: { bp: '120/80', weight: '75kg', height: '178cm' },
        notes: 'All parameters within normal range. Follow up in 6 months.',
        date: '2024-06-20',
    });

    const encrypted2 = encryptionService.encryptRecord(sampleData2);

    const record2 = await prisma.medicalRecord.create({
        data: {
            patientId: patient.id,
            title: 'General Health Checkup',
            description: 'Routine health screening',
            encryptedData: encrypted2.encryptedData,
            encryptionIV: encrypted2.encryptionIV,
            encryptionTag: encrypted2.encryptionTag,
            encryptedKey: encrypted2.encryptedKey,
            abePolicy: {},
        },
    });
    console.log(`  ✅ Sample record 2 created: ${record2.title} (ID: ${record2.id})`);

    console.log('\n🎉 Seeding complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test Credentials:');
    console.log('  Patient: patient@demo.com / Patient@123 (no MFA)');
    console.log('  Doctor:  doctor@demo.com  / Doctor@123  (MFA required)');
    console.log('  Admin:   admin@demo.com   / Admin@123   (MFA required)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seed()
    .catch(err => {
        console.error('Seed error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
