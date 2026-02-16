'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send login email');
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const errorMessages: Record<string, string> = {
    missing_token: 'Login link is missing. Please try again.',
    invalid_token: 'This login link has expired or is invalid. Please request a new one.',
    user_not_found: 'User not found. Please sign up first.',
    verification_failed: 'Verification failed. Please try again.',
  };

  if (sent) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
          Check your email
        </h2>
        <p className="text-green-700 dark:text-green-300">
          We sent a login link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-green-600 dark:text-green-400 mt-4">
          The link will expire in 15 minutes
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-2">Sign in</h2>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        Enter your email to receive a magic login link
      </p>

      {(urlError || error) && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 mb-4 text-sm">
          {urlError ? errorMessages[urlError] || urlError : error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 mb-4"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Login Link'}
        </button>
      </form>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-6 animate-pulse">
      <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded mb-4 w-24" />
      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded mb-6 w-48" />
      <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
      <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold">
            <span className="text-3xl">⚡</span>
            <span>ComEd Prices</span>
          </Link>
        </div>

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-zinc-500 text-sm mt-6">
          No password required. We&apos;ll email you a secure link.
        </p>

        <div className="text-center mt-6">
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
