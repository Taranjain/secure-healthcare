# Healthcare Secure File Upload — Implementation Summary

This document summarizes the changes made to the HealthVault project to enable secure file (PDF/image) upload, encryption, storage, and doctor access.

---

## What Was Broken

**Root cause:** `frontend/src/lib/api.js` had a hardcoded `Content-Type: application/json` header on every Axios request. When uploading files via `FormData`, this header prevented the browser from setting the correct `multipart/form-data` boundary. Result: **Multer on the backend never saw the file** (`req.file` was `undefined`), so every upload became a text-only record.

---

## Files Changed

### 1. `frontend/src/lib/api.js`

**Fix:** Keep `Content-Type: application/json` for normal API calls, but remove it for `FormData` uploads so the browser auto-sets the multipart boundary.

```js
const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    // ... auth token ...
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type']; // Let browser set multipart boundary
    }
    return config;
});
```

### 2. `backend/prisma/schema.prisma`

**Added 3 columns to `MedicalRecord` model:**
- `fileEncryptionIV String?`
- `fileEncryptionTag String?`
- `fileEncryptedKey String?`

These store file-specific AES-256-GCM encryption metadata separately from text encryption metadata.

### 3. `backend/src/controllers/recordController.js`

**Changes:**
- **Upload (`createRecord`):** When a file is uploaded, encrypt it with `encryptFile()`, save `.enc` to disk, and store `fileEncryptionIV`, `fileEncryptionTag`, `fileEncryptedKey` in the database. If text data is also provided, encrypt it separately — file and text now have independent keys.
- **Download (`downloadRecord`):** Read `.enc` from disk, decrypt with `fileEncryption*` columns (not text columns). Added filename extension mapping so downloads have correct extensions (`.pdf`, `.png`, `.jpg`, etc.).
- **Removed:** qpdf password protection layer (was adding an extra password prompt that confused users).

### 4. `backend/src/services/encryptionService.js`

**Added:**
- `protectPdfWithPassword()` function using qpdf (kept for future use but not called by default).

### 5. `frontend/src/app/dashboard/doctor/page.js` and `patient/page.js`

**Changes:**
- **Inline preview in modal:** Click "Decrypt & View" → file opens inside the modal
  - **Images:** `<img>` tag
  - **PDFs:** `<object type="application/pdf">` (uses browser's native PDF viewer with scroll, zoom, page controls)
- **Download button:** Extracts correct filename with extension from a frontend extension map and triggers download.

### 6. `backend/src/config/index.js`

**Added:**
- `uploadDir: process.env.UPLOAD_DIR || '/app/uploads'` — makes upload directory configurable for local dev vs Docker.

### 7. `backend/src/middleware/rateLimiter.js`

**Increased limits:**
- General API: 200 req / 15 min (was 100)
- Auth: 40 req / 15 min (was 20)

These are now configurable via env vars (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).

### 8. `backend/Dockerfile`

**Added:** `qpdf` package for PDF password protection support.

### 9. `backend/.dockerignore`

**Created:** Excludes host `node_modules` from Docker build to prevent binary architecture mismatch.

---

## How It Works (End-to-End Flow)

### Patient Upload
1. Patient selects a PDF or image in the "Upload Record" modal.
2. Frontend sends `FormData` (no explicit `Content-Type` — browser sets multipart boundary).
3. Multer receives the file, saves temporarily to `/tmp/healthcare-uploads/`.
4. Controller reads file buffer, calls `encryptionService.encryptFile(fileBuffer)`:
   - Generates a unique 32-byte random DEK (Data Encryption Key)
   - Encrypts file with AES-256-GCM
   - Returns `{ encryptedBuffer, iv, tag, encryptedKey }`
5. Encrypted file saved to disk as `{timestamp}_{originalname}.enc`.
6. File encryption metadata (`iv`, `tag`, `encryptedKey`) stored in DB columns: `fileEncryptionIV`, `fileEncryptionTag`, `fileEncryptedKey`.
7. If text data also provided, it gets its own independent encryption.

### Doctor Access
1. Doctor logs in and sees records in "Accessible Records" tab.
2. Patient has granted consent (either blanket or per-record).
3. Doctor clicks "Decrypt & View":
   - Backend returns record metadata + decrypted text data.
   - If file exists, backend downloads the `.enc` file, decrypts with `fileEncryption*`, and streams the decrypted bytes.
   - Frontend receives blob, creates `URL.createObjectURL()`, and renders:
     - **PDF:** `<object>` tag with browser's native PDF viewer
     - **Images:** `<img>` tag
4. Doctor can click "Download" to save with correct file extension.

---

## Security Architecture

### At-Rest Encryption
- Files are encrypted with **AES-256-GCM** before touching disk.
- Each file gets a **unique random DEK** (Data Encryption Key).
- DEK is itself encrypted with the **master key** (envelope encryption) and stored in PostgreSQL.
- Even if someone steals the `.enc` file from disk, it is unreadable without the database keys.

### Access Control
- **Consent middleware:** Doctor can only access records with active patient consent.
- **ABE (Attribute-Based Encryption):** Optional policy checks on doctor attributes (department, specialization).
- **Audit trail:** Every view/download is logged with blockchain hash for immutability.

### Transport
- All API traffic over HTTPS (production) or HTTP (local dev).
- JWT tokens for authentication, refresh tokens for session continuity.

---

## Running Locally

### Prerequisites
- PostgreSQL running on port 5432
- Node.js (backend + frontend)

### Start Backend
```bash
cd backend
npm install
# Create uploads directory
mkdir -p uploads
# Set env vars and start
JWT_SECRET="..." \
JWT_REFRESH_SECRET="..." \
MASTER_ENCRYPTION_KEY="..." \
DATABASE_URL="postgresql://healthcare:healthcare_secret_2024@localhost:5432/healthcare_db" \
FRONTEND_URL="http://localhost:3000" \
UPLOAD_DIR="./uploads" \
node src/server.js
```

### Start Frontend
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:4000/api npm run dev
```

### Demo Accounts
| Role | Email | Password | MFA |
|------|-------|----------|-----|
| Patient | `patient@demo.com` | `Patient@123` | No |
| Doctor | `doctor@demo.com` | `Doctor@123` | Yes (seed output shows secret) |
| Admin | `admin@demo.com` | `Admin@123` | Yes |

---

## Test Credentials (from seed)

After running `node prisma/seed.js`:
- Patient: `patient@demo.com` / `Patient@123`
- Doctor: `doctor@demo.com` / `Doctor@123` (MFA required — check seed output for secret)
- Admin: `admin@demo.com` / `Admin@123`

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| File uploads but shows as text-only | Wrong Content-Type header | Ensure `api.js` deletes `Content-Type` for FormData |
| Downloaded file has no extension | Missing extension mapping | Check `downloadRecord` extension map |
| Doctor can't see records | No consent granted | Patient must grant consent first |
| Backend crashes on start | Missing env vars | Set `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MASTER_ENCRYPTION_KEY` |
| Rate limiter blocks requests | Too many requests | Increase `RATE_LIMIT_MAX` or wait 15 minutes |
| PDF shows white screen | iframe doesn't render blob PDFs | Use `<object>` instead (already fixed) |

---

## Docker Compose (Production)

```bash
docker compose up --build
```

Services:
- `healthcare-postgres` — PostgreSQL 15
- `healthcare-redis` — Redis 7
- `healthcare-backend` — Express API
- `healthcare-frontend` — Next.js app

---

*Last updated: 2026-05-26*
