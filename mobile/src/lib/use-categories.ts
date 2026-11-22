import { useQuery } from '@tanstack/react-query';

import { api } from './api';

/** Categories come from the database; cached for the session. With a genre, only categories that have it. */
export function useCategories(genre?: string) {
  return (
    useQuery({ queryKey: ['categories', genre ?? ''], queryFn: () => api.categories(genre), staleTime: 10 * 60_000 }).data ?? []
  );
}

export function useGenres() {
  return useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 10 * 60_000 }).data ?? [];
}
