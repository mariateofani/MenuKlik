import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { login as apiLogin } from '../services/api.js';

// Sesi disimpan di sessionStorage, jadi setiap tab bisa masuk dengan akun berbeda.
// Contoh: tab 1 sebagai Kasir, tab 2 sebagai Dapur, tab 3 sebagai pelanggan.
const KEY = 'menuklik_session';
const AuthContext = createContext(null);

function readSession() {
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => (typeof window === 'undefined' ? null : readSession()));

  const login = useCallback((email, password) => {
    const s = apiLogin(email, password);
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* sesi tetap berlaku di memori */
    }
    setSession(s);
    return s;
  }, []);

  // Dipakai setelah pendaftaran: langsung masuk tanpa mengetik ulang password.
  const signIn = useCallback((s) => {
    try { window.sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sesi tetap di memori */ }
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* abaikan */
    }
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, login, signIn, logout }), [session, login, signIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
