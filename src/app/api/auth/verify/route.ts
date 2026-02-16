import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicToken, getUserByEmail } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_token`);
  }

  try {
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
