import { NextRequest, NextResponse } from 'next/server';
import { getHourlyAverages } from '@/lib/comed-api';

export const dynamic = 'force-dynamic';

// Activity presets with typical durations
const ACTIVITY_PRESETS = {
  laundry: { name: 'Laundry', durationHours: 1.5 },
  dishwasher: { name: 'Dishwasher', durationHours: 1 },
  ev_charging: { name: 'EV Charging', durationHours: 8 },
  pool_pump: { name: 'Pool Pump', durationHours: 4 },
  hvac_precool: { name: 'Pre-cool/Pre-heat', durationHours: 2 },
  water_heater: { name: 'Water Heater', durationHours: 1 },
} as const;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const activity = searchParams.get('activity') as keyof typeof ACTIVITY_PRESETS | null;

  try {
    // Get last 7 days of hourly data for pattern analysis
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hourlyPrices = await getHourlyAverages(weekAgo, now);

    // Group by hour of day
    const hourlyAvg = new Map<number, { total: number; count: number }>();
    for (const p of hourlyPrices) {
      const hour = new Date(p.millisUTC).getHours();
      const current = hourlyAvg.get(hour) || { total: 0, count: 0 };
      current.total += p.price;
      current.count += 1;
      hourlyAvg.set(hour, current);
    }

    // Calculate average price per hour
    const hourlyData = Array.from(hourlyAvg.entries())
      .map(([hour, data]) => ({
        hour,
        avgPrice: data.total / data.count,
      }))
      .sort((a, b) => a.avgPrice - b.avgPrice);

    // Patterns
    const patterns = {
      cheapestHours: hourlyData.slice(0, 5),
      expensiveHours: hourlyData.slice(-5).reverse(),
      weekendDiscount: 0, // Would need more data to calculate
    };

    // Activity-specific recommendation
    if (activity && activity in ACTIVITY_PRESETS) {
      const preset = ACTIVITY_PRESETS[activity];
      const durationHours = Math.ceil(preset.durationHours);

      // Find best contiguous window
      const bestTimes = [];
      for (let startHour = 0; startHour <= 24 - durationHours; startHour++) {
        let totalPrice = 0;
        let valid = true;
        for (let h = 0; h < durationHours; h++) {
          const hourData = hourlyData.find(d => d.hour === (startHour + h) % 24);
          if (hourData) {
            totalPrice += hourData.avgPrice;
          } else {
            valid = false;
            break;
          }
        }
        if (valid) {
          bestTimes.push({
            startHour,
            endHour: (startHour + durationHours) % 24,
            dayOfWeek: new Date().getDay(),
            avgScore: totalPrice / durationHours / 10, // Normalize
            recommendation: totalPrice / durationHours < 3
              ? 'Excellent time to run'
              : totalPrice / durationHours < 5
                ? 'Good time to run'
                : 'Fair - consider waiting',
          });
        }
      }
      bestTimes.sort((a, b) => a.avgScore - b.avgScore);

      return NextResponse.json({
        activity: {
          activity: preset.name,
          durationHours: preset.durationHours,
          bestTimes: bestTimes.slice(0, 5),
        },
        trend: { trend: 'stable', changePercent: 0 },
        patterns,
      });
    }

    // General best times
    const bestTimes = hourlyData.map(h => ({
      dayOfWeek: new Date().getDay(),
      hour: h.hour,
      score: h.avgPrice / 10,
      avgPrice: h.avgPrice,
      volatility: 0,
      recommendation: h.avgPrice < 3 ? 'excellent' : h.avgPrice < 5 ? 'good' : h.avgPrice < 7 ? 'fair' : 'poor',
    }));

    return NextResponse.json({
      bestTimes: bestTimes.slice(0, 24),
      trend: { trend: 'stable', changePercent: 0 },
      patterns,
      activities: Object.entries(ACTIVITY_PRESETS).map(([key, value]) => ({
        key,
        name: value.name,
        durationHours: value.durationHours,
      })),
    });
  } catch (error) {
    console.error('Error analyzing best times:', error);
    return NextResponse.json(
      { error: 'Unable to analyze best times' },
      { status: 500 }
    );
  }
}
