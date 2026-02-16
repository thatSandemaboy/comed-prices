// Server-side ComEd operations that require database access
// This file should ONLY be imported in server components or API routes

import { get5MinutePrices, getCurrentHourAverage } from './comed-api';
import { insertPrice, getLatestPrice } from './db';

/**
 * Fetch and store prices in the database
 * Called by the background worker every 5 minutes
 */
export async function fetchAndStorePrices() {
  // Get the latest stored timestamp to avoid duplicates
  const latest = getLatestPrice();
  const startDate = latest
    ? new Date(latest.timestamp * 1000)
    : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours

  const prices = await get5MinutePrices(startDate);

  let inserted = 0;
  for (const price of prices) {
    const timestamp = Math.floor(price.millisUTC / 1000);
    const result = insertPrice(timestamp, price.price);
    if (result.changes > 0) inserted++;
  }

  return { total: prices.length, inserted };
}

export { getCurrentHourAverage };
