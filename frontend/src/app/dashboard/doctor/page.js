'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { recordsAPI, consentsAPI, auditAPI } from '../../../lib/api';
import Navbar from '../../../components/Navbar';

function DoctorDashboardContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'records';

    const [records, setRecords] = useState([]);
    const [consents, setConsents] = useState([]);
    const [logs, setLogs] = useState({ logs: [], total: 0 });
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [recordsRes, consentsRes, logsRes] = await Promise.all([
                recordsAPI.getAccessible(),
                consentsAPI.getMyConsents(),
                auditAPI.getLogs({ limit: 50 }),
            ]);
            setRecords(recordsRes.data.records);
            setConsents(consentsRes.data.consents);
            setLogs(logsRes.data);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
        if (!authLoading && user?.role !== 'DOCTOR') router.push('/login');
        if (user) fetchData();
    }, [user, authLoading, router, fetchData]);

    async function handleViewRecord(id) {
        setError('');
        setFilePreviewUrl(null);
        try {
            const { data } = await recordsAPI.getRecord(id);
            setSelectedRecord(data.record);

            // If record has a file, download it for inline preview
            if (data.record.hasFile) {
                const fileRes = await recordsAPI.downloadRecord(id);
                const blob = new Blob([fileRes.data], { type: data.record.fileType });
                const url = window.URL.createObjectURL(blob);
                setFilePreviewUrl(url);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Cannot view record. You may need consent from the patient.');
        }
    }

    function handleDownload() {
        if (!selectedRecord || !filePreviewUrl) return;

        // Build filename with proper extension
        const extMap = {
            'application/pdf': '.pdf',
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/gif': '.gif',
            'text/plain': '.txt',
        };
        const ext = extMap[selectedRecord.fileType] || '';
        const filename = selectedRecord.title.endsWith(ext)
            ? selectedRecord.title
            : `${selectedRecord.title}${ext}`;

        const a = document.createElement('a');
        a.href = filePreviewUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function closeModal() {
        setSelectedRecord(null);
        if (filePreviewUrl) {
            window.URL.revokeObjectURL(filePreviewUrl);
            setFilePreviewUrl(null);
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
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white">Doctor Dashboard</h1>
                    <p className="text-gray-400 mt-1">Welcome, {user?.name}</p>
                    <div className="flex gap-2 mt-2">
                        {user?.attributes?.department && (
                            <span className="badge badge-doctor">🏥 {user.attributes.department}</span>
                        )}
                        {user?.attributes?.specialization && (
                            <span className="badge badge-patient">⚕️ {user.attributes.specialization}</span>
                        )}
                    </div>
                </div>

                {error && <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-700/30 text-red-400">{error}</div>}

                {/* Tabs */}
                <div className="flex gap-2 mb-8 border-b border-healthcare-border pb-4">
                    {[
                        { key: 'records', label: '📋 Accessible Records', count: records.length },
                        { key: 'consents', label: '🤝 My Consents', count: consents.length },
                        { key: 'audit', label: '📊 Activity Log', count: logs.total },
                    ].map(t => (
                        <button key={t.key}
                            onClick={() => router.push(`/dashboard/doctor?tab=${t.key}`)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-purple-600/20 text-purple-400 border border-purple-700/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                                <p className="text-gray-500 text-lg">No accessible records. Patients must grant you consent first.</p>
                            </div>
                        ) : records.map(r => (
                            <div key={r.id} className="glass-card p-5 flex items-center justify-between hover:border-purple-700/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-800/30 flex items-center justify-center text-xl">
                                        {r.fileType?.includes('pdf') ? '📄' : r.fileType?.includes('image') ? '🖼️' : '📋'}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">{r.title}</h3>
                                        <p className="text-sm text-gray-400">{r.description || 'No description'}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-blue-400">👤 Patient: {r.patient?.name}</span>
                                            <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                                            {Object.keys(r.abePolicy || {}).length > 0 && (
                                                <span className="text-xs text-amber-400">🛡️ ABE: {JSON.stringify(r.abePolicy)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => handleViewRecord(r.id)} className="btn-secondary text-sm px-4 py-1.5">
                                    🔓 Decrypt & View
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Consents Tab */}
                {tab === 'consents' && (
                    <div className="space-y-4">
                        {consents.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <p className="text-gray-500">No consents received yet.</p>
                            </div>
                        ) : consents.map(c => (
                            <div key={c.id} className="glass-card p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`badge ${c.status === 'ACTIVE' ? 'badge-active' : c.status === 'REVOKED' ? 'badge-revoked' : 'badge-expired'}`}>
                                        {c.status}
                                    </span>
                                    <span className="text-white font-medium">From: {c.patient?.name}</span>
                                </div>
                                <p className="text-sm text-gray-400">
                                    {c.record ? `Record: ${c.record.title}` : 'All records'}
                                    {c.expiresAt && ` · Expires: ${new Date(c.expiresAt).toLocaleString()}`}
                                </p>
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
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Record</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(logs.logs || []).map(log => (
                                        <tr key={log.id} className="border-b border-healthcare-border/50 hover:bg-white/[0.02]">
                                            <td className="px-4 py-3 text-sm text-gray-300">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-gray-300">{log.action}</td>
                                            <td className="px-4 py-3 text-sm text-gray-400">{log.record?.title || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{log.details || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Record View Modal */}
                {selectedRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card p-8 w-full max-w-3xl animate-fade-in max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">{selectedRecord.title}</h2>
                                <button onClick={closeModal} className="text-gray-400 hover:text-white text-xl">✕</button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-gray-400">{selectedRecord.description}</p>

                                {/* Decrypted text data */}
                                {selectedRecord.data ? (
                                    <div className="p-4 rounded-xl bg-healthcare-surface border border-healthcare-border">
                                        <h3 className="text-sm font-medium text-gray-400 mb-2">🔓 Decrypted Medical Data</h3>
                                        <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap">
                                            {typeof selectedRecord.data === 'string'
                                                ? (() => { try { return JSON.stringify(JSON.parse(selectedRecord.data), null, 2); } catch { return selectedRecord.data; } })()
                                                : JSON.stringify(selectedRecord.data, null, 2)}
                                        </pre>
                                    </div>
                                ) : null}

                                {/* Inline file preview */}
                                {filePreviewUrl && selectedRecord.hasFile && (
                                    <div className="p-4 rounded-xl bg-healthcare-surface border border-healthcare-border">
                                        <h3 className="text-sm font-medium text-gray-400 mb-2">
                                            📎 File Preview ({selectedRecord.fileType?.split('/')[1] || 'file'})
                                        </h3>
                                        {selectedRecord.fileType?.startsWith('image/') ? (
                                            <img
                                                src={filePreviewUrl}
                                                alt={selectedRecord.title}
                                                className="max-w-full max-h-[60vh] rounded-lg object-contain mx-auto"
                                            />
                                        ) : selectedRecord.fileType === 'application/pdf' ? (
                                            <div className="w-full h-[60vh] rounded-lg overflow-auto bg-white">
                                                <object
                                                    data={filePreviewUrl}
                                                    type="application/pdf"
                                                    className="w-full h-full"
                                                >
                                                    <p className="p-4 text-center text-gray-500">PDF preview not supported in this browser. Use the download button below.</p>
                                                </object>
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-gray-400">
                                                <p>Preview not available for this file type.</p>
                                                <p className="text-xs mt-1">Use the download button below to view the file.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Download button */}
                                {selectedRecord.hasFile && (
                                    <button onClick={handleDownload}
                                        className="btn-secondary text-sm px-4 py-1.5 w-full">
                                        📥 Download {selectedRecord.fileType?.split('/')[1] || 'File'}
                                    </button>
                                )}

                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span>Patient: {selectedRecord.patient?.name}</span>
                                    <span>Created: {new Date(selectedRecord.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function DoctorDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-primary-400 animate-pulse text-lg">Loading...</div></div>}>
            <DoctorDashboardContent />
        </Suspense>
    );
}
