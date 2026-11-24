import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { getToken } from './session';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5080';
export const PRIVACY_URL = `${API_URL}/privacy`;
export const SUPPORT_URL = `${API_URL}/support`;

export type AttemptStatus = 'Recording' | 'Processing' | 'Done' | 'Failed';

/** `hidden`: the user turned this category off; it's left out of lists and random picks. */
export type Category = { name: string; description: string; badge: string | null; topicCount: number; hidden: boolean };

export type Genre = { name: string; topicCount: number };

/** Legacy topics have an empty genre, technique and hint. Difficulty: 1 easy, 2 medium, 3 hard. */
export type Topic = {
  id: number;
  text: string;
  category: string;
  genre: string;
  technique: string;
  hint: string;
  difficulty: number;
};

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

/** One rubric criterion: 0–2 points, the evidence, and what would have earned 2 (empty at 2). */
/** `toMax` is the "how to improve" tip; for delivery it has one line per missed norm. */
export type Criterion = { points: number; evidence: string; toMax: string };

export type RubricKey = 'thought' | 'support' | 'conclusion' | 'coherence' | 'delivery';
export type Rubric = Record<RubricKey, Criterion>;

/** The speech on the PREP steps: a short quote per step, null when the step is missing. */
export type Skeleton = { point: string | null; reason: string | null; example: string | null; conclusion: string | null };

/** `rubric` and `skeleton` are null on evaluations made before the rubric; those have `subScores` instead. */
export type Evaluation = {
  score: number;
  subScores: SubScores | null;
  rubric: Rubric | null;
  skeleton: Skeleton | null;
  /** A vocabulary drill, only when the speech was monotonous. */
  drill?: string | null;
  /** Replacements for each word the speaker repeated; missing on older evaluations. */
  synonyms?: { word: string; options: string[] }[] | null;
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
  /** Share of words heard clearly (0–1); null when unknown. */
  clarity?: number | null;
  unclearWords?: string[] | null;
  /** How varied the vocabulary was; null when there was too little speech. Not scored. */
  vocabulary?: { diversity: number; repeats: { word: string; count: number }[]; isLow: boolean } | null;
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
  reviewText: string | null;
  hasReviewAudio: boolean;
};

export type Me = {
  attempts: number;
  averageScore: number | null;
  bestScore: number | null;
  streakDays: number;
  /** Average points (0–2) per criterion over recent attempts; null before any rubric-scored attempt. */
  criteria: Partial<Record<RubricKey, number>> | null;
};

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

  categories: (genre?: string) => request<Category[]>(genre ? `/categories?genre=${encodeURIComponent(genre)}` : '/categories'),
  genres: () => request<Genre[]>('/genres'),

  randomTopic: (exclude?: number, category?: string, genre?: string) => {
    const q = new URLSearchParams();
    if (exclude) q.set('exclude', String(exclude));
    if (category) q.set('category', category);
    if (genre) q.set('genre', genre);
    return request<Topic>(`/topics/random?${q}`);
  },

  uploadAttempt: async (topicId: number, durationSec: number, audioUri: string) => {
    const form = new FormData();
    form.append('topicId', String(topicId));
    form.append('durationSec', String(durationSec));
    if (Platform.OS === 'web') {
      // On web the recorder returns a blob: URL; expo-file-system is unavailable there.
      const blob = await (await fetch(audioUri)).blob();
      form.append('audio', blob, 'recording.webm');
    } else {
      // Expo's fetch needs a real File object, not React Native's { uri, name, type } descriptor.
      form.append('audio', new File(audioUri));
    }
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
  reviewAudioSource: async (id: string) => ({
    uri: `${API_URL}/attempts/${id}/review-audio`,
    headers: { Authorization: `Bearer ${await getToken()}` },
  }),

  me: () => request<Me>('/me'),
  setHiddenCategories: (categories: string[]) =>
    request<void>('/me/hidden-categories', { method: 'PUT', body: JSON.stringify({ categories }) }),
  deleteAccount: () => request<void>('/me', { method: 'DELETE' }),
};
