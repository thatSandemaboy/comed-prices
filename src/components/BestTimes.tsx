'use client';

import { useEffect, useState } from 'react';

interface Activity {
  key: string;
  name: string;
  durationHours: number;
}

interface BestTime {
  startHour: number;
  endHour: number;
  dayOfWeek: number;
  avgScore: number;
  recommendation: string;
}

interface ActivityRecommendation {
  activity: string;
  durationHours: number;
  bestTimes: BestTime[];
}

interface Pattern {
  cheapestHours: { hour: number; avgPrice: number }[];
  expensiveHours: { hour: number; avgPrice: number }[];
  weekendDiscount: number;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export default function BestTimes() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<ActivityRecommendation | null>(null);
  const [patterns, setPatterns] = useState<Pattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/analysis/best-times');
        if (!response.ok) throw new Error('Failed to fetch analysis');
        const result = await response.json();
        setActivities(result.activities || []);
        setPatterns(result.patterns);
        setError(null);
      } catch (err) {
        setError('Analysis requires historical data. Please wait for data collection.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedActivity) {
      setRecommendation(null);
      return;
    }

    async function fetchRecommendation() {
      try {
        const response = await fetch(`/api/analysis/best-times?activity=${selectedActivity}`);
        if (!response.ok) throw new Error('Failed to fetch recommendation');
        const result = await response.json();
        setRecommendation(result.activity);
      } catch (err) {
        console.error(err);
      }
    }

    fetchRecommendation();
  }, [selectedActivity]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-700 dark:text-yellow-300 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Activity selector */}
      <div>
        <label className="block text-sm font-medium mb-2">
          What do you want to run?
        </label>
        <div className="flex flex-wrap gap-2">
          {activities.map((activity) => (
            <button
              key={activity.key}
              onClick={() => setSelectedActivity(
                selectedActivity === activity.key ? null : activity.key
              )}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedActivity === activity.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {activity.name}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Best times for {recommendation.activity}
          </h4>
          <div className="space-y-2">
            {recommendation.bestTimes.slice(0, 3).map((time, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg"
              >
                <div>
                  <div className="font-medium">
                    {dayNames[time.dayOfWeek]} {formatHour(time.startHour)} - {formatHour(time.endHour)}
                  </div>
                  <div className="text-sm text-zinc-500">
                    {recommendation.durationHours}h duration
                  </div>
                </div>
                <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                  time.avgScore < 0.25 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  time.avgScore < 0.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {time.recommendation.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Typical patterns */}
      {patterns && !selectedActivity && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">
              Cheapest Hours (Typical)
            </h4>
            <div className="space-y-2">
              {patterns.cheapestHours.map((h, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{formatHour(h.hour)}</span>
                  <span className="text-green-700 dark:text-green-400 font-medium">
                    ~{h.avgPrice.toFixed(1)}¢
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-3">
              Most Expensive (Avoid)
            </h4>
            <div className="space-y-2">
              {patterns.expensiveHours.map((h, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{formatHour(h.hour)}</span>
                  <span className="text-red-700 dark:text-red-400 font-medium">
                    ~{h.avgPrice.toFixed(1)}¢
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekend tip */}
      {patterns && patterns.weekendDiscount > 5 && (
        <div className="text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
          Tip: Weekends are typically {patterns.weekendDiscount.toFixed(0)}% cheaper than weekdays
        </div>
      )}
    </div>
  );
}
