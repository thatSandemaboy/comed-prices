import { NextRequest, NextResponse } from 'next/server';
import { get5MinutePrices, getHourlyAverages } from '@/lib/comed-api';
import { getPriceHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '24');
  const type = searchParams.get('type') || '5min'; // '5min' or 'hourly'
  const source = searchParams.get('source') || 'api'; // 'api' or 'db'

  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

    if (source === 'db') {
      // Get from our local database
      const startTime = Math.floor(startDate.getTime() / 1000);
      const endTime = Math.floor(now.getTime() / 1000);
      const prices = getPriceHistory(startTime, endTime);

      return NextResponse.json({
        prices: prices.map((p) => ({
          timestamp: p.timestamp * 1000,
          price: p.price,
        })),
        source: 'database',
        count: prices.length,
      });
    }

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

    // Fallback to database
    const startTime = Math.floor(Date.now() / 1000) - hours * 60 * 60;
    const endTime = Math.floor(Date.now() / 1000);
    const prices = getPriceHistory(startTime, endTime);

    if (prices.length > 0) {
      return NextResponse.json({
        prices: prices.map((p) => ({
          timestamp: p.timestamp * 1000,
          price: p.price,
        })),
        source: 'database-fallback',
        count: prices.length,
      });
    }

    return NextResponse.json(
      { error: 'Unable to fetch price history' },
      { status: 500 }
    );
  }
}
