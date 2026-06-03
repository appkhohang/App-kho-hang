# Security Specification & Threat Model for Xưởng An ERP

This document outlines the security specifications, data invariants, threat model, and "Dirty Dozen" payload test cases for the Firestore security rules protecting the Cloud Database of Xưởng An hạch toán.

## 1. Core Data Invariants

1. **Strict Authentication & Verification**:
   - No anonymous or public operations are allowed on any business collection.
   - All accesses (reads and writes) require a fully authenticated Google login session with a verified email address (`request.auth.token.email_verified == true`).

2. **Poisoning and Size Hardening**:
   - Document IDs must match the alphanumeric security format `^[a-zA-Z0-9_\-]+$` and must not exceed 128 characters.
   - All string attributes must be checked for length limits (e.g., titles under 256 characters) to avoid resource denial-of-wallet exhaust attacks.

3. **No Unauthenticated Shadow Writes**:
   - Only validated administrators or authorized staff with verified email are permitted to issue updates.
   - Self-assigned roles or modification of system-restricted status fields must be prevented via key-level state verification.

---

## 2. The "Dirty Dozen" Threat Payloads

Here are 12 specific payloads representing threat scenarios seeking to break identity, integrity, and state limits:

1. **Unauthenticated List Harvesting**: Retrieve all bills without an active session.
2. **Junk ID Poisoning**: Create an import item with a `1MB` junk-character string as document ID.
3. **Privilege Escalation**: Attempt to write a customized `UserProfile` setting oneself as Admin when unauthorized.
4. **Unverified Email Spoofing**: Execute transactions from a domain using a spoofed email whose `email_verified` claim is `false`.
5. **Blanket Query Scraping**: Attempting a collection-level list fetch without passing any query parameters where credentials should be strictly audited.
6. **Data Type Corruption**: Injection of text string instead of numeric balance in `Customer` `initialDebt` or `grandTotal`.
7. **Negative Balance Exploitation**: Submit negative numbers to transaction amounts or rates.
8. **Immutability Bypass**: Trying to change the `createdAt` timestamp of a historical `PaymentRecord` after it is declared.
9. **Shadow Fields Injection**: Overloading `WorkerJob` with a non-existent property to leak memory structures.
10. **Terminal State Shortcut**: Attempting directly to complete a production run or wipe logs with status bypass.
11. **Orphaned Writes**: Creating a `WorkerJob` reference with a non-existent `workerId` when referencing external collection relations.
12. **PII Blanket Leakage**: Attempting to grab profile contacts of other staff members without role authentication.

---

## 3. Threat Mitigation and Rules Validation

We validate that these threat models are defeated via structural conditions inside the `firestore.rules` matching:
- `isEmailVerified()` checking authenticity.
- `isValidId(id)` checking injection patterns.
- Type safeguards in logical validate helpers.
