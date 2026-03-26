// Notification services for price alerts

import webpush from 'web-push';
import { Resend } from 'resend';
import {
  getActiveAlerts,
  updateAlertTriggered,
  getPushSubscriptionsByUser,
  deletePushSubscription,
} from './db';

// Initialize web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (!vapidConfigured && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }
}

// Lazy-initialize Resend for email
let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

export interface PriceAlert {
  price: number;
  threshold: number;
  timestamp: Date;
}

/**
 * Check all active alerts and send notifications if thresholds are met
 */
export async function checkAndNotify(currentPrice: number): Promise<{
  alertsTriggered: number;
  pushSent: number;
  emailSent: number;
}> {
  const alerts = getActiveAlerts();
  const now = Math.floor(Date.now() / 1000);

  let alertsTriggered = 0;
  let pushSent = 0;
  let emailSent = 0;

  for (const alert of alerts) {
    // Check if price is below threshold
    if (currentPrice > alert.threshold_cents) {
      continue;
    }

    // Check cooldown
    if (alert.last_triggered_at) {
      const cooldownSeconds = alert.cooldown_minutes * 60;
      if (now - alert.last_triggered_at < cooldownSeconds) {
        continue;
      }
    }

    // Alert should trigger
    alertsTriggered++;
    updateAlertTriggered(alert.id);

    const alertInfo: PriceAlert = {
      price: currentPrice,
      threshold: alert.threshold_cents,
      timestamp: new Date(),
    };

    // Send push notification
    if (alert.notify_push) {
      const subscriptions = getPushSubscriptionsByUser(alert.user_id);
      for (const sub of subscriptions) {
        try {
          const sent = await sendPushNotification(sub, alertInfo);
          if (sent) pushSent++;
        } catch (error) {
          console.error('Push notification failed:', error);
          // Remove invalid subscription
          if (
            error instanceof Error &&
            (error.message.includes('410') || error.message.includes('404'))
          ) {
            deletePushSubscription(sub.endpoint);
          }
        }
      }
    }

    // Send email notification
    if (alert.notify_email && alert.email) {
      try {
        const sent = await sendEmailNotification(alert.email, alertInfo);
        if (sent) emailSent++;
      } catch (error) {
        console.error('Email notification failed:', error);
      }
    }
  }

  return { alertsTriggered, pushSent, emailSent };
}

/**
 * Send push notification to a subscription
 */
async function sendPushNotification(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  alert: PriceAlert
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notification');
    return false;
  }

  ensureVapidConfigured();

  const payload = JSON.stringify({
    title: '⚡ Low Price Alert!',
    body: `ComEd price is now ${alert.price.toFixed(1)}¢/kWh (below ${alert.threshold}¢)`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: '/',
      price: alert.price,
      threshold: alert.threshold,
      timestamp: alert.timestamp.toISOString(),
    },
  });

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    payload
  );
  return true;
}

/**
 * Send email notification
 */
async function sendEmailNotification(email: string, alert: PriceAlert) {
  const resendClient = getResend();
  if (!resendClient) {
    console.warn('Resend API key not configured, skipping email notification');
    return false;
  }

  const fromEmail = process.env.FROM_EMAIL || 'alerts@resend.dev';

  await resendClient.emails.send({
    from: `ComEd Price Alerts <${fromEmail}>`,
    to: email,
    subject: `⚡ Low Price Alert: ${alert.price.toFixed(1)}¢/kWh`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">⚡ Low Electricity Price Alert</h1>
        <p style="font-size: 18px;">
          ComEd's current price is <strong>${alert.price.toFixed(1)}¢/kWh</strong>,
          which is below your threshold of ${alert.threshold}¢/kWh.
        </p>
        <p>This is a great time to:</p>
        <ul>
          <li>Run your laundry</li>
          <li>Charge your EV</li>
          <li>Run the dishwasher</li>
          <li>Pre-cool/pre-heat your home</li>
        </ul>
        <p style="color: #666; font-size: 14px;">
          Alert triggered at ${alert.timestamp.toLocaleString('en-US', {
            timeZone: 'America/Chicago',
          })}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          You're receiving this because you set up a price alert on ComEd Hourly Pricing.
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts">Manage your alerts</a>
        </p>
      </div>
    `,
  });
  return true;
}

/**
 * Send magic link email for authentication
 */
export async function sendMagicLinkEmail(email: string, token: string) {
  const resendClient = getResend();
  if (!resendClient) {
    throw new Error('Email delivery is not configured');
  }

  const fromEmail = process.env.FROM_EMAIL || 'auth@resend.dev';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl}/api/auth/verify?token=${token}`;

  await resendClient.emails.send({
    from: `ComEd Pricing <${fromEmail}>`,
    to: email,
    subject: 'Sign in to ComEd Hourly Pricing',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Sign in to ComEd Hourly Pricing</h1>
        <p>Click the button below to sign in to your account:</p>
        <a href="${loginUrl}" style="
          display: inline-block;
          background: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        ">Sign In</a>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 15 minutes.
        </p>
        <p style="color: #999; font-size: 12px;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
    `,
  });
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
