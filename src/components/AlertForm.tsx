'use client';

import { useEffect, useState } from 'react';

interface Alert {
  id: number;
  thresholdCents: number;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  notifyEmail: boolean;
  notifyPush: boolean;
}

interface AlertFormProps {
  onLoginRequired?: () => void;
}

export default function AlertForm({ onLoginRequired }: AlertFormProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [newThreshold, setNewThreshold] = useState(3);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    checkAuth();
    checkPushSupport();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchAlerts();
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  function checkPushSupport() {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  }

  async function fetchAlerts() {
    try {
      const response = await fetch('/api/alerts/subscribe');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createAlert() {
    try {
      const response = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          thresholdCents: newThreshold,
        }),
      });

      if (response.ok) {
        fetchAlerts();
        setNewThreshold(3);
      }
    } catch (err) {
      console.error('Failed to create alert:', err);
    }
  }

  async function updateAlert(alertId: number, updates: Partial<Alert>) {
    try {
      await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          alertId,
          ...updates,
        }),
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to update alert:', err);
    }
  }

  async function deleteAlert(alertId: number) {
    try {
      await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          alertId,
        }),
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        alert('Please allow notifications to receive price alerts');
        return;
      }

      // Get VAPID key
      const alertsResponse = await fetch('/api/alerts/subscribe');
      const alertsData = await alertsResponse.json();
      const vapidPublicKey = alertsData.vapidPublicKey;

      if (!vapidPublicKey) {
        console.error('VAPID key not configured');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Save subscription to server
      await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe-push',
          subscription: subscription.toJSON(),
        }),
      });

      setPushEnabled(true);
    } catch (err) {
      console.error('Failed to enable push:', err);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Sign in to set up price alerts
        </p>
        <button
          onClick={onLoginRequired}
          className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create new alert */}
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
        <h4 className="font-medium mb-3">Create New Alert</h4>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            Alert me when price drops below:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(parseFloat(e.target.value))}
              min={0}
              max={20}
              step={0.5}
              className="w-20 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
            />
            <span className="text-zinc-500">¢/kWh</span>
          </div>
          <button
            onClick={createAlert}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Alert
          </button>
        </div>
      </div>

      {/* Push notification toggle */}
      {pushSupported && (
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
          <div>
            <div className="font-medium">Push Notifications</div>
            <div className="text-sm text-zinc-500">
              Get instant alerts on your device
            </div>
          </div>
          <button
            onClick={enablePush}
            disabled={pushEnabled}
            className={`px-4 py-2 rounded-lg font-medium ${
              pushEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {pushEnabled ? 'Enabled' : 'Enable'}
          </button>
        </div>
      )}

      {/* Existing alerts */}
      {alerts.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Your Alerts</h4>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    alert.enabled ? 'bg-green-500' : 'bg-zinc-300'
                  }`} />
                  <div>
                    <div className="font-medium">
                      Below {alert.thresholdCents}¢/kWh
                    </div>
                    <div className="text-sm text-zinc-500">
                      Cooldown: {alert.cooldownMinutes} min
                      {alert.lastTriggeredAt && (
                        <> | Last: {new Date(alert.lastTriggeredAt).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateAlert(alert.id, { enabled: !alert.enabled })}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      alert.enabled
                        ? 'bg-zinc-200 dark:bg-zinc-700'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {alert.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="px-3 py-1 rounded text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <p className="text-center text-zinc-500 py-4">
          No alerts configured. Create one above to get notified when prices are low.
        </p>
      )}
    </div>
  );
}
