import { getBindings } from '@/lib/server/env';
import { requireAuth } from '@/lib/server/auth';
import { readState } from '@/lib/server/data';
import { handleRouteError, json } from '@/lib/server/http';
import { ensureSeeded } from '@/lib/server/seed';

export async function GET(request: Request) {
  try {
    const { DB } = getBindings();
    if (!request.headers.get('authorization')) return json({ error: 'Sign in to continue.', code: 'unauthenticated' }, { status: 401 });

    // The known admin initializes the empty workspace. Candidates never receive
    // broader data during this bootstrap step.
    const auth = await requireAuth(request, DB);
    if (auth.role === 'admin') await ensureSeeded(DB, auth.email);
    return json(await readState(DB, auth));
  } catch (error) {
    return handleRouteError(error);
  }
}
