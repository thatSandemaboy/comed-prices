import { cookies } from 'next/headers';
import { deleteExpiredAuthSessions, getUserBySessionToken } from './db';

export const AUTH_COOKIE_NAME = 'sessionToken';

export async function getAuthenticatedUser() {
  deleteExpiredAuthSessions();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return getUserBySessionToken(sessionToken) || null;
}
