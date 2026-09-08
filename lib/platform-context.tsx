'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type User } from 'firebase/auth';
import { enableAnalytics, firebaseAuth, googleProvider } from './firebase';
import type { AppState } from './types';

type ActionResult = { ok: boolean; message?: string; [key: string]: unknown };

type PlatformContextValue = {
  user: User | null;
  state: AppState | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refresh: () => Promise<void>;
  act: (action: string, payload?: Record<string, unknown>) => Promise<ActionResult>;
  upload: (form: FormData) => Promise<ActionResult>;
  connectOpenAI: (apiKey: string) => Promise<ActionResult>;
  disconnectOpenAI: () => Promise<ActionResult>;
  download: (params: { fileId?: string; resumeId?: string; format?: 'pdf' | 'docx'; inline?: boolean }) => Promise<void>;
  fetchFileUrl: (fileId: string) => Promise<string>;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

async function token() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Sign in to continue.');
  return user.getIdToken();
}

async function authenticatedFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${await token()}`);
  return fetch(url, { ...init, headers });
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!firebaseAuth.currentUser) {
      setState(null);
      return;
    }
    const response = await authenticatedFetch('/api/state');
    if (!response.ok) throw new Error(await readError(response));
    setState(await response.json() as AppState);
    setError(null);
  }, []);

  useEffect(() => {
    void enableAnalytics();
    void setPersistence(firebaseAuth, browserLocalPersistence).catch(() => undefined);
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setState(null);
      setError(null);
      if (nextUser) {
        try {
          await refresh();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Unable to load the portal.');
        }
      }
      setLoading(false);
    });
  }, [refresh]);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.replace(/^Firebase:\s*/i, '') : 'Google sign-in failed.';
      setError(message);
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setBusy(true);
    try {
      await signOut(firebaseAuth);
      setState(null);
      setError(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const response = await authenticatedFetch('/api/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as ActionResult;
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const upload = useCallback(async (form: FormData) => {
    setBusy(true);
    try {
      const response = await authenticatedFetch('/api/files', { method: 'POST', body: form });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as ActionResult;
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const connectOpenAI = useCallback(async (apiKey: string) => {
    setBusy(true);
    try {
      const response = await authenticatedFetch('/api/openai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey }) });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as ActionResult;
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disconnectOpenAI = useCallback(async () => {
    setBusy(true);
    try {
      const response = await authenticatedFetch('/api/openai', { method: 'DELETE' });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as ActionResult;
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const download = useCallback(async ({ fileId, resumeId, format = 'pdf', inline = false }: { fileId?: string; resumeId?: string; format?: 'pdf' | 'docx'; inline?: boolean }) => {
    const query = new URLSearchParams();
    if (fileId) query.set('id', fileId);
    if (resumeId) query.set('resumeId', resumeId);
    if (resumeId) query.set('format', format);
    if (inline) query.set('inline', '1');
    const response = await authenticatedFetch(`/api/files?${query}`);
    if (!response.ok) throw new Error(await readError(response));
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `resume.${format}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    globalThis.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  const fetchFileUrl = useCallback(async (fileId: string) => {
    const response = await authenticatedFetch(`/api/files?id=${encodeURIComponent(fileId)}&inline=1`);
    if (!response.ok) throw new Error(await readError(response));
    return URL.createObjectURL(await response.blob());
  }, []);

  const value = useMemo<PlatformContextValue>(() => ({ user, state, loading, busy, error, signIn, signOutUser, refresh, act, upload, connectOpenAI, disconnectOpenAI, download, fetchFileUrl }), [user, state, loading, busy, error, signIn, signOutUser, refresh, act, upload, connectOpenAI, disconnectOpenAI, download, fetchFileUrl]);
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error('usePlatform must be used inside PlatformProvider.');
  return value;
}
