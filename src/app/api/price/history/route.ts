import { NextRequest, NextResponse } from 'next/server';
import { get5MinutePrices, getHourlyAverages } from '@/lib/comed-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '24');
  const type = searchParams.get('type') || '5min'; // '5min' or 'hourly'

  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Get from ComEd API
    let prices;
    if (type === 'hourly') {
      prices = await getHourlyAverages(startDate, now);
    } else {
      prices = await get5MinutePrices(startDate, now);
    }

    return NextResponse.json({
      prices: prices.map((p) => ({
        timestamp: p.millisUTC,
        price: p.price,
      })),
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
