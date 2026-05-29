# Testing Guide

This document outlines the comprehensive testing strategy for Stellar-Spend, including unit tests, integration tests, E2E tests, and mutation testing.

## Test Structure

```
src/
├── lib/
│   ├── offramp/
│   │   └── adapters/
│   │       ├── allbridge-adapter.test.ts
│   │       └── paycrest-adapter.test.ts
│   └── services/
│       ├── quote.service.test.ts
│       └── batch.service.test.ts
├── test/
│   ├── integration/
│   │   ├── api-quote.integration.test.ts
│   │   ├── api-bridge.integration.test.ts
│   │   ├── api-paycrest.integration.test.ts
│   │   └── api-webhooks.integration.test.ts
│   └── mutation-critical-paths.test.ts
e2e/
├── offramp-flow.spec.ts
├── wallet-connection-flow.spec.ts
└── transaction-history.spec.ts
```

## Running Tests

### Unit Tests

Run all unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Integration Tests

Integration tests are included in the main test suite:
```bash
npm test
```

They test API endpoints with mocked HTTP requests.

### E2E Tests

Run E2E tests:
```bash
npm run test:e2e
```

Run E2E tests in headed mode (see browser):
```bash
npx playwright test --headed
```

Run specific E2E test:
```bash
npx playwright test e2e/offramp-flow.spec.ts
```

### Mutation Testing

Run mutation tests:
```bash
npm run test:mutation
```

View mutation report:
```bash
open mutation-report/index.html
```

## Test Coverage Goals

- **Unit Tests**: 90% coverage
- **Integration Tests**: All critical API endpoints
- **E2E Tests**: Complete user journeys
- **Mutation Score**: 80% minimum

## Unit Tests

### Adapter Tests

**AllbridgeAdapter** (`src/lib/offramp/adapters/allbridge-adapter.test.ts`)
- Chain details retrieval
- Token listing
- Bridge transaction building
- Transfer status checking
- Error handling

**PaycrestAdapter** (`src/lib/offramp/adapters/paycrest-adapter.test.ts`)
- Payout order creation
- Order status retrieval
- Beneficiary verification
- Supported currencies listing
- Error scenarios

### Service Tests

**QuoteService** (`src/lib/services/quote.service.test.ts`)
- Quote generation
- Exchange rate retrieval
- Fee calculation
- Rate caching

**BatchService** (`src/lib/services/batch.service.test.ts`)
- Batch creation
- Batch status tracking
- Batch processing
- Validation

## Integration Tests

### API Quote Endpoint

Tests for `POST /api/offramp/quote`:
- Valid requests with different currencies
- Fee method variations (USDC, XLM)
- Large and small amounts
- Invalid inputs (negative, zero, non-numeric)
- Unsupported currencies
- Edge cases (decimals, precision)

### API Bridge Endpoints

Tests for bridge transaction endpoints:
- `POST /api/offramp/bridge/build-tx` - XDR building
- `POST /api/offramp/bridge/submit-soroban` - Transaction submission
- `GET /api/offramp/bridge/status/:txHash` - Status polling
- `GET /api/offramp/bridge/gas-fee-options` - Fee options

### API Paycrest Endpoints

Tests for payout endpoints:
- `POST /api/offramp/paycrest/order` - Order creation
- `GET /api/offramp/status/:orderId` - Status tracking
- `POST /api/offramp/verify-account` - Account verification

### Webhook Endpoints

Tests for `POST /api/webhooks/paycrest`:
- HMAC signature validation
- Event handling (completed, failed, pending)
- Duplicate webhook handling
- Error scenarios

## E2E Tests

### Complete Offramp Flow

Tests the full user journey:
1. Wallet connection
2. Amount entry
3. Currency selection
4. Fee method selection
5. Quote retrieval
6. Beneficiary details entry
7. Account verification
8. Transaction review
9. Transaction confirmation
10. Success confirmation

### Wallet Connection Flow

Tests wallet integration:
- Freighter wallet connection
- Lobstr wallet connection
- Auto-detection
- Address display
- Balance display
- Connection errors
- Wallet switching

### Transaction History

Tests history page functionality:
- History display
- Transaction details
- Status filtering
- Search functionality
- Sorting
- Export
- Statistics
- Empty state

## Mutation Testing

Mutation testing verifies test quality by introducing code mutations and checking if tests catch them.

### Critical Paths Tested

1. **Amount Validation**
   - Zero check removal
   - Negative check removal
   - Comparison operator changes

2. **Fee Calculation**
   - Wrong fee percentage
   - Missing fee calculation
   - Incorrect rounding

3. **Status Checks**
   - Wrong status comparison
   - Missing status cases

4. **Boundary Conditions**
   - Off-by-one errors
   - Array boundaries

5. **Logical Operators**
   - AND to OR mutations
   - OR to AND mutations

6. **Return Values**
   - Wrong return values
   - Missing return statements

### Mutation Score Thresholds

- **High**: 90%
- **Medium**: 80%
- **Low**: 70%

## Best Practices

### Unit Tests

1. **Test behavior, not implementation**
   ```typescript
   // Good
   expect(calculateFee(100, 'stablecoin')).toBe(0.5);
   
   // Avoid
   expect(calculateFee).toHaveBeenCalled();
   ```

2. **Use descriptive test names**
   ```typescript
   it('should throw for negative amount', () => {
     // test
   });
   ```

3. **Test edge cases**
   - Zero values
   - Negative values
   - Very large values
   - Empty strings
   - Null/undefined

4. **Mock external dependencies**
   ```typescript
   vi.spyOn(adapter, 'getTransferStatus').mockResolvedValueOnce(status);
   ```

### Integration Tests

1. **Test complete request/response cycles**
2. **Validate error responses**
3. **Test all HTTP methods**
4. **Verify response schemas**

### E2E Tests

1. **Test complete user journeys**
2. **Use meaningful selectors** (`data-testid`)
3. **Wait for elements properly**
4. **Test error recovery**
5. **Verify visual feedback**

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Scheduled daily runs

### GitHub Actions Workflow

```yaml
- name: Run unit tests
  run: npm test

- name: Run integration tests
  run: npm test

- name: Run E2E tests
  run: npm run test:e2e

- name: Run mutation tests
  run: npm run test:mutation

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Failing Locally

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Clear Vitest cache:
   ```bash
   npx vitest --clearCache
   ```

3. Check environment variables:
   ```bash
   cp .env.example .env.local
   ```

### E2E Tests Failing

1. Ensure dev server is running:
   ```bash
   npm run dev
   ```

2. Update Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Run in headed mode to debug:
   ```bash
   npx playwright test --headed
   ```

### Mutation Tests Slow

1. Reduce test files:
   ```bash
   npm run test:mutation -- --mutate "src/lib/fee-calculation.ts"
   ```

2. Increase timeout:
   ```bash
   npm run test:mutation -- --timeoutMS 10000
   ```

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Stryker Mutation Testing](https://stryker-mutator.io)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
