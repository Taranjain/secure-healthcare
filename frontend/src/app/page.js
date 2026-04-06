'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            const dashboardMap = { PATIENT: '/dashboard/patient', DOCTOR: '/dashboard/doctor', ADMIN: '/dashboard/admin' };
            router.push(dashboardMap[user.role] || '/dashboard/patient');
        }
    }, [user, loading, router]);

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse-slow" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                        <span className="text-xl">🏥</span>
                    </div>
                    <span className="text-xl font-bold gradient-text">HealthVault</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/login" className="btn-secondary">Sign In</Link>
                    <Link href="/register" className="btn-primary">Get Started</Link>
                </div>
            </nav>

            {/* Hero */}
            <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
                <div className="text-center max-w-4xl mx-auto animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/30 border border-primary-700/30 text-primary-400 text-sm font-medium mb-8">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        AES-256 Encrypted · Blockchain Verified · HIPAA Ready
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
                        <span className="text-white">Secure Healthcare</span>
                        <br />
                        <span className="gradient-text">Data Sharing</span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Privacy-preserving medical record sharing between patients, doctors, and providers.
                        Every access is encrypted, consented, and recorded on an immutable audit trail.
                    </p>

                    <div className="flex items-center justify-center gap-4 mb-20">
                        <Link href="/register" className="btn-primary text-lg px-8 py-3">
                            Start Sharing Securely →
                        </Link>
                        <Link href="/login" className="btn-secondary text-lg px-8 py-3">
                            Sign In
                        </Link>
                    </div>
                </div>

                {/* Feature grid */}
                <div className="grid md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                    {[
                        { icon: '🔐', title: 'AES-256 Encryption', desc: 'Military-grade encryption for all medical records. Per-record keys with envelope encryption.', color: 'glow-blue' },
                        { icon: '👤', title: 'Patient Consent', desc: 'Full control over who sees your data. Grant, revoke, or set time-limited access.', color: 'glow-teal' },
                        { icon: '🔗', title: 'Blockchain Audit', desc: 'Tamper-proof access logs on a SHA-256 hash chain. Every access is verifiable.', color: 'glow-purple' },
                        { icon: '🔑', title: 'Multi-Factor Auth', desc: 'TOTP-based MFA required for doctors and admins. Secure authenticator app integration.', color: 'glow-blue' },
                        { icon: '🛡️', title: 'Attribute-Based Access', desc: 'Policy-driven access control. Records can require specific departments or specializations.', color: 'glow-teal' },
                        { icon: '📊', title: 'Real-time Dashboard', desc: 'Live audit logs, blockchain verification, and access analytics for full transparency.', color: 'glow-purple' },
                    ].map((f, i) => (
                        <div key={i} className={`glass-card gradient-border p-6 ${f.color} transition-transform hover:-translate-y-1`}>
                            <div className="text-3xl mb-4">{f.icon}</div>
                            <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-healthcare-border py-8 text-center text-gray-500 text-sm">
                <p>HealthVault – Secure Healthcare Data Sharing Platform</p>
            </footer>
        </div>
    );
}
