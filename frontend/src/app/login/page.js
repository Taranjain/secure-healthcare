'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaToken, setMfaToken] = useState('');
    const [tempToken, setTempToken] = useState('');
    const [showMFA, setShowMFA] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    async function handleLogin(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await authAPI.login({ email, password });

            if (data.mfaRequired) {
                setTempToken(data.tempToken);
                setShowMFA(true);
                setLoading(false);
                return;
            }

            login(data.user, data.accessToken, data.refreshToken);
            const dashboardMap = { PATIENT: '/dashboard/patient', DOCTOR: '/dashboard/doctor', ADMIN: '/dashboard/admin' };
            router.push(dashboardMap[data.user.role] || '/dashboard/patient');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleMFA(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await authAPI.verifyMFA({ token: mfaToken, tempToken });
            login(data.user, data.accessToken, data.refreshToken);
            const dashboardMap = { PATIENT: '/dashboard/patient', DOCTOR: '/dashboard/doctor', ADMIN: '/dashboard/admin' };
            router.push(dashboardMap[data.user.role] || '/dashboard/patient');
        } catch (err) {
            setError(err.response?.data?.error || 'MFA verification failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative">
            <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

            <div className="glass-card gradient-border p-8 w-full max-w-md relative z-10 animate-fade-in">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🔐</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
                    <p className="text-gray-400 mt-1">Sign in to HealthVault</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {!showMFA ? (
                    <form onSubmit={handleLogin} className="space-y-5" id="login-form">
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                            <input id="login-email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="input-field" placeholder="you@example.com" required autoComplete="email" />
                        </div>
                        <div>
                            <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                            <input id="login-password" name="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                                className="input-field" placeholder="••••••••" required autoComplete="current-password" />
                        </div>
                        <button id="login-submit" type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleMFA} className="space-y-5">
                        <div className="text-center p-4 rounded-xl bg-primary-900/20 border border-primary-700/20">
                            <p className="text-primary-400 text-sm">🔑 MFA Required</p>
                            <p className="text-gray-400 text-xs mt-1">Enter the 6-digit code from your authenticator app</p>
                        </div>
                        <div>
                            <label htmlFor="mfa-token" className="block text-sm font-medium text-gray-300 mb-2">OTP Code</label>
                            <input id="mfa-token" name="mfaToken" type="text" value={mfaToken} onChange={e => setMfaToken(e.target.value)}
                                className="input-field text-center text-2xl tracking-widest" placeholder="000000"
                                maxLength={6} pattern="[0-9]{6}" required autoFocus autoComplete="one-time-code" />
                        </div>
                        <button id="mfa-submit" type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
                            {loading ? 'Verifying...' : 'Verify & Sign In'}
                        </button>
                        <button type="button" onClick={() => { setShowMFA(false); setMfaToken(''); }}
                            className="btn-secondary w-full text-sm">
                            ← Back to Login
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <p className="text-gray-500 text-sm">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="text-primary-400 hover:text-primary-300 font-medium">Register</Link>
                    </p>
                </div>

                {/* Demo credentials */}
                <div className="mt-6 p-4 rounded-xl bg-healthcare-surface border border-healthcare-border">
                    <p className="text-xs text-gray-500 font-medium mb-2">Demo Credentials</p>
                    <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-blue-400">Patient:</span> patient@demo.com / Patient@123</p>
                        <p><span className="text-purple-400">Doctor:</span> doctor@demo.com / Doctor@123 <span className="text-amber-400">(MFA)</span></p>
                        <p><span className="text-amber-400">Admin:</span> admin@demo.com / Admin@123 <span className="text-amber-400">(MFA)</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
