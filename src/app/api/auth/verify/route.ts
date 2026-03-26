import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

const IS_SERVERLESS = process.env.VERCEL === '1';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (IS_SERVERLESS) {
    return NextResponse.redirect(`${appUrl}/login?error=not_available`);
  }

  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_token`);
  }

  try {
    const { verifyMagicToken, getUserByEmail, createAuthSession } = await import('@/lib/db');
    const result = verifyMagicToken(token);

    if (!result) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_token`);
    }

    const user = getUserByEmail(result.email);

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=user_not_found`);
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
    return NextResponse.redirect(`${appUrl}/login?error=verification_failed`);
  }
}
