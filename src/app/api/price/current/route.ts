import { NextResponse } from 'next/server';
import { getCurrentHourAverage, get5MinutePrices, getPriceColor } from '@/lib/comed-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Get live data from ComEd API
    const liveData = await getCurrentHourAverage();

    // Get today's prices for stats
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let todayStats = null;
    try {
      const todayPrices = await get5MinutePrices(startOfDay);
      if (todayPrices.length > 0) {
        const prices = todayPrices.map(p => p.price);
        todayStats = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: prices.reduce((a, b) => a + b, 0) / prices.length,
        };
      }
    } catch {
      // Stats are optional
    }

    return NextResponse.json({
      current: {
        price: liveData.price,
        timestamp: liveData.millisUTC,
        color: getPriceColor(liveData.price),
      },
      today: todayStats,
    });
  } catch (error) {
    console.error('Error fetching current price:', error);
    return NextResponse.json(
      { error: 'Unable to fetch price data' },
      { status: 500 }
    );
  }
}
