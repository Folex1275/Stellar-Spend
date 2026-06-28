## Summary

Routes all application logging through the centralized `src/lib/logger.ts` with structured levels, correlation IDs, and centralized PII/secret redaction. Eliminates all raw `console.*` usage (lint-enforced).

## Changes

### Core Infrastructure
- **`src/lib/logger.ts`** — Enhanced redaction with SSN, credit card, CVV, routing number patterns; expanded `REDACT_KEYS` (session, jwt, refreshToken, etc.); exported `redactSensitive()` helper for reuse; documented `LOG_LEVEL` env var configuration.
- **`src/lib/middleware/request-logging.middleware.ts`** — Attaches `requestId` to `NextRequest` object via `req.requestId` for downstream access; ensures correlation IDs propagate through the request pipeline.
- **`src/types/next.d.ts`** — Module augmentation declaring `NextRequest.requestId`.
- **`src/lib/offramp/utils/logger.ts`** — Migrated from standalone `console.log(JSON.stringify(...))` to delegate to the centralized logger via `logger.withContext({requestId})`.

### Console Replacement (143 occurrences across 68 files)
All `console.error`, `console.warn`, `console.log`, and `console.debug` calls replaced with `logger.error`, `logger.warn`, `logger.info`, `logger.debug` with correct parameter ordering. Structured data formerly passed as `JSON.stringify(...)` is now passed as structured fields.

### Lint Enforcement
- **`eslint.config.js`** — Added `no-console: error` rule with exception for `src/lib/logger.ts` only.

### Testing
- **`src/lib/logger.test.ts`** — 18 tests covering: secret key redaction (case-insensitive), PII masking (email, phone, account numbers, SSN, credit cards), nested object redaction, array redaction, depth limiting, null/primitives handling, log entry structure, `withContext` binding, error serialization, and log-level filtering.

## Migration
- `scripts/migrate-console.ps1` — PowerShell migration script for future use.

## Acceptance Criteria
- [x] No raw `console.*` remains in app code (lint-enforced via `no-console: error`)
- [x] Logs include correlation IDs (`requestId` propagated via middleware)
- [x] PII/Secrets redacted centrally (`REDACT_KEYS`, `PII_PATTERNS`)
- [x] Log-level configuration via `LOG_LEVEL` env var
- [x] Tests for redaction (18 test cases)

Closes #676
