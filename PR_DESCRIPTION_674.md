# Refactor: Strengthen the dependency-injection container

## Summary

Replaces the ad-hoc singleton pattern and old `ServiceContainer` with a unified `DIContainer` that serves as the single wiring point for all application services. Every service now has a clear interface, is registered in the container, and routes resolve services exclusively through the container.

## Changes

### Core DI Container (`src/lib/di/`)
- **`container.ts`** — Added `registerOverride()` method that clears cached instances, enabling clean test mocks
- **`registry.ts`** — `configureServices()` now registers **all 13 services** (up from 4): Quote, Bridge, Payout, Webhook, Transaction, Sharing, Analytics, QRCode, Onramp, Referral, Scheduling, Insurance, Batch
- **`registry.ts`** — Added `overrideService()` helper for injecting mock implementations in tests
- **`index.ts`** — Re-exports everything for clean `@/lib/di` imports

### Service Interfaces (`src/lib/services/`)
- **`interfaces.ts`** — Defined explicit interfaces for all 13 services: `IQuoteService`, `IBridgeService`, `IPayoutService`, `IWebhookService`, `ITransactionService`, `ISharingService`, `IAnalyticsService`, `IQRCodeService`, `IOnrampService`, `IReferralService`, `ISchedulingService`, `IInsuranceService`, `IBatchService`

### Service Layer (`src/lib/services/`)
- **Removed hidden module-level singletons** from 9 service files (e.g. `export const quoteService = new QuoteService()`)
- **Deleted `container.ts`** — The old `ServiceContainer` singleton (superseded by `DIContainer`)
- **Created `wrapper-services.ts`** — Class wrappers for function-based services (Batch, Referral, Insurance, Scheduling) so they integrate cleanly with the DI container
- **Updated `index.ts`** — Clean exports, no accidental module-level singletons

### Routes (`src/app/api/`)
- **Updated 9 route files** to resolve services via `globalContainer.resolve(SERVICE_KEYS.X)` instead of importing module-level singletons

### Tests (`src/test/`)
- **`services.test.ts`** — Replaced old `ServiceContainer` tests with comprehensive `DIContainer` wiring tests, including singleton identity, mock overrides, and service resolution validation

## Acceptance Criteria Fulfilled

- [x] Routes resolve services via the container only (all 9 route files updated)
- [x] Services are easily mockable in tests (`overrideService()` support)
- [x] Relevant areas: `src/lib/di`, `src/lib/services/container.ts` (deleted), `interfaces.ts` (updated)

## Files Changed

| File | Status |
|------|--------|
| `src/lib/di/container.ts` | Modified (added `registerOverride`) |
| `src/lib/di/registry.ts` | Modified (all 13 services, overrideService) |
| `src/lib/services/interfaces.ts` | Modified (all service interfaces) |
| `src/lib/services/wrapper-services.ts` | **New** |
| `src/lib/services/index.ts` | Modified (clean exports) |
| `src/lib/services/container.ts` | **Deleted** |
| 9 service files | Modified (removed singletons) |
| 9 route files | Modified (use DI container) |
| `src/test/services.test.ts` | Modified (DI wiring tests) |

closes #674
