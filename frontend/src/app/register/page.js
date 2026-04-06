'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '../../lib/api';

export default function RegisterPage() {
    const [form, setForm] = useState({ email: '', password: '', name: '', role: 'PATIENT', department: '', specialization: '' });
    const [mfaData, setMfaData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    function update(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleRegister(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const attributes = {};
            if (form.department) attributes.department = form.department;
            if (form.specialization) attributes.specialization = form.specialization;

            const { data } = await authAPI.register({
                email: form.email,
                password: form.password,
                name: form.name,
                role: form.role,
                attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            });

            if (data.mfa) {
                setMfaData(data.mfa);
            } else {
                router.push('/login');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.details?.map(d => d.message).join(', ') || 'Registration failed');
        } finally {
            setLoading(false);
        }
    }

    if (mfaData) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="glass-card gradient-border p-8 w-full max-w-md animate-fade-in">
                    <div className="text-center mb-6">
                        <span className="text-4xl">🔐</span>
                        <h1 className="text-2xl font-bold text-white mt-4">Setup MFA</h1>
                        <p className="text-gray-400 mt-1">Scan this QR code with your authenticator app</p>
                    </div>

                    <div className="flex justify-center mb-6">
                        <img src={mfaData.qrCode} alt="MFA QR Code" className="rounded-xl border border-healthcare-border" />
                    </div>

                    <div className="p-4 rounded-xl bg-healthcare-surface border border-healthcare-border mb-6">
                        <p className="text-xs text-gray-500 font-medium mb-1">Manual Entry Secret</p>
                        <p className="text-sm text-primary-400 font-mono break-all">{mfaData.secret}</p>
                    </div>

                    <Link href="/login" className="btn-primary w-full block text-center">
                        Continue to Login →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 relative">
            <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

            <div className="glass-card gradient-border p-8 w-full max-w-md relative z-10 animate-fade-in">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🏥</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Create Account</h1>
                    <p className="text-gray-400 mt-1">Join HealthVault</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4" id="register-form">
                    <div>
                        <label htmlFor="register-name" className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                        <input id="register-name" name="name" type="text" value={form.name} onChange={e => update('name', e.target.value)}
                            className="input-field" placeholder="John Doe" required autoComplete="name" />
                    </div>
                    <div>
                        <label htmlFor="register-email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                        <input id="register-email" name="email" type="email" value={form.email} onChange={e => update('email', e.target.value)}
                            className="input-field" placeholder="you@example.com" required autoComplete="email" />
                    </div>
                    <div>
                        <label htmlFor="register-password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                        <input id="register-password" name="password" type="password" value={form.password} onChange={e => update('password', e.target.value)}
                            className="input-field" placeholder="Min 8 chars, uppercase, number, special" required autoComplete="new-password" />
                        <p className="text-xs text-gray-500 mt-1">Must include uppercase, number, and special character</p>
                    </div>
                    <div>
                        <label htmlFor="register-role" className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                        <select id="register-role" name="role" value={form.role} onChange={e => update('role', e.target.value)} className="input-field">
                            <option value="PATIENT">Patient</option>
                            <option value="DOCTOR">Doctor</option>
                        </select>
                    </div>

                    {form.role === 'DOCTOR' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Department</label>
                                <input type="text" value={form.department} onChange={e => update('department', e.target.value)}
                                    className="input-field" placeholder="e.g. Cardiology" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Specialization</label>
                                <input type="text" value={form.specialization} onChange={e => update('specialization', e.target.value)}
                                    className="input-field" placeholder="e.g. Interventional" />
                            </div>
                            <div className="p-3 rounded-xl bg-amber-900/20 border border-amber-700/20 text-amber-400 text-sm">
                                🔑 MFA will be automatically enabled for doctor accounts
                            </div>
                        </>
                    )}

                    <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-gray-500 text-sm">
                        Already have an account?{' '}
                        <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
