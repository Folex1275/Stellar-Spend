import { NextRequest, NextResponse } from 'next/server';
import { globalContainer } from '@/lib/di';
import { SERVICE_KEYS } from '@/lib/di/registry';
import { QRCodeData } from '@/types/qrcode';

export async function POST(req: NextRequest) {
  try {
    const { transactionId, data }: { transactionId: string; data: QRCodeData } =
      await req.json();

    if (!transactionId || !data) {
      return NextResponse.json(
        { error: 'Transaction ID and data are required' },
        { status: 400 }
      );
    }

    const svc = await globalContainer.resolve(SERVICE_KEYS.QRCODE_SERVICE);
    const qrCode = await svc.createQRCode(transactionId, data);

    return NextResponse.json(qrCode, { status: 201 });
  } catch (error) {
    console.error('Error creating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to create QR code' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const transactionId = req.nextUrl.searchParams.get('transactionId');
    const format = (req.nextUrl.searchParams.get('format') || 'svg') as 'svg' | 'png';

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const svc = await globalContainer.resolve(SERVICE_KEYS.QRCODE_SERVICE);
    const qrCode = await svc.getQRCode(transactionId);

    if (!qrCode) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
    }

    // If requesting SVG format, return as SVG
    if (format === 'svg') {
      const data = svc.parseQRData(qrCode.qrData);
      if (!data) {
        return NextResponse.json({ error: 'Invalid QR data' }, { status: 400 });
      }

      const svg = svc.generateSVGPattern(qrCode.qrData, 200);
      return new NextResponse(svg, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }

    return NextResponse.json(qrCode);
  } catch (error) {
    console.error('Error fetching QR code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QR code' },
      { status: 500 }
    );
  }
}
