import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { applyFlat } from '@/i18n/flatten';
import { ru } from '@/i18n/ru';

import { API_URL } from './api';

const CACHE_NAME = 'texts.ru.json';

type TextsResponse = { locale: string; updatedAt: string; texts: Record<string, string> };

/** expo-file-system has no web implementation, so the web build caches in localStorage. */
const cache = {
  async read(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(CACHE_NAME) ?? null;
    const file = new File(Paths.document, CACHE_NAME);
    return file.exists ? file.text() : null;
  },
  write(value: string) {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(CACHE_NAME, value);
    else new File(Paths.document, CACHE_NAME).write(value);
  },
};

/**
 * Loads UI texts from the server (editable in the database) and applies them over the built-in ones.
 * Order: built-in strings → cached copy from last launch → fresh copy from the server.
 * Never throws: if the server is unreachable the app keeps the cached or built-in texts.
 */
export async function loadTexts(timeoutMs = 2500) {
  try {
    const cached = await cache.read();
    if (cached) applyFlat(ru, JSON.parse(cached).texts);
  } catch {
    // Corrupt or unavailable cache: ignore, the server copy below replaces it.
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_URL}/content/texts?locale=ru`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;

    const data: TextsResponse = await res.json();
    applyFlat(ru, data.texts);
    try {
      cache.write(JSON.stringify(data));
    } catch {
      // Caching is best-effort.
    }
  } catch {
    // Offline or slow server: keep what we have.
  }
}
