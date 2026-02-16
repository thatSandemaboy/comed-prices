// Background Worker for ComEd Price Collection
// Run with: npm run worker

import cron from 'node-cron';
import { fetchAndStorePrices, getCurrentHourAverage } from '../src/lib/comed-server';
import { getDayAheadPredictions } from '../src/lib/comed-api';
import { checkAndNotify } from '../src/lib/notifications';
import { insertDayAheadPrediction, updateHourlyStats } from '../src/lib/db';

const LOG_PREFIX = '[ComEd Worker]';

function log(message: string) {
  console.log(`${LOG_PREFIX} ${new Date().toISOString()} - ${message}`);
}

async function collectPrices() {
  try {
    log('Fetching prices from ComEd...');
    const result = await fetchAndStorePrices();
    log(`Stored ${result.inserted} new prices (${result.total} received)`);

    // Check alerts
    const currentPrice = await getCurrentHourAverage();
    log(`Current price: ${currentPrice.price}¢/kWh`);

    const alertResult = await checkAndNotify(currentPrice.price);
    if (alertResult.alertsTriggered > 0) {
      log(
        `Triggered ${alertResult.alertsTriggered} alerts ` +
        `(${alertResult.pushSent} push, ${alertResult.emailSent} email)`
      );
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error collecting prices:`, error);
  }
}

async function collectDayAhead() {
  try {
    log('Fetching day-ahead predictions...');
    const predictions = await getDayAheadPredictions();

    if (!predictions || predictions.length === 0) {
      log('No day-ahead predictions available');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    let inserted = 0;

    for (const pred of predictions) {
      const hourStart = Math.floor(pred.millisUTC / 1000);
      insertDayAheadPrediction(hourStart, pred.price, now);
      inserted++;
    }

    log(`Stored ${inserted} day-ahead predictions`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error collecting day-ahead:`, error);
  }
}

async function computeStats() {
  try {
    log('Computing hourly statistics...');
    updateHourlyStats();
    log('Hourly statistics updated');
  } catch (error) {
    console.error(`${LOG_PREFIX} Error computing stats:`, error);
  }
}

// Main entry point
async function main() {
  log('Starting ComEd Price Collector Worker');

  // Initial collection on startup
  await collectPrices();
  await collectDayAhead();
  await computeStats();

  // Schedule price collection every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    collectPrices();
  });

  // Schedule day-ahead fetching at 4 PM and 9 PM (when predictions are usually available)
  cron.schedule('0 16,21 * * *', () => {
    collectDayAhead();
  });

  // Schedule stats computation every hour
  cron.schedule('5 * * * *', () => {
    computeStats();
  });

  log('Worker scheduled and running');

  // Keep the process running
  process.on('SIGINT', () => {
    log('Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Shutting down...');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(`${LOG_PREFIX} Fatal error:`, error);
  process.exit(1);
});
