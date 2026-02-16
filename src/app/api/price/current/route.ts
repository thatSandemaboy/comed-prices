import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://hourlypricing.comed.com';

function getPriceColor(price: number): 'green' | 'yellow' | 'red' {
  if (price < 3) return 'green';
  if (price < 6) return 'yellow';
  return 'red';
}

export async function GET() {
  try {
    // Get current hour average
    const currentResponse = await fetch(`${BASE_URL}/api?type=currenthouraverage`, {
      cache: 'no-store',
    });

    if (!currentResponse.ok) {
      throw new Error(`ComEd API error: ${currentResponse.status}`);
    }

    const currentData = await currentResponse.json();
    if (!Array.isArray(currentData) || currentData.length === 0) {
      throw new Error('Invalid current price response');
    }

    const price = parseFloat(currentData[0].price);
    const timestamp = parseInt(currentData[0].millisUTC);

    // Get 5-minute feed for today's stats
    let todayStats = null;
    try {
      const historyResponse = await fetch(`${BASE_URL}/api?type=5minutefeed`, {
        cache: 'no-store',
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (Array.isArray(historyData) && historyData.length > 0) {
          // Filter to today only
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const startOfDayMs = startOfDay.getTime();

          const todayPrices = historyData
            .filter((item: { millisUTC: string }) => parseInt(item.millisUTC) >= startOfDayMs)
            .map((item: { price: string }) => parseFloat(item.price));

          if (todayPrices.length > 0) {
            todayStats = {
              min: Math.min(...todayPrices),
              max: Math.max(...todayPrices),
              avg: todayPrices.reduce((a: number, b: number) => a + b, 0) / todayPrices.length,
            };
          }
        }
      }
    } catch {
      // Stats are optional
    }

    return NextResponse.json({
      current: {
        price,
        timestamp,
        color: getPriceColor(price),
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
