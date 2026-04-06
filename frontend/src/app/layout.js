import './globals.css';
import { AuthProvider } from '../lib/auth';

export const metadata = {
    title: 'HealthVault – Secure Healthcare Data Sharing',
    description: 'Privacy-preserving medical record sharing with AES-256 encryption, RBAC, and blockchain audit trails.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen antialiased">
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
