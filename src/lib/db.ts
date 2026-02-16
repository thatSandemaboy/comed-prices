import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'comed.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    -- 5-minute price data from ComEd
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL UNIQUE,
      price REAL NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp);

    -- Day-ahead predictions
    CREATE TABLE IF NOT EXISTS day_ahead_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour_start INTEGER NOT NULL,
      predicted_price REAL NOT NULL,
      fetched_at INTEGER NOT NULL,
      UNIQUE(hour_start, fetched_at)
    );
    CREATE INDEX IF NOT EXISTS idx_day_ahead_hour ON day_ahead_predictions(hour_start);

    -- Users (magic link auth)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      last_login_at INTEGER
    );

    -- Alert configurations
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      threshold_cents REAL NOT NULL,
      enabled INTEGER DEFAULT 1,
      cooldown_minutes INTEGER DEFAULT 60,
      last_triggered_at INTEGER,
      notify_email INTEGER DEFAULT 1,
      notify_push INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);

    -- Web Push subscriptions
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

    -- Pre-computed hourly statistics for analysis
    CREATE TABLE IF NOT EXISTS hourly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      avg_price REAL NOT NULL,
      min_price REAL NOT NULL,
      max_price REAL NOT NULL,
      stddev_price REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      computed_at INTEGER NOT NULL,
      UNIQUE(day_of_week, hour)
    );

    -- Magic link tokens
    CREATE TABLE IF NOT EXISTS magic_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_magic_token ON magic_tokens(token);
  `);
}

// Price operations
export function insertPrice(timestamp: number, price: number) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO prices (timestamp, price) VALUES (?, ?)
  `);
  return stmt.run(timestamp, price);
}

export function getLatestPrice() {
  const db = getDb();
  return db.prepare(`
    SELECT timestamp, price FROM prices ORDER BY timestamp DESC LIMIT 1
  `).get() as { timestamp: number; price: number } | undefined;
}

export function getPriceHistory(startTime: number, endTime: number) {
  const db = getDb();
  return db.prepare(`
    SELECT timestamp, price FROM prices
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
  `).all(startTime, endTime) as { timestamp: number; price: number }[];
}

export function getTodayStats() {
  const db = getDb();
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  return db.prepare(`
    SELECT
      MIN(price) as min_price,
      MAX(price) as max_price,
      AVG(price) as avg_price
    FROM prices
    WHERE timestamp >= ?
  `).get(startOfDay) as { min_price: number; max_price: number; avg_price: number } | undefined;
}

// Day-ahead operations
export function insertDayAheadPrediction(hourStart: number, predictedPrice: number, fetchedAt: number) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO day_ahead_predictions (hour_start, predicted_price, fetched_at)
    VALUES (?, ?, ?)
  `);
  return stmt.run(hourStart, predictedPrice, fetchedAt);
}

export function getDayAheadPredictions(startTime: number, endTime: number) {
  const db = getDb();
  return db.prepare(`
    SELECT hour_start, predicted_price FROM day_ahead_predictions
    WHERE hour_start >= ? AND hour_start <= ?
    ORDER BY hour_start ASC
  `).all(startTime, endTime) as { hour_start: number; predicted_price: number }[];
}

// User operations
export function createUser(email: string) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (email) VALUES (?)
  `);
  stmt.run(email);
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as {
    id: number;
    email: string;
    created_at: number;
  };
}

export function getUserByEmail(email: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as {
    id: number;
    email: string;
    created_at: number;
  } | undefined;
}

export function getUserById(id: number) {
  const db = getDb();
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as {
    id: number;
    email: string;
    created_at: number;
  } | undefined;
}

// Alert operations
export function createAlert(userId: number, thresholdCents: number, cooldownMinutes = 60) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO alerts (user_id, threshold_cents, cooldown_minutes) VALUES (?, ?, ?)
  `);
  return stmt.run(userId, thresholdCents, cooldownMinutes);
}

export function getAlertsByUser(userId: number) {
  const db = getDb();
  return db.prepare(`SELECT * FROM alerts WHERE user_id = ?`).all(userId) as {
    id: number;
    user_id: number;
    threshold_cents: number;
    enabled: number;
    cooldown_minutes: number;
    last_triggered_at: number | null;
    notify_email: number;
    notify_push: number;
  }[];
}

export function getActiveAlerts() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, u.email
    FROM alerts a
    JOIN users u ON a.user_id = u.id
    WHERE a.enabled = 1
  `).all() as {
    id: number;
    user_id: number;
    email: string;
    threshold_cents: number;
    cooldown_minutes: number;
    last_triggered_at: number | null;
    notify_email: number;
    notify_push: number;
  }[];
}

export function updateAlertTriggered(alertId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE alerts SET last_triggered_at = unixepoch() WHERE id = ?
  `);
  return stmt.run(alertId);
}

export function updateAlert(alertId: number, updates: {
  threshold_cents?: number;
  enabled?: number;
  cooldown_minutes?: number;
  notify_email?: number;
  notify_push?: number;
}) {
  const db = getDb();
  const fields = Object.entries(updates)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`);
  const values = Object.values(updates).filter(v => v !== undefined);

  if (fields.length === 0) return;

  const stmt = db.prepare(`UPDATE alerts SET ${fields.join(', ')} WHERE id = ?`);
  return stmt.run(...values, alertId);
}

export function deleteAlert(alertId: number) {
  const db = getDb();
  return db.prepare(`DELETE FROM alerts WHERE id = ?`).run(alertId);
}

// Push subscription operations
export function savePushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
  `);
  return stmt.run(userId, endpoint, p256dh, auth);
}

export function getPushSubscriptionsByUser(userId: number) {
  const db = getDb();
  return db.prepare(`SELECT * FROM push_subscriptions WHERE user_id = ?`).all(userId) as {
    id: number;
    user_id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
}

export function deletePushSubscription(endpoint: string) {
  const db = getDb();
  return db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
}

// Hourly stats operations
export function updateHourlyStats() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // Calculate stats for each day/hour combination from the last 90 days
  const ninetyDaysAgo = now - (90 * 24 * 60 * 60);

  db.exec(`
    INSERT OR REPLACE INTO hourly_stats (day_of_week, hour, avg_price, min_price, max_price, stddev_price, sample_count, computed_at)
    SELECT
      CAST(strftime('%w', datetime(timestamp, 'unixepoch', 'localtime')) AS INTEGER) as dow,
      CAST(strftime('%H', datetime(timestamp, 'unixepoch', 'localtime')) AS INTEGER) as h,
      AVG(price),
      MIN(price),
      MAX(price),
      COALESCE(
        SQRT(AVG(price * price) - AVG(price) * AVG(price)),
        0
      ),
      COUNT(*),
      ${now}
    FROM prices
    WHERE timestamp >= ${ninetyDaysAgo}
    GROUP BY dow, h
  `);
}

export function getHourlyStats() {
  const db = getDb();
  return db.prepare(`
    SELECT day_of_week, hour, avg_price, min_price, max_price, stddev_price, sample_count
    FROM hourly_stats
    ORDER BY day_of_week, hour
  `).all() as {
    day_of_week: number;
    hour: number;
    avg_price: number;
    min_price: number;
    max_price: number;
    stddev_price: number;
    sample_count: number;
  }[];
}

// Magic token operations
export function createMagicToken(email: string, token: string, expiresIn = 15 * 60) {
  const db = getDb();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const stmt = db.prepare(`
    INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)
  `);
  return stmt.run(email, token, expiresAt);
}

export function verifyMagicToken(token: string) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(`
    SELECT * FROM magic_tokens
    WHERE token = ? AND expires_at > ? AND used = 0
  `).get(token, now) as { email: string; id: number } | undefined;

  if (result) {
    db.prepare(`UPDATE magic_tokens SET used = 1 WHERE id = ?`).run(result.id);
  }

  return result;
}
