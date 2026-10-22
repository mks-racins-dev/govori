import { File } from 'expo-file-system';

import { getToken } from './session';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5080';
export const PRIVACY_URL = `${API_URL}/privacy`;
export const SUPPORT_URL = `${API_URL}/support`;

export type AttemptStatus = 'Recording' | 'Processing' | 'Done' | 'Failed';

export type Category = { name: string; description: string; badge: string | null };

export type Topic = { id: number; text: string; category: string };

export type AttemptSummary = {
  id: string;
  topic: string;
  category: string;
  status: AttemptStatus;
  score: number | null;
  durationSec: number;
  createdAt: string;
};

export type SubScores = {
  structure: number;
  relevance: number;
  vocabulary: number;
  fluency: number;
  pace: number;
};

export type Evaluation = {
  score: number;
  subScores: SubScores;
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
};

export type Metrics = {
  durationSec: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
};

export type AttemptDetail = {
  id: string;
  topic: Topic;
  status: AttemptStatus;
  durationSec: number;
  createdAt: string;
  transcript: string | null;
  failureReason: string | null;
  evaluation: Evaluation | null;
  metrics: Metrics | null;
};

export type Me = { attempts: number; averageScore: number | null; bestScore: number | null; streakDays: number };

export class ApiError extends Error {
  constructor(public status: number, detail?: string) {
    super(detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => undefined));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  devLogin: (deviceId: string) =>
    request<{ token: string }>('/auth/dev', { method: 'POST', body: JSON.stringify({ deviceId }) }),
  passwordLogin: (username: string, password: string) =>
    request<{ token: string }>('/auth/password', { method: 'POST', body: JSON.stringify({ username, password }) }),
  appleLogin: (identityToken: string) =>
    request<{ token: string }>('/auth/apple', { method: 'POST', body: JSON.stringify({ identityToken }) }),

  categories: () => request<Category[]>('/categories'),

  randomTopic: (exclude?: number, category?: string) => {
    const q = new URLSearchParams();
    if (exclude) q.set('exclude', String(exclude));
    if (category) q.set('category', category);
    return request<Topic>(`/topics/random?${q}`);
  },

  uploadAttempt: (topicId: number, durationSec: number, audioUri: string) => {
    const form = new FormData();
    form.append('topicId', String(topicId));
    form.append('durationSec', String(durationSec));
    // Expo's fetch needs a real File object, not React Native's { uri, name, type } descriptor.
    form.append('audio', new File(audioUri));
    return request<{ id: string }>('/attempts', { method: 'POST', body: form });
  },

  attempts: () => request<AttemptSummary[]>('/attempts'),
  attempt: (id: string) => request<AttemptDetail>(`/attempts/${id}`),
  retryAttempt: (id: string) => request<void>(`/attempts/${id}/retry`, { method: 'POST' }),
  deleteAttempt: (id: string) => request<void>(`/attempts/${id}`, { method: 'DELETE' }),
  audioSource: async (id: string) => ({
    uri: `${API_URL}/attempts/${id}/audio`,
    headers: { Authorization: `Bearer ${await getToken()}` },
  }),

  me: () => request<Me>('/me'),
  deleteAccount: () => request<void>('/me', { method: 'DELETE' }),
};
