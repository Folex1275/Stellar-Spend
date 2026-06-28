'use client';

import { useCallback } from 'react';
import type { PayoutStatus } from '@/lib/offramp/types';
import { TransactionStorage } from '@/lib/transaction-storage';
import type { OfframpStep } from '@/types/stellaramp';
import { PAYOUT_CONFIG } from '@/lib/polling/backoff';
import { useGenericPolling } from './useGenericPolling';

const TERMINAL_STATES: PayoutStatus[] = ['validated', 'settled', 'refunded', 'expired'];

interface PollPayoutStatusOptions {
  transactionId: string;
  onStepChange: (step: OfframpStep) => void;
  onSettling?: () => void;
}

/**
 * Polls GET /api/offramp/status/{orderId} using exponential backoff, up to 10 min.
 * Delegates to useGenericPolling for the core polling loop.
 * - "validated" | "settled"  → calls onSettling(), resolves
 * - "refunded" | "expired"   → rejects with descriptive error
 * - 5 consecutive HTTP errors → rejects with descriptive connectivity error
 * - Timeout                  → rejects with "Payout polling timeout"
 * Updates TransactionStorage on every poll.
 */
export function usePollPayoutStatus() {
  const { pollStatus } = useGenericPolling<PayoutStatus>({
    config: PAYOUT_CONFIG,
    terminalStates: TERMINAL_STATES,
    throwOnTimeout: true,
    throwOnConsecutiveErrors: true,
  });

  const pollPayoutStatus = useCallback(
    async (orderId: string, { transactionId, onSettling }: PollPayoutStatusOptions): Promise<void> => {
      const endpoint = `/api/offramp/status/${orderId}`;

      try {
        await pollStatus(
          endpoint,
          { id: orderId, onSuccess: onSettling },
          (data) => {
            const status: PayoutStatus = (data.status ?? 'pending') as PayoutStatus;
            TransactionStorage.update(transactionId, { payoutStatus: status });
            return status;
          },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('Polling timeout')) {
          throw new Error('Payout polling timeout');
        }
        if (message.includes('consecutive network errors')) {
          throw new Error('Payout polling failed: too many consecutive network errors. Please check your connection.');
        }
        if (message.includes('refunded')) {
          throw new Error('Payout was refunded. Please contact support.');
        }
        if (message.includes('expired')) {
          throw new Error('Payout order expired. Please try again.');
        }
        throw err;
      }
    },
    [pollStatus]
  );

  return { pollPayoutStatus };
}
