import { useSyncExternalStore } from 'react';
import { getDb, getRev, subscribe } from '../services/db.js';

// Komponen yang memakai hook ini otomatis render ulang setiap kali data berubah,
// termasuk perubahan dari tab browser lain.
export function useDb(selector) {
  useSyncExternalStore(subscribe, getRev, getRev);
  return selector(getDb());
}
