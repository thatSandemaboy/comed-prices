import { NextResponse } from 'next/server';
import { getDayAheadPredictions as fetchDayAhead } from '@/lib/comed-api';
import { getDayAheadPredictions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // First try to fetch fresh day-ahead predictions from ComEd
    const apiPredictions = await fetchDayAhead();

    if (apiPredictions && apiPredictions.length > 0) {
      return NextResponse.json({
        predictions: apiPredictions.map((p) => ({
          timestamp: p.millisUTC,
          price: p.price,
        })),
        source: 'comed-api',
        available: true,
      });
    }

    // Fall back to database if API doesn't return predictions
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const dbPredictions = getDayAheadPredictions(
      Math.floor(tomorrow.getTime() / 1000),
      Math.floor(dayAfterTomorrow.getTime() / 1000)
    );

    if (dbPredictions.length > 0) {
      return NextResponse.json({
        predictions: dbPredictions.map((p) => ({
          timestamp: p.hour_start * 1000,
          price: p.predicted_price,
        })),
        source: 'database',
        available: true,
      });
    }

    // No predictions available
    return NextResponse.json({
      predictions: [],
      source: null,
      available: false,
      message:
        'Day-ahead predictions are typically available after 4 PM for the next day',
    });
  } catch (error) {
    console.error('Error fetching day-ahead predictions:', error);

    return NextResponse.json({
      predictions: [],
      source: null,
      available: false,
      error: 'Unable to fetch day-ahead predictions',
    });
  }
}
