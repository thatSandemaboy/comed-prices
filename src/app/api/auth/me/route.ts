import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const IS_SERVERLESS = process.env.VERCEL === '1';

export async function GET() {
  // On serverless, auth is not available
  if (IS_SERVERLESS) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;

    if (!userId) {
      return NextResponse.json({ authenticated: false });
    }

    // Dynamic import to avoid loading sqlite on serverless
    const { getUserById } = await import('@/lib/db');
    const user = getUserById(parseInt(userId));

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
