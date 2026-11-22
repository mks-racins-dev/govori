import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as NativeSecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api } from './api';

/** expo-secure-store has no web implementation; the web build (dev testing only) uses localStorage. */
const SecureStore =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        setItemAsync: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        deleteItemAsync: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : NativeSecureStore;


const TOKEN_KEY = 'govori.token';
const DEVICE_KEY = 'govori.deviceId';

let cachedToken: string | null = null;

export async function getToken() {
  if (cachedToken === null) cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

async function saveToken(token: string | null) {
  cachedToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type Session = {
  ready: boolean;
  signedIn: boolean;
  signInWithApple: () => Promise<void>;
  signInDev: () => Promise<void>;
  signInWithPassword: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    getToken().then((token) => {
      setSignedIn(!!token);
      setReady(true);
    });
  }, []);

  const session: Session = {
    ready,
    signedIn,
    async signInWithApple() {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      if (!credential.identityToken) throw new Error('No identity token');
      const { token } = await api.appleLogin(credential.identityToken);
      await saveToken(token);
      setSignedIn(true);
    },
    async signInDev() {
      let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
      }
      const { token } = await api.devLogin(deviceId);
      await saveToken(token);
      setSignedIn(true);
    },
    async signInWithPassword(username: string, password: string) {
      const { token } = await api.passwordLogin(username, password);
      await saveToken(token);
      setSignedIn(true);
    },
    async signOut() {
      await saveToken(null);
      setSignedIn(false);
    },
  };

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
