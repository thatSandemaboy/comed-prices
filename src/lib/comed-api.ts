// ComEd Hourly Pricing API Client
// API Docs: https://hourlypricing.comed.com/hp-api/

const BASE_URL = 'https://hourlypricing.comed.com';

export interface PricePoint {
  millisUTC: number;
  price: number;
}

export interface CurrentHourAverage {
  millisUTC: number;
  price: number;
}

/**
 * Get the current hour average price
 * API: https://hourlypricing.comed.com/api?type=currenthouraverage
 */
export async function getCurrentHourAverage(): Promise<CurrentHourAverage> {
  const response = await fetch(`${BASE_URL}/api?type=currenthouraverage`, {
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current hour average: ${response.status}`);
  }

  const data = await response.json();
  // Response format: [{"millisUTC":"1707764400000","price":"2.3"}]
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid response format from current hour average API');
  }

  return {
    millisUTC: parseInt(data[0].millisUTC),
    price: parseFloat(data[0].price),
  };
}

/**
 * Get 5-minute price data
 * API: https://hourlypricing.comed.com/api?type=5minutefeed
 * Optional: &datestart=YYYYMMDDHHMM&dateend=YYYYMMDDHHMM
 */
export async function get5MinutePrices(
  dateStart?: Date,
  dateEnd?: Date
): Promise<PricePoint[]> {
  let url = `${BASE_URL}/api?type=5minutefeed`;

  if (dateStart) {
    url += `&datestart=${formatApiDate(dateStart)}`;
  }
  if (dateEnd) {
    url += `&dateend=${formatApiDate(dateEnd)}`;
  }

  const response = await fetch(url, {
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch 5-minute prices: ${response.status}`);
  }

  const data = await response.json();
  // Response format: [{"millisUTC":"1707764700000","price":"2.3"}, ...]
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from 5-minute feed API');
  }

  return data.map((item: { millisUTC: string; price: string }) => ({
    millisUTC: parseInt(item.millisUTC),
    price: parseFloat(item.price),
  }));
}

/**
 * Get hourly average prices (historical)
 * API: https://hourlypricing.comed.com/api?type=hourlyaverage
 * Returns: hourly averages for specified date range (up to 90+ days)
 */
export async function getHourlyAverages(
  dateStart?: Date,
  dateEnd?: Date
): Promise<PricePoint[]> {
  let url = `${BASE_URL}/api?type=hourlyaverage`;

  if (dateStart) {
    url += `&datestart=${formatApiDate(dateStart)}`;
  }
  if (dateEnd) {
    url += `&dateend=${formatApiDate(dateEnd)}`;
  }

  const response = await fetch(url, {
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch hourly averages: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from hourly average API');
  }

  return data.map((item: { millisUTC: string; price: string }) => ({
    millisUTC: parseInt(item.millisUTC),
    price: parseFloat(item.price),
  }));
}

/**
 * Get day-ahead predictions (undocumented API - may not always work)
 * Based on research, this fetches predictions from ComEd's internal data
 */
export async function getDayAheadPredictions(): Promise<PricePoint[] | null> {
  try {
    // Try the undocumented day-ahead endpoint
    const response = await fetch(`${BASE_URL}/api?type=daynexttocome`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return data.map((item: { millisUTC: string; price: string }) => ({
      millisUTC: parseInt(item.millisUTC),
      price: parseFloat(item.price),
    }));
  } catch {
    // Day-ahead API is undocumented, may not always work
    return null;
  }
}

/**
 * Format date for ComEd API (YYYYMMDDHHMM format)
 */
function formatApiDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
}

/**
 * Get price color based on value (for UI display)
 * Green = cheap, Yellow = moderate, Red = expensive
 */
export function getPriceColor(price: number): 'green' | 'yellow' | 'red' {
  if (price < 3) return 'green';
  if (price < 6) return 'yellow';
  return 'red';
}

/**
 * Format price for display (e.g., "2.5¢/kWh")
 */
export function formatPrice(price: number): string {
  return `${price.toFixed(1)}¢/kWh`;
}
