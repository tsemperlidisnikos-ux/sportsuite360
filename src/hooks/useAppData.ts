import { useCallback, useEffect, useState } from 'react';
import { getData } from '../data/repository';
import type { AppData } from '../types';

const STORAGE_KEY = 'academyhub-data-v12';
const listeners = new Set<() => void>();

function notifyAppDataListeners() {
  listeners.forEach((listener) => listener());
}

export function useAppData() {
  const [data, setData] = useState<AppData>(() => getData());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const sync = () => {
      setData(getData());
      setVersion((v) => v + 1);
    };
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) notifyAppDataListeners();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refresh = useCallback(() => {
    notifyAppDataListeners();
  }, []);

  return { data, refresh, version };
}
