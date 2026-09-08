import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ADMIN_EMAIL, FIREBASE_PROJECT_ID } from '@/lib/constants';
import { HttpError } from './http';

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export type AuthContext = {
  email: string;
  name: string;
  role: 'admin' | 'candidate';
  candidateId?: string;
};

export async function requireAuth(request: Request, db: D1Database): Promise<AuthContext> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(authorization.slice(7), firebaseKeys, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    }));
  } catch {
    throw new HttpError(401, 'Your sign-in session is invalid or expired.', 'invalid_token');
  }

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const name = typeof payload.name === 'string' ? payload.name : email.split('@')[0];
  if (!email || payload.email_verified !== true) {
    throw new HttpError(403, 'A verified Google email is required.', 'email_not_verified');
  }
  if (email === ADMIN_EMAIL) return { email, name, role: 'admin' };

  const candidate = await db
    .prepare('SELECT id, portal_enabled, status FROM candidates WHERE lower(email) = ? LIMIT 1')
    .bind(email)
    .first<{ id: string; portal_enabled: number; status: string }>();
  if (!candidate || candidate.status === 'Archived' || !candidate.portal_enabled) {
    throw new HttpError(403, 'No active candidate portal is linked to this email.', 'portal_not_linked');
  }
  return { email, name, role: 'candidate', candidateId: candidate.id };
}

export function requireAdmin(auth: AuthContext) {
  if (auth.role !== 'admin') {
    throw new HttpError(403, 'Candidate accounts are strictly read only.', 'read_only_portal');
  }
}
