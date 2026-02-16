'use client';

import { useEffect, useState } from 'react';

interface PriceData {
  current: {
    price: number;
    timestamp: number;
    color: string;
    fromCache?: boolean;
  };
  today: {
    min: number;
    max: number;
    avg: number;
  } | null;
}

function getPriceColor(price: number): 'green' | 'yellow' | 'red' {
  if (price < 3) return 'green';
  if (price < 6) return 'yellow';
  return 'red';
}

function formatPrice(price: number): string {
  return `${price.toFixed(1)}¢/kWh`;
}

const colorClasses = {
  green: 'text-green-500 bg-green-500/10',
  yellow: 'text-yellow-500 bg-yellow-500/10',
  red: 'text-red-500 bg-red-500/10',
};

export default function PriceDisplay() {
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const response = await fetch('/api/price/current');
        if (!response.ok) throw new Error('Failed to fetch price');
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError('Unable to load price data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600 dark:text-red-400">
        {error || 'No data available'}
      </div>
    );
  }

  const color = getPriceColor(data.current.price);

  return (
    <div className="space-y-4">
      {/* Main price display */}
      <div className={`p-8 rounded-2xl ${colorClasses[color]}`}>
        <div className="text-sm font-medium opacity-70 mb-1">Current Price</div>
        <div className="text-5xl font-bold tracking-tight">
          {formatPrice(data.current.price)}
        </div>
        <div className="text-sm opacity-70 mt-2">
          Updated {new Date(data.current.timestamp).toLocaleTimeString()}
          {data.current.fromCache && ' (cached)'}
        </div>
      </div>

      {/* Today's stats */}
      {data.today && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Today&apos;s Low</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">
              {data.today.min?.toFixed(1)}¢
            </div>
          </div>
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Average</div>
            <div className="text-xl font-semibold">
              {data.today.avg?.toFixed(1)}¢
            </div>
          </div>
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Today&apos;s High</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">
              {data.today.max?.toFixed(1)}¢
            </div>
          </div>
        </div>
      )}

      {/* Price indicator legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>&lt;3¢ Great</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>3-6¢ Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>&gt;6¢ High</span>
        </div>
      </div>
    </div>
  );
}
