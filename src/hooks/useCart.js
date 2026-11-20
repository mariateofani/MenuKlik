import { useCallback, useEffect, useState } from 'react';

// Keranjang disimpan per token QR di perangkat pelanggan, jadi tidak hilang saat halaman dimuat ulang.
// Keranjang hanya menyimpan pilihan (id menu, id variasi, jumlah). Harga selalu dihitung ulang dari data menu.
const load = (key, fallback) => {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* abaikan */
  }
};

export function useCart(token) {
  const key = `menuklik_cart_${token}`;
  const [state, setState] = useState(() => load(key, { lines: [], note: '', name: '', myOrders: [] }));

  useEffect(() => setState(load(key, { lines: [], note: '', name: '', myOrders: [] })), [key]);
  useEffect(() => store(key, state), [key, state]);

  const sameLine = (a, b) => a.productId === b.productId && a.note === b.note && [...a.optionIds].sort().join() === [...b.optionIds].sort().join();

  const add = useCallback((line) => {
    setState((s) => {
      const i = s.lines.findIndex((l) => sameLine(l, line));
      if (i >= 0) {
        const lines = [...s.lines];
        lines[i] = { ...lines[i], qty: Math.min(50, lines[i].qty + line.qty) };
        return { ...s, lines };
      }
      return { ...s, lines: [...s.lines, { ...line, key: Math.random().toString(36).slice(2) }] };
    });
  }, []);

  const setQty = useCallback((lineKey, qty) => {
    setState((s) => ({ ...s, lines: qty < 1 ? s.lines.filter((l) => l.key !== lineKey) : s.lines.map((l) => (l.key === lineKey ? { ...l, qty: Math.min(50, qty) } : l)) }));
  }, []);

  const remove = useCallback((lineKey) => setState((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== lineKey) })), []);
  const setMeta = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);
  const clearAfterOrder = useCallback((orderId) => setState((s) => ({ ...s, lines: [], note: '', myOrders: [...new Set([...s.myOrders, orderId])] })), []);

  return { ...state, count: state.lines.reduce((a, l) => a + l.qty, 0), add, setQty, remove, setMeta, clearAfterOrder };
}
