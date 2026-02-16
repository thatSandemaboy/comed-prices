import { NextResponse } from 'next/server';
import { getCurrentHourAverage, getPriceColor } from '@/lib/comed-api';
import { getLatestPrice, getTodayStats } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Try to get live data from ComEd API
    const liveData = await getCurrentHourAverage();

    // Also get data from our database for comparison
    const dbPrice = getLatestPrice();
    const todayStats = getTodayStats();

    return NextResponse.json({
      current: {
        price: liveData.price,
        timestamp: liveData.millisUTC,
        color: getPriceColor(liveData.price),
      },
      today: todayStats
        ? {
            min: todayStats.min_price,
            max: todayStats.max_price,
            avg: todayStats.avg_price,
          }
        : null,
      lastDbUpdate: dbPrice
        ? {
            price: dbPrice.price,
            timestamp: dbPrice.timestamp * 1000,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching current price:', error);

    // Fallback to database if API fails
    const dbPrice = getLatestPrice();
    const todayStats = getTodayStats();

    if (dbPrice) {
      return NextResponse.json({
        current: {
          price: dbPrice.price,
          timestamp: dbPrice.timestamp * 1000,
          color: getPriceColor(dbPrice.price),
          fromCache: true,
        },
        today: todayStats
          ? {
              min: todayStats.min_price,
              max: todayStats.max_price,
              avg: todayStats.avg_price,
            }
          : null,
      });
    }

    return NextResponse.json(
      { error: 'Unable to fetch price data' },
      { status: 500 }
    );
  }
}
