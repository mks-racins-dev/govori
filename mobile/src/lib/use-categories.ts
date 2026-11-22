import { useQuery } from '@tanstack/react-query';

import { api } from './api';

/**
 * Categories come from the database; cached for the session. With a genre, only categories that have it.
 * Categories the user turned off are left out unless `includeHidden` is set.
 */
export function useCategories(genre?: string, { includeHidden = false } = {}) {
  const all =
    useQuery({ queryKey: ['categories', genre ?? ''], queryFn: () => api.categories(genre), staleTime: 10 * 60_000 }).data ?? [];
  return includeHidden ? all : all.filter((c) => !c.hidden);
}

export function useGenres() {
  return useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 10 * 60_000 }).data ?? [];
}
