import Navigation from '@/components/Navigation';

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Price Alerts</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Price alerts and sign-in are temporarily unavailable while this feature is rebuilt
            </p>
          </div>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Coming Soon</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              We pulled the current alert flow because it is not ready for deployment yet.
              The pricing dashboard still works, and alerts will come back once the hosted sign-in
              and notification flow are finished.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
