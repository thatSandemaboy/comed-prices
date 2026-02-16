import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://hourlypricing.comed.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '24');

  try {
    // Fetch from ComEd API without date params (returns ~24 hours of data)
    const response = await fetch(`${BASE_URL}/api?type=5minutefeed`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`ComEd API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid response format');
    }

    // Filter to requested time range
    const now = Date.now();
    const cutoff = now - hours * 60 * 60 * 1000;

    const prices = data
      .map((item: { millisUTC: string; price: string }) => ({
        timestamp: parseInt(item.millisUTC),
        price: parseFloat(item.price),
      }))
      .filter((p: { timestamp: number }) => p.timestamp >= cutoff)
      .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);

    return NextResponse.json({
      prices,
      source: 'comed-api',
      count: prices.length,
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(
      { error: 'Unable to fetch price history' },
      { status: 500 }
    );
  }
}
