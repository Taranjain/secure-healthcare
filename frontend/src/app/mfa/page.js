'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { authAPI } from '../../lib/api';
import Navbar from '../../components/Navbar';

export default function MFASetupPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    async function handleSetupMFA() {
        setError('');
        setLoading(true);
        try {
            const { data } = await authAPI.setupMFA();
            setQrCode(data.qrCode);
            setSecret(data.secret);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to setup MFA');
        } finally {
            setLoading(false);
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-primary-400 animate-pulse text-lg">Loading...</div>
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen">
            <Navbar />
            <main className="max-w-xl mx-auto px-4 py-12">
                <div className="glass-card gradient-border p-8 animate-fade-in">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🔐</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white">Multi-Factor Authentication</h1>
                        <p className="text-gray-400 mt-2">
                            {user.mfaEnabled
                                ? 'MFA is currently enabled on your account'
                                : 'Secure your account with TOTP-based authentication'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* MFA Status */}
                    <div className={`p-4 rounded-xl mb-6 ${user.mfaEnabled
                        ? 'bg-emerald-900/20 border border-emerald-700/20'
                        : 'bg-amber-900/20 border border-amber-700/20'
                        }`}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{user.mfaEnabled ? '✅' : '⚠️'}</span>
                            <div>
                                <p className={`font-medium ${user.mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {user.mfaEnabled ? 'MFA Enabled' : 'MFA Not Enabled'}
                                </p>
                                <p className="text-sm text-gray-400">
                                    {user.mfaEnabled
                                        ? 'Your account is protected with TOTP authentication.'
                                        : 'Enable MFA to add an extra layer of security.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Setup / Reset MFA */}
                    {!success ? (
                        <div className="text-center">
                            <button
                                id="setup-mfa-btn"
                                onClick={handleSetupMFA}
                                disabled={loading}
                                className="btn-primary disabled:opacity-50"
                            >
                                {loading ? 'Generating...' : user.mfaEnabled ? '🔄 Reset MFA' : '🔐 Enable MFA'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="text-center">
                                <p className="text-sm text-gray-400 mb-4">
                                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                                </p>
                                <div className="flex justify-center">
                                    <img src={qrCode} alt="MFA QR Code" className="rounded-xl border border-healthcare-border" />
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-healthcare-surface border border-healthcare-border">
                                <p className="text-xs text-gray-500 font-medium mb-2">Manual Entry Secret</p>
                                <p className="text-sm text-primary-400 font-mono break-all select-all">{secret}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-amber-900/20 border border-amber-700/20 text-amber-400 text-sm">
                                ⚠️ Save this secret in a safe place. You&apos;ll need it if you lose access to your authenticator app.
                            </div>

                            <button
                                onClick={() => {
                                    const dashboardMap = { PATIENT: '/dashboard/patient', DOCTOR: '/dashboard/doctor', ADMIN: '/dashboard/admin' };
                                    router.push(dashboardMap[user.role] || '/dashboard/patient');
                                }}
                                className="btn-primary w-full"
                            >
                                ✓ Done — Go to Dashboard
                            </button>
                        </div>
                    )}

                    {/* Info */}
                    <div className="mt-8 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300">How MFA Works</h3>
                        {[
                            { icon: '📱', text: 'Install an authenticator app on your phone' },
                            { icon: '📷', text: 'Scan the QR code or enter the secret manually' },
                            { icon: '🔢', text: 'Enter the 6-digit code during login' },
                            { icon: '🔒', text: 'Your account is now protected with two factors' },
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-healthcare-surface/50">
                                <span className="text-lg">{step.icon}</span>
                                <p className="text-sm text-gray-400">{step.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
