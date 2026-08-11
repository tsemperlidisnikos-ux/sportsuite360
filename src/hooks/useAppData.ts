import { useCallback, useEffect, useState } from 'react';
import { subscribeAppData } from '../data/appDataEvents';
import { getData } from '../data/repository';
import type { AppData } from '../types';

const STORAGE_KEY = 'academyhub-data-v12';

function snapshotData(): AppData {
  const current = getData();
  // Shallow copy so React always sees a new root reference after mutations.
  return { ...current, photos: [...(current.photos ?? [])] };
}

export function useAppData() {
  const [data, setData] = useState<AppData>(() => snapshotData());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const sync = () => {
      setData(snapshotData());
      setVersion((v) => v + 1);
    };
    return subscribeAppData(sync);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setData(snapshotData());
        setVersion((v) => v + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refresh = useCallback(() => {
    setData(snapshotData());
    setVersion((v) => v + 1);
  }, []);

  return { data, refresh, version };
}
