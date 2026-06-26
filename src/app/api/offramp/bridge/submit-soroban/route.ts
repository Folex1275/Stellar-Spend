import { NextRequest, NextResponse } from 'next/server';
import { decodeTxResultXdr, extractErrorMessage } from '@/lib/offramp/utils/errors';
import { withIdempotency } from '@/lib/idempotency';

export const maxDuration = 15;

/**
 * POST /api/offramp/bridge/submit-soroban
 * 
 * Submits a signed Stellar XDR transaction to the Soroban RPC.
 * Requires Idempotency-Key header to prevent duplicate submissions.
 * 
 * Request body:
 * {
 *   signedXdr: string (signed transaction XDR)
 * }
 * 
 * Response:
 * {
 *   status: 'PENDING' | 'SUCCESS' | 'ERROR'
 *   hash: string
 *   error?: string (only if status is ERROR)
 * }
 */
export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    const { signedXdr } = await req.json();

    if (!signedXdr) {
      return NextResponse.json({ error: 'signedXdr is required' }, { status: 400 });
    }

    const rpcUrl = process.env.STELLAR_SOROBAN_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: 'Soroban RPC URL not configured' }, { status: 500 });
    }

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: { transaction: signedXdr },
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message ?? 'RPC error' }, { status: 400 });
    }

    const result = data.result;
    const status = result?.status ?? 'PENDING';
    const hash = result?.hash;

    // Handle different statuses
    if (status === 'PENDING') {
      return NextResponse.json({ status: 'PENDING', hash });
    }

    if (status === 'SUCCESS') {
      return NextResponse.json({ status: 'SUCCESS', hash });
    }

    if (status === 'DUPLICATE') {
      return NextResponse.json({ status: 'PENDING', hash });
    }

    if (status === 'ERROR' || status === 'TRY_AGAIN_LATER') {
      // Decode error result XDR
      const errorMessage = decodeTxResultXdr(result?.errorResultXdr);
      
      // Log diagnostic events on error
      if (result?.diagnosticEventsXdr) {
        console.error('Diagnostic events:', result.diagnosticEventsXdr);
      }

      return NextResponse.json(
        { error: errorMessage || 'Transaction failed' },
        { status: 400 }
      );
    }

    // Default response for unknown status
    return NextResponse.json({ status: status || 'PENDING', hash });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  });
}
