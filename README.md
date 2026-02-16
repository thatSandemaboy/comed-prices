# ComEd Hourly Pricing App

A Progressive Web App (PWA) that displays real-time ComEd electricity prices, sends alerts when prices drop below thresholds, and recommends optimal times for high-energy activities.

## Features

- **Live Price Dashboard**: Real-time electricity prices with color-coded indicators (green = cheap, yellow = normal, red = expensive)
- **24-Hour Price Chart**: Visual history of price fluctuations
- **Best Time Recommendations**: AI-powered suggestions for when to run appliances (laundry, EV charging, dishwasher, etc.)
- **Price Alerts**: Get notified via email or push notification when prices drop below your threshold
- **Day-Ahead Predictions**: See tomorrow's expected prices (when available)
- **PWA Support**: Install on your phone, works offline

## Quick Start

```bash
# Install dependencies
npm install

# Create data directory
mkdir -p data

# Start development server
npm run dev

# In another terminal, start the background worker
npm run worker
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Database path (defaults to ./data/comed.db)
DATABASE_PATH=./data/comed.db

# App URL (for magic links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email notifications (optional)
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=alerts@yourdomain.com

# Push notifications (optional)
# Generate keys with: npm run generate-vapid
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Next.js PWA (Frontend)                 │
│  - Live price dashboard                             │
│  - Day-ahead predictions chart                      │
│  - Best-time recommendations                        │
│  - Alert configuration                              │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│            Next.js API Routes (Backend)             │
│  GET /api/price/current                             │
│  GET /api/price/history                             │
│  GET /api/price/day-ahead                           │
│  GET /api/analysis/best-times                       │
│  POST /api/alerts/subscribe                         │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│          Background Worker (Node.js cron)           │
│  - Collects prices every 5 minutes                  │
│  - Checks alert thresholds                          │
│  - Fetches day-ahead predictions daily              │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│               SQLite Database                       │
│  - prices (5-minute historical data)                │
│  - day_ahead_predictions                            │
│  - users, alerts, push_subscriptions                │
│  - hourly_stats (pre-computed for analysis)         │
└─────────────────────────────────────────────────────┘
```

## API Endpoints

### GET /api/price/current
Returns the current electricity price.

```json
{
  "current": {
    "price": 2.5,
    "timestamp": 1707764700000,
    "color": "green"
  },
  "today": {
    "min": 1.8,
    "max": 6.2,
    "avg": 3.4
  }
}
```

### GET /api/price/history?hours=24
Returns historical prices.

### GET /api/price/day-ahead
Returns day-ahead predictions (when available).

### GET /api/analysis/best-times?activity=laundry
Returns recommended times for running appliances.

## Tech Stack

- **Framework**: Next.js 14+ with TypeScript
- **Database**: SQLite (via better-sqlite3)
- **Notifications**: Web Push API + Resend (email)
- **Charts**: Recharts
- **Styling**: Tailwind CSS

## Deployment

### Frontend (Vercel)

```bash
npm run build
# Deploy to Vercel
```

### Background Worker (Railway/any Node.js host)

```bash
npm run worker
```

## Price Understanding

ComEd's hourly pricing typically follows these patterns:

- **Cheapest**: 2-5 AM (overnight)
- **Most Expensive**: 5-8 PM (evening peak)
- **Weekends**: Generally lower than weekdays

Price levels:
- **< 3¢/kWh**: Excellent - run high-energy appliances
- **3-6¢/kWh**: Normal
- **> 6¢/kWh**: High - delay if possible

## License

MIT
