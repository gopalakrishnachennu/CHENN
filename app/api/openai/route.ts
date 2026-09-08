import { getBindings } from '@/lib/server/env';
import { requireAdmin, requireAuth } from '@/lib/server/auth';
import { encryptSecret } from '@/lib/server/crypto';
import { handleRouteError, HttpError, json, requireSameOrigin } from '@/lib/server/http';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { DB, CONFIG_ENCRYPTION_KEY } = getBindings();
    const auth = await requireAuth(request, DB);
    requireAdmin(auth);
    const body = await request.json() as { apiKey?: unknown };
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (!apiKey.startsWith('sk-') || apiKey.length < 24 || apiKey.length > 300) {
      throw new HttpError(400, 'Enter a valid OpenAI API key.', 'invalid_api_key');
    }

    const probe = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!probe.ok) {
      throw new HttpError(400, 'OpenAI rejected this key. Check the key and project billing, then try again.', 'openai_key_rejected');
    }

    const encrypted = await encryptSecret(apiKey, CONFIG_ENCRYPTION_KEY);
    const now = new Date().toISOString();
    const lastFour = apiKey.slice(-4);
    await DB.batch([
      DB.prepare("INSERT INTO api_credentials (provider,cipher_text,iv,last_four,status,updated_at,updated_by) VALUES ('openai',?,?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET cipher_text=excluded.cipher_text,iv=excluded.iv,last_four=excluded.last_four,status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(encrypted.cipherText, encrypted.iv, lastFour, 'connected', now, auth.email),
      DB.prepare('INSERT INTO audit_logs (id,actor_email,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), auth.email, 'credential.connected', 'credential', 'openai', JSON.stringify({ lastFour }), now),
    ]);
    return json({ ok: true, message: 'OpenAI is connected securely.', credential: { connected: true, lastFour, updatedAt: now } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const { DB } = getBindings();
    const auth = await requireAuth(request, DB);
    requireAdmin(auth);
    const now = new Date().toISOString();
    await DB.batch([
      DB.prepare("DELETE FROM api_credentials WHERE provider='openai'"),
      DB.prepare('INSERT INTO audit_logs (id,actor_email,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), auth.email, 'credential.disconnected', 'credential', 'openai', '{}', now),
    ]);
    return json({ ok: true, message: 'OpenAI was disconnected.' });
  } catch (error) {
    return handleRouteError(error);
  }
}
