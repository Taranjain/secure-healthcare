
• Security Model

  This app protects medical records with several layers, not just one password check. In simple terms, it    
  tries to answer four questions every time someone does something sensitive:                                
                                                                                                             
  1. Who is this user?                                                                                       
  2. Are they allowed to do this kind of action?                                                             
  3. Has the patient allowed this specific access?                                                           
  4. Can we prove later that the access happened?                                                            
                                                                                                             
  That is the core security design.                                                                          
                                                                                                             
  1. Login Security: proving who the user is                                                                 

  When a user registers, their password is not stored in plain text. The backend hashes it with bcrypt in /  
  Users/B_ASHISH/secure-healthcare/backend/src/controllers/authController.js. That means the database stores 
  a transformed version of the password, not the password itself.                                            
                                                                                                             
  When the user logs in:                                                                                     
                                                                                                             
  - they send email + password                                                                               
  - the backend compares the entered password to the stored hash                                             
  - if it matches, the backend issues JWT tokens                                                             
                                                                                                             
  There are two tokens:                                                                                      
                                                                                                             
  - accessToken: short-lived, used for normal API calls                                                      
  - refreshToken: longer-lived, used to get a new access token when the old one expires
                                                                                                             
  This reduces the damage if one short-lived token expires quickly.                                          
                                                                                                             
  2. MFA: extra protection for sensitive users                                                               
                                                                                                             
  Doctors and admins are required to use MFA. This is handled in /Users/B_ASHISH/secure-healthcare/backend/  
  src/services/mfaService.js and /Users/B_ASHISH/secure-healthcare/backend/src/controllers/authController.js.                                                                                                             
  How it works:                                                                                              
                                                                                                             
  - after correct password login, the backend does not immediately fully log in a doctor/admin               
  - it sends back a temporary token                                                                          
  - the user must enter a code from an authenticator app                                                     
  - only after that does the backend issue real JWT tokens                                                   
                                                                                                             
  So for doctors/admins, a stolen password alone is not enough. The attacker would also need the MFA device. 
                                                                                                             
  3. JWT auth: protecting API requests                                                                       
                                                                                                             
  After login, the frontend stores tokens and sends the accessToken on API requests in the Authorization     
  header. This is wired in /Users/B_ASHISH/secure-healthcare/frontend/src/lib/api.js.                        
                                                                                                             
  On the backend, /Users/B_ASHISH/secure-healthcare/backend/src/middleware/auth.js checks:                   
                                                                                                             
  - is there a bearer token?                                                                                 
  - is it valid?                                                                                             
  - is it expired?                                                                                           
  - does the user still exist in the database?                                                               
                                                                                                             
  If valid, the backend attaches the current user to req.user.                                               
                                                                                                             
  That means protected endpoints do not trust the frontend alone. Every request is rechecked on the server.  
                                                                                                             
  4. Role-based access control: not everyone can call every endpoint                                         

  The app uses roles:                                                                                        
                                                                                                             
  - PATIENT                                                                                                  
  - DOCTOR                                                                                                   
  - ADMIN                                                                                                    
                                                                                                             
  Routes are restricted by role using middleware such as:                                                    
                                                                                                             
  - patient-only upload                                                                                      
  - doctor-only accessible-record listing                                                                    
  - admin-only dashboard and user list                                                                       
                                                                                                             
  This means even if a logged-in user knows an endpoint URL, they still cannot use it unless their role is   
  allowed.                                                                                                   
                                                                                                             
  Simple example:
                                                                                                             
  - a patient can upload records                                                                             
  - a doctor cannot upload as a patient                                                                      
  - an admin can inspect system logs but is not treated as a patient owner                                   
                                                                                                             
  So the app first checks identity, then role.                                                               
                                                                                                             
  5. Record encryption: protecting stored medical data                                                       
                                                                                                             
  This is one of the most important parts. Medical records are encrypted before storage using /Users/        
  B_ASHISH/secure-healthcare/backend/src/services/encryptionService.js.                                      
                                                                                                             
  It uses AES-256-GCM, which gives:                                                                          
                                                                                                             
  - confidentiality: outsiders cannot read the data                                                          
  - integrity check: tampering can be detected during decryption                                             
                                                                                                             
  The app uses envelope encryption:                                                                          
                                                                                                             
  - each record gets its own random data key, called a DEK                                                   
  - that DEK encrypts the actual record                                                                      
  - then the DEK itself is encrypted with a master key from environment variables                            
                                                                                                             
  Why this matters:                                                                                          
                                                                                                             
  - if one record key were exposed, it would not automatically expose all records                            
  - the master key is kept outside the database, in environment config                                       
                                                                                                             
  For text records:                                                                                          
                                                                                                             
  - encrypted text is stored in Postgres                                                                     
                                                                                                             
  For uploaded files:                                                                                        
                                                                                                             
  - the file is encrypted first                                                                              
  - only the encrypted file is saved on disk                                                                 
  - metadata like IV, auth tag, and encrypted DEK are stored in the database                                 
                                                                                                             
  So the database and file storage do not contain readable medical files by default.                         
                                                                                                             
  6. Consent system: patient decides which doctor can see records                                            
                                                                                                             
  This is the most important business-level security rule. Even if a doctor is authenticated and has the     
  correct role, they still do not automatically get patient records.                                         
                                                                                                             
  The app checks consent in /Users/B_ASHISH/secure-healthcare/backend/src/middleware/consent.js.             
                                                                                                             
  A doctor can access a patient’s record only if there is an active consent that:                            
                                                                                                             
  - belongs to that patient and doctor                                                                       
  - is still active                                                                                          
  - is not expired                                                                                           
  - applies either to that one record or all of the patient’s records                                        
                                                                                                             
  Patients can:                                                                                              
                                                                                                             
  - grant consent                                                                                            
  - revoke consent                                                                                           
  - set expiry dates                                                                                         
                                                                                                             
  This means the doctor’s access is controlled by the patient, not just by hospital staff role.              
                                                                                                             
  Simple example:                                                                                            
                                                                                                             
  - Dr. A is a valid doctor                                                                                  
  - patient uploads a record                                                                                 
  - Dr. A still cannot view it                                                                               
  - patient must explicitly grant consent first                                                              
                                                                                                             
  That is a strong privacy rule.                                                                             
                                                                                                             
  7. Attribute-based policy checks: extra restrictions on top of consent                                     
                                                                                                             
  Some records can also have attribute rules checked in /Users/B_ASHISH/secure-healthcare/backend/src/       
  services/abeService.js.                                                                                    
                                                                                                             
  Important clarification: this is not real cryptographic ABE. It is application-level policy checking.      
                                                                                                             
  Example policy:                                                                                            
                                                                                                             
  - only a doctor in Cardiology                                                                              
  - or only a doctor with a certain specialization                                                           
                                                                                                             
  So access may require:                                                                                     

  - valid login                                                                                              
  - correct doctor role                                                                                      
  - active patient consent                                                                                   
  - matching attributes                                                                                      
                                                                                                             
  This creates a second filter after consent.                                                                
                                                                                                             
  Example:                                                                                                   

  - patient granted consent to a doctor                                                                      
  - but the record requires department = Cardiology                                                          
  - if doctor belongs to Neurology, access is denied                                                         
                                                                                                             
  So consent alone may still not be enough.                                                                  
                                                                                                             
  8. Audit logging: every sensitive action is recorded                                                       
                                                                                                             
  The app logs actions through /Users/B_ASHISH/secure-healthcare/backend/src/services/auditService.js.       
                                                                                                             
  It records things like:                                                                                    
                                                                                                             
  - login                                                                                                    
  - record upload                                                                                            
  - record view                                                                                              
  - record download                                                                                          
  - consent granted                                                                                          
  - consent revoked                                                                                          
  - record deletion                                                                                          
                                                                                                             
  Each log includes useful context:                                                                          
                                                                                                             
  - which user acted                                                                                         
  - which record was involved                                                                                
  - time                                                                                                     
  - IP address                                                                                               
  - user agent                                                                                               
  - action details                                                                                           
                                                                                                             
  This helps with accountability. If someone opens a patient file, the system can later show who did it and  
  when.                                                                                                      
                                                                                                             
  That is important because security is not only about blocking bad access. It is also about making access   
  traceable.                                                                                                 
                                                                                                             
  9. Blockchain-style hash chain: tamper evidence for audit logs                                             

  The app adds an extra integrity layer through /Users/B_ASHISH/secure-healthcare/backend/src/services/      
  blockchainService.js.                                                                                      
                                                                                                             
  This is not a public blockchain. It is an internal SHA-256 hash chain.                                     
                                                                                                             
  How it works:                                                                                              
                                                                                                             
  - each audit event is also stored as a block                                                               
  - each block contains the previous block’s hash                                                            
  - if someone changes an old block, the chain should no longer verify correctly                             

  What this gives:                                                                                           
                                                                                                             
  - tamper evidence for audit history                                                                        
  - stronger trust that logs were not silently changed later                                                 
                                                                                                             
  What it does not give:                                                                                     
                                                                                                             
  - decentralization                                                                                         
  - public consensus                                                                                         
  - the guarantees of Ethereum or Bitcoin                                                                    
                                                                                                             
  In simple English: it is a chained record of events designed to make audit tampering easier to detect.     
                                                                                                             
  10. API hardening: reducing common web attacks                                                             
                                                                                                             
  In /Users/B_ASHISH/secure-healthcare/backend/src/app.js, the app uses several standard protections:        

  - helmet: adds safer HTTP headers                                                                          
  - cors: limits which frontend origin can call the backend                                                  
  - express-rate-limit: slows repeated abusive requests                                                      
  - validators: reject malformed or invalid input                                                            
  - JSON parsing limits: reduces oversized payload abuse                                                     
                                                                                                             
  These controls help against common web risks like:                                                         
                                                                                                             
  - brute force attempts                                                                                     
  - bad input                                                                                                
  - cross-origin misuse                                                                                      
  - some browser-level attacks                                                                               
                                                                                                             
  11. Rate limiting: slowing login abuse                                                                     
                                                                                                             
  Auth and MFA endpoints use stricter limiters through /Users/B_ASHISH/secure-healthcare/backend/src/routes/ 
  auth.js and the rate-limiter middleware.                                                                   
                                                                                                             
  Purpose:                                                                                                   
                                                                                                             
  - make password guessing harder                                                                            
  - make MFA guessing harder                                                                                 
  - reduce automated abuse                                                                                   
                                                                                                             
  So if an attacker keeps trying passwords or OTP codes rapidly, the app can block or slow those requests.   
                                                                                                             
  12. File upload restrictions: reducing dangerous uploads                                                   
                                                                                                             
  Record uploads use multer in /Users/B_ASHISH/secure-healthcare/backend/src/routes/records.js.              
                                                                                                             
  Security measures there include:                                                                           
                                                                                                             
  - max file size limit                                                                                      
  - allowlist of file MIME types                                                                             
  - temp storage before encryption                                                                           
  - immediate removal of temp upload after encrypted copy is saved                                           
                                                                                                             
  This reduces risk from arbitrary file uploads and prevents raw uploaded files from staying around longer   
  than needed.                                                                                               
                                                                                                             
  13. Token refresh behavior: keeping sessions usable without endless access                                 
                                                                                                             
  The frontend auto-refreshes expired access tokens in /Users/B_ASHISH/secure-healthcare/frontend/src/lib/   
  api.js.                                                                                                    

  This improves usability, but the security idea is:                                                         
                                                                                                             
  - normal token is short-lived
  - refresh token is used only when needed                                                                   
  - if refresh fails, the app clears local session and sends user back to login                              
                                                                                                             
  So the user experience stays smooth without making the main access token long-lived.                       
                                                                                                             
  14. Separation of storage: database + encrypted disk files                                                 
                                                                                                             
  Sensitive data is split across:                                                                            
                                                                                                             
  - Postgres for metadata and encrypted text                                                                 
  - disk volume for encrypted file blobs                                                                     
  - environment variables for secrets like JWT and master encryption key                                     
                                                                                                             
  That separation matters because one storage layer alone is not enough to fully reconstruct data unless the 
  secrets are also available.                                                                                
                                                                                                             
  How a secure record access actually happens                                                                
                                                                                                             
  Here is the full flow in plain English:                                                                    
                                                                                                             
  1. Patient uploads a record.                                                                               
  2. Backend encrypts it before saving.                                                                      
  3. Record sits in storage unreadable by default.                                                           
  4. Patient grants consent to a doctor.                                                                     
  5. Doctor logs in with password and MFA.                                                                   
  6. Doctor requests a record.                                                                               
  7. Backend checks token.                                                                                   
  8. Backend checks role.                                                                                    
  9. Backend checks patient consent.                                                                         
  10. Backend checks any extra attribute policy.                                                             
  11. Only then does backend decrypt the record and return it.
  12. The view/download action is written to audit logs and hash chain.                                      
                                                                                                             
  So the app protects data both before access and during access.                                             
                                                                                                             
  What the app is doing well                                                                                 
                                                                                                             
  The main strengths are:                                                                                    
                                                                                                             
  - passwords are hashed                                                                                     
  - doctors/admins use MFA                                                                                   
  - records are encrypted before storage                                                                     
  - patient consent is enforced server-side
  - access is audited                                                                                        
  - audit records are chained for tamper detection                                                           
  - routes are protected by auth and role middleware                                                         
  - common web protections are enabled                                                                       
                                                                                                             
  That is a solid layered model for a demo or portfolio project.                                             
                                                                                                             
  Important limits and caveats                                                                               
                                                                                                             
  A few things are worth understanding clearly.                                                              
                                                                                                             
  The “ABE” part is not real cryptographic attribute-based encryption. It is rule checking in application    
  code.                                                                                                      
                                                                                                             
  The frontend stores JWTs in localStorage. That is common, but weaker against XSS than using secure HTTP-   
  only cookies.                                                                                              
                                                                                                             
  The internal “blockchain” is only a local tamper-evident chain inside the app’s database. It is not        
  decentralized.                                                                                             
                                                                                                             
  Redis is present in the stack, but from the code you showed, it does not appear to be central to security  
  logic yet.
                                                                                                             
  The master encryption key comes from environment variables. That is fine for development, but in production
  it would be stronger to use a real secret manager or KMS.                                                  
                                                                                                             
  Simple one-line summary                                                                                    
                                                                                                             
  Security in this app works by combining:                                                                   
                                                                                                             
  - identity checks                                                                                          
  - MFA                                                                                                      
  - role checks                                                                                              
  - patient consent checks                                                                                   
  - optional attribute rules                                                                                 
  - encryption at rest                                                                                       
  - audit logging
  - tamper-evident log chaining

  If you want, I can next explain this as:

  - a diagram-like flow
  - a “what happens when doctor opens a record” walkthrough
  - or a “security review: what is good and what is weak” breakdown


›   - but the record requires department = Cardiology