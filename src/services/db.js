// "Database" simulasi di localStorage browser.
// - transact() dipakai untuk setiap perubahan data (mirip satu transaksi di database).
// - subscribe() memberi tahu komponen React saat data berubah.
// - BroadcastChannel menyebarkan perubahan ke tab lain, jadi tab pelanggan, kasir,
//   dan dapur saling ter-update secara real-time selama dibuka di browser yang sama.
// Saat pindah ke backend asli (misalnya Supabase), file ini dan api.js yang diganti;
// halaman-halaman tidak perlu ditulis ulang.
import { createSeed, DB_VERSION } from './seed.js';

const KEY = 'menuklik_db_v1';
const hasWindow = typeof window !== 'undefined';
const listeners = new Set();
let cache = null;
const channel = hasWindow && 'BroadcastChannel' in window ? new BroadcastChannel('menuklik_db') : null;

function readStorage() {
  try {
    const raw = hasWindow ? window.localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage() {
  try {
    if (hasWindow) window.localStorage.setItem(KEY, JSON.stringify(cache));
    return true;
  } catch (err) {
    console.warn('Data simulasi gagal disimpan (penyimpanan browser penuh atau diblokir).', err);
    return false;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function getDb() {
  if (!cache) {
    const stored = readStorage();
    if (stored && stored.version === DB_VERSION) cache = stored;
    else {
      cache = createSeed({ withSamples: true });
      writeStorage();
    }
  }
  return cache;
}

export const getRev = () => getDb().rev;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Setiap transaksi bersifat atomik: jika mutator melempar eror (validasi gagal di tengah jalan)
// atau penyimpanan penuh, seluruh perubahan dibatalkan dan data kembali seperti sebelum transaksi.
function restore(db, snapshot) {
  Object.keys(db).forEach((k) => delete db[k]);
  Object.assign(db, snapshot);
}

export function transact(mutator) {
  const db = getDb();
  const snapshot = structuredClone(db);
  let result;
  try {
    result = mutator(db);
    db.rev += 1;
    if (!writeStorage()) throw new Error('Penyimpanan browser penuh. Coba hapus foto menu yang besar atau reset data demo.');
  } catch (err) {
    restore(db, snapshot);
    throw err;
  }
  channel?.postMessage({ rev: db.rev });
  emit();
  return result;
}

function reloadFromStorage() {
  const stored = readStorage();
  if (stored && stored.version === DB_VERSION) {
    cache = stored;
    emit();
  }
}

if (channel) channel.onmessage = reloadFromStorage;
if (hasWindow) window.addEventListener('storage', (e) => e.key === KEY && reloadFromStorage());

export function resetDb({ withSamples = true } = {}) {
  cache = createSeed({ withSamples });
  cache.rev = Date.now();
  writeStorage();
  channel?.postMessage({ rev: cache.rev });
  emit();
}
