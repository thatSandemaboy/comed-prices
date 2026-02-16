import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeBestTimes,
  findBestTimeForActivity,
  getTypicalPatterns,
  getCurrentTrend,
  ACTIVITY_PRESETS,
} from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const activity = searchParams.get('activity') as keyof typeof ACTIVITY_PRESETS | null;
  const dayOfWeek = searchParams.get('dayOfWeek');

  try {
    // Get current trend
    const trend = getCurrentTrend();

    // Get typical patterns
    const patterns = getTypicalPatterns();

    // If an activity is specified, return activity-specific recommendations
    if (activity && activity in ACTIVITY_PRESETS) {
      const targetDay = dayOfWeek !== null ? parseInt(dayOfWeek) : undefined;
      const recommendation = findBestTimeForActivity(activity, targetDay);

      return NextResponse.json({
        activity: recommendation,
        trend,
        patterns,
      });
    }

    // Otherwise, return general best times
    const targetDay = dayOfWeek !== null ? parseInt(dayOfWeek) : undefined;
    const bestTimes = analyzeBestTimes(targetDay);

    return NextResponse.json({
      bestTimes: bestTimes.slice(0, 24), // Top 24 time slots
      trend,
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
      { error: 'Unable to analyze best times. Historical data may not be available yet.' },
      { status: 500 }
    );
  }
}
