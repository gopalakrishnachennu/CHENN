'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  connectFirebaseOpenAI,
  disconnectFirebaseOpenAI,
  readFirebaseState,
  runFirebaseAction,
} from './firebase-backend';
import {
  downloadFirebaseAsset,
  getFirebaseFileUrl,
  uploadFirebaseFile,
} from './firebase-files';
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
  act: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<ActionResult>;
  upload: (form: FormData) => Promise<ActionResult>;
  connectOpenAI: (apiKey: string) => Promise<ActionResult>;
  disconnectOpenAI: () => Promise<ActionResult>;
  download: (params: {
    fileId?: string;
    resumeId?: string;
    format?: 'pdf' | 'docx';
    inline?: boolean;
  }) => Promise<void>;
  fetchFileUrl: (fileId: string) => Promise<string>;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

function currentUser() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Sign in to continue.');
  return user;
}

function messageFor(cause: unknown, fallback: string) {
  if (!(cause instanceof Error)) return fallback;
  return cause.message
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\(auth\/[^)]+\)\.?$/i, '');
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const active = firebaseAuth.currentUser;
    if (!active) {
      setState(null);
      return;
    }
    const next = await readFirebaseState(active);
    setState(next);
    setError(null);
  }, []);

  useEffect(() => {
    void enableAnalytics();
    void setPersistence(firebaseAuth, browserLocalPersistence).catch(
      () => undefined,
    );
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setState(null);
      setError(null);
      if (nextUser) {
        try {
          setState(await readFirebaseState(nextUser));
        } catch (cause) {
          setError(messageFor(cause, 'Unable to load the portal.'));
        }
      }
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      await signInWithRedirect(firebaseAuth, googleProvider);
    } catch (cause) {
      setError(messageFor(cause, 'Google sign-in failed.'));
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

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);
      try {
        const result = await runFirebaseAction(currentUser(), action, payload);
        await refresh();
        return result;
      } catch (cause) {
        const message = messageFor(cause, 'The action could not be completed.');
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const upload = useCallback(
    async (form: FormData) => {
      setBusy(true);
      setError(null);
      try {
        const result = await uploadFirebaseFile(currentUser(), form);
        await refresh();
        return result;
      } catch (cause) {
        const message = messageFor(cause, 'The upload failed.');
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const connectOpenAI = useCallback(
    async (apiKey: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await connectFirebaseOpenAI(currentUser(), apiKey);
        await refresh();
        return result;
      } catch (cause) {
        const message = messageFor(cause, 'OpenAI could not be connected.');
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const disconnectOpenAI = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await disconnectFirebaseOpenAI(currentUser());
      await refresh();
      return result;
    } catch (cause) {
      const message = messageFor(cause, 'OpenAI could not be disconnected.');
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const download = useCallback(
    async (params: {
      fileId?: string;
      resumeId?: string;
      format?: 'pdf' | 'docx';
      inline?: boolean;
    }) => {
      await downloadFirebaseAsset(currentUser(), params, state);
    },
    [state],
  );

  const fetchFileUrl = useCallback(
    async (fileId: string) => getFirebaseFileUrl(currentUser(), fileId),
    [],
  );

  const value = useMemo<PlatformContextValue>(
    () => ({
      user,
      state,
      loading,
      busy,
      error,
      signIn,
      signOutUser,
      refresh,
      act,
      upload,
      connectOpenAI,
      disconnectOpenAI,
      download,
      fetchFileUrl,
    }),
    [
      user,
      state,
      loading,
      busy,
      error,
      signIn,
      signOutUser,
      refresh,
      act,
      upload,
      connectOpenAI,
      disconnectOpenAI,
      download,
      fetchFileUrl,
    ],
  );
  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value)
    throw new Error('usePlatform must be used inside PlatformProvider.');
  return value;
}
