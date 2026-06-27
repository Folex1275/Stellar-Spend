'use client';

import { useCallback } from 'react';
import type { BridgeStatus } from '@/lib/offramp/types';
import { TransactionStorage } from '@/lib/transaction-storage';
import { BRIDGE_CONFIG } from '@/lib/polling/backoff';
import { useGenericPolling } from './useGenericPolling';

const BRIDGE_TERMINAL_STATES: BridgeStatus[] = ['completed', 'failed', 'expired'];

interface PollBridgeStatusOptions {
  transactionId: string;
  onBridgeComplete?: () => void;
}

/**
 * Polls GET /api/offramp/bridge/status/{txHash} using exponential backoff, up to 5 min.
 * Delegates to useGenericPolling for the core polling loop.
 * - "completed"  → calls onBridgeComplete(), resolves
 * - "failed"     → rejects with descriptive error
 * - Timeout      → resolves silently (bridge polling is best-effort)
 * - 10 consecutive errors → resolves silently
 * Updates TransactionStorage on every poll.
 */
export function usePollBridgeStatus() {
  const { pollStatus } = useGenericPolling<BridgeStatus>({
    config: BRIDGE_CONFIG,
    terminalStates: BRIDGE_TERMINAL_STATES,
    throwOnTimeout: false,
    throwOnConsecutiveErrors: false,
  });

  const pollBridgeStatus = useCallback(
    async (txHash: string, { transactionId, onBridgeComplete }: PollBridgeStatusOptions): Promise<void> => {
      const endpoint = `/api/offramp/bridge/status/${txHash}`;

      try {
        await pollStatus(
          endpoint,
          { id: txHash, onSuccess: onBridgeComplete },
          (data) => {
            const status: BridgeStatus = (data.data?.status ?? data.status ?? 'pending') as BridgeStatus;
            TransactionStorage.update(transactionId, { bridgeStatus: status });
            return status;
          },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          message.includes('expired')
            ? 'Bridge transfer expired. Please try again.'
            : 'Bridge transfer failed. Please contact support.'
        );
      }
    },
    [pollStatus]
  );

  return { pollBridgeStatus };
}
