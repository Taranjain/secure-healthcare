# Secure Healthcare Data Sharing Platform

<div align="center">

**🏥 HealthVault** – Privacy-preserving medical record sharing with military-grade encryption, blockchain audit trails, and granular consent management.

</div>

---

## 🏗️ Architecture

```
┌──────────────────────┐     ┌─────────────────────────────────────────┐
│  Next.js Frontend    │     │           Express Backend               │
│  (Port 3000)         │────▶│  (Port 4000)                            │
│  - Patient Dashboard │     │  ┌─────────────────────────────────┐    │
│  - Doctor Dashboard  │     │  │ Middleware: Auth│RBAC│Consent│   │    │
│  - Admin Dashboard   │     │  │   Rate Limit│Validation          │    │
│  - Auth + MFA        │     │  └─────────────────────────────────┘    │
└──────────────────────┘     │  ┌─────────────────────────────────┐    │
                             │  │ Services: AES-256│Blockchain│   │    │
                             │  │   MFA│ABE│Audit                  │    │
                             │  └─────────────────────────────────┘    │
                             └──────────┬────────────┬─────────────────┘
                                        │            │
                               ┌────────▼──┐  ┌──────▼────┐
                               │ PostgreSQL │  │   Redis   │
                               │ (Port 5432)│  │(Port 6379)│
                               └────────────┘  └───────────┘
```

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| Encryption | AES-256-GCM with envelope encryption (per-record DEK + master key) |
| Authentication | JWT access + refresh tokens, bcrypt password hashing |
| MFA | TOTP-based (Google Authenticator compatible), required for doctors/admins |
| Authorization | Role-Based (Patient/Doctor/Admin) + Attribute-Based Encryption policies |
| Consent | Patient-controlled, per-record or blanket, time-limited with auto-expiry |
| Audit Trail | Append-only access logs + SHA-256 blockchain hash chain |
| API Security | Helmet headers, CORS, rate limiting, input validation/sanitization |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)

### 1. Clone & Configure
```bash
cd healthcare-platform
cp .env.example .env
# Edit .env if needed (defaults work for development)
```

### 2. Start with Docker
```bash
docker compose up --build
```

### 3. Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **API Docs (Swagger)**: http://localhost:4000/api-docs
- **Health Check**: http://localhost:4000/api/health

### 4. Demo Credentials
| Role | Email | Password | MFA |
|------|-------|----------|-----|
| Patient | patient@demo.com | Patient@123 | No |
| Doctor | doctor@demo.com | Doctor@123 | Yes (see container logs for secret) |
| Admin | admin@demo.com | Admin@123 | Yes (see container logs for secret) |

> **MFA Setup**: Check `docker compose logs backend` for the MFA secrets. Enter them in Google Authenticator or any TOTP app.

## 🗄️ PostgreSQL Connection

| Setting | Value |
|---------|-------|
| **Host** | `localhost` (from host) or `postgres` (from Docker network) |
| **Port** | 5432 |
| **User** | `healthcare` |
| **Password** | `healthcare_secret_2024` (from .env) |
| **Database** | `healthcare_db` |
| **URL** | `postgresql://healthcare:healthcare_secret_2024@localhost:5432/healthcare_db` |

## 📁 Project Structure
```
healthcare-platform/
├── docker-compose.yml          # Container orchestration
├── .env                        # Environment variables
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.js             # Test data seeder
│   └── src/
│       ├── app.js              # Express app + Swagger
│       ├── server.js           # Entry point
│       ├── config/             # Environment config
│       ├── middleware/          # Auth, RBAC, Consent, Rate Limit, Validation
│       ├── controllers/        # Auth, Records, Consents, Audit, Admin
│       ├── services/           # Encryption, ABE, Blockchain, MFA, Audit
│       └── routes/             # API route definitions
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/                # Next.js pages (login, register, dashboards)
│       ├── components/         # Navbar
│       └── lib/                # API client, Auth context
└── uploads/                    # Encrypted file storage (Docker volume)
```

## 🔌 API Endpoints

### Auth (`/api/auth`)
- `POST /register` – Register user (public)
- `POST /login` – Login, returns JWT or MFA challenge (public)
- `POST /verify-mfa` – Verify TOTP and get tokens (public)
- `POST /refresh` – Refresh access token
- `POST /setup-mfa` – Enable MFA (authenticated)
- `GET /profile` – Get current user profile (authenticated)

### Records (`/api/records`)
- `POST /` – Upload & encrypt record (Patient)
- `GET /my` – List own records (Patient)
- `GET /accessible` – List consented records (Doctor)
- `GET /:id` – View decrypted record (consent required)
- `GET /:id/download` – Download decrypted file (consent required)
- `DELETE /:id` – Delete record (Patient, own only)

### Consents (`/api/consents`)
- `POST /` – Grant consent to doctor (Patient)
- `GET /my` – List consents (given or received)
- `PATCH /:id/revoke` – Revoke consent (Patient)
- `GET /doctors` – List all doctors (for consent UI)

### Audit (`/api/audit`)
- `GET /logs` – Access logs (role-filtered)
- `GET /blockchain` – View blockchain (Admin)
- `GET /blockchain/verify` – Verify chain integrity

### Admin (`/api/admin`)
- `GET /users` – List all users
- `GET /dashboard` – System statistics

## 🧪 Demo Workflow

1. **Login as Patient** → `patient@demo.com / Patient@123`
2. **Upload a record** → Data is AES-256 encrypted before storage
3. **Grant consent** → Select a doctor, optionally set expiry
4. **Login as Doctor** → `doctor@demo.com / Doctor@123` (MFA required)
5. **View patient record** → Data is decrypted and audit-logged
6. **Check audit logs** → Every access is recorded with blockchain hash
7. **Login as Admin** → View dashboard, verify blockchain integrity

## ⚠️ Production Notes

- Generate real secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Use HTTPS (add reverse proxy like Nginx/Caddy)
- Enable Redis password authentication
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Use a key management service (AWS KMS, HashiCorp Vault) for the master encryption key
