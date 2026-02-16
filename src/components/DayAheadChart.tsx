'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface Prediction {
  timestamp: number;
  price: number;
}

interface ChartData {
  time: string;
  hour: number;
  price: number;
}

export default function DayAheadChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        const response = await fetch('/api/price/day-ahead');
        if (!response.ok) throw new Error('Failed to fetch predictions');
        const result = await response.json();

        setAvailable(result.available);
        setMessage(result.message || null);

        if (result.predictions && result.predictions.length > 0) {
          const chartData = result.predictions.map((p: Prediction) => {
            const date = new Date(p.timestamp);
            return {
              time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              hour: date.getHours(),
              price: p.price,
            };
          });
          setData(chartData);
        }
      } catch (err) {
        console.error('Failed to fetch day-ahead predictions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPredictions();
    // Refresh every hour
    const interval = setInterval(fetchPredictions, 3600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
    );
  }

  if (!available || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 text-center p-4">
        <div>
          <p className="font-medium">Day-Ahead Predictions Unavailable</p>
          <p className="text-sm mt-1">
            {message || 'Predictions are typically available after 4 PM for the next day'}
          </p>
        </div>
      </div>
    );
  }

  const avgPrice = data.reduce((sum, d) => sum + d.price, 0) / data.length;
  const maxPrice = Math.max(...data.map((d) => d.price));
  const minPrice = Math.min(...data.map((d) => d.price));

  // Find cheapest hours
  const sortedByPrice = [...data].sort((a, b) => a.price - b.price);
  const cheapestHours = sortedByPrice.slice(0, 3);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Tomorrow&apos;s Predicted Prices</h3>
          <p className="text-sm text-zinc-500">Based on day-ahead market</p>
        </div>
        <div className="text-sm text-zinc-500">
          Range: {minPrice.toFixed(1)}-{maxPrice.toFixed(1)}¢
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}¢`}
            width={45}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload;
                const isLowest = cheapestHours.some(h => h.hour === d.hour);
                return (
                  <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                    <div className="text-sm text-zinc-500">{d.time}</div>
                    <div className="text-lg font-semibold">{d.price.toFixed(2)}¢/kWh</div>
                    {isLowest && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Good time to run appliances
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine
            y={avgPrice}
            stroke="#9ca3af"
            strokeDasharray="3 3"
            label={{ value: 'Avg', position: 'right', fill: '#9ca3af', fontSize: 10 }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#priceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Cheapest hours summary */}
      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="text-sm font-medium mb-2">Best Times Tomorrow</div>
        <div className="flex flex-wrap gap-2">
          {cheapestHours.map((h, i) => (
            <div
              key={i}
              className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
            >
              {formatHour(h.hour)} - {h.price.toFixed(1)}¢
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}
