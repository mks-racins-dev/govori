import { File, Paths } from 'expo-file-system';

import { applyFlat } from '@/i18n/flatten';
import { ru } from '@/i18n/ru';

import { API_URL } from './api';

const cacheFile = new File(Paths.document, 'texts.ru.json');

type TextsResponse = { locale: string; updatedAt: string; texts: Record<string, string> };

/**
 * Loads UI texts from the server (editable in the database) and applies them over the built-in ones.
 * Order: built-in strings → cached copy from last launch → fresh copy from the server.
 * Never throws: if the server is unreachable the app keeps the cached or built-in texts.
 */
export async function loadTexts(timeoutMs = 2500) {
  try {
    if (cacheFile.exists) applyFlat(ru, JSON.parse(await cacheFile.text()).texts);
  } catch {
    // Corrupt cache: ignore, the server copy below replaces it.
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_URL}/content/texts?locale=ru`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;

    const data: TextsResponse = await res.json();
    applyFlat(ru, data.texts);
    cacheFile.write(JSON.stringify(data));
  } catch {
    // Offline or slow server: keep what we have.
  }
}
