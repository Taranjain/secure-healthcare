'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { recordsAPI, consentsAPI, auditAPI } from '../../../lib/api';
import Navbar from '../../../components/Navbar';

function PatientDashboardContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'records';

    const [records, setRecords] = useState([]);
    const [consents, setConsents] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [logs, setLogs] = useState({ logs: [], total: 0 });
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Upload form
    const [showUpload, setShowUpload] = useState(false);
    const [uploadForm, setUploadForm] = useState({ title: '', description: '', data: '', file: null });

    // Consent form
    const [showConsent, setShowConsent] = useState(false);
    const [consentForm, setConsentForm] = useState({ doctorId: '', recordId: '', expiresAt: '' });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [recordsRes, consentsRes, doctorsRes, logsRes] = await Promise.all([
                recordsAPI.getMyRecords(),
                consentsAPI.getMyConsents(),
                consentsAPI.listDoctors(),
                auditAPI.getLogs({ limit: 50 }),
            ]);
            setRecords(recordsRes.data.records);
            setConsents(consentsRes.data.consents);
            setDoctors(doctorsRes.data.doctors);
            setLogs(logsRes.data);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
        if (!authLoading && user?.role !== 'PATIENT') router.push('/login');
        if (user) fetchData();
    }, [user, authLoading, router, fetchData]);

    async function handleUpload(e) {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
            const formData = new FormData();
            formData.append('title', uploadForm.title);
            formData.append('description', uploadForm.description);
            if (uploadForm.data) formData.append('data', uploadForm.data);
            if (uploadForm.file) formData.append('file', uploadForm.file);
            await recordsAPI.create(formData);
            setSuccess('Record uploaded and encrypted successfully!');
            setShowUpload(false);
            setUploadForm({ title: '', description: '', data: '', file: null });
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Upload failed');
        }
    }

    async function handleGrantConsent(e) {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
            await consentsAPI.grant({
                doctorId: consentForm.doctorId,
                recordId: consentForm.recordId || null,
                expiresAt: consentForm.expiresAt || null,
            });
            setSuccess('Consent granted successfully!');
            setShowConsent(false);
            setConsentForm({ doctorId: '', recordId: '', expiresAt: '' });
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to grant consent');
        }
    }

    async function handleRevokeConsent(id) {
        try {
            await consentsAPI.revoke(id);
            setSuccess('Consent revoked');
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to revoke');
        }
    }

    async function handleViewRecord(id) {
        try {
            const { data } = await recordsAPI.getRecord(id);
            setSelectedRecord(data.record);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to view record');
        }
    }

    async function handleDeleteRecord(id) {
        if (!confirm('Delete this record permanently?')) return;
        try {
            await recordsAPI.deleteRecord(id);
            setSuccess('Record deleted');
            setSelectedRecord(null);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete');
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-primary-400 animate-pulse text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Patient Dashboard</h1>
                        <p className="text-gray-400 mt-1">Welcome, {user?.name}</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowUpload(true)} className="btn-primary">📤 Upload Record</button>
                        <button onClick={() => setShowConsent(true)} className="btn-secondary">🤝 Grant Access</button>
                    </div>
                </div>

                {/* Alerts */}
                {error && <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/30 text-red-400">{error}</div>}
                {success && <div className="mb-6 p-3 rounded-xl bg-emerald-900/30 border border-emerald-700/30 text-emerald-400">{success}</div>}

                {/* Tabs */}
                <div className="flex gap-2 mb-8 border-b border-healthcare-border pb-4">
                    {[
                        { key: 'records', label: '📄 My Records', count: records.length },
                        { key: 'consents', label: '🤝 Consents', count: consents.length },
                        { key: 'audit', label: '📊 Audit Logs', count: logs.total },
                    ].map(t => (
                        <button key={t.key}
                            onClick={() => router.push(`/dashboard/patient?tab=${t.key}`)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-primary-600/20 text-primary-400 border border-primary-700/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}>
                            {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
                        </button>
                    ))}
                </div>

                {/* Records Tab */}
                {tab === 'records' && (
                    <div className="space-y-4">
                        {records.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <p className="text-gray-500 text-lg">No records yet. Upload your first medical record.</p>
                            </div>
                        ) : records.map(r => (
                            <div key={r.id} className="glass-card p-5 flex items-center justify-between hover:border-primary-700/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary-900/30 border border-primary-800/30 flex items-center justify-center text-xl">
                                        {r.fileType?.includes('pdf') ? '📄' : r.fileType?.includes('image') ? '🖼️' : '📋'}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">{r.title}</h3>
                                        <p className="text-sm text-gray-400">{r.description || 'No description'}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-gray-500">🔒 Encrypted</span>
                                            <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                                            {Object.keys(r.abePolicy || {}).length > 0 && (
                                                <span className="text-xs text-amber-400">🛡️ ABE Protected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleViewRecord(r.id)} className="btn-secondary text-sm px-4 py-1.5">View</button>
                                    <button onClick={() => handleDeleteRecord(r.id)} className="btn-danger text-sm px-4 py-1.5">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Consents Tab */}
                {tab === 'consents' && (
                    <div className="space-y-4">
                        {consents.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <p className="text-gray-500">No consents granted yet.</p>
                            </div>
                        ) : consents.map(c => (
                            <div key={c.id} className="glass-card p-5 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className={`badge ${c.status === 'ACTIVE' ? 'badge-active' : c.status === 'REVOKED' ? 'badge-revoked' : 'badge-expired'}`}>
                                            {c.status}
                                        </span>
                                        <span className="text-white font-medium">Dr. {c.doctor?.name || 'Unknown'}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {c.record ? `Record: ${c.record.title}` : 'All records'}
                                        {c.expiresAt && ` · Expires: ${new Date(c.expiresAt).toLocaleString()}`}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Granted: {new Date(c.createdAt).toLocaleString()}</p>
                                </div>
                                {c.status === 'ACTIVE' && (
                                    <button onClick={() => handleRevokeConsent(c.id)} className="btn-danger text-sm px-4 py-1.5">Revoke</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Audit Tab */}
                {tab === 'audit' && (
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-healthcare-border">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Record</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Blockchain</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(logs.logs || []).map(log => (
                                        <tr key={log.id} className="border-b border-healthcare-border/50 hover:bg-white/[0.02]">
                                            <td className="px-4 py-3 text-sm text-gray-300">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="text-white">{log.user?.name || 'System'}</span>
                                                <span className={`ml-2 badge ${log.user?.role === 'DOCTOR' ? 'badge-doctor' : log.user?.role === 'ADMIN' ? 'badge-admin' : 'badge-patient'}`}>
                                                    {log.user?.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-300">{log.action}</td>
                                            <td className="px-4 py-3 text-sm text-gray-400">{log.record?.title || '—'}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {log.blockchainHash ? (
                                                    <span className="text-emerald-400 font-mono text-xs">{log.blockchainHash.slice(0, 12)}...</span>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Upload Modal */}
                {showUpload && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card p-8 w-full max-w-lg animate-fade-in">
                            <h2 className="text-xl font-bold text-white mb-6">📤 Upload Medical Record</h2>
                            <form onSubmit={handleUpload} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                                    <input type="text" value={uploadForm.title} onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
                                        className="input-field" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                    <textarea value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                                        className="input-field" rows={2} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Medical Data (text)</label>
                                    <textarea value={uploadForm.data} onChange={e => setUploadForm(p => ({ ...p, data: e.target.value }))}
                                        className="input-field font-mono text-sm" rows={4} placeholder='{"diagnosis": "...", "prescription": "..."}' />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">File (PDF/Image)</label>
                                    <input type="file" onChange={e => setUploadForm(p => ({ ...p, file: e.target.files[0] }))}
                                        accept=".pdf,.png,.jpg,.jpeg,.gif" className="input-field" />
                                </div>
                                <div className="p-3 rounded-xl bg-primary-900/20 border border-primary-700/20 text-primary-400 text-sm">
                                    🔒 Data will be encrypted with AES-256-GCM before storage
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="submit" className="btn-primary flex-1">Encrypt & Upload</button>
                                    <button type="button" onClick={() => setShowUpload(false)} className="btn-secondary flex-1">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Consent Modal */}
                {showConsent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card p-8 w-full max-w-lg animate-fade-in">
                            <h2 className="text-xl font-bold text-white mb-6">🤝 Grant Consent</h2>
                            <form onSubmit={handleGrantConsent} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Doctor *</label>
                                    <select value={consentForm.doctorId} onChange={e => setConsentForm(p => ({ ...p, doctorId: e.target.value }))}
                                        className="input-field" required>
                                        <option value="">Choose a doctor...</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.email})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Specific Record (optional)</label>
                                    <select value={consentForm.recordId} onChange={e => setConsentForm(p => ({ ...p, recordId: e.target.value }))}
                                        className="input-field">
                                        <option value="">All records</option>
                                        {records.map(r => (
                                            <option key={r.id} value={r.id}>{r.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Expires At (optional)</label>
                                    <input type="datetime-local" value={consentForm.expiresAt}
                                        onChange={e => setConsentForm(p => ({ ...p, expiresAt: e.target.value }))}
                                        className="input-field" />
                                    <p className="text-xs text-gray-500 mt-1">Leave empty for no expiry</p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="submit" className="btn-primary flex-1">Grant Access</button>
                                    <button type="button" onClick={() => setShowConsent(false)} className="btn-secondary flex-1">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Record View Modal */}
                {selectedRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card p-8 w-full max-w-2xl animate-fade-in max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">{selectedRecord.title}</h2>
                                <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-gray-400">{selectedRecord.description}</p>
                                <div className="p-4 rounded-xl bg-healthcare-surface border border-healthcare-border">
                                    <h3 className="text-sm font-medium text-gray-400 mb-2">🔓 Decrypted Medical Data</h3>
                                    <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap overflow-x-auto">
                                        {typeof selectedRecord.data === 'string'
                                            ? (() => { try { return JSON.stringify(JSON.parse(selectedRecord.data), null, 2); } catch { return selectedRecord.data; } })()
                                            : JSON.stringify(selectedRecord.data, null, 2)}
                                    </pre>
                                </div>
                                {selectedRecord.hasFile && (
                                    <div className="p-4 rounded-xl bg-primary-900/20 border border-primary-700/20">
                                        <p className="text-primary-400 text-sm">📎 This record has an attached file ({selectedRecord.fileType})</p>
                                    </div>
                                )}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span>Created: {new Date(selectedRecord.createdAt).toLocaleString()}</span>
                                    <span>Patient: {selectedRecord.patient?.name}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function PatientDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-primary-400 animate-pulse text-lg">Loading...</div></div>}>
            <PatientDashboardContent />
        </Suspense>
    );
}
