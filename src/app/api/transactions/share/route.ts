import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { globalContainer } from '@/lib/di';
import { SERVICE_KEYS } from '@/lib/di/registry';
import { ShareSettings } from '@/types/sharing';

export async function POST(req: NextRequest) {
  try {
    const userAddress = req.headers.get('x-user-address');
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 401 });
    }

    const { transactionId, settings }: { transactionId: string; settings: ShareSettings } =
      await req.json();

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const svc = await globalContainer.resolve(SERVICE_KEYS.SHARING_SERVICE);
    const share = await svc.createShareLink(transactionId, userAddress, settings);

    return NextResponse.json(share, { status: 201 });
  } catch (error) {
    logger.error('Error creating share link:', {}, error);
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userAddress = req.headers.get('x-user-address');
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 401 });
    }

    const svc = await globalContainer.resolve(SERVICE_KEYS.SHARING_SERVICE);
    const shares = await svc.getUserShareLinks(userAddress);

    return NextResponse.json(shares);
  } catch (error) {
    logger.error('Error fetching share links:', {}, error);
    return NextResponse.json(
      { error: 'Failed to fetch share links' },
      { status: 500 }
    );
  }
}
