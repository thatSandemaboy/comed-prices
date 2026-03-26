import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

const IS_SERVERLESS = process.env.VERCEL === '1';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fallbackUrl = `${appUrl}/alerts`;

  if (IS_SERVERLESS) {
    return NextResponse.redirect(fallbackUrl);
  }

  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(fallbackUrl);
  }

  try {
    const { verifyMagicToken, getUserByEmail, createAuthSession } = await import('@/lib/db');
    const result = verifyMagicToken(token);

    if (!result) {
      return NextResponse.redirect(fallbackUrl);
    }

    const user = getUserByEmail(result.email);

    if (!user) {
      return NextResponse.redirect(fallbackUrl);
    }

    const sessionToken = randomBytes(32).toString('hex');
    createAuthSession(user.id, sessionToken);

    // Set auth cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    // Redirect to home or alerts page
    return NextResponse.redirect(`${appUrl}/alerts`);
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.redirect(fallbackUrl);
  }
}
