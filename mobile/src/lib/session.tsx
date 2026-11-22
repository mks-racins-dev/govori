import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as NativeSecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api } from './api';

const TOKEN_KEY = 'govori.token';
const DEVICE_KEY = 'govori.deviceId';

/**
 * expo-secure-store has no web implementation. The web build (dev testing only) keeps secrets in memory,
 * never in browser storage, so reloading the page signs out.
 */
const webMemory = new Map<string, string>();
const SecureStore =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (k: string) => webMemory.get(k) ?? null,
        setItemAsync: async (k: string, v: string) => {
          webMemory.set(k, v);
        },
        deleteItemAsync: async (k: string) => {
          webMemory.delete(k);
        },
      }
    : NativeSecureStore;

/** The device id is not a secret; on web it lives in localStorage so dev login keeps the same account. */
const DeviceStore = {
  get: async () =>
    Platform.OS === 'web' ? (globalThis.localStorage?.getItem(DEVICE_KEY) ?? null) : NativeSecureStore.getItemAsync(DEVICE_KEY),
  set: async (id: string) => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(DEVICE_KEY, id);
    else await NativeSecureStore.setItemAsync(DEVICE_KEY, id);
  },
};

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
      let deviceId = await DeviceStore.get();
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await DeviceStore.set(deviceId);
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
