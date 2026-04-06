# Secure Healthcare Data Sharing Platform (HealthVault)
## Complete Project Documentation

---

## 1. Project Overview

HealthVault is a **production-grade, privacy-preserving web application** for sharing medical records between patients, doctors, and administrators. It demonstrates real-world cybersecurity principles including:

- AES-256-GCM **envelope encryption** for medical data at rest
- JWT-based **authentication** with TOTP **multi-factor authentication**
- Patient-controlled **consent-based access** to medical records
- SHA-256 hash-chain **blockchain audit trail** for tamper detection
- **Role-Based Access Control (RBAC)** with three roles: Patient, Doctor, Admin
- Attribute-Based Encryption (**ABE**) policy enforcement

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Axios |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL 15 (via Prisma ORM) |
| **Cache** | Redis 7 |
| **Auth** | JSON Web Tokens (JWT), bcrypt, otplib (TOTP) |
| **Encryption** | Node.js `crypto` module (AES-256-GCM) |
| **File Upload** | Multer |
| **API Docs** | Swagger / OpenAPI 3.0 |
| **Containerization** | Docker, Docker Compose |

---

## 3. Project Structure

```
healthcare-platform/
├── docker-compose.yml          # Orchestrates all 4 services
├── .env                        # Environment variables (secrets)
├── .env.example                # Template for .env
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (6 models)
│   │   └── seed.js             # Seeds demo users & sample records
│   └── src/
│       ├── server.js            # Entry point
│       ├── app.js               # Express app setup, middleware, Swagger
│       ├── config/index.js      # Centralised config from env vars
│       ├── controllers/
│       │   ├── authController.js     # Login, Register, MFA, Token Refresh
│       │   ├── recordController.js   # CRUD for encrypted medical records
│       │   ├── consentController.js  # Grant, Revoke, List consents
│       │   ├── auditController.js    # Audit logs & blockchain verify
│       │   └── adminController.js    # System stats, user management
│       ├── middleware/
│       │   ├── auth.js              # JWT verification middleware
│       │   ├── rbac.js              # Role-based access control
│       │   └── consentCheck.js      # Verifies active consent before record access
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── recordRoutes.js
│       │   ├── consentRoutes.js
│       │   ├── auditRoutes.js
│       │   └── adminRoutes.js
│       └── services/
│           ├── encryptionService.js  # AES-256-GCM envelope encryption
│           ├── blockchainService.js  # SHA-256 hash-chain audit trail
│           ├── auditService.js       # Audit log + blockchain integration
│           ├── mfaService.js         # TOTP MFA (QR code, verify)
│           └── abeService.js         # Attribute-Based Encryption policies
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/
        ├── app/
        │   ├── layout.js            # Root layout with AuthProvider
        │   ├── globals.css           # Design system (glassmorphism, gradients)
        │   ├── page.js              # Landing page
        │   ├── login/page.js        # Login + MFA challenge
        │   ├── register/page.js     # Registration + auto MFA setup
        │   ├── mfa/page.js          # MFA management page
        │   └── dashboard/
        │       ├── patient/page.js  # Patient dashboard
        │       ├── doctor/page.js   # Doctor dashboard
        │       └── admin/page.js    # Admin dashboard
        ├── components/
        │   └── Navbar.js            # Role-aware navigation bar
        └── lib/
            ├── api.js               # Axios API client with interceptors
            └── auth.js              # React Context for auth state
```

---

## 4. Database Schema (Prisma)

### 4.1 Users
```
User {
  id, email, passwordHash, name, role (PATIENT|DOCTOR|ADMIN),
  attributes (JSON), mfaEnabled, mfaSecret, timestamps
}
```
- Passwords are hashed with bcrypt (12 salt rounds)
- `attributes` stores role-specific data (department, specialization, etc.)

### 4.2 MedicalRecord
```
MedicalRecord {
  id, patientId, title, description,
  encryptedData (AES-256-GCM ciphertext),
  encryptionIV, encryptionTag, encryptedKey (envelope-encrypted DEK),
  fileType, filePath, abePolicy (JSON), timestamps
}
```

### 4.3 Consent
```
Consent {
  id, patientId, doctorId, recordId (null = all records),
  status (ACTIVE|REVOKED|EXPIRED), expiresAt, timestamps
}
```

### 4.4 AccessLog
```
AccessLog {
  id, userId, recordId, action, ipAddress, userAgent,
  details, blockchainHash, timestamp
}
```

### 4.5 BlockchainBlock
```
BlockchainBlock {
  index (auto-increment PK), previousHash, hash,
  data (JSON), timestamp (BigInt), nonce
}
```

### 4.6 OtpToken
```
OtpToken { id, userId, otp, expiresAt, used, createdAt }
```

---

## 5. Feature Deep Dive

### 5.1 AES-256-GCM Envelope Encryption

**What it is:** Every medical record is encrypted with a unique random key (DEK), and that key itself is encrypted by a master key (KEK). This is the same pattern AWS KMS uses.

**How it works step by step:**

1. Patient uploads a record (text data or file).
2. System generates a random 32-byte **Data Encryption Key (DEK)**.
3. The record data is encrypted using AES-256-GCM with that DEK.
   - This produces: `encryptedData`, `iv` (16-byte initialization vector), `tag` (16-byte GCM authentication tag).
4. The DEK is then encrypted using the **Master Encryption Key** from `.env` → stored as `encryptedKey` in format `iv:tag:encrypted`.
5. The original DEK is discarded from memory.
6. On decryption: Master Key decrypts the DEK → DEK decrypts the data.

**Why GCM mode specifically?** GCM provides **authenticated encryption** — if anyone modifies even one bit of the ciphertext, the authentication tag check fails and decryption is rejected. This prevents tampering.

**File encryption** uses the same approach but operates on raw buffers instead of text strings.

### 5.2 JWT Authentication

**Flow:**
1. User submits email + password.
2. Backend verifies password hash with bcrypt.
3. If MFA is enabled → returns `{ mfaRequired: true, tempToken }`. User must provide TOTP code.
4. If MFA passes (or not required) → issues:
   - **Access Token** (expires in 15 minutes)
   - **Refresh Token** (expires in 7 days)
5. Frontend stores tokens in `localStorage` and sends `Authorization: Bearer <token>` on every API call.
6. When access token expires, the Axios interceptor automatically calls `/auth/refresh` with the refresh token.

### 5.3 Multi-Factor Authentication (MFA / TOTP)

**What is TOTP?** Time-based One-Time Password. Both your phone and the server share a secret key. Both independently generate a 6-digit code based on the current time (in 30-second windows). If the codes match, you're verified.

**Setup flow:**
1. Server generates a random TOTP secret using `otplib`.
2. Server creates a QR code URL (`otpauth://totp/...`) and converts it to a data URL image.
3. User scans QR code with Google Authenticator / Authy / any TOTP app.
4. The app stores the secret and starts generating codes.

**Login flow with MFA:**
1. User enters email + password → backend responds with `mfaRequired: true` and a `tempToken`.
2. Frontend shows OTP input field.
3. User opens their authenticator app, reads the current 6-digit code, types it in.
4. Backend verifies the code against the stored secret using `authenticator.verify()`.
5. If valid → issues JWT tokens and logs user in.

**How to test with the seeded Doctor account:**
1. When Docker starts, the backend logs print: `MFA Secret: XXXXXXXXXXXXXXXX`
2. Open Google Authenticator → Add → Manual Entry → paste that secret.
3. Log in as `doctor@demo.com` / `Doctor@123`.
4. Enter the 6-digit code from your authenticator app.

### 5.4 Patient Consent Layer

**Rules:**
- A Patient's records are **only accessible to that Patient** by default.
- A Patient can **grant consent** to a specific Doctor.
- Consent can be:
  - For **all records** (recordId = null)
  - For a **specific record** (recordId set)
  - **Time-limited** (expiresAt set)
  - **Permanent** (expiresAt = null)
- Patients can **revoke consent** at any time (sets status to REVOKED).
- The `consentCheck` middleware runs before any record access endpoint for Doctors.

**How consent check works (middleware):**
```
1. Doctor requests GET /api/records/:id
2. consentCheck middleware runs:
   a. Find all ACTIVE consents where doctorId = this doctor
   b. Check if any consent covers this specific record
      (either recordId matches, or consent covers all records for this patient)
   c. Check consent hasn't expired
3. If no valid consent → return 403 Forbidden
4. If consent exists → proceed to record controller
```

### 5.5 Blockchain Audit Trail

**What it is:** A SHA-256 hash chain that makes audit logs tamper-proof.

**How it works:**
1. Every sensitive action creates an audit log entry.
2. The audit service also calls `blockchainService.addBlock()`.
3. `addBlock()` gets the latest block's hash, combines it with the new data, and computes a new SHA-256 hash.
4. The formula: `hash = SHA256(index + previousHash + deterministicStringify(data) + timestamp + nonce)`
5. Each block's `previousHash` points to the last block's `hash`, forming a chain.

**Why it detects tampering:**
- If someone modifies any data in block #5, its hash changes.
- Block #6's `previousHash` no longer matches block #5's hash.
- The `verifyChain()` function recalculates every hash and checks every link.

**Admin verification:** The Admin dashboard has a "Verify Blockchain" button that calls `GET /api/audit/verify-chain`. It recalculates all hashes and reports whether the chain is intact.

### 5.6 Attribute-Based Encryption (ABE) Policies

**What it is:** An extra layer of access control beyond consents. Even with consent, a doctor may need specific attributes (like being in the Cardiology department) to view certain records.

**How it works:**
- When creating a record, a patient can set an `abePolicy` like `{ role: "DOCTOR", department: "Cardiology" }`.
- When a doctor tries to view that record, the system checks the doctor's `attributes` JSON against the policy.
- If the doctor's attributes don't match the policy, access is denied even with active consent.

### 5.7 Role-Based Access Control (RBAC)

| Action | Patient | Doctor | Admin |
|--------|---------|--------|-------|
| Upload records | ✅ Own | ❌ | ❌ |
| View own records | ✅ | N/A | ❌ |
| View patient records | N/A | ✅ With consent | ❌ |
| Grant/revoke consent | ✅ | ❌ | ❌ |
| View audit logs | ✅ Own | ✅ Own | ✅ All |
| Verify blockchain | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| System stats | ❌ | ❌ | ✅ |

---

## 6. API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT or MFA challenge) |
| POST | `/api/auth/verify-mfa` | Verify TOTP code |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/profile` | Get current user profile |
| POST | `/api/auth/mfa/setup` | Generate MFA QR code |

### Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/records` | Upload encrypted record (Patient only) |
| GET | `/api/records/my` | List own records (Patient) |
| GET | `/api/records/accessible` | List consented records (Doctor) |
| GET | `/api/records/:id` | View decrypted record |
| GET | `/api/records/:id/download` | Download decrypted file |
| DELETE | `/api/records/:id` | Delete own record (Patient) |

### Consents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/consents` | Grant consent to a doctor |
| GET | `/api/consents/my` | List my consents |
| PUT | `/api/consents/:id/revoke` | Revoke a consent |
| GET | `/api/consents/doctors` | List available doctors |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/logs` | Get audit logs |
| GET | `/api/audit/verify-chain` | Verify blockchain integrity |
| GET | `/api/audit/chain` | Get blockchain blocks |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | System statistics |
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Change user role |

---

## 7. Security Middleware Pipeline

Every request passes through:

```
Request
  → helmet()           # Security headers (CSP, HSTS, X-Frame-Options)
  → cors()             # Cross-origin protection
  → rateLimit()        # 100 requests per 15 min per IP
  → express.json()     # Body parsing (10kb limit)
  → morgan()           # Request logging
  → auth()             # JWT token verification (on protected routes)
  → rbac()             # Role authorization check
  → consentCheck()     # Consent verification (on record access)
  → Controller         # Business logic
```

---

## 8. How to Build From Scratch

### Step 1: Initialize the Backend

```bash
mkdir healthcare-platform && cd healthcare-platform
mkdir backend && cd backend
npm init -y
npm install express cors helmet morgan multer bcrypt jsonwebtoken otplib qrcode
npm install @prisma/client express-rate-limit express-validator joi swagger-ui-express
npm install -D prisma nodemon
npx prisma init
```

### Step 2: Define the Database Schema
Create `prisma/schema.prisma` with models for User, MedicalRecord, Consent, AccessLog, BlockchainBlock, OtpToken.

### Step 3: Build Core Services
1. **encryptionService.js** — Implement `encrypt()`, `decrypt()`, `encryptDEK()`, `decryptDEK()`, `encryptRecord()`, `decryptRecord()`, `encryptFile()`, `decryptFile()`.
2. **blockchainService.js** — Implement `calculateHash()`, `initializeChain()`, `addBlock()`, `verifyChain()`.
3. **auditService.js** — Wrapper that creates AccessLog + blockchain block.
4. **mfaService.js** — TOTP setup (QR code generation) and verification.
5. **abeService.js** — Attribute policy validation and checking.

### Step 4: Build Controllers
1. **authController.js** — register, login, verifyMFA, refreshToken, getProfile, setupMFA.
2. **recordController.js** — createRecord, getMyRecords, getAccessibleRecords, getRecord, downloadRecord, deleteRecord.
3. **consentController.js** — grantConsent, getMyConsents, revokeConsent, listDoctors.
4. **auditController.js** — getLogs, verifyChain, getChain.
5. **adminController.js** — getStats, getUsers, updateUserRole.

### Step 5: Build Middleware
1. **auth.js** — Extract and verify JWT from Authorization header.
2. **rbac.js** — Check `req.user.role` against allowed roles.
3. **consentCheck.js** — Query consents table before record access.

### Step 6: Wire Routes
Create route files that map HTTP methods to controllers with appropriate middleware.

### Step 7: Create Express App
Set up `app.js` with all middleware, routes, Swagger docs, error handling.

### Step 8: Initialize the Frontend

```bash
cd .. && mkdir frontend && cd frontend
npm init -y
npm install next@14 react react-dom axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 9: Build Frontend Pages
1. **layout.js** — Root layout with AuthProvider context.
2. **globals.css** — Design system (glassmorphism, gradients, animations).
3. **page.js** — Landing page with hero section and feature cards.
4. **login/page.js** — Login form with MFA challenge flow.
5. **register/page.js** — Registration with role selection and auto MFA.
6. **mfa/page.js** — MFA management (enable/reset).
7. **dashboard/patient/page.js** — Record upload, consent management, audit logs.
8. **dashboard/doctor/page.js** — Consented records viewer.
9. **dashboard/admin/page.js** — System stats, user list, blockchain verification.

### Step 10: Build Shared Frontend Code
1. **lib/api.js** — Axios instance with base URL, auth interceptor, token refresh.
2. **lib/auth.js** — React Context for user state, login/logout functions.
3. **components/Navbar.js** — Role-aware navigation.

### Step 11: Dockerize

Create `backend/Dockerfile`, `frontend/Dockerfile`, and `docker-compose.yml` with PostgreSQL, Redis, Backend, and Frontend services.

### Step 12: Seed Database

Create `prisma/seed.js` to create demo users with proper password hashing and MFA secrets.

---

## 9. Environment Variables

```env
# PostgreSQL
POSTGRES_USER=healthcare
POSTGRES_PASSWORD=<strong_password>
POSTGRES_DB=healthcare_db
DATABASE_URL=postgresql://<user>:<pass>@postgres:5432/healthcare_db

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=development
PORT=4000

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=<64-byte-hex>
JWT_REFRESH_SECRET=<64-byte-hex>

# AES-256 Master Key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
MASTER_ENCRYPTION_KEY=<32-byte-hex = 64 hex characters>

# MFA
MFA_ISSUER=HealthcarePlatform

# Frontend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

> **CRITICAL:** The `MASTER_ENCRYPTION_KEY` must remain constant. If changed, all previously encrypted records become permanently unreadable.

---

## 10. Running the Project

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your values

# 2. Start everything
docker compose up --build

# 3. Access points
# Frontend:  http://localhost:3000
# Backend:   http://localhost:4000/api
# Swagger:   http://localhost:4000/api-docs

# 4. Reset database (wipes all data)
docker compose down -v
docker compose up --build
```

### Demo Credentials (auto-seeded)
| Role | Email | Password | MFA |
|------|-------|----------|-----|
| Patient | patient@demo.com | Patient@123 | No |
| Doctor | doctor@demo.com | Doctor@123 | Yes (secret in logs) |
| Admin | admin@demo.com | Admin@123 | Yes (secret in logs) |

---

## 11. Testing the Full Workflow

### Step 1: Login as Patient
- Go to `http://localhost:3000/login`
- Enter `patient@demo.com` / `Patient@123`
- You land on the Patient Dashboard

### Step 2: Upload a Medical Record
- Click "Upload Record"
- Enter a title (e.g., "Blood Test Results")
- Enter medical data text (e.g., "Hemoglobin: 14.2 g/dL, WBC: 7500")
- Optionally attach a PDF/image file
- Click Upload — the data is encrypted with AES-256-GCM before storage

### Step 3: Grant Consent to Doctor
- Go to the "Consents" tab
- Click "Grant Consent"
- Select the doctor from the dropdown
- Optionally select a specific record or leave blank for all records
- Optionally set an expiration date
- Click Grant

### Step 4: Login as Doctor
- Logout → Go to Login
- Enter `doctor@demo.com` / `Doctor@123`
- Open Google Authenticator and enter the 6-digit TOTP code
- You land on the Doctor Dashboard

### Step 5: View Patient's Record
- You should see the patient's records in "Accessible Records"
- Click a record to view it
- The record is decrypted on the server only if consent is active
- The decrypted medical data appears in the modal

### Step 6: Check Audit Logs (Admin)
- Logout → Login as admin (with MFA)
- View "Audit" tab — all actions (uploads, views, consents) are logged
- Click "Verify Blockchain" — should show all blocks intact

---

## 12. Common Issues & Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `[Decryption failed]` | Records encrypted with a different master key | Reset DB: `docker compose down -v && docker compose up --build` |
| Blockchain shows tampering | Old blocks used non-deterministic JSON | Reset DB to clear old blocks |
| Can't type in login/register | CSS gradient-border overlay | Fixed with `pointer-events: none` in globals.css |
| MFA code rejected | Time sync issue between phone and server | Ensure phone time is auto-synced |
| `ERR_CONNECTION_REFUSED` on frontend | Backend not ready yet | Wait a few seconds for all containers to start |

---

## 13. Key Security Principles Demonstrated

1. **Defense in Depth** — Multiple layers: encryption + auth + consent + RBAC + ABE + audit
2. **Principle of Least Privilege** — Doctors only see consented records; Admins can't see medical data
3. **Data at Rest Encryption** — All medical data encrypted with AES-256-GCM
4. **Envelope Encryption** — Per-record unique keys, master key never touches raw data
5. **Authenticated Encryption** — GCM mode prevents ciphertext tampering
6. **Immutable Audit Trail** — Hash-chain blockchain detects log tampering
7. **Multi-Factor Authentication** — TOTP for elevated-privilege roles
8. **Input Validation** — Joi schemas validate all API inputs
9. **Rate Limiting** — Prevents brute-force attacks
10. **Security Headers** — Helmet adds CSP, HSTS, X-Frame-Options, etc.
