import { NextRequest, NextResponse } from 'next/server';
import { createUser, createMagicToken } from '@/lib/db';
import { sendMagicLinkEmail } from '@/lib/notifications';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create user if doesn't exist
    createUser(email.toLowerCase());

    // Generate magic token
    const token = randomBytes(32).toString('hex');
    createMagicToken(email.toLowerCase(), token);

    // Send magic link email
    await sendMagicLinkEmail(email.toLowerCase(), token);

    return NextResponse.json({
      success: true,
      message: 'Check your email for a login link',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Failed to send login email' },
      { status: 500 }
    );
  }
}
