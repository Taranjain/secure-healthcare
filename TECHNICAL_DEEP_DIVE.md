# Deep Dive: File Protection Architecture

This document explains the complete technical implementation of file (PDF, image, etc.) encryption, storage, and decryption in the HealthVault platform.

---

## Table of Contents
1. [Threat Model](#threat-model)
2. [Encryption Architecture Overview](#encryption-architecture-overview)
3. [Envelope Encryption Deep Dive](#envelope-encryption-deep-dive)
4. [AES-256-GCM Implementation](#aes-256-gcm-implementation)
5. [File Upload Flow](#file-upload-flow)
6. [File Download Flow](#file-download-flow)
7. [Database Schema Design](#database-schema-design)
8. [Key Management](#key-management)
9. [Security Properties](#security-properties)
10. [Attack Scenarios & Mitigations](#attack-scenarios--mitigations)

---

## Threat Model

### What We Protect Against
1. **Server compromise** — attacker gains access to server filesystem
2. **Database breach** — attacker dumps PostgreSQL tables
3. **Insider threat** — unauthorized staff access to patient data
4. **Network interception** — man-in-the-middle attacks
5. **Accidental exposure** — wrong patient sees another's records

### What We Don't Protect Against
- Browser compromise on doctor/patient machine (endpoint security is out of scope)
- Social engineering (user gives away password)
- Screenshots/photos of decrypted content on screen

---

## Encryption Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENCRYPTION PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PATIENT UPLOADS FILE                                             │
│         │                                                          │
│         ▼                                                          │
│  ┌─────────────────────┐                                           │
│  │  Raw File (PDF/IMG) │                                           │
│  └─────────┬───────────┘                                           │
│            │                                                        │
│            ▼                                                        │
│  ┌─────────────────────────────────┐                             │
│  │  encryptionService.encryptFile() │                             │
│  │                                   │                             │
│  │  Step 1: Generate random 32-byte   │                             │
│  │          Data Encryption Key (DEK)│                             │
│  │                                   │                             │
│  │  Step 2: AES-256-GCM encrypt       │                             │
│  │          file buffer with DEK      │                             │
│  │          → encryptedBuffer        │                             │
│  │          → IV (16 bytes)          │                             │
│  │          → Auth Tag (16 bytes)    │                             │
│  │                                   │                             │
│  │  Step 3: Encrypt DEK with Master   │                             │
│  │          Key using AES-256-GCM    │                             │
│  │          → encryptedKey             │                             │
│  └─────────┬──────────────────────────┘                             │
│            │                                                        │
│            ▼                                                        │
│  ┌─────────────────┐    ┌──────────────────────────────────┐     │
│  │ Encrypted File   │    │ Encryption Metadata (Database)  │     │
│  │ on Disk (.enc)   │    │                                  │     │
│  │                  │    │  • fileEncryptionIV (hex)         │     │
│  │  Binary gibberish│    │  • fileEncryptionTag (hex)        │     │
│  │  (unreadable)    │    │  • fileEncryptedKey (envelope)   │     │
│  └─────────────────┘    └──────────────────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Envelope Encryption Deep Dive

### Why Envelope Encryption?

Instead of encrypting every file directly with the master key, we use a two-tier system:

**Tier 1: Master Key** — Stored in environment variable (`MASTER_ENCRYPTION_KEY`), 32 bytes hex. Never stored in database. Loaded once at startup.

**Tier 2: Data Encryption Key (DEK)** — Unique per file, randomly generated. Encrypted by master key and stored in DB.

### Benefits
1. **Key rotation** — Change master key, re-encrypt DEKs, no need to re-encrypt all files
2. **Per-record revocation** — Delete the DEK entry = file permanently unreadable
3. **No single point of failure** — Even if DB is breached, attacker needs master key too

### Code Implementation

```javascript
// Generate unique DEK for this file
function generateDEK() {
    return crypto.randomBytes(32); // 256 bits of entropy
}

// Encrypt DEK with master key
function encryptDEK(dek) {
    const masterKey = getMasterKey();
    const { encrypted, iv, tag } = encrypt(dek.toString('hex'), masterKey);
    return `${iv}:${tag}:${encrypted}`; // Combined hex string
}

// Decrypt DEK using master key
function decryptDEK(encryptedDEK) {
    const masterKey = getMasterKey();
    const [iv, tag, encrypted] = encryptedDEK.split(':');
    const dekHex = decrypt(encrypted, iv, tag, masterKey);
    return Buffer.from(dekHex, 'hex');
}
```

---

## AES-256-GCM Implementation

### Why AES-256-GCM?

- **AES** — Industry standard, hardware-accelerated on modern CPUs
- **256-bit key** — Quantum-resistant (sufficient against known quantum algorithms)
- **GCM mode** — Provides both confidentiality AND integrity/authenticity in one pass
- **Auth Tag** — Detects any tampering with ciphertext

### GCM-Specific Properties

```
Plaintext ──┐
             ├──→ AES-GCM Encryption ──→ Ciphertext + Auth Tag
     Key ────┘        ↑
     IV  ─────────────┘
```

- **IV (Initialization Vector)** — 16 bytes, must be unique per encryption with same key. Randomly generated.
- **Auth Tag** — 16 bytes, verifies ciphertext wasn't tampered with. If even 1 bit changes, decryption fails.
- **No padding** — Unlike CBC mode, GCM doesn't require padding, so no padding oracle attacks.

### Node.js Implementation

```javascript
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128 bits
const TAG_LENGTH = 16;  // 128 bits
const KEY_LENGTH = 32;  // 256 bits

function encryptFile(fileBuffer) {
    const dek = generateDEK();              // Unique key for this file
    const iv = crypto.randomBytes(IV_LENGTH); // Unique IV for this file
    
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
    const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();         // Integrity check
    
    return {
        encryptedBuffer: encrypted,         // Save this to disk
        iv: iv.toString('hex'),             // Store in DB
        tag: tag.toString('hex'),            // Store in DB
        encryptedKey: encryptDEK(dek),      // Store in DB
    };
}

function decryptFile(encryptedBuffer, ivHex, tagHex, encryptedKey) {
    const dek = decryptDEK(encryptedKey);    // Recover unique key
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(tag);                // Verify integrity
    
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}
```

**Critical:** If the auth tag doesn't match, `decipher.final()` throws an error — this means the file was tampered with or the wrong key was used.

---

## File Upload Flow

### Step-by-Step

```
1. Patient clicks "Upload Record" → fills title, description, selects PDF

2. Frontend constructs FormData:
   FormData {
     title: "Blood Test Results",
     description: "Annual physical",
     data: '{"hemoglobin":14.2}',  // optional text data
     file: File { name: "blood.pdf", type: "application/pdf", ... }
   }

3. Axios sends POST /api/records
   - Content-Type is REMOVED for FormData (browser sets multipart boundary)
   - File travels as binary multipart chunk

4. Multer (Express middleware) processes the request:
   - Parses multipart body
   - Saves file temporarily to /tmp/healthcare-uploads/{random}
   - Populates req.file with metadata:
     {
       originalname: "blood.pdf",
       mimetype: "application/pdf",
       path: "/tmp/healthcare-uploads/abc123",
       size: 45023
     }

5. Controller (createRecord) executes:
   a. Read file buffer: fs.readFileSync(req.file.path)
   b. Encrypt: encryptionService.encryptFile(fileBuffer)
      → Returns { encryptedBuffer, iv, tag, encryptedKey }
   c. Write encrypted file: /app/uploads/{timestamp}_blood.pdf.enc
   d. Delete temp file: fs.unlinkSync(req.file.path)
   e. Store in DB:
      - filePath: /app/uploads/1779..._blood.pdf.enc
      - fileType: application/pdf
      - fileEncryptionIV: "a3f2..." (16 bytes hex)
      - fileEncryptionTag: "8e1b..." (16 bytes hex)
      - fileEncryptedKey: "iv:tag:encrypted_dek" (envelope encrypted)

6. Response to frontend: { message: "Record created", record: {...} }

7. Patient grants consent to doctor (separate API call)
```

---

## File Download Flow

### Step-by-Step

```
1. Doctor clicks "Decrypt & View" on a record

2. Frontend sends GET /api/records/{id}

3. Backend checks:
   a. JWT token valid?
   b. Is user a doctor?
   c. Does patient have active consent for this doctor?
   d. Does ABE policy allow (if configured)?

4. Backend retrieves record from DB:
   {
     filePath: "/app/uploads/1779..._blood.pdf.enc",
     fileType: "application/pdf",
     fileEncryptionIV: "a3f2...",
     fileEncryptionTag: "8e1b...",
     fileEncryptedKey: "iv:tag:encrypted_dek",
     encryptedData: "...",  // text data (separate)
     encryptionIV: "...",    // text data IV
     encryptionTag: "...",  // text data tag
     encryptedKey: "..."    // text data key
   }

5. Decrypt text data (if present):
   encryptionService.decryptRecord(record)
   → Uses encryptedData + encryptionIV + encryptionTag + encryptedKey

6. Decrypt file (if requested via /download endpoint):
   a. Read encrypted bytes: fs.readFileSync(record.filePath)
   b. Decrypt: encryptionService.decryptFile(
        encryptedBuffer,
        record.fileEncryptionIV,
        record.fileEncryptionTag,
        record.fileEncryptedKey
      )
   c. Returns original PDF bytes

7. Set response headers:
   Content-Type: application/pdf
   Content-Disposition: attachment; filename="Blood Test Report.pdf"

8. Stream decrypted bytes to browser

9. Browser renders:
   - PDF: <object> tag with native PDF viewer (scroll, zoom, pages)
   - Image: <img> tag
   - Doctor can also click Download to save locally
```

---

## Database Schema Design

### Why Separate Columns for File and Text?

**Original bug:** The system only had one set of encryption columns (`encryptionIV`, `encryptionTag`, `encryptedKey`). When a patient uploaded both file + text:
- File was encrypted → got { iv, tag, key }
- Text was encrypted → got { iv, tag, key }
- **The text keys overwrote the file keys in the DB**
- Result: file could never be decrypted again

**Fix:** Added `fileEncryptionIV`, `fileEncryptionTag`, `fileEncryptedKey` columns exclusively for file encryption metadata.

```prisma
model MedicalRecord {
  id             String   @id @default(uuid())
  patientId      String
  title          String
  description    String?
  
  // Text data encryption (when patient types medical data)
  encryptedData  String   @db.Text    // hex ciphertext
  encryptionIV   String               // IV for text
  encryptionTag  String               // Auth tag for text
  encryptedKey   String               // Envelope-encrypted DEK for text
  
  // File metadata
  fileType       String?              // MIME type: application/pdf, image/png, etc.
  filePath       String?              // Path to .enc file on disk
  
  // File encryption (separate from text!)
  fileEncryptionIV   String?          // IV for file
  fileEncryptionTag  String?          // Auth tag for file
  fileEncryptedKey   String?          // Envelope-encrypted DEK for file
  
  abePolicy      Json     @default("{}")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

---

## Key Management

### Master Key
- **Source:** `MASTER_ENCRYPTION_KEY` environment variable
- **Format:** 64 hex characters = 32 bytes = 256 bits
- **Storage:** Only in environment, never in code or database
- **Rotation:** Change env var, all existing DEKs must be re-encrypted

### Data Encryption Keys (DEKs)
- **Source:** `crypto.randomBytes(32)` — pure random, 256 bits
- **Quantity:** One per record (one for text, one for file if both exist)
- **Storage:** Encrypted by master key, stored in database
- **Lifetime:** Permanent unless record is deleted

### Key Isolation
Each record has independent encryption:
```
Record A: DEK_A = random_32_bytes → encrypted by Master Key → stored as "encryptedKey_A"
Record B: DEK_B = random_32_bytes → encrypted by Master Key → stored as "encryptedKey_B"
```

Compromising Record A's DEK does NOT help decrypt Record B.

---

## Security Properties

### 1. Confidentiality
- Files are unreadable without:
  a. The encrypted file on disk
  b. The database row with IV, Tag, and encryptedKey
  c. The master key from environment variables

**Attacker needs ALL THREE to decrypt.**

### 2. Integrity
- AES-GCM auth tag detects any modification to ciphertext
- If file on disk is tampered with, `decipher.final()` throws error
- Blockchain audit log records every access with immutable hash

### 3. Authenticity
- Only authenticated doctors with active consent can access
- JWT tokens expire every 15 minutes
- MFA required for doctor and admin accounts

### 4. Access Control
- Patient owns their records
- Doctor needs explicit consent (blanket or per-record)
- Consent can be revoked at any time
- ABE policies can restrict by department/specialization

### 5. Audit Trail
Every action logged:
- VIEW, DOWNLOAD, UPLOAD, DELETE, GRANT_CONSENT, REVOKE_CONSENT
- Timestamp, IP address, user agent
- Blockchain hash for tamper-proofing

---

## Attack Scenarios & Mitigations

### Scenario 1: Attacker steals the server hard drive
**Threat:** Gets all `.enc` files from `/app/uploads/`
**Result:** Files are binary gibberish. Attacker needs database + master key.
**Mitigation:** AES-256-GCM encryption at rest.

### Scenario 2: Attacker dumps the PostgreSQL database
**Threat:** Gets all DB rows including `fileEncryptedKey`
**Result:** Attacker has encrypted DEKs but not the master key to decrypt them.
**Mitigation:** Envelope encryption — master key is not in DB.

### Scenario 3: Attacker compromises both DB and filesystem
**Threat:** Has `.enc` files AND database rows
**Result:** Still missing the master key from environment variables.
**Mitigation:** Master key must also be stolen. Use secrets manager (AWS KMS, HashiCorp Vault) in production.

### Scenario 4: Doctor tries to access without consent
**Threat:** Doctor knows record UUID, tries direct API call
**Result:** `checkConsent` middleware blocks with 403.
**Mitigation:** Consent enforcement on every record access.

### Scenario 5: Patient A tries to view Patient B's records
**Threat:** UUID guessing or sharing links
**Result:** `checkConsent` + ownership check blocks access.
**Mitigation:** Patients can only access their own records; doctors need consent.

### Scenario 6: Replay attack with old JWT
**Threat:** Stolen JWT from network sniffing
**Result:** JWT expires in 15 minutes; refresh token rotates on use.
**Mitigation:** Short-lived access tokens + refresh token rotation.

---

## Performance Considerations

### File Size
- Files are encrypted/decrypted in memory buffers
- Current limit: 10MB per file (Multer config)
- For larger files: Stream encryption or increase limit

### Encryption Overhead
- AES-256-GCM is hardware-accelerated on modern CPUs (AES-NI)
- Typical overhead: <5% for encryption/decryption
- No significant latency for medical documents (< 50MB)

### Database
- Encrypted files stored on disk, not in DB (BLOB storage avoided)
- DB only stores metadata (~200 bytes per record)
- Fast queries even with thousands of records

---

## Production Hardening Recommendations

1. **Master Key Management**
   - Use AWS KMS, Azure Key Vault, or HashiCorp Vault
   - Never store master key in plain text file or env var on server
   - Implement key rotation procedure

2. **File Storage**
   - Use encrypted block storage (AWS EBS with encryption)
   - Consider object storage with server-side encryption (S3 with SSE-KMS)
   - Implement backup encryption

3. **Database**
   - Enable PostgreSQL SSL/TLS
   - Use connection pooling (PgBouncer)
   - Enable query logging for audit

4. **Network**
   - Force HTTPS in production (HSTS headers)
   - Implement DDoS protection (Cloudflare, AWS WAF)
   - Rate limiting per IP + per user

5. **Monitoring**
   - Alert on failed decryption attempts
   - Alert on unusual download patterns
   - Log all admin actions

---

## Glossary

| Term | Meaning |
|------|---------|
| **DEK** | Data Encryption Key — unique key for each record |
| **Master Key** | Top-level key that encrypts all DEKs |
| **Envelope Encryption** | DEK encrypted by Master Key, stored alongside ciphertext |
| **IV** | Initialization Vector — random nonce for each encryption |
| **Auth Tag** | Authentication Tag — integrity checksum from GCM mode |
| **AES-256-GCM** | Advanced Encryption Standard, 256-bit key, Galois/Counter Mode |
| **Multer** | Express middleware for handling multipart/form-data (file uploads) |
| **ABE** | Attribute-Based Encryption — policy-based access control |

---

*Last updated: 2026-05-26*
