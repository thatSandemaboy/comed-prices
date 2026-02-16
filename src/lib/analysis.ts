// Best-time analysis algorithms for ComEd pricing

import { getHourlyStats, getDayAheadPredictions, getPriceHistory } from './db';

export interface TimeSlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  score: number; // Lower is better (cheaper)
  avgPrice: number;
  predictedPrice?: number;
  volatility: number;
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ActivityRecommendation {
  activity: string;
  durationHours: number;
  bestTimes: {
    startHour: number;
    endHour: number;
    dayOfWeek: number;
    avgScore: number;
    recommendation: string;
  }[];
}

// Activity presets with typical durations
export const ACTIVITY_PRESETS = {
  laundry: { name: 'Laundry', durationHours: 1.5 },
  dishwasher: { name: 'Dishwasher', durationHours: 1 },
  ev_charging: { name: 'EV Charging', durationHours: 8 },
  pool_pump: { name: 'Pool Pump', durationHours: 4 },
  hvac_precool: { name: 'Pre-cool/Pre-heat', durationHours: 2 },
  water_heater: { name: 'Water Heater', durationHours: 1 },
} as const;

// Weights for scoring algorithm
const WEIGHTS = {
  predictedPrice: 0.6,
  historicalAvg: 0.3,
  volatilityPenalty: 0.1,
};

/**
 * Calculate best times for activities based on historical patterns and predictions
 */
export function analyzeBestTimes(targetDayOfWeek?: number): TimeSlot[] {
  const hourlyStats = getHourlyStats();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  // Get day-ahead predictions if available
  const predictions = getDayAheadPredictions(
    Math.floor(tomorrow.getTime() / 1000),
    Math.floor(dayAfterTomorrow.getTime() / 1000)
  );

  // Create a map of predictions by hour
  const predictionMap = new Map<number, number>();
  for (const pred of predictions) {
    const hour = new Date(pred.hour_start * 1000).getHours();
    predictionMap.set(hour, pred.predicted_price);
  }

  // Calculate global stats for normalization
  const allPrices = hourlyStats.map((s) => s.avg_price);
  const globalMin = Math.min(...allPrices);
  const globalMax = Math.max(...allPrices);
  const priceRange = globalMax - globalMin || 1;

  const allVolatilities = hourlyStats.map((s) => s.stddev_price);
  const maxVolatility = Math.max(...allVolatilities) || 1;

  // Generate time slots
  const slots: TimeSlot[] = [];

  for (const stat of hourlyStats) {
    // Filter by day if specified
    if (targetDayOfWeek !== undefined && stat.day_of_week !== targetDayOfWeek) {
      continue;
    }

    // Get predicted price for this hour (if tomorrow matches this day of week)
    const predictedPrice = predictionMap.get(stat.hour);

    // Calculate normalized scores (0-1, lower is better)
    const priceScore = (stat.avg_price - globalMin) / priceRange;
    const volatilityScore = stat.stddev_price / maxVolatility;

    // Combined score with weights
    let score: number;
    if (predictedPrice !== undefined) {
      const predictedScore = (predictedPrice - globalMin) / priceRange;
      score =
        WEIGHTS.predictedPrice * predictedScore +
        WEIGHTS.historicalAvg * priceScore +
        WEIGHTS.volatilityPenalty * volatilityScore;
    } else {
      // No predictions available, rely more on historical
      score =
        (WEIGHTS.predictedPrice + WEIGHTS.historicalAvg) * priceScore +
        WEIGHTS.volatilityPenalty * volatilityScore;
    }

    // Determine recommendation based on score
    let recommendation: TimeSlot['recommendation'];
    if (score < 0.25) recommendation = 'excellent';
    else if (score < 0.5) recommendation = 'good';
    else if (score < 0.75) recommendation = 'fair';
    else recommendation = 'poor';

    slots.push({
      dayOfWeek: stat.day_of_week,
      hour: stat.hour,
      score,
      avgPrice: stat.avg_price,
      predictedPrice,
      volatility: stat.stddev_price,
      recommendation,
    });
  }

  // Sort by score (best times first)
  return slots.sort((a, b) => a.score - b.score);
}

/**
 * Find best time windows for a specific activity duration
 */
export function findBestTimeForActivity(
  activityKey: keyof typeof ACTIVITY_PRESETS,
  targetDayOfWeek?: number
): ActivityRecommendation {
  const activity = ACTIVITY_PRESETS[activityKey];
  const slots = analyzeBestTimes(targetDayOfWeek);
  const durationHours = Math.ceil(activity.durationHours);

  // Group slots by day
  const slotsByDay = new Map<number, TimeSlot[]>();
  for (const slot of slots) {
    const daySlots = slotsByDay.get(slot.dayOfWeek) || [];
    daySlots.push(slot);
    slotsByDay.set(slot.dayOfWeek, daySlots);
  }

  // Find best contiguous windows for each day
  const bestTimes: ActivityRecommendation['bestTimes'] = [];

  for (const [dayOfWeek, daySlots] of slotsByDay) {
    // Sort by hour for contiguous window search
    daySlots.sort((a, b) => a.hour - b.hour);

    // Sliding window to find best consecutive hours
    let bestWindowStart = 0;
    let bestWindowScore = Infinity;

    for (let i = 0; i <= 24 - durationHours; i++) {
      // Calculate average score for this window
      let windowScore = 0;
      let validWindow = true;

      for (let j = 0; j < durationHours; j++) {
        const hour = (i + j) % 24;
        const slot = daySlots.find((s) => s.hour === hour);
        if (!slot) {
          validWindow = false;
          break;
        }
        windowScore += slot.score;
      }

      if (validWindow && windowScore / durationHours < bestWindowScore) {
        bestWindowScore = windowScore / durationHours;
        bestWindowStart = i;
      }
    }

    // Determine recommendation text
    let recommendationText: string;
    if (bestWindowScore < 0.25) recommendationText = 'Excellent time to run';
    else if (bestWindowScore < 0.5) recommendationText = 'Good time to run';
    else if (bestWindowScore < 0.75) recommendationText = 'Fair - consider waiting';
    else recommendationText = 'High prices - delay if possible';

    bestTimes.push({
      startHour: bestWindowStart,
      endHour: (bestWindowStart + durationHours) % 24,
      dayOfWeek,
      avgScore: bestWindowScore,
      recommendation: recommendationText,
    });
  }

  // Sort by score
  bestTimes.sort((a, b) => a.avgScore - b.avgScore);

  return {
    activity: activity.name,
    durationHours: activity.durationHours,
    bestTimes: bestTimes.slice(0, 5), // Top 5 recommendations
  };
}

/**
 * Get current price trend (rising, falling, stable)
 */
export function getCurrentTrend(): {
  trend: 'rising' | 'falling' | 'stable';
  changePercent: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const twoHoursAgo = now - 2 * 60 * 60;

  const recentPrices = getPriceHistory(twoHoursAgo, now);

  if (recentPrices.length < 4) {
    return { trend: 'stable', changePercent: 0 };
  }

  // Compare first half average to second half average
  const midpoint = Math.floor(recentPrices.length / 2);
  const firstHalf = recentPrices.slice(0, midpoint);
  const secondHalf = recentPrices.slice(midpoint);

  const firstAvg =
    firstHalf.reduce((sum, p) => sum + p.price, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, p) => sum + p.price, 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePercent > 10) return { trend: 'rising', changePercent };
  if (changePercent < -10) return { trend: 'falling', changePercent };
  return { trend: 'stable', changePercent };
}

/**
 * Get typical price patterns for display
 */
export function getTypicalPatterns(): {
  cheapestHours: { hour: number; avgPrice: number }[];
  expensiveHours: { hour: number; avgPrice: number }[];
  weekendDiscount: number;
} {
  const stats = getHourlyStats();

  // Calculate average by hour across all days
  const hourlyAvg = new Map<number, { total: number; count: number }>();
  for (const stat of stats) {
    const current = hourlyAvg.get(stat.hour) || { total: 0, count: 0 };
    current.total += stat.avg_price;
    current.count += 1;
    hourlyAvg.set(stat.hour, current);
  }

  const hourlyPrices = Array.from(hourlyAvg.entries()).map(([hour, data]) => ({
    hour,
    avgPrice: data.total / data.count,
  }));

  hourlyPrices.sort((a, b) => a.avgPrice - b.avgPrice);

  // Calculate weekend discount
  const weekdayStats = stats.filter(
    (s) => s.day_of_week >= 1 && s.day_of_week <= 5
  );
  const weekendStats = stats.filter(
    (s) => s.day_of_week === 0 || s.day_of_week === 6
  );

  const weekdayAvg =
    weekdayStats.reduce((sum, s) => sum + s.avg_price, 0) /
    (weekdayStats.length || 1);
  const weekendAvg =
    weekendStats.reduce((sum, s) => sum + s.avg_price, 0) /
    (weekendStats.length || 1);

  const weekendDiscount =
    weekdayAvg > 0 ? ((weekdayAvg - weekendAvg) / weekdayAvg) * 100 : 0;

  return {
    cheapestHours: hourlyPrices.slice(0, 5),
    expensiveHours: hourlyPrices.slice(-5).reverse(),
    weekendDiscount,
  };
}

/**
 * Format hour for display (e.g., "2 AM", "5 PM")
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Format day of week
 */
export function formatDayOfWeek(dow: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dow] || '';
}
