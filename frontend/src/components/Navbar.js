'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';

export default function Navbar() {
    const { user, logout } = useAuth();

    if (!user) return null;

    const navLinks = {
        PATIENT: [
            { href: '/dashboard/patient', label: 'My Records', icon: '📄' },
            { href: '/dashboard/patient?tab=consents', label: 'Consents', icon: '🤝' },
            { href: '/dashboard/patient?tab=audit', label: 'Audit Logs', icon: '📊' },
            { href: '/mfa', label: 'MFA', icon: '🔐' },
        ],
        DOCTOR: [
            { href: '/dashboard/doctor', label: 'Patient Records', icon: '📋' },
            { href: '/dashboard/doctor?tab=consents', label: 'My Consents', icon: '🤝' },
            { href: '/dashboard/doctor?tab=audit', label: 'Activity', icon: '📊' },
            { href: '/mfa', label: 'MFA', icon: '🔐' },
        ],
        ADMIN: [
            { href: '/dashboard/admin', label: 'Dashboard', icon: '📊' },
            { href: '/dashboard/admin?tab=users', label: 'Users', icon: '👥' },
            { href: '/dashboard/admin?tab=blockchain', label: 'Blockchain', icon: '🔗' },
            { href: '/dashboard/admin?tab=audit', label: 'Audit', icon: '📜' },
            { href: '/mfa', label: 'MFA', icon: '🔐' },
        ],
    };

    const roleColors = { PATIENT: 'badge-patient', DOCTOR: 'badge-doctor', ADMIN: 'badge-admin' };

    return (
        <nav className="sticky top-0 z-50 bg-healthcare-bg/80 backdrop-blur-xl border-b border-healthcare-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                            <span className="text-lg">🏥</span>
                        </div>
                        <span className="text-lg font-bold gradient-text hidden sm:block">HealthVault</span>
                    </div>

                    {/* Nav Links */}
                    <div className="flex items-center gap-1">
                        {(navLinks[user.role] || []).map((link) => (
                            <Link key={link.href} href={link.href}
                                className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                                <span className="mr-1.5">{link.icon}</span>
                                <span className="hidden md:inline">{link.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-white">{user.name}</p>
                            <span className={`badge ${roleColors[user.role]}`}>{user.role}</span>
                        </div>
                        <button onClick={logout}
                            className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
                            title="Logout">
                            🚪
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
