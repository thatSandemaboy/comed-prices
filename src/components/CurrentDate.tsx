'use client';

export default function CurrentDate() {
  const dateString = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="text-zinc-500 dark:text-zinc-400 text-sm">
      {dateString}
    </div>
  );
}
