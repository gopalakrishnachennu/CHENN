import { env } from 'cloudflare:workers';

export type RuntimeBindings = {
  DB: D1Database;
  FILES: R2Bucket;
  CONFIG_ENCRYPTION_KEY?: string;
};

export function getBindings(): RuntimeBindings {
  const bindings = env as unknown as RuntimeBindings;
  if (!bindings.DB) throw new Error('The DB binding is not configured.');
  if (!bindings.FILES) throw new Error('The FILES binding is not configured.');
  return bindings;
}
