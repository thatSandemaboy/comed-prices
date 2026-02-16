import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Check if we're in a serverless environment without persistent storage
const IS_SERVERLESS = process.env.VERCEL === '1';

// Dynamic imports for database functions (only work locally)
async function getDbFunctions() {
  if (IS_SERVERLESS) return null;
  try {
    const db = await import('@/lib/db');
    return db;
  } catch {
    return null;
  }
}

// Get user's alerts
export async function GET() {
  const db = await getDbFunctions();

  if (!db) {
    return NextResponse.json({
      alerts: [],
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      message: 'Alerts require a persistent database. Run locally with the worker for full functionality.',
    });
  }

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = db.getUserById(parseInt(userId));
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const alerts = db.getAlertsByUser(user.id);

    return NextResponse.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        thresholdCents: a.threshold_cents,
        enabled: Boolean(a.enabled),
        cooldownMinutes: a.cooldown_minutes,
        lastTriggeredAt: a.last_triggered_at
          ? new Date(a.last_triggered_at * 1000).toISOString()
          : null,
        notifyEmail: Boolean(a.notify_email),
        notifyPush: Boolean(a.notify_push),
      })),
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    });
  } catch (error) {
    console.error('Error getting alerts:', error);
    return NextResponse.json(
      { error: 'Failed to get alerts' },
      { status: 500 }
    );
  }
}

// Create or update alerts
export async function POST(request: NextRequest) {
  const db = await getDbFunctions();

  if (!db) {
    return NextResponse.json(
      { error: 'Alerts require a persistent database. This feature is not available on serverless deployments.' },
      { status: 501 }
    );
  }

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = db.getUserById(parseInt(userId));
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const { thresholdCents, cooldownMinutes = 60 } = data;
        if (typeof thresholdCents !== 'number' || thresholdCents < 0) {
          return NextResponse.json(
            { error: 'Invalid threshold' },
            { status: 400 }
          );
        }

        const result = db.createAlert(user.id, thresholdCents, cooldownMinutes);
        return NextResponse.json({
          success: true,
          alertId: result.lastInsertRowid,
        });
      }

      case 'update': {
        const { alertId, ...updates } = data;
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID required' },
            { status: 400 }
          );
        }

        // Map camelCase to snake_case
        const dbUpdates: Record<string, number | undefined> = {};
        if ('thresholdCents' in updates) dbUpdates.threshold_cents = updates.thresholdCents;
        if ('enabled' in updates) dbUpdates.enabled = updates.enabled ? 1 : 0;
        if ('cooldownMinutes' in updates) dbUpdates.cooldown_minutes = updates.cooldownMinutes;
        if ('notifyEmail' in updates) dbUpdates.notify_email = updates.notifyEmail ? 1 : 0;
        if ('notifyPush' in updates) dbUpdates.notify_push = updates.notifyPush ? 1 : 0;

        db.updateAlert(alertId, dbUpdates);
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        const { alertId } = data;
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID required' },
            { status: 400 }
          );
        }

        db.deleteAlert(alertId);
        return NextResponse.json({ success: true });
      }

      case 'subscribe-push': {
        const { subscription } = data;
        if (!subscription?.endpoint || !subscription?.keys) {
          return NextResponse.json(
            { error: 'Invalid push subscription' },
            { status: 400 }
          );
        }

        db.savePushSubscription(
          user.id,
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth
        );
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing alerts:', error);
    return NextResponse.json(
      { error: 'Failed to manage alerts' },
      { status: 500 }
    );
  }
}
