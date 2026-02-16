'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface ChartData {
  time: string;
  price: number;
  hour: number;
}

export default function PriceChart({ hours = 24 }: { hours?: number }) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/price/history?hours=${hours}`);
        if (!response.ok) throw new Error('Failed to fetch history');
        const result = await response.json();

        const chartData = result.prices.map((p: PricePoint) => {
          const date = new Date(p.timestamp);
          return {
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            price: p.price,
            hour: date.getHours(),
          };
        });

        setData(chartData);
        setError(null);
      } catch (err) {
        setError('Unable to load chart data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
    const interval = setInterval(fetchHistory, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [hours]);

  if (loading) {
    return (
      <div className="animate-pulse h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500">
        {error || 'No chart data available'}
      </div>
    );
  }

  const avgPrice = data.reduce((sum, d) => sum + d.price, 0) / data.length;
  const maxPrice = Math.max(...data.map((d) => d.price));
  const minPrice = Math.min(...data.map((d) => d.price));

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Last {hours} Hours</h3>
        <div className="text-sm text-zinc-500">
          Avg: {avgPrice.toFixed(1)}¢ | Range: {minPrice.toFixed(1)}-{maxPrice.toFixed(1)}¢
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
                return (
                  <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                    <div className="text-sm text-zinc-500">{d.time}</div>
                    <div className="text-lg font-semibold">{d.price.toFixed(2)}¢/kWh</div>
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
          <Line
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
