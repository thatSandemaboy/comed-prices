'use client';

import { useRouter } from 'next/navigation';
import AlertForm from '@/components/AlertForm';
import Navigation from '@/components/Navigation';

export default function AlertsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Price Alerts</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Get notified when electricity prices drop below your threshold
            </p>
          </div>

          <AlertForm onLoginRequired={() => router.push('/login')} />
        </div>
      </main>
    </div>
  );
}
