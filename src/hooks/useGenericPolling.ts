'use client';

import { useCallback, useRef } from 'react';
import { usePollingManager, DurationExceededError, ConsecutiveErrorsExceededError } from '@/lib/polling/polling-manager';
import type { StatusResponse } from '@/lib/polling/polling-manager';
import type { PollingConfig } from '@/lib/polling/backoff';

export interface UsePollingOptions<T> {
  config: PollingConfig;
  terminalStates: T[];
  onTerminalState?: (state: T) => void;
  onError?: (error: Error) => void;
  updateStorage?: (status: T) => void;
  onTimeout?: () => void;
  onConsecutiveErrors?: () => void;
  throwOnTimeout?: boolean;
  throwOnConsecutiveErrors?: boolean;
}

export interface PollStatusOptions {
  id: string;
  onSuccess?: () => void;
}

/**
 * Generic polling hook for status endpoints.
 * Single primitive that all specific polling hooks delegate to.
 * Handles backoff, jitter, cancellation, terminal states, error handling, and storage updates.
 */
export function useGenericPolling<T extends string>({
  config,
  terminalStates,
  onTerminalState,
  onError,
  updateStorage,
  onTimeout,
  onConsecutiveErrors,
  throwOnTimeout = true,
  throwOnConsecutiveErrors = true,
}: UsePollingOptions<T>) {
  const { start } = usePollingManager(config);
  const terminalStatesRef = useRef(terminalStates);
  terminalStatesRef.current = terminalStates;

  const pollStatus = useCallback(
    async (
      endpoint: string,
      options: PollStatusOptions,
      parseResponse: (data: any) => T,
      fetchOptions?: { method?: string; headers?: Record<string, string>; body?: BodyInit },
    ): Promise<void> => {
      const fetchFn = async (id: string, signal: AbortSignal): Promise<StatusResponse> => {
        const res = await fetch(endpoint, {
          cache: 'no-store',
          signal,
          ...fetchOptions,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to fetch status');
        }

        const status = parseResponse(data);

        updateStorage?.(status);

        const isTerminal = terminalStatesRef.current.includes(status);

        return { status, id, isTerminal };
      };

      try {
        const result = await start(options.id, fetchFn, () => {});
        const status = result.status as T;

        if (terminalStatesRef.current.includes(status)) {
          onTerminalState?.(status);
          options.onSuccess?.();
          return;
        }
      } catch (err) {
        if (err instanceof DurationExceededError) {
          onTimeout?.();
          onError?.(err);
          if (throwOnTimeout) {
            throw new Error('Polling timeout');
          }
          return;
        }
        if (err instanceof ConsecutiveErrorsExceededError) {
          onConsecutiveErrors?.();
          onError?.(err);
          if (throwOnConsecutiveErrors) {
            throw new Error('Too many consecutive network errors. Please check your connection.');
          }
          return;
        }
        throw err;
      }
    },
    [start, onTerminalState, onError, updateStorage, onTimeout, onConsecutiveErrors, throwOnTimeout, throwOnConsecutiveErrors]
  );

  return { pollStatus };
}
