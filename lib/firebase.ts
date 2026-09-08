'use client';

import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDf_KnGXAP5aGHNqdxq_M4iTz4uZUKxzbw',
  authDomain:
    typeof window !== 'undefined' && window.location.hostname.endsWith('.web.app')
      ? window.location.hostname
      : 'chenn.web.app',
  projectId: 'chennu4169',
  storageBucket: 'chennu4169.firebasestorage.app',
  messagingSenderId: '844035407431',
  appId: '1:844035407431:web:7a5ad58f9c9a3268683b62',
  measurementId: 'G-LFPNGM52YT',
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let analyticsPromise: Promise<Analytics | null> | null = null;
export function enableAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}
