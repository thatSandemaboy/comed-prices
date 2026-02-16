import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
    const { verifyMagicToken, getUserByEmail } = await import('@/lib/db');
    const result = verifyMagicToken(token);

    if (!result) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_token`);
    }

    const user = getUserByEmail(result.email);

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=user_not_found`);
    }

    // Set auth cookie
    const cookieStore = await cookies();
    cookieStore.set('userId', user.id.toString(), {
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
