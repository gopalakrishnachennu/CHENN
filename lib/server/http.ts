export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'request_failed') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('ResumeOS route failure', error instanceof Error ? error.message : 'Unknown error');
  return json({ error: 'Something went wrong. Please try again.', code: 'internal_error' }, { status: 500 });
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const requested = new URL(request.url);
  if (new URL(origin).host !== requested.host) {
    throw new HttpError(403, 'Cross-origin writes are not allowed.', 'invalid_origin');
  }
}
