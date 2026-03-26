import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (sessionToken) {
    const { deleteAuthSession } = await import('@/lib/db');
    deleteAuthSession(sessionToken);
  }
  cookieStore.delete(AUTH_COOKIE_NAME);

  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (sessionToken) {
    const { deleteAuthSession } = await import('@/lib/db');
    deleteAuthSession(sessionToken);
  }
  cookieStore.delete(AUTH_COOKIE_NAME);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return NextResponse.redirect(appUrl);
}
