import { useEffect, useState } from 'react';

// Memicu render ulang berkala, misalnya untuk "12 mnt lalu" di layar dapur.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
