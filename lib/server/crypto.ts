import { HttpError } from './http';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret?: string) {
  if (!secret) throw new HttpError(503, 'Secure credential storage is not configured.', 'credential_storage_unavailable');
  let material: Uint8Array;
  try {
    material = base64ToBytes(secret);
  } catch {
    throw new HttpError(503, 'Secure credential storage is misconfigured.', 'credential_storage_invalid');
  }
  if (material.byteLength !== 32) {
    throw new HttpError(503, 'Secure credential storage is misconfigured.', 'credential_storage_invalid');
  }
  const keyBytes = new Uint8Array(material.byteLength);
  keyBytes.set(material);
  return crypto.subtle.importKey('raw', keyBytes.buffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(value: string, secret?: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer }, key, new TextEncoder().encode(value));
  return { cipherText: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv) };
}

export async function decryptSecret(cipherText: string, iv: string, secret?: string) {
  const key = await encryptionKey(secret);
  try {
    const ivBytes = base64ToBytes(iv);
    const cipherBytes = base64ToBytes(cipherText);
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer }, key, cipherBytes.buffer as ArrayBuffer);
    return new TextDecoder().decode(clear);
  } catch {
    throw new HttpError(503, 'The saved credential could not be decrypted.', 'credential_decryption_failed');
  }
}
