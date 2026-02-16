import PriceDisplay from '@/components/PriceDisplay';
import PriceChart from '@/components/PriceChart';
import DayAheadChart from '@/components/DayAheadChart';
import BestTimes from '@/components/BestTimes';
import Navigation from '@/components/Navigation';
import CurrentDate from '@/components/CurrentDate';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header with date */}
          <section>
            <CurrentDate />
          </section>

          {/* Current price */}
          <section>
            <PriceDisplay />
          </section>

          {/* Price chart */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Price History</h2>
            <PriceChart hours={24} />
          </section>

          {/* Day-ahead predictions */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Tomorrow&apos;s Forecast</h2>
            <DayAheadChart />
          </section>

          {/* Best times */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Best Time to Run Appliances</h2>
            <BestTimes />
          </section>
        </div>
      </main>
    </div>
  );
}
