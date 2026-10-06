import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToDataChanges } from '@/data/events';

export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Runs a database query and keeps the result fresh: it re-runs when `deps` change, when the screen
 * regains focus, and whenever a write calls `notifyDataChanged()`.
 */
export function useQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: unknown[]): QueryResult<T> {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const skipNextFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (skipNextFocus.current) {
        skipNextFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    let cancelled = false;
    query(db)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setHasLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return { data, loading: !hasLoaded, error, refresh };
}
