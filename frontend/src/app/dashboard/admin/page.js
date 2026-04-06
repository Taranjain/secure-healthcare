'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { adminAPI, auditAPI } from '../../../lib/api';
import Navbar from '../../../components/Navbar';

function AdminDashboardContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'dashboard';

    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [allLogs, setAllLogs] = useState({ logs: [], total: 0 });
    const [blockchain, setBlockchain] = useState([]);
    const [chainValid, setChainValid] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [dashRes, usersRes, logsRes, chainRes] = await Promise.all([
                adminAPI.getDashboard(),
                adminAPI.getUsers(),
                auditAPI.getLogs({ limit: 100 }),
                auditAPI.getBlockchain({ limit: 20 }),
            ]);
            setStats(dashRes.data.stats);
            setRecentLogs(dashRes.data.recentLogs);
            setUsers(usersRes.data.users);
            setAllLogs(logsRes.data);
            setBlockchain(chainRes.data.blocks);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
        if (!authLoading && user?.role !== 'ADMIN') router.push('/login');
        if (user) fetchData();
    }, [user, authLoading, router, fetchData]);

    async function verifyBlockchain() {
        try {
            const { data } = await auditAPI.verifyBlockchain();
            setChainValid(data);
        } catch {
            setError('Verification failed');
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-primary-400 animate-pulse text-lg">Loading...</div>
            </div>
        );
    }

    const statCards = stats ? [
        { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'from-primary-600 to-primary-700' },
        { label: 'Patients', value: stats.totalPatients, icon: '🏥', color: 'from-blue-600 to-blue-700' },
        { label: 'Doctors', value: stats.totalDoctors, icon: '⚕️', color: 'from-purple-600 to-purple-700' },
        { label: 'Records', value: stats.totalRecords, icon: '📄', color: 'from-emerald-600 to-emerald-700' },
        { label: 'Total Consents', value: stats.totalConsents, icon: '🤝', color: 'from-amber-600 to-amber-700' },
        { label: 'Active Consents', value: stats.activeConsents, icon: '✅', color: 'from-teal-600 to-teal-700' },
        { label: 'Audit Logs', value: stats.totalLogs, icon: '📊', color: 'from-rose-600 to-rose-700' },
        { label: 'Blockchain Blocks', value: blockchain.length, icon: '🔗', color: 'from-indigo-600 to-indigo-700' },
    ] : [];

    return (
        <div className="min-h-screen">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                    <p className="text-gray-400 mt-1">System Overview & Management</p>
                </div>

                {error && <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/30 text-red-400">{error}</div>}

                {/* Tabs */}
                <div className="flex gap-2 mb-8 border-b border-healthcare-border pb-4">
                    {[
                        { key: 'dashboard', label: '📊 Overview' },
                        { key: 'users', label: '👥 Users' },
                        { key: 'blockchain', label: '🔗 Blockchain' },
                        { key: 'audit', label: '📜 Audit Logs' },
                    ].map(t => (
                        <button key={t.key}
                            onClick={() => router.push(`/dashboard/admin?tab=${t.key}`)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-amber-600/20 text-amber-400 border border-amber-700/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Dashboard Tab */}
                {tab === 'dashboard' && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {statCards.map((s, i) => (
                                <div key={i} className="glass-card p-5">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-lg mb-3`}>
                                        {s.icon}
                                    </div>
                                    <p className="text-2xl font-bold text-white">{s.value}</p>
                                    <p className="text-sm text-gray-400">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="glass-card p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                            <div className="space-y-3">
                                {recentLogs.map((log, i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-healthcare-surface/50">
                                        <div className="w-9 h-9 rounded-lg bg-primary-900/30 flex items-center justify-center text-sm">
                                            {log.action === 'LOGIN' ? '🔐' : log.action === 'UPLOAD' ? '📤' : log.action === 'VIEW' ? '👁️' : '📋'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white">
                                                <span className="font-medium">{log.user?.name}</span>
                                                <span className={`ml-2 badge ${log.user?.role === 'DOCTOR' ? 'badge-doctor' : log.user?.role === 'ADMIN' ? 'badge-admin' : 'badge-patient'}`}>
                                                    {log.user?.role}
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-400">{log.action} {log.record?.title ? `· ${log.record.title}` : ''}</p>
                                        </div>
                                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Users Tab */}
                {tab === 'users' && (
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-healthcare-border">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">MFA</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b border-healthcare-border/50 hover:bg-white/[0.02]">
                                            <td className="px-4 py-3 text-sm text-white font-medium">{u.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-400">{u.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`badge ${u.role === 'DOCTOR' ? 'badge-doctor' : u.role === 'ADMIN' ? 'badge-admin' : 'badge-patient'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {u.mfaEnabled ? <span className="text-emerald-400">✓ Enabled</span> : <span className="text-gray-500">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Blockchain Tab */}
                {tab === 'blockchain' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <button onClick={verifyBlockchain} className="btn-primary">🔍 Verify Chain Integrity</button>
                            {chainValid && (
                                <div className={`p-3 rounded-xl text-sm ${chainValid.valid ? 'bg-emerald-900/30 border border-emerald-700/30 text-emerald-400' : 'bg-red-900/30 border border-red-700/30 text-red-400'}`}>
                                    {chainValid.valid ? '✓ ' : '✕ '}{chainValid.details}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            {blockchain.map((block, i) => (
                                <div key={block.index} className="glass-card p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-900/30 border border-indigo-800/30 flex items-center justify-center font-bold text-indigo-400">
                                                #{block.index}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">Block #{block.index}</p>
                                                <p className="text-xs text-gray-500">{new Date(parseInt(block.timestamp)).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex gap-2">
                                            <span className="text-gray-500 w-24 shrink-0">Hash:</span>
                                            <span className="text-emerald-400 font-mono break-all">{block.hash}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-gray-500 w-24 shrink-0">Prev Hash:</span>
                                            <span className="text-primary-400 font-mono break-all">{block.previousHash}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-gray-500 w-24 shrink-0">Data:</span>
                                            <span className="text-gray-300 font-mono">{JSON.stringify(block.data)}</span>
                                        </div>
                                    </div>
                                    {i < blockchain.length - 1 && (
                                        <div className="flex justify-center my-2 text-gray-600">🔗</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Audit Tab */}
                {tab === 'audit' && (
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-healthcare-border">
                            <p className="text-sm text-gray-400">Total: {allLogs.total} log entries (append-only, immutable)</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-healthcare-border">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Record</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Blockchain</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(allLogs.logs || []).map(log => (
                                        <tr key={log.id} className="border-b border-healthcare-border/50 hover:bg-white/[0.02]">
                                            <td className="px-4 py-3 text-sm text-gray-300">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-white">{log.user?.name || 'System'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`badge ${log.user?.role === 'DOCTOR' ? 'badge-doctor' : log.user?.role === 'ADMIN' ? 'badge-admin' : 'badge-patient'}`}>
                                                    {log.user?.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-300">{log.action}</td>
                                            <td className="px-4 py-3 text-sm text-gray-400">{log.record?.title || '—'}</td>
                                            <td className="px-4 py-3 text-xs">
                                                {log.blockchainHash ? (
                                                    <span className="text-emerald-400 font-mono">{log.blockchainHash.slice(0, 16)}...</span>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-primary-400 animate-pulse text-lg">Loading...</div></div>}>
            <AdminDashboardContent />
        </Suspense>
    );
}
