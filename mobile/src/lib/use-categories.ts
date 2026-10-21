import { useQuery } from '@tanstack/react-query';

import { api } from './api';

/** Categories come from the database; cached for the session. */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: api.categories, staleTime: 10 * 60_000 }).data ?? [];
}
