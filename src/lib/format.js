// Fungsi bantu format angka, waktu, dan ID.

export const DAY = 86_400_000;
export const MINUTE = 60_000;

export const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');

export const time = (t) =>
  new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export const dateShort = (t) =>
  new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export const dateTime = (t) =>
  new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const dateLong = (t) =>
  new Date(t).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const minutesSince = (t) => Math.max(0, Math.floor((Date.now() - t) / MINUTE));

export function timeAgo(t) {
  const m = minutesSince(t);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function toDateInput(t) {
  const d = new Date(t);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function fromDateInput(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function randomInts(n) {
  const arr = new Uint32Array(n);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr);
  else for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 2 ** 32);
  return arr;
}

// Token QR: acak, tidak berurutan, tanpa karakter yang mudah tertukar (0/o, 1/l).
export function randomToken(length = 16) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(randomInts(length), (x) => chars[x % chars.length]).join('');
}

export const uid = (prefix = '') => prefix + randomToken(12);

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}
