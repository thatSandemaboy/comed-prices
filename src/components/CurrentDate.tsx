'use client';

import { useEffect, useState } from 'react';

export default function CurrentDate() {
  const [dateString, setDateString] = useState('');

  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    setDateString(formatted);
  }, []);

  if (!dateString) {
    return <div className="h-6" />;
  }

  return (
    <div className="text-zinc-500 dark:text-zinc-400 text-sm">
      {dateString}
    </div>
  );
}
