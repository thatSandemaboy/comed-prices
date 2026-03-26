import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

const IS_SERVERLESS = process.env.VERCEL === '1';

export async function GET() {
  // On serverless, auth is not available
  if (IS_SERVERLESS) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
