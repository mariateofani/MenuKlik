// Lapisan "backend" simulasi. Setiap fungsi di sini mewakili satu endpoint API.
// Aturan bisnis (validasi stok, snapshot harga, hak akses peran, isolasi data per restoran,
// pencegahan pesanan ganda, verifikasi notifikasi pembayaran) sengaja ditaruh di sini,
// bukan di halaman, supaya nanti bisa dipindahkan utuh ke backend sungguhan.
import { getDb, transact } from './db.js';
import { uid, randomToken, startOfDay, DAY, MINUTE } from '../lib/format.js';
import { can, ROLES, roleLabels, isManual, isActiveOrder } from '../lib/constants.js';
import { DEMO_PASSWORD } from './seed.js';

export class ApiError extends Error {
  constructor(message, code = 'error', details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

// Waktu simulasi (khusus demo): db.time_offset menggeser jam server agar masa tenggang dan kedaluwarsa bisa dicoba.
const now = () => Date.now() + (getDb().time_offset || 0);
const byId = (list, id) => list.find((x) => x.id === id);
const sortBy = (key, dir = 1) => (a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0);
const CUSTOMER = { id: 'customer', label: 'Pelanggan (QR)' };

/* =====================================================================
   BACAAN UMUM
   ===================================================================== */
export const settingsOf = (db, rid) => db.restaurant_settings.find((s) => s.restaurant_id === rid);

export function currentSubscription(db, rid) {
  return db.subscriptions.filter((s) => s.restaurant_id === rid).sort(sortBy('started_at', -1))[0] || null;
}

// Aturan platform yang bisa diubah Super Admin (disimpan di db.platform_settings).
export const DEFAULT_PLATFORM = { trial_enabled: true, trial_days: 14, grace_days: 3, qr_when_expired: false, staff_when_expired: false };
export const platformSettings = (db) => ({ ...DEFAULT_PLATFORM, ...(db.platform_settings || {}) });
const periodDays = (p) => (p === 'yearly' ? 365 : 30);

// Fase langganan lengkap (dipakai halaman Langganan). Dihitung dari tanggal berakhir,
// masa tenggang, dan hasil pembayaran perpanjangan.
export function subscriptionPhase(db, rid) {
  if (byId(db.restaurants, rid)?.status === 'suspended') return 'suspended';
  const s = currentSubscription(db, rid);
  if (!s) return 'none';
  const n = now();
  if (s.status === 'pending') return 'pending';
  if (s.status === 'trial') {
    if (n >= s.ends_at) return 'trial_expired';
    return s.ends_at - n <= 3 * DAY ? 'trial_ending' : 'trial';
  }
  if (s.status === 'canceled') return 'canceled';
  if (n < s.ends_at) return s.cancel_at_end ? 'canceling' : s.ends_at - n <= 7 * DAY ? 'ending' : 'active';
  if (s.cancel_at_end) return 'canceled';
  if (n < s.ends_at + platformSettings(db).grace_days * DAY) return s.renew_failed ? 'renew_failed' : 'grace';
  return 'expired';
}

// Tingkat akses untuk QR pelanggan dan aksi pegawai: trial | active | expired | suspended.
export function subscriptionState(db, rid) {
  const ph = subscriptionPhase(db, rid);
  if (ph === 'suspended') return 'suspended';
  if (['trial', 'trial_ending'].includes(ph)) return 'trial';
  if (['active', 'ending', 'canceling', 'grace', 'renew_failed'].includes(ph)) return 'active';
  return 'expired';
}

export function planOf(db, rid) {
  const s = currentSubscription(db, rid);
  return s ? byId(db.plans, s.plan_id) : null;
}

export function optionsOf(db, productId) {
  return db.product_variants.filter((v) => v.product_id === productId && v.is_active !== false).sort(sortBy('sort_order'));
}

export function groupOptions(options) {
  const groups = [];
  options.filter((o) => o.kind === 'variant').forEach((o) => {
    let g = groups.find((x) => x.name === o.group_name);
    if (!g) groups.push((g = { name: o.group_name, options: [] }));
    g.options.push(o);
  });
  return { groups, addons: options.filter((o) => o.kind === 'addon') };
}

export const defaultOptionIds = (options) => groupOptions(options).groups.map((g) => g.options[0].id);

// Hitung harga satu baris keranjang dari data menu TERKINI.
export function priceLine(db, line) {
  const product = byId(db.products, line.productId);
  if (!product) return null;
  const options = (line.optionIds || []).map((id) => byId(db.product_variants, id)).filter(Boolean);
  const unit = product.price + options.reduce((a, o) => a + o.price_delta, 0);
  return {
    product,
    options,
    unit,
    total: unit * line.qty,
    optionsText: options.map((o) => (o.kind === 'variant' ? o.name : `+ ${o.name}`)).join(', '),
    unavailable: !product.is_active || !product.is_available || options.some((o) => o.is_active === false),
  };
}

export function cartTotals(db, rid, lines) {
  const s = settingsOf(db, rid);
  const subtotal = lines.reduce((a, l) => a + (priceLine(db, l)?.total || 0), 0);
  // Asumsi: pajak dan biaya layanan sama-sama dihitung dari subtotal.
  const tax = Math.round((subtotal * s.tax_percent) / 100);
  const service = Math.round((subtotal * s.service_percent) / 100);
  return { subtotal, tax, service, total: subtotal + tax + service, count: lines.reduce((a, l) => a + l.qty, 0) };
}

export function isOpenNow(settings, at = new Date()) {
  const toMin = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const m = at.getHours() * 60 + at.getMinutes();
  const o = toMin(settings.open_time);
  const c = toMin(settings.close_time);
  return c > o ? m >= o && m < c : m >= o || m < c;
}

export function orderBundle(db, order) {
  return {
    ...order,
    table: byId(db.tables, order.table_id),
    items: db.order_items.filter((i) => i.order_id === order.id),
    payments: db.payments.filter((p) => p.order_id === order.id).sort(sortBy('created_at')),
    history: db.order_status_history.filter((h) => h.order_id === order.id).sort(sortBy('created_at')),
  };
}

export const latestPayment = (bundle) => bundle.payments[bundle.payments.length - 1] || null;

export const currentQr = (db, tableId) =>
  db.qr_codes.find((q) => q.table_id === tableId && q.is_active) ||
  db.qr_codes.filter((q) => q.table_id === tableId).sort(sortBy('created_at', -1))[0];

function audit(db, rid, actor, action, detail) {
  db.audit_logs.push({ id: uid('log_'), restaurant_id: rid, actor_id: actor.id, actor_label: actor.label, action, detail, created_at: now() });
}

// Riwayat mencatat siapa, di perangkat apa. kind: order | payment | kitchen | serving.
function addHistory(db, order, kind, to, actor, device = '', note = '') {
  db.order_status_history.push({
    id: uid('osh_'), order_id: order.id, restaurant_id: order.restaurant_id, kind, to_status: to,
    changed_by: actor.id, changed_by_label: actor.label, device, note, created_at: now(),
  });
  if (kind === 'kitchen') order.kitchen_status = to;
  if (kind === 'serving') order.serving_status = to;
  order.updated_at = now();
}

const SYSTEM = { id: 'system', label: 'Sistem' };
const GATEWAY = { id: 'gateway', label: 'Payment gateway (webhook)' };

function paymentEvent(db, payment, type, summary, source, gatewayEventId = null) {
  db.payment_events.push({
    id: uid('pe_'), payment_id: payment.id, restaurant_id: payment.restaurant_id, event_type: type, source,
    gateway_event_id: gatewayEventId, summary, created_at: now(),
  });
}

function createPayment(db, order, channel) {
  // Satu pesanan boleh punya beberapa catatan pembayaran (mis. gagal lalu dicoba lagi),
  // tetapi hanya satu yang berstatus pending pada satu waktu.
  db.payments.filter((p) => p.order_id === order.id && p.status === 'pending').forEach((p) => {
    p.status = 'failed';
    paymentEvent(db, p, 'superseded', 'Digantikan percobaan pembayaran baru', 'system');
  });
  const cash = channel === 'cash';
  const p = {
    id: uid('pay_'), restaurant_id: order.restaurant_id, order_id: order.id,
    payment_number: 'TRX-' + String(db.payments.filter((x) => x.restaurant_id === order.restaurant_id).length + 1).padStart(5, '0'),
    method: cash ? 'cash' : 'digital', channel, amount: order.total, status: 'pending',
    gateway_ref: cash ? null : 'SIM-' + randomToken(8).toUpperCase(), paid_at: null, confirmed_by: null,
    expires_at: cash ? null : now() + 15 * MINUTE, created_at: now(),
  };
  db.payments.push(p);
  paymentEvent(db, p, 'created', cash ? 'Menunggu pembayaran tunai di kasir' : 'Transaksi dibuat di payment gateway (simulasi)', cash ? 'system' : 'gateway');
  order.payment_status = 'pending';
  order.updated_at = now();
  return p;
}

/* =====================================================================
   PELANGGAN (tanpa login, dikenali dari token QR)
   ===================================================================== */
export function resolveQr(token) {
  const db = getDb();
  const qr = db.qr_codes.find((q) => q.token === token);
  if (!qr) return { ok: false, reason: 'not_found' };
  const restaurant = byId(db.restaurants, qr.restaurant_id);
  const table = byId(db.tables, qr.table_id);
  if (!restaurant || !table || table.is_archived) return { ok: false, reason: 'not_found' };
  // Alasan penolakan tetap membawa restoran, meja, dan pengaturan. Pelanggan yang sudah punya pesanan
  // tetap bisa memantau statusnya walau pemesanan baru ditutup (lihat CustomerLayout).
  const info = { restaurant, table, qr, settings: settingsOf(db, restaurant.id) };
  if (!qr.is_active) return { ok: false, reason: 'revoked', ...info };
  const sub = subscriptionState(db, restaurant.id);
  if (sub === 'suspended' || (sub === 'expired' && !platformSettings(db).qr_when_expired)) return { ok: false, reason: 'subscription', ...info };
  if (!table.is_active) return { ok: false, reason: 'table_inactive', ...info };
  return { ok: true, ...info };
}

export function getMenu(db, rid) {
  const categories = db.categories.filter((c) => c.restaurant_id === rid && c.is_active).sort(sortBy('sort_order'));
  const activeCats = new Set(categories.map((c) => c.id));
  const products = db.products
    .filter((p) => p.restaurant_id === rid && p.is_active && activeCats.has(p.category_id))
    .sort(sortBy('sort_order'))
    .map((p) => ({ ...p, options: optionsOf(db, p.id) }));
  return { categories: categories.filter((c) => products.some((p) => p.category_id === c.id)), products };
}

export function placeOrder({ token, lines, customerName = '', note = '', paymentMethod, channel, idempotencyKey }) {
  return transact((db) => {
    // 1) Pencegahan pesanan ganda: kunci yang sama mengembalikan pesanan yang sama.
    const dup = db.orders.find((o) => o.idempotency_key === idempotencyKey);
    if (dup) return { order: dup, duplicate: true };

    // 2) Validasi QR dan meja di server.
    const q = resolveQr(token);
    if (!q.ok) throw new ApiError('QR tidak valid atau meja sedang tidak menerima pesanan.', 'qr_invalid');
    if (!lines?.length) throw new ApiError('Keranjang masih kosong.', 'validation');
    const rid = q.restaurant.id;

    // 3) Validasi ulang menu, stok, dan pilihan variasi.
    const problems = [];
    lines.forEach((l) => {
      const p = byId(db.products, l.productId);
      if (!p || p.restaurant_id !== rid || !p.is_active) problems.push({ productId: l.productId, message: `${p?.name || 'Salah satu menu'} sudah tidak dijual.` });
      else if (!p.is_available) problems.push({ productId: p.id, message: `${p.name} baru saja habis.` });
      else {
        const opts = (l.optionIds || []).map((id) => byId(db.product_variants, id));
        const groups = groupOptions(optionsOf(db, p.id)).groups;
        const badOption = opts.some((o) => !o || o.product_id !== p.id || o.is_active === false);
        const missing = groups.some((g) => !opts.some((o) => o && o.kind === 'variant' && o.group_name === g.name));
        if (badOption || missing) problems.push({ productId: p.id, message: `Pilihan untuk ${p.name} sudah berubah. Pilih ulang dari menu.` });
      }
      if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 50) problems.push({ productId: l.productId, message: 'Jumlah item tidak valid.' });
    });
    if (problems.length) throw new ApiError(problems.map((p) => p.message).join(' '), 'validation', problems);

    if (!['digital', 'cashier'].includes(paymentMethod)) throw new ApiError('Pilih cara pembayaran.', 'validation');
    if (paymentMethod === 'digital' && !q.settings.channels[channel]) throw new ApiError('Metode pembayaran digital ini sedang tidak tersedia.', 'validation');

    // 4) Simpan pesanan, harga disalin (snapshot) ke order_items.
    const restaurant = byId(db.restaurants, rid);
    restaurant.order_seq = (restaurant.order_seq || 0) + 1;
    const totals = cartTotals(db, rid, lines);
    const order = {
      id: uid('ord_'), restaurant_id: rid, table_id: q.table.id,
      order_number: 'MK-' + String(restaurant.order_seq).padStart(4, '0'),
      idempotency_key: idempotencyKey, customer_name: customerName.trim().slice(0, 40), note: note.trim().slice(0, 200),
      payment_method: paymentMethod,
      // Kebijakan disalin ke pesanan agar perubahan pengaturan tidak mengubah pesanan lama.
      pay_policy: paymentMethod === 'digital' ? 'pay_first' : q.settings.pay_policy,
      payment_status: 'pending', kitchen_status: 'waiting', serving_status: null, cancelled: false, pos_recorded: false,
      subtotal: totals.subtotal, tax_amount: totals.tax, service_amount: totals.service, total: totals.total,
      cancel_reason: '', created_at: now(), updated_at: now(),
    };
    db.orders.push(order);
    lines.forEach((l) => {
      const pl = priceLine(db, l);
      db.order_items.push({
        id: uid('oi_'), order_id: order.id, restaurant_id: rid, product_id: pl.product.id, product_name: pl.product.name,
        base_price: pl.product.price, options_text: pl.optionsText, unit_price: pl.unit, qty: l.qty,
        note: (l.note || '').trim().slice(0, 120), line_total: pl.total,
      });
    });
    addHistory(db, order, 'order', 'created', CUSTOMER, 'HP pelanggan');
    createPayment(db, order, paymentMethod === 'digital' ? channel : 'cash');
    return { order };
  });
}

// Pelanggan hanya boleh membaca pesanan yang dibuat dari meja yang sama dengan QR-nya.
export function getCustomerOrder(db, orderId, token) {
  const qr = db.qr_codes.find((x) => x.token === token);
  const order = byId(db.orders, orderId);
  if (!qr || !order || order.table_id !== qr.table_id) return null;
  return orderBundle(db, order);
}

function customerOrderForWrite(db, orderId, token) {
  const b = getCustomerOrder(db, orderId, token);
  if (!b) throw new ApiError('Pesanan tidak ditemukan.', 'not_found');
  return byId(db.orders, orderId);
}

export function retryDigitalPayment({ orderId, token, channel }) {
  return transact((db) => {
    const o = customerOrderForWrite(db, orderId, token);
    if (o.cancelled) throw new ApiError('Pesanan sudah dibatalkan.', 'invalid_state');
    if (!['failed', 'expired'].includes(o.payment_status)) throw new ApiError('Pembayaran ini masih berjalan atau sudah selesai.', 'invalid_state');
    if (!settingsOf(db, o.restaurant_id).channels[channel]) throw new ApiError('Metode ini tidak tersedia.', 'validation');
    o.payment_method = 'digital';
    o.pay_policy = 'pay_first';
    return createPayment(db, o, channel);
  });
}

export function switchToCashier({ orderId, token }) {
  return transact((db) => {
    const o = customerOrderForWrite(db, orderId, token);
    if (o.cancelled) throw new ApiError('Pesanan sudah dibatalkan.', 'invalid_state');
    if (!['failed', 'expired'].includes(o.payment_status)) throw new ApiError('Selesaikan atau batalkan pembayaran digital dulu.', 'invalid_state');
    o.payment_method = 'cashier';
    o.pay_policy = settingsOf(db, o.restaurant_id).pay_policy;
    return createPayment(db, o, 'cash');
  });
}

// SIMULASI notifikasi (webhook) dari payment gateway.
// Di sistem asli fungsi ini ada di backend dan dipanggil oleh server payment gateway,
// bukan oleh HP pelanggan. Backend wajib memverifikasi tanda tangan notifikasi.
export function simulateGatewayNotification({ paymentId, result, gatewayEventId }) {
  return transact((db) => {
    const p = byId(db.payments, paymentId);
    if (!p || p.method !== 'digital') throw new ApiError('Transaksi tidak ditemukan.', 'not_found');
    if (db.payment_events.some((e) => e.gateway_event_id === gatewayEventId)) {
      paymentEvent(db, p, 'duplicate_ignored', `Notifikasi ${gatewayEventId} sudah pernah diproses, diabaikan.`, 'gateway');
      return { duplicate: true, payment: p };
    }
    const label = { paid: 'berhasil', failed: 'gagal', expired: 'kedaluwarsa' }[result];
    paymentEvent(db, p, `webhook_${result}`, `Notifikasi diterima: ${label}. Tanda tangan diverifikasi (simulasi).`, 'gateway', gatewayEventId);
    if (p.status !== 'pending') {
      paymentEvent(db, p, 'ignored_final', 'Status sudah final, notifikasi tidak mengubah apa pun.', 'system');
      return { ignored: true, payment: p };
    }
    p.status = result;
    if (result === 'paid') p.paid_at = now();
    const o = byId(db.orders, p.order_id);
    const latest = db.payments.filter((x) => x.order_id === o.id).sort(sortBy('created_at')).pop();
    if (latest.id === p.id) {
      o.payment_status = p.status;
      addHistory(db, o, 'payment', p.status, GATEWAY, 'Server');
    }
    return { payment: p };
  });
}

/* =====================================================================
   AUTENTIKASI & OTORISASI
   ===================================================================== */
export function login(email, password) {
  const db = getDb();
  const u = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!u || u.password !== password) throw new ApiError('Email atau password salah.', 'auth');
  return sessionOf(db, u);
}

// Membentuk sesi dari akun: admin platform, pegawai restoran (satu atau beberapa peran), atau pemilik baru yang belum punya restoran.
function sessionOf(db, u) {
  if (!u.is_active) throw new ApiError('Akun ini dinonaktifkan.', 'auth');
  if (u.platform_role === 'super_admin') return { kind: 'admin', userId: u.id, name: u.name, email: u.email };
  const m = db.restaurant_members.find((x) => x.user_id === u.id && x.is_active);
  if (!m && u.onboarding) return { kind: 'onboarding', userId: u.id, name: u.name, email: u.email };
  if (!m) throw new ApiError('Akun ini belum terhubung ke restoran mana pun, atau aksesnya sudah dicabut.', 'auth');
  return { kind: 'staff', userId: u.id, name: u.name, email: u.email, restaurantId: m.restaurant_id, roles: m.roles };
}

// SIMULASI "Masuk dengan Google". Tidak ada koneksi ke Google. Di produk asli, backend memverifikasi
// token OAuth dari Google, lalu mencocokkan email terverifikasi dengan akun. Di sini email dipercaya apa adanya.
// Email yang belum dikenal menjadi akun pemilik baru dan diarahkan ke pendaftaran usaha.
export function loginWithGoogle({ email, name }) {
  return transact((db) => {
    const e = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new ApiError('Format email tidak valid.', 'validation');
    let u = db.users.find((x) => x.email.toLowerCase() === e);
    if (!u) {
      const n = String(name || '').trim() || e.split('@')[0];
      u = { id: uid('user_'), name: n, email: e, phone: '', password: randomToken(24), google: true, platform_role: null, is_active: true, onboarding: true, trial_used: false, created_at: now() };
      db.users.push(u);
    }
    return sessionOf(db, u);
  });
}

// Setiap aksi pegawai memeriksa ulang keanggotaan dan peran dari database,
// bukan hanya dari data sesi di browser.
export function staffContext(db, session) {
  if (!session || session.kind !== 'staff') return null;
  const m = db.restaurant_members.find((x) => x.user_id === session.userId && x.restaurant_id === session.restaurantId && x.is_active);
  if (!m) return null;
  return { rid: m.restaurant_id, roles: m.roles, actor: { id: session.userId, label: `${session.name} (${roleLabels(m.roles)})` } };
}

function requireStaff(db, session, perm) {
  const ctx = staffContext(db, session);
  if (!ctx) throw new ApiError('Sesi berakhir atau akses dicabut. Silakan masuk lagi.', 'auth');
  if (perm && !can(ctx.roles, perm)) throw new ApiError('Peran kamu tidak punya izin untuk aksi ini.', 'forbidden');
  return ctx;
}

// Isolasi tenant: data restoran lain diperlakukan seolah tidak ada.
function own(record, rid) {
  if (!record || record.restaurant_id !== rid) throw new ApiError('Data tidak ditemukan.', 'not_found');
  return record;
}

function requireAdmin(db, session) {
  const u = session?.kind === 'admin' && byId(db.users, session.userId);
  if (!u || u.platform_role !== 'super_admin' || !u.is_active) throw new ApiError('Khusus Super Admin.', 'forbidden');
  return { id: u.id, label: `${u.name} (Super Admin)` };
}

/* =====================================================================
   PESANAN (Owner, Kasir, Dapur)
   ===================================================================== */
export const ORDER_ACTION_LABEL = {
  confirm_cash: 'Konfirmasi bayar tunai',
  accept: 'Terima & kirim ke dapur',
  start: 'Mulai memasak',
  ready: 'Selesai masak',
  pickup: 'Ambil pesanan',
  deliver: 'Sudah diantar ke meja',
  quick: 'Langsung tandai sudah disajikan',
  cancel: 'Batalkan pesanan',
};

// Fungsi murni: dipakai layar untuk menampilkan alasan tombol terkunci, dan dipakai lagi
// oleh runOrderAction untuk menegakkan aturan yang sama. Izin = gabungan semua peran pegawai.
// Mode manual (Basic, atau Standard tanpa tablet): Kasir juga boleh mencatat status dapur dan penyajian.
export function checkOrderAction(order, roles, action, settings) {
  const no = (reason) => ({ ok: false, reason });
  const yes = { ok: true };
  const list = [].concat(roles || []);
  if (!list.length) return no('Belum ada akun yang masuk.');
  const has = (r) => list.includes(r);
  const manual = isManual(settings);
  const kitchenOk = has('kitchen') || (manual && has('cashier'));
  const waiterOk = has('waiter') || (manual && has('cashier'));
  const paid = order.payment_status === 'paid';
  if (order.cancelled) return no('Pesanan sudah dibatalkan.');
  switch (action) {
    case 'confirm_cash':
      if (!has('cashier')) return no('Butuh peran Kasir.');
      if (order.payment_method !== 'cashier') return no('Pembayaran digital hanya berubah lewat notifikasi resmi payment gateway.');
      if (order.payment_status !== 'pending') return no('Pembayaran sudah dicatat.');
      return yes;
    case 'accept':
      if (!has('cashier')) return no('Butuh peran Kasir.');
      if (order.kitchen_status !== 'waiting') return no('Sudah dikirim ke dapur.');
      if (order.pay_policy === 'pay_first' && !paid) return no(order.payment_method === 'digital' ? 'Menunggu konfirmasi payment gateway.' : 'Kebijakan: bayar dulu di kasir.');
      return yes;
    case 'start':
      if (!kitchenOk) return no(manual ? 'Butuh peran Dapur atau Kasir.' : 'Butuh peran Dapur.');
      if (order.kitchen_status !== 'accepted') return no(order.kitchen_status === 'waiting' ? 'Belum diterima kasir.' : 'Sudah dimasak.');
      return yes;
    case 'ready':
      if (!kitchenOk) return no(manual ? 'Butuh peran Dapur atau Kasir.' : 'Butuh peran Dapur.');
      if (order.kitchen_status !== 'preparing') return no('Belum mulai dimasak.');
      return yes;
    case 'pickup':
      if (!waiterOk) return no(manual ? 'Butuh peran Waiter atau Kasir.' : 'Butuh peran Waiter.');
      if (order.serving_status !== 'waiting_pickup') return no(order.serving_status ? 'Sudah diambil.' : 'Makanan belum siap.');
      return yes;
    case 'deliver':
      if (!waiterOk) return no(manual ? 'Butuh peran Waiter atau Kasir.' : 'Butuh peran Waiter.');
      if (!['waiting_pickup', 'picked_up'].includes(order.serving_status)) return no(order.serving_status === 'delivered' ? 'Sudah diantar.' : 'Makanan belum siap.');
      return yes;
    case 'quick':
      if (!(kitchenOk && waiterOk)) return no('Butuh peran Dapur dan Waiter.');
      if (!['accepted', 'preparing', 'ready'].includes(order.kitchen_status) || order.serving_status === 'delivered') return no('Kirim pesanan ke dapur dulu.');
      return yes;
    case 'cancel':
      if (!(has('cashier') || has('owner'))) return no('Butuh peran Kasir atau Owner.');
      if (!['waiting', 'accepted'].includes(order.kitchen_status)) return no('Pesanan sudah dimasak, tidak bisa dibatalkan dari sini.');
      if (paid && !has('owner')) return no('Pesanan lunas hanya bisa dibatalkan Owner (refund).');
      return yes;
    default:
      return no('Aksi tidak dikenal.');
  }
}

// Teks tindakan berikutnya untuk pesanan (null jika tidak ada yang perlu dilakukan peran ini).
export function orderNeed(order, roles, settings) {
  if (order.cancelled) return '';
  if (checkOrderAction(order, roles, 'confirm_cash', settings).ok) return order.serving_status === 'delivered' ? 'Tagih pembayaran' : ORDER_ACTION_LABEL.confirm_cash;
  if (checkOrderAction(order, roles, 'accept', settings).ok) return ORDER_ACTION_LABEL.accept;
  if (isManual(settings)) for (const a of ['start', 'ready', 'deliver']) if (checkOrderAction(order, roles, a, settings).ok) return ORDER_ACTION_LABEL[a];
  return '';
}

// Fitur operasional pegawai dibatasi saat langganan tidak aktif (pemilik tetap bisa melihat data dan membayar).
function requireSubscriptionActive(db, rid) {
  const st = subscriptionState(db, rid);
  if (st === 'suspended' || (st === 'expired' && !platformSettings(db).staff_when_expired)) throw new ApiError('Langganan restoran tidak aktif. Fitur operasional dibatasi sampai pemilik memperpanjang langganan.', 'subscription');
}

export function runOrderAction(session, orderId, action, { reason, device = 'Dashboard' } = {}) {
  return transact((db) => {
    const ctx = requireStaff(db, session);
    requireSubscriptionActive(db, ctx.rid);
    const o = own(byId(db.orders, orderId), ctx.rid);
    const settings = settingsOf(db, ctx.rid);
    const check = checkOrderAction(o, ctx.roles, action, settings);
    if (!check.ok) throw new ApiError(check.reason, 'forbidden');
    const lastPayment = () => db.payments.filter((p) => p.order_id === o.id).sort(sortBy('created_at')).pop();
    const k = (to) => addHistory(db, o, 'kitchen', to, ctx.actor, device);
    const sv = (to) => (to === 'waiting_pickup' ? addHistory(db, o, 'serving', to, SYSTEM, 'Server') : addHistory(db, o, 'serving', to, ctx.actor, device));

    switch (action) {
      case 'confirm_cash': {
        const p = lastPayment();
        p.status = 'paid';
        p.paid_at = now();
        p.confirmed_by = ctx.actor.id;
        paymentEvent(db, p, 'cash_confirmed', `Uang tunai diterima, dikonfirmasi oleh ${ctx.actor.label}`, 'staff');
        o.payment_status = 'paid';
        addHistory(db, o, 'payment', 'paid', ctx.actor, device);
        audit(db, ctx.rid, ctx.actor, 'payment.cash_confirmed', `${o.order_number} ${p.payment_number}`);
        break;
      }
      case 'accept': k('accepted'); break;
      case 'start': k('preparing'); break;
      case 'ready': k('ready'); sv('waiting_pickup'); break;
      case 'pickup': sv('picked_up'); break;
      case 'deliver':
        if (o.serving_status === 'waiting_pickup') sv('picked_up');
        sv('delivered');
        break;
      case 'quick': {
        const order = ['accepted', 'preparing', 'ready'];
        ['preparing', 'ready'].forEach((st) => order.indexOf(o.kitchen_status) < order.indexOf(st) && k(st));
        if (!o.serving_status) sv('waiting_pickup');
        sv('picked_up');
        sv('delivered');
        o.history_note = 'dicatat sekaligus';
        db.order_status_history[db.order_status_history.length - 1].note = 'dicatat sekaligus';
        break;
      }
      case 'cancel': {
        if (!reason) throw new ApiError('Pilih alasan pembatalan.', 'validation');
        o.cancelled = true;
        o.cancel_reason = reason;
        addHistory(db, o, 'order', 'cancelled', ctx.actor, device, reason);
        const p = lastPayment();
        if (p.status === 'paid') {
          p.status = 'refunded';
          paymentEvent(db, p, 'refund_recorded', `Refund dicatat oleh ${ctx.actor.label}. Pengembalian dana mengikuti prosedur payment gateway atau tunai.`, 'staff');
          o.payment_status = 'refunded';
        } else if (p.status === 'pending') {
          p.status = 'failed';
          paymentEvent(db, p, 'closed', 'Ditutup karena pesanan dibatalkan sebelum dibayar', 'system');
          o.payment_status = 'failed';
        }
        audit(db, ctx.rid, ctx.actor, 'order.cancelled', `${o.order_number}: ${reason}`);
        break;
      }
      default:
        throw new ApiError('Aksi tidak dikenal.', 'validation');
    }
    delete o.history_note;
    return o;
  });
}

// Tandai transaksi sudah dicatat di mesin POS atau buku kas lama (MenuKlik tidak menggantikan POS di MVP).
export function togglePosRecorded(session, orderId) {
  return transact((db) => {
    const ctx = requireStaff(db, session, 'payments.view');
    const o = own(byId(db.orders, orderId), ctx.rid);
    o.pos_recorded = !o.pos_recorded;
    audit(db, ctx.rid, ctx.actor, 'order.pos_recorded', `${o.order_number}: ${o.pos_recorded}`);
    return o;
  });
}

export function selectOrders(db, rid, { from = startOfDay(now()), to = now() + DAY } = {}) {
  return db.orders
    .filter((o) => o.restaurant_id === rid && o.created_at >= from && o.created_at < to)
    .sort(sortBy('created_at', -1))
    .map((o) => orderBundle(db, o));
}

const historyAt = (b, kind, to) => [...b.history].reverse().find((h) => h.kind === kind && h.to_status === to)?.created_at;

export function selectKitchenQueue(db, rid) {
  return db.orders
    .filter((o) => o.restaurant_id === rid && !o.cancelled && (['accepted', 'preparing'].includes(o.kitchen_status) || (o.kitchen_status === 'ready' && ['waiting_pickup', 'picked_up'].includes(o.serving_status))))
    .sort(sortBy('created_at'))
    .map((o) => {
      const b = orderBundle(db, o);
      // Dapur hanya menerima data yang dibutuhkan: tanpa harga, nama pelanggan, atau status bayar.
      return {
        id: b.id, order_number: b.order_number, table: b.table?.name, kitchen_status: b.kitchen_status, serving_status: b.serving_status, note: b.note,
        accepted_at: historyAt(b, 'kitchen', 'accepted') || b.created_at, ready_at: historyAt(b, 'kitchen', 'ready') || null,
        items: b.items.map((i) => ({ id: i.id, name: i.product_name, qty: i.qty, options: i.options_text, note: i.note })),
      };
    });
}

// Antrean waiter: nomor meja, isi pesanan, dan status. Tanpa harga.
export function selectServingQueue(db, rid) {
  return db.orders
    .filter((o) => o.restaurant_id === rid && !o.cancelled && o.serving_status !== 'delivered')
    .sort(sortBy('created_at'))
    .map((o) => {
      const b = orderBundle(db, o);
      return {
        id: b.id, order_number: b.order_number, table: b.table?.name, kitchen_status: b.kitchen_status, serving_status: b.serving_status, payment_status: b.payment_status,
        ready_at: historyAt(b, 'kitchen', 'ready') || null,
        items: b.items.map((i) => ({ id: i.id, name: i.product_name, qty: i.qty, options: i.options_text })),
      };
    });
}

/* =====================================================================
   MENU & KATEGORI (Owner)
   ===================================================================== */
export function saveProduct(session, input) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'menu.manage');
    const name = (input.name || '').trim();
    const price = Math.round(Number(input.price));
    if (!name) throw new ApiError('Nama menu wajib diisi.', 'validation');
    if (!Number.isFinite(price) || price < 0) throw new ApiError('Harga tidak valid.', 'validation');
    const cat = own(byId(db.categories, input.category_id), rid);
    const options = (input.options || [])
      .map((o) => ({ ...o, name: (o.name || '').trim(), group_name: o.kind === 'addon' ? 'Tambahan' : (o.group_name || '').trim(), price_delta: Math.round(Number(o.price_delta) || 0) }))
      .filter((o) => o.name);
    if (options.some((o) => o.kind === 'variant' && !o.group_name)) throw new ApiError('Setiap variasi perlu nama grup, misalnya "Ukuran".', 'validation');

    let p;
    if (input.id) {
      p = own(byId(db.products, input.id), rid);
      if (p.price !== price) audit(db, rid, actor, 'product.price_changed', `${name}: ${p.price} -> ${price}`);
      Object.assign(p, {
        name, price, category_id: cat.id, description: (input.description || '').trim(), image_url: input.image_url ?? p.image_url,
        is_available: !!input.is_available, is_active: !!input.is_active, updated_at: now(),
      });
    } else {
      p = {
        id: uid('prd_'), restaurant_id: rid, category_id: cat.id, name, description: (input.description || '').trim(), price,
        image_url: input.image_url || null, is_available: input.is_available !== false, is_active: input.is_active !== false,
        sort_order: db.products.filter((x) => x.restaurant_id === rid).length + 1, created_at: now(), updated_at: now(),
      };
      db.products.push(p);
      audit(db, rid, actor, 'product.created', name);
    }
    // Sinkron variasi: yang dihapus dinonaktifkan (bukan dibuang) agar riwayat tetap utuh.
    const existing = db.product_variants.filter((v) => v.product_id === p.id);
    const keep = new Set(options.filter((o) => o.id).map((o) => o.id));
    existing.forEach((v) => !keep.has(v.id) && (v.is_active = false));
    options.forEach((o, i) => {
      const v = o.id && existing.find((x) => x.id === o.id);
      if (v) Object.assign(v, { kind: o.kind, group_name: o.group_name, name: o.name, price_delta: o.price_delta, sort_order: i, is_active: true });
      else db.product_variants.push({ id: uid('opt_'), product_id: p.id, restaurant_id: rid, kind: o.kind, group_name: o.group_name, name: o.name, price_delta: o.price_delta, sort_order: i, is_active: true });
    });
    return p;
  });
}

export function setProductFlag(session, productId, field, value) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'menu.manage');
    if (!['is_available', 'is_active'].includes(field)) throw new ApiError('Kolom tidak dikenal.');
    const p = own(byId(db.products, productId), rid);
    p[field] = !!value;
    p.updated_at = now();
    return p;
  });
}

// Menu yang pernah dipesan tidak dihapus permanen, cukup diarsipkan.
export function deleteProduct(session, productId) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'menu.manage');
    const p = own(byId(db.products, productId), rid);
    const used = db.order_items.some((i) => i.product_id === p.id);
    if (used) {
      p.is_active = false;
      p.is_archived = true;
      audit(db, rid, actor, 'product.archived', p.name);
      return { archived: true };
    }
    db.products = db.products.filter((x) => x.id !== p.id);
    db.product_variants = db.product_variants.filter((v) => v.product_id !== p.id);
    audit(db, rid, actor, 'product.deleted', p.name);
    return { deleted: true };
  });
}

export function saveCategory(session, { id, name, is_active = true }) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'menu.manage');
    const n = (name || '').trim();
    if (!n) throw new ApiError('Nama kategori wajib diisi.', 'validation');
    if (db.categories.some((c) => c.restaurant_id === rid && c.id !== id && c.name.toLowerCase() === n.toLowerCase())) throw new ApiError('Nama kategori sudah dipakai.', 'validation');
    if (id) return Object.assign(own(byId(db.categories, id), rid), { name: n, is_active: !!is_active });
    const c = { id: uid('cat_'), restaurant_id: rid, name: n, sort_order: db.categories.filter((x) => x.restaurant_id === rid).length + 1, is_active: true, created_at: now() };
    db.categories.push(c);
    return c;
  });
}

export function moveCategory(session, id, dir) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'menu.manage');
    const list = db.categories.filter((c) => c.restaurant_id === rid).sort(sortBy('sort_order'));
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return null;
    [list[i].sort_order, list[j].sort_order] = [list[j].sort_order, list[i].sort_order];
    return true;
  });
}

export function deleteCategory(session, id) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'menu.manage');
    const c = own(byId(db.categories, id), rid);
    if (db.products.some((p) => p.category_id === c.id && !p.is_archived)) throw new ApiError('Pindahkan atau hapus dulu menu di kategori ini.', 'validation');
    db.categories = db.categories.filter((x) => x.id !== c.id);
    return true;
  });
}

/* =====================================================================
   MEJA & QR (Owner kelola, Kasir lihat)
   ===================================================================== */
export function selectTables(db, rid) {
  return db.tables
    .filter((t) => t.restaurant_id === rid && !t.is_archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))
    .map((t) => ({
      ...t,
      qr: currentQr(db, t.id),
      activeOrders: db.orders.filter((o) => o.table_id === t.id && isActiveOrder(o)).length,
    }));
}

export function addTable(session, name) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'tables.manage');
    const n = (name || '').trim();
    if (!n) throw new ApiError('Nama meja wajib diisi.', 'validation');
    const tables = db.tables.filter((t) => t.restaurant_id === rid && !t.is_archived);
    if (tables.some((t) => t.name.toLowerCase() === n.toLowerCase())) throw new ApiError('Nama meja sudah dipakai.', 'validation');
    const plan = planOf(db, rid);
    if (plan?.max_tables && tables.length >= plan.max_tables) throw new ApiError(`Paket ${plan.name} dibatasi ${plan.max_tables} meja. Pilih paket lain untuk menambah meja.`, 'limit');
    const t = { id: uid('tbl_'), restaurant_id: rid, name: n, is_active: true, is_archived: false, created_at: now() };
    db.tables.push(t);
    db.qr_codes.push({ id: uid('qr_'), restaurant_id: rid, table_id: t.id, token: randomToken(16), is_active: true, created_at: now(), revoked_at: null });
    audit(db, rid, actor, 'table.created', n);
    return t;
  });
}

export function updateTable(session, tableId, patch) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'tables.manage');
    const t = own(byId(db.tables, tableId), rid);
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) throw new ApiError('Nama meja wajib diisi.', 'validation');
      if (db.tables.some((x) => x.restaurant_id === rid && x.id !== t.id && !x.is_archived && x.name.toLowerCase() === n.toLowerCase())) throw new ApiError('Nama meja sudah dipakai.', 'validation');
      t.name = n;
    }
    if (patch.is_active !== undefined) t.is_active = !!patch.is_active;
    return t;
  });
}

export function regenerateQr(session, tableId) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'tables.manage');
    const t = own(byId(db.tables, tableId), rid);
    db.qr_codes.filter((q) => q.table_id === t.id && q.is_active).forEach((q) => {
      q.is_active = false;
      q.revoked_at = now();
    });
    const qr = { id: uid('qr_'), restaurant_id: rid, table_id: t.id, token: randomToken(16), is_active: true, created_at: now(), revoked_at: null };
    db.qr_codes.push(qr);
    audit(db, rid, actor, 'qr.regenerated', `Meja ${t.name}`);
    return qr;
  });
}

export function deleteTable(session, tableId) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'tables.manage');
    const t = own(byId(db.tables, tableId), rid);
    if (db.orders.some((o) => o.table_id === t.id && isActiveOrder(o))) throw new ApiError('Meja ini masih punya pesanan aktif.', 'validation');
    t.is_archived = true;
    t.is_active = false;
    db.qr_codes.filter((q) => q.table_id === t.id).forEach((q) => {
      q.is_active = false;
      q.revoked_at = q.revoked_at || now();
    });
    audit(db, rid, actor, 'table.archived', t.name);
    return true;
  });
}

/* =====================================================================
   PENGATURAN, PEGAWAI, AKSES DATA (Owner)
   ===================================================================== */
export function updateRestaurantProfile(session, patch) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const r = byId(db.restaurants, rid);
    if (patch.name !== undefined && !patch.name.trim()) throw new ApiError('Nama restoran wajib diisi.', 'validation');
    ['name', 'address', 'phone', 'logo_text', 'logo_url', 'cover_url'].forEach((k) => patch[k] !== undefined && (r[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k]));
    audit(db, rid, actor, 'restaurant.profile_updated', r.name);
    return r;
  });
}

export function updateSettings(session, patch) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const s = settingsOf(db, rid);
    const pct = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 30) throw new ApiError('Persentase harus antara 0 dan 30.', 'validation');
      return Math.round(n * 10) / 10;
    };
    if (patch.tax_percent !== undefined) s.tax_percent = pct(patch.tax_percent);
    if (patch.service_percent !== undefined) s.service_percent = pct(patch.service_percent);
    if (patch.pay_policy !== undefined) s.pay_policy = patch.pay_policy === 'pay_later' ? 'pay_later' : 'pay_first';
    if (patch.channels) s.channels = { qris: !!patch.channels.qris, ewallet: !!patch.channels.ewallet, va: !!patch.channels.va };
    if (patch.open_time) s.open_time = patch.open_time;
    if (patch.close_time) s.close_time = patch.close_time;
    if (patch.config !== undefined) {
      if (!['basic', 'standard', 'advanced'].includes(patch.config)) throw new ApiError('Konfigurasi tidak dikenal.', 'validation');
      const plan = planOf(db, rid);
      if (plan && !plan.configs.includes(patch.config)) throw new ApiError(`Konfigurasi ${patch.config} butuh paket yang lebih tinggi. Ganti paket di menu Langganan.`, 'limit');
      s.config = patch.config;
    }
    if (patch.shared_tablet !== undefined) s.shared_tablet = !!patch.shared_tablet;
    if (patch.notify_new_order !== undefined) s.notify_new_order = !!patch.notify_new_order;
    if (patch.notify_sound !== undefined) s.notify_sound = !!patch.notify_sound;
    audit(db, rid, actor, 'settings.updated', JSON.stringify(patch).slice(0, 200));
    return s;
  });
}

export function selectMembers(db, rid) {
  return db.restaurant_members
    .filter((m) => m.restaurant_id === rid)
    .map((m) => ({ ...m, user: byId(db.users, m.user_id) }))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.roles.join().localeCompare(b.roles.join()));
}

export function inviteMember(session, { name, email, roles }) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'staff.manage');
    const n = (name || '').trim();
    const e = (email || '').trim().toLowerCase();
    if (!n || !/^\S+@\S+\.\S+$/.test(e)) throw new ApiError('Isi nama dan email yang valid.', 'validation');
    if (!roles?.length || roles.some((r) => !ROLES[r])) throw new ApiError('Pilih minimal satu peran.', 'validation');
    const plan = planOf(db, rid);
    const staffCount = db.restaurant_members.filter((m) => m.restaurant_id === rid && m.is_active).length;
    if (plan?.max_staff && staffCount >= plan.max_staff) throw new ApiError(`Paket ${plan.name} dibatasi ${plan.max_staff} akun pegawai. Ganti paket untuk menambah pegawai.`, 'limit');
    let u = db.users.find((x) => x.email === e);
    if (u && db.restaurant_members.some((m) => m.user_id === u.id && m.restaurant_id === rid)) throw new ApiError('Email ini sudah terdaftar sebagai pegawai.', 'validation');
    if (!u) {
      u = { id: uid('user_'), name: n, email: e, password: DEMO_PASSWORD, platform_role: null, is_active: true, created_at: now() };
      db.users.push(u);
    }
    const m = { id: uid('mem_'), restaurant_id: rid, user_id: u.id, roles, is_active: true, created_at: now() };
    db.restaurant_members.push(m);
    audit(db, rid, actor, 'member.invited', `${e} sebagai ${roleLabels(roles)}`);
    return m;
  });
}

export function updateMember(session, memberId, patch) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'staff.manage');
    const m = own(byId(db.restaurant_members, memberId), rid);
    if (m.user_id === session.userId) throw new ApiError('Kamu tidak bisa mengubah peran atau menonaktifkan akunmu sendiri.', 'validation');
    const next = { roles: patch.roles ?? m.roles, is_active: patch.is_active ?? m.is_active };
    if (!next.roles.length) throw new ApiError('Pegawai harus punya minimal satu peran.', 'validation');
    const ownersLeft = db.restaurant_members.filter((x) => x.restaurant_id === rid && x.id !== m.id && x.roles.includes('owner') && x.is_active).length;
    if (m.roles.includes('owner') && (!next.roles.includes('owner') || !next.is_active) && ownersLeft === 0) throw new ApiError('Restoran harus punya minimal satu owner aktif.', 'validation');
    Object.assign(m, next);
    audit(db, rid, actor, 'member.updated', `${m.id}: ${roleLabels(next.roles)}, aktif=${next.is_active}`);
    return m;
  });
}

export const activeAccessGrant = (db, rid) =>
  db.access_requests.find((a) => a.restaurant_id === rid && a.status === 'approved' && a.expires_at > now()) || null;

export function respondAccessRequest(session, requestId, approve) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const a = own(byId(db.access_requests, requestId), rid);
    if (a.status !== 'pending') throw new ApiError('Permintaan ini sudah dijawab.', 'invalid_state');
    a.status = approve ? 'approved' : 'declined';
    a.decided_at = now();
    a.decided_by = actor.label;
    a.expires_at = approve ? now() + DAY : null;
    audit(db, rid, actor, approve ? 'access.approved' : 'access.declined', a.reason);
    return a;
  });
}

// Laporan kendala: konteks teknis ikut terlampir otomatis (konfigurasi, perangkat, aktivitas terakhir).
// Data pelanggan dan isi transaksi tidak pernah ikut.
export function createSupportTicket(session, { category = 'other', device = '', subject, message, critical = false, code = '' }) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    if (!subject?.trim() || !message?.trim()) throw new ApiError('Isi judul dan penjelasan singkat.', 'validation');
    const st = settingsOf(db, rid);
    const priority = critical ? 'kritis' : ['order', 'payment'].includes(category) ? 'tinggi' : 'normal';
    const last = selectActivity(db, rid, 3).filter((a) => a.kind === 'status').map((a) => `Aktivitas terakhir: ${a.order} ${a.status} (${a.device || '-'})`);
    const n = db.support_tickets.length + 1;
    const t = {
      id: uid('tkt_'), ticket_number: 'TKT-' + String(n).padStart(4, '0'), restaurant_id: rid, category, priority, subject: subject.trim(), message: message.trim(), device,
      config: st.config + (st.config === 'standard' ? (st.shared_tablet ? ', tablet bersama' : ', manual') : ''), code, context: [`Dilaporkan ${new Date(now()).toTimeString().slice(0, 5)}`, ...last],
      status: 'open', created_at: now(), replies: [], first_reply_at: null, resolved_at: null, rating: null, rating_note: '', owner_unread: 0, admin_unread: true,
    };
    db.support_tickets.push(t);
    audit(db, rid, actor, 'support.created', `${t.ticket_number} ${priority}: ${t.subject}`);
    return t;
  });
}

function ownTicket(db, session, id) {
  const { rid, actor } = requireStaff(db, session, 'settings.manage');
  return { t: own(byId(db.support_tickets, id), rid), rid, actor };
}

export function replyTicketAsOwner(session, id, text) {
  return transact((db) => {
    const { t, actor } = ownTicket(db, session, id);
    if (!text?.trim()) throw new ApiError('Tulis pesan.', 'validation');
    t.replies.push({ from: 'owner', who: actor.label, text: text.trim(), at: now() });
    t.admin_unread = true;
    return t;
  });
}
export function markTicketRead(session, id) {
  return transact((db) => { const { t } = ownTicket(db, session, id); t.owner_unread = 0; return t; });
}
export function reopenTicket(session, id) {
  return transact((db) => {
    const { t, actor } = ownTicket(db, session, id);
    Object.assign(t, { status: 'open', admin_unread: true, rating: null, resolved_at: null });
    t.replies.push({ from: 'owner', who: actor.label, text: 'Masalah masih terjadi.', at: now() });
    return t;
  });
}
export function rateTicket(session, id, { rating, note }) {
  return transact((db) => {
    const { t } = ownTicket(db, session, id);
    if (t.status !== 'resolved') throw new ApiError('Ulasan hanya untuk laporan yang selesai.', 'invalid_state');
    if (!(rating >= 1 && rating <= 5)) throw new ApiError('Pilih nilai 1 sampai 5.', 'validation');
    t.rating = rating;
    t.rating_note = (note || '').trim();
    return t;
  });
}

// Pengumuman gangguan untuk semua restoran, agar pemilik tidak melapor berulang.
export const selectNotice = (db) => db.platform_notice || null;
export function setNotice(session, text) {
  return transact((db) => {
    requireAdmin(db, session);
    if (!text?.trim()) throw new ApiError('Isi pengumuman.', 'validation');
    db.platform_notice = { text: text.trim(), at: now() };
    return db.platform_notice;
  });
}
export function clearNotice(session) {
  return transact((db) => { requireAdmin(db, session); db.platform_notice = null; return null; });
}

/* =====================================================================
   LAPORAN
   ===================================================================== */
export function getReport(db, rid, from, to) {
  const orders = db.orders.filter((o) => o.restaurant_id === rid && o.created_at >= from && o.created_at < to).sort(sortBy('created_at', -1));
  const paid = orders.filter((o) => o.payment_status === 'paid');
  const valid = new Set(orders.filter((o) => !o.cancelled).map((o) => o.id));
  const sales = paid.reduce((a, o) => a + o.total, 0);

  const series = [];
  for (let d = startOfDay(from); d < to; d += DAY) {
    const dayOrders = orders.filter((o) => o.created_at >= d && o.created_at < d + DAY);
    series.push({ date: d, orders: dayOrders.length, sales: dayOrders.filter((o) => o.payment_status === 'paid').reduce((a, o) => a + o.total, 0) });
  }

  const itemMap = new Map();
  db.order_items.forEach((i) => {
    if (!valid.has(i.order_id)) return;
    const x = itemMap.get(i.product_name) || { name: i.product_name, qty: 0, revenue: 0 };
    x.qty += i.qty;
    x.revenue += i.line_total;
    itemMap.set(i.product_name, x);
  });

  const methods = { digital: { count: 0, amount: 0 }, cashier: { count: 0, amount: 0 } };
  paid.forEach((o) => {
    methods[o.payment_method].count += 1;
    methods[o.payment_method].amount += o.total;
  });

  return {
    orders,
    orderCount: orders.length,
    completed: orders.filter((o) => o.serving_status === 'delivered' && o.payment_status === 'paid').length,
    sales,
    avg: paid.length ? sales / paid.length : 0,
    paidCount: paid.length,
    series,
    topItems: [...itemMap.values()].sort((a, b) => b.qty - a.qty),
    methods,
    cancelled: orders.filter((o) => o.cancelled),
  };
}

export function selectActivity(db, rid, limit = 10) {
  const orderNo = (id) => byId(db.orders, id)?.order_number;
  const feed = [
    ...db.order_status_history.filter((h) => h.restaurant_id === rid).map((h) => ({ at: h.created_at, kind: 'status', hkind: h.kind, order: orderNo(h.order_id), status: h.to_status, by: h.changed_by_label, device: h.device })),
    ...db.payments.filter((p) => p.restaurant_id === rid && p.paid_at).map((p) => ({ at: p.paid_at, kind: 'paid', order: orderNo(p.order_id), amount: p.amount, channel: p.channel })),
  ];
  return feed.sort((a, b) => b.at - a.at).slice(0, limit);
}

export function selectPayments(db, rid, { from, to }) {
  return db.payments
    .filter((p) => p.restaurant_id === rid && p.created_at >= from && p.created_at < to)
    .sort(sortBy('created_at', -1))
    .map((p) => ({ ...p, order: byId(db.orders, p.order_id), events: db.payment_events.filter((e) => e.payment_id === p.id).sort(sortBy('created_at')) }));
}

/* =====================================================================
   SUPER ADMIN
   ===================================================================== */
export function adminRestaurantRows(db) {
  return db.restaurants.map((r) => {
    const sub = currentSubscription(db, r.id);
    const owner = db.restaurant_members.find((m) => m.restaurant_id === r.id && m.roles.includes('owner') && m.is_active);
    return {
      ...r,
      subscription: sub,
      plan: sub ? byId(db.plans, sub.plan_id) : null,
      subState: subscriptionState(db, r.id),
      daysLeft: sub ? Math.ceil((sub.ends_at - now()) / DAY) : null,
      tableCount: db.tables.filter((t) => t.restaurant_id === r.id && !t.is_archived).length,
      memberCount: db.restaurant_members.filter((m) => m.restaurant_id === r.id && m.is_active).length,
      // Hanya angka agregat, bukan isi transaksi.
      orders7d: db.orders.filter((o) => o.restaurant_id === r.id && o.created_at >= now() - 7 * DAY).length,
      owner: owner ? byId(db.users, owner.user_id) : null,
      grant: activeAccessGrant(db, r.id),
      pendingRequest: db.access_requests.find((a) => a.restaurant_id === r.id && a.status === 'pending') || null,
    };
  });
}

export function platformOverview(db) {
  const rows = adminRestaurantRows(db);
  const count = (s) => rows.filter((r) => r.subState === s).length;
  const recent = db.orders.filter((o) => o.created_at >= now() - 7 * DAY);
  return {
    rows,
    registered: rows.length,
    trial: count('trial'),
    subscribed: count('active'),
    expired: count('expired'),
    suspended: count('suspended'),
    active: count('trial') + count('active'),
    mrr: rows.filter((r) => r.subState === 'active').reduce((a, r) => a + (r.plan?.price_monthly || 0), 0),
    orders7d: recent.length,
    digitalShare: recent.length ? recent.filter((o) => o.payment_method === 'digital').length / recent.length : 0,
    openTickets: db.support_tickets.filter((t) => t.status !== 'resolved').length,
  };
}

export function adminGrantedOrders(db, session, rid) {
  requireAdmin(db, session);
  if (!activeAccessGrant(db, rid)) throw new ApiError('Belum ada izin akses dari pemilik restoran.', 'forbidden');
  return db.orders
    .filter((o) => o.restaurant_id === rid)
    .sort(sortBy('created_at', -1))
    .slice(0, 20)
    .map((o) => ({ id: o.id, order_number: o.order_number, created_at: o.created_at, total: o.total, kitchen_status: o.kitchen_status, serving_status: o.serving_status, cancelled: o.cancelled, payment_status: o.payment_status }));
}

export function setRestaurantStatus(session, rid, status) {
  return transact((db) => {
    const actor = requireAdmin(db, session);
    const r = byId(db.restaurants, rid);
    if (!r) throw new ApiError('Restoran tidak ditemukan.', 'not_found');
    r.status = status === 'suspended' ? 'suspended' : 'active';
    audit(db, rid, actor, 'admin.restaurant_status', r.status);
    return r;
  });
}

export function extendSubscription(session, rid, days) {
  return transact((db) => {
    const actor = requireAdmin(db, session);
    const s = currentSubscription(db, rid);
    if (!s) throw new ApiError('Restoran belum punya langganan.', 'not_found');
    s.ends_at = Math.max(s.ends_at, now()) + days * DAY;
    audit(db, rid, actor, 'admin.subscription_extended', `${days} hari`);
    return s;
  });
}

export function assignPlan(session, rid, planId) {
  return transact((db) => {
    const actor = requireAdmin(db, session);
    const plan = byId(db.plans, planId);
    if (!plan) throw new ApiError('Pilih paket.', 'validation');
    const cur = currentSubscription(db, rid);
    if (cur && cur.ends_at > now()) cur.ends_at = now();
    const s = { id: uid('sub_'), restaurant_id: rid, plan_id: plan.id, status: 'active', period: 'monthly', auto_renew: true, cancel_at_end: false, pending_plan_id: null, renew_failed: false, started_at: now(), ends_at: now() + plan.duration_days * DAY };
    db.subscriptions.push(s);
    const n = db.subscription_invoices.length + 300;
    db.subscription_invoices.push({ id: uid('inv_'), invoice_number: `SUB-0${n}`, restaurant_id: rid, plan_id: plan.id, amount: plan.price_monthly, status: 'paid', period_start: s.started_at, period_end: s.ends_at, paid_at: now(), note: 'Dicatat manual oleh Super Admin (simulasi).', created_at: now() });
    // Paket menentukan konfigurasi perangkat dan kuota meja. Data tidak dihapus: meja berlebih hanya dinonaktifkan.
    const st = settingsOf(db, rid);
    if (!plan.configs.includes(st.config)) st.config = plan.configs[plan.configs.length - 1];
    if (plan.max_tables) db.tables.filter((t) => t.restaurant_id === rid && t.is_active && !t.is_archived).slice(plan.max_tables).forEach((t) => (t.is_active = false));
    audit(db, rid, actor, 'admin.plan_assigned', plan.name);
    return s;
  });
}

function applyPlanPatch(db, p, patch) {
  const fail = (m) => { throw new ApiError(`${p.name}: ${m}`, 'validation'); };
  const money = (v, label) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < 0) fail(`${label} tidak valid.`); return n; };
  const quota = (v, label) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < 1) fail(`${label} tidak valid.`); return n; };
  const next = {
    name: (patch.name ?? p.name).trim() || p.name,
    description: (patch.description ?? p.description).trim(),
    price_monthly: money(patch.price_monthly ?? p.price_monthly, 'Harga bulanan'),
    price_yearly: money(patch.price_yearly ?? p.price_yearly, 'Harga tahunan'),
    max_tables: 'max_tables' in patch ? quota(patch.max_tables, 'Kuota meja') : p.max_tables,
    max_staff: 'max_staff' in patch ? quota(patch.max_staff, 'Kuota pegawai') : p.max_staff,
    features: patch.features ?? p.features,
    configs: patch.configs ?? p.configs,
  };
  if (!next.configs.includes('basic')) fail('Konfigurasi Basic selalu diizinkan.');
  Object.assign(p, next);
}

export function updatePlan(session, planId, patch) {
  return transact((db) => {
    requireAdmin(db, session);
    const p = byId(db.plans, planId);
    if (!p) throw new ApiError('Paket tidak ditemukan.', 'not_found');
    applyPlanPatch(db, p, patch);
    return p;
  });
}

// Simpan semua paket dan aturan platform sekaligus (atomik: gagal satu, gagal semua).
// Harga baru berlaku untuk tagihan berikutnya. Konfigurasi dan kuota restoran yang sedang berlangganan disesuaikan tanpa menghapus data.
export function savePlatformConfig(session, { plans, settings }) {
  return transact((db) => {
    requireAdmin(db, session);
    Object.entries(plans).forEach(([id, patch]) => applyPlanPatch(db, byId(db.plans, id), patch));
    const t = Math.round(Number(settings.trial_days));
    const g = Math.round(Number(settings.grace_days));
    if (!(t >= 1 && t <= 90)) throw new ApiError('Durasi uji coba antara 1 dan 90 hari.', 'validation');
    if (!(g >= 0 && g <= 30)) throw new ApiError('Masa tenggang antara 0 dan 30 hari.', 'validation');
    db.platform_settings = { trial_enabled: !!settings.trial_enabled, trial_days: t, grace_days: g, qr_when_expired: !!settings.qr_when_expired, staff_when_expired: !!settings.staff_when_expired };
    db.restaurants.forEach((r) => currentSubscription(db, r.id) && enforcePlan(db, r.id));
    return db.platform_settings;
  });
}

export function requestDataAccess(session, rid, reason) {
  return transact((db) => {
    const actor = requireAdmin(db, session);
    if (!reason || reason.trim().length < 10) throw new ApiError('Tulis alasan operasional minimal 10 karakter.', 'validation');
    if (db.access_requests.some((a) => a.restaurant_id === rid && a.status === 'pending')) throw new ApiError('Masih ada permintaan yang menunggu jawaban.', 'validation');
    const a = { id: uid('acc_'), restaurant_id: rid, requested_by: actor.label, reason: reason.trim(), status: 'pending', created_at: now(), decided_at: null, decided_by: null, expires_at: null };
    db.access_requests.push(a);
    audit(db, rid, actor, 'access.requested', a.reason);
    return a;
  });
}

export function updateTicket(session, ticketId, { status, reply }) {
  return transact((db) => {
    requireAdmin(db, session);
    const t = byId(db.support_tickets, ticketId);
    if (!t) throw new ApiError('Tiket tidak ditemukan.', 'not_found');
    if (reply && reply.trim()) {
      t.replies.push({ from: 'admin', who: 'Tim MenuKlik', text: reply.trim(), at: now() });
      if (!t.first_reply_at) t.first_reply_at = now();
      if (t.status === 'open' && !status) t.status = 'in_progress';
      t.owner_unread += 1;
    }
    if (status && status !== t.status) {
      t.status = status;
      if (status === 'resolved') t.resolved_at = now();
      t.replies.push({ from: 'sys', text: `Status diubah menjadi ${{ open: 'Baru', in_progress: 'Diproses', resolved: 'Selesai' }[status]}`, at: now() });
      t.owner_unread += 1;
    }
    t.admin_unread = false;
    return t;
  });
}
export function markTicketReadByAdmin(session, id) {
  return transact((db) => { requireAdmin(db, session); const t = byId(db.support_tickets, id); if (t) t.admin_unread = false; return t; });
}

/* =====================================================================
   LANGGANAN MANDIRI PEMILIK (pembayaran langganan terpisah dari pembayaran makanan)
   ===================================================================== */
export const planPrice = (plan, period) => (period === 'yearly' ? plan.price_yearly : plan.price_monthly);

// Paket menentukan konfigurasi perangkat dan kuota meja. Data tidak pernah dihapus.
function enforcePlan(db, rid) {
  const sub = currentSubscription(db, rid);
  const plan = sub && byId(db.plans, sub.plan_id);
  const notes = [];
  if (!plan) return notes;
  const st = settingsOf(db, rid);
  if (!plan.configs.includes(st.config)) {
    st.config = plan.configs[plan.configs.length - 1];
    notes.push(`Konfigurasi perangkat diubah ke ${st.config}`);
  }
  if (plan.max_tables) {
    const act = db.tables.filter((t) => t.restaurant_id === rid && t.is_active && !t.is_archived);
    if (act.length > plan.max_tables) {
      act.slice(plan.max_tables).forEach((t) => (t.is_active = false));
      notes.push(`${act.length - plan.max_tables} meja dinonaktifkan sesuai kuota (data tetap ada)`);
    }
  }
  return notes;
}

function addInvoice(db, { rid, planId, period, kind, amount, method = 'qris', note = '' }) {
  const n = db.subscription_invoices.length + 300;
  const inv = {
    id: uid('inv_'), invoice_number: `SUB-0${n}`, restaurant_id: rid, plan_id: planId, period, kind, method,
    amount, status: 'unpaid', period_start: now(), period_end: null, paid_at: null, note, created_at: now(),
    events: [{ t: 'Tagihan dibuat, menunggu pembayaran', at: now() }],
  };
  db.subscription_invoices.push(inv);
  return inv;
}

function applyInvoice(db, inv) {
  const rid = inv.restaurant_id;
  const sub = currentSubscription(db, rid);
  const pd = periodDays(inv.period) * DAY;
  const n = now();
  const fresh = () => {
    const x = { id: uid('sub_'), restaurant_id: rid, plan_id: inv.plan_id, status: 'active', period: inv.period, started_at: n, ends_at: n + pd, auto_renew: true, cancel_at_end: false, pending_plan_id: null, renew_failed: false };
    db.subscriptions.push(x);
    return x;
  };
  if (inv.kind === 'new') {
    if (sub && sub.status === 'pending') Object.assign(sub, { status: 'active', plan_id: inv.plan_id, period: inv.period, started_at: n, ends_at: n + pd, auto_renew: true });
    else if (sub && sub.status === 'trial' && n < sub.ends_at) Object.assign(sub, { status: 'active', plan_id: inv.plan_id, period: inv.period, ends_at: sub.ends_at + pd, auto_renew: true });
    else fresh();
  } else if (inv.kind === 'extend' || inv.kind === 'renewal') {
    sub.ends_at = Math.max(sub.ends_at, n) + pd;
    Object.assign(sub, { status: 'active', renew_failed: false, cancel_at_end: false });
    if (sub.pending_plan_id) { sub.plan_id = sub.pending_plan_id; sub.pending_plan_id = null; }
  } else if (inv.kind === 'resub') fresh();
  else if (inv.kind === 'upgrade') Object.assign(sub, { plan_id: inv.plan_id, pending_plan_id: null });
  inv.period_end = currentSubscription(db, rid).ends_at;
  return enforcePlan(db, rid);
}

// Simulasi notifikasi (webhook) payment gateway untuk tagihan langganan.
export function simulateSubscriptionGateway(invoiceId, result) {
  return transact((db) => {
    const inv = byId(db.subscription_invoices, invoiceId);
    if (!inv) throw new ApiError('Tagihan tidak ditemukan.', 'not_found');
    if (inv.status !== 'unpaid') return { notes: [], inv, final: true };
    inv.status = result;
    const label = { paid: 'berhasil', failed: 'gagal', expired: 'kedaluwarsa' }[result];
    inv.events.push({ t: `Webhook gateway: ${label} (tanda tangan diverifikasi, simulasi)`, at: now() });
    let notes = [];
    if (result === 'paid') {
      inv.paid_at = now();
      notes = applyInvoice(db, inv);
    } else if (inv.kind === 'renewal') currentSubscription(db, inv.restaurant_id).renew_failed = true;
    return { notes, inv };
  });
}

// Rincian biaya jika pindah paket.
export function planChangeQuote(db, rid, targetPlanId) {
  const s = currentSubscription(db, rid);
  const cur = byId(db.plans, s.plan_id);
  const tp = byId(db.plans, targetPlanId);
  const phase = subscriptionPhase(db, rid);
  const up = tp.price_monthly > cur.price_monthly;
  const gained = tp.features.filter((f) => !cur.features.includes(f));
  const lost = cur.features.filter((f) => !tp.features.includes(f));
  const st = settingsOf(db, rid);
  const activeTables = db.tables.filter((t) => t.restaurant_id === rid && t.is_active && !t.is_archived).length;
  const staff = db.restaurant_members.filter((m) => m.restaurant_id === rid && m.is_active).length;
  const warn = [];
  if (!tp.configs.includes(st.config)) warn.push(`Konfigurasi ${st.config} tidak tersedia di paket ${tp.name}; akan diganti.`);
  if (tp.max_tables && activeTables > tp.max_tables) warn.push(`Kamu punya ${activeTables} meja aktif, kuota ${tp.name} ${tp.max_tables} meja. Meja berlebih dinonaktifkan (data tidak dihapus).`);
  if (tp.max_staff && staff > tp.max_staff) warn.push(`Jumlah pegawai (${staff}) melebihi kuota ${tp.max_staff}. Pegawai lama tetap ada, tetapi tidak bisa menambah pegawai baru.`);
  const base = { cur, tp, up, gained, lost, warn };
  if (['trial', 'trial_ending'].includes(phase)) return { ...base, mode: 'trial', charge: 0 };
  if (!['active', 'ending', 'canceling'].includes(phase)) return { ...base, mode: 'resub', charge: planPrice(tp, 'monthly') };
  if (up) {
    const period = s.period || 'monthly';
    const rem = Math.max(0, Math.ceil((s.ends_at - now()) / DAY));
    const pd = periodDays(period);
    const diff = planPrice(tp, period) - planPrice(cur, period);
    return { ...base, mode: 'upgrade', period, rem, pd, diff, charge: Math.max(0, Math.round((diff * rem) / pd / 100) * 100) };
  }
  return { ...base, mode: 'downgrade', charge: 0 };
}

// Konfirmasi pindah paket. Mengembalikan { invoice } jika perlu membayar.
export function confirmPlanChange(session, targetPlanId) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const s = currentSubscription(db, rid);
    if (!s) throw new ApiError('Belum ada langganan.', 'invalid_state');
    const q = planChangeQuote(db, rid, targetPlanId);
    if (q.tp.id === s.plan_id) throw new ApiError('Itu paket yang sedang dipakai.', 'validation');
    if (q.mode === 'trial') {
      s.plan_id = q.tp.id;
      audit(db, rid, actor, 'subscription.trial_plan_changed', q.tp.name);
      return { notes: enforcePlan(db, rid) };
    }
    if (q.mode === 'downgrade') {
      s.pending_plan_id = q.tp.id;
      audit(db, rid, actor, 'subscription.downgrade_scheduled', q.tp.name);
      return { notes: [], scheduled: true };
    }
    if (q.mode === 'resub') return { checkout: { kind: 'resub', planId: q.tp.id } };
    if (q.charge <= 0) {
      s.plan_id = q.tp.id;
      return { notes: enforcePlan(db, rid) };
    }
    const inv = addInvoice(db, { rid, planId: q.tp.id, period: q.period, kind: 'upgrade', amount: q.charge, note: `Prorata: (${planPrice(q.tp, q.period)} - ${planPrice(q.cur, q.period)}) x ${q.rem}/${q.pd} hari. Tanggal berakhir tetap.` });
    audit(db, rid, actor, 'subscription.upgrade_invoice', inv.invoice_number);
    return { invoice: inv };
  });
}

// Buat tagihan: new (dari uji coba), extend, resub.
export function createSubscriptionInvoice(session, { kind, planId, period, method }) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const plan = byId(db.plans, planId);
    if (!plan || !['new', 'extend', 'resub'].includes(kind) || !['monthly', 'yearly'].includes(period)) throw new ApiError('Data tagihan tidak valid.', 'validation');
    const inv = addInvoice(db, { rid, planId, period, kind, method, amount: planPrice(plan, period), note: period === 'yearly' ? `Hemat ${plan.price_monthly * 12 - plan.price_yearly} dibanding 12 x bulanan.` : '' });
    audit(db, rid, actor, 'subscription.invoice_created', inv.invoice_number);
    return inv;
  });
}

export function setSubscriptionFlag(session, action) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const s = currentSubscription(db, rid);
    if (action === 'cancel') Object.assign(s, { cancel_at_end: true, auto_renew: false });
    else if (action === 'resume') Object.assign(s, { cancel_at_end: false, auto_renew: true });
    else if (action === 'undo_downgrade') s.pending_plan_id = null;
    else throw new ApiError('Aksi tidak dikenal.', 'validation');
    audit(db, rid, actor, `subscription.${action}`, '');
    return s;
  });
}

// Khusus demo: perpanjangan otomatis oleh sistem berhasil atau gagal.
export function simulateAutoRenew(session, result) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'settings.manage');
    const s = currentSubscription(db, rid);
    const planId = s.pending_plan_id || s.plan_id;
    const inv = addInvoice(db, { rid, planId, period: s.period || 'monthly', kind: 'renewal', method: 'ewallet', amount: planPrice(byId(db.plans, planId), s.period || 'monthly') });
    return { inv };
  });
}

// Khusus demo: geser jam server.
export function shiftTime(session, days, jumpToEnd) {
  return transact((db) => {
    const { rid } = requireStaff(db, session, 'settings.manage');
    if (jumpToEnd !== undefined) {
      const s = currentSubscription(db, rid);
      db.time_offset = s.ends_at + jumpToEnd * DAY - Date.now() + 3600000;
    } else db.time_offset = days === 0 ? 0 : (db.time_offset || 0) + days * DAY;
    return db.time_offset;
  });
}

export const invoicesOf = (db, rid) => db.subscription_invoices.filter((i) => i.restaurant_id === rid).sort(sortBy('created_at', -1));
export const serverNow = () => now();


/* =====================================================================
   PENDAFTARAN PEMILIK USAHA & ONBOARDING
   Alur: daftar -> verifikasi kode -> profil usaha -> operasional -> pilih paket -> uji coba atau bayar.
   ===================================================================== */
const newOtp = () => String(Math.floor(100000 + Math.random() * 900000));
export const BIZ_CATEGORIES = ['Warung makan', 'Kafe', 'Restoran', 'Bakso & mie', 'Kedai kopi', 'Katering', 'Lainnya'];

export function startRegistration({ name, email, phone, password, password2, terms }) {
  return transact((db) => {
    const n = (name || '').trim();
    const e = (email || '').trim().toLowerCase();
    const ph = (phone || '').replace(/[\s-]/g, '');
    const fail = (m) => { throw new ApiError(m, 'validation'); };
    if (!n) fail('Isi nama pemilik.');
    if (!/^\S+@\S+\.\S+$/.test(e)) fail('Format email tidak valid.');
    if (db.users.some((u) => u.email.toLowerCase() === e)) fail('Email ini sudah terdaftar. Silakan masuk.');
    if (!/^(\+62|62|0)8\d{7,12}$/.test(ph)) fail('Nomor HP tidak valid. Contoh: 081234567890.');
    if (!password || password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password)) fail('Password minimal 8 karakter dan memuat huruf serta angka.');
    if (password !== password2) fail('Konfirmasi password tidak sama.');
    if (!terms) fail('Setujui syarat dan ketentuan untuk melanjutkan.');
    db.pending_registrations = (db.pending_registrations || []).filter((r) => r.email !== e);
    const reg = { id: uid('reg_'), name: n, email: e, phone: ph, password, otp: newOtp(), attempts: 0, created_at: now() };
    db.pending_registrations.push(reg);
    // Di produk asli kode dikirim lewat email/SMS dan tidak pernah dikembalikan ke browser.
    return { regId: reg.id, otp: reg.otp, email: e, phone: ph };
  });
}

export function resendOtp(regId) {
  return transact((db) => {
    const reg = (db.pending_registrations || []).find((r) => r.id === regId);
    if (!reg) throw new ApiError('Pendaftaran tidak ditemukan. Ulangi dari awal.', 'not_found');
    reg.otp = newOtp();
    reg.attempts = 0;
    return { otp: reg.otp };
  });
}

export function verifyRegistration(regId, code) {
  return transact((db) => {
    const reg = (db.pending_registrations || []).find((r) => r.id === regId);
    if (!reg) throw new ApiError('Pendaftaran tidak ditemukan. Ulangi dari awal.', 'not_found');
    if (reg.attempts >= 5) throw new ApiError('Terlalu banyak percobaan. Kirim ulang kode.', 'limit');
    if (String(code).trim() !== reg.otp) { reg.attempts += 1; throw new ApiError('Kode tidak cocok. Periksa lagi atau kirim ulang kode.', 'validation'); }
    if (db.users.some((u) => u.email.toLowerCase() === reg.email)) throw new ApiError('Email ini sudah terdaftar.', 'validation');
    const u = { id: uid('user_'), name: reg.name, email: reg.email, phone: reg.phone, password: reg.password, platform_role: null, is_active: true, onboarding: true, trial_used: false, created_at: now() };
    db.users.push(u);
    db.pending_registrations = db.pending_registrations.filter((r) => r.id !== regId);
    return { kind: 'onboarding', userId: u.id, name: u.name, email: u.email };
  });
}

// Membuat restoran, pengaturan, meja + QR, dan langganan berstatus "pending" sampai uji coba dimulai atau tagihan dibayar.
export function createRestaurantFromOnboarding(session, ob, planId) {
  return transact((db) => {
    if (!session || session.kind !== 'onboarding') throw new ApiError('Sesi pendaftaran tidak valid. Masuk lagi.', 'auth');
    const u = byId(db.users, session.userId);
    const plan = byId(db.plans, planId);
    if (!plan || !plan.is_active) throw new ApiError('Pilih paket.', 'validation');
    const name = (ob.name || '').trim();
    const tables = Math.round(Number(ob.tables));
    if (!name) throw new ApiError('Isi nama usaha.', 'validation');
    if (!(tables >= 1 && tables <= 100)) throw new ApiError('Jumlah meja antara 1 dan 100.', 'validation');
    if (plan.max_tables && tables > plan.max_tables) throw new ApiError(`Paket ${plan.name} dibatasi ${plan.max_tables} meja. Kurangi jumlah meja atau pilih paket lain.`, 'limit');
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'usaha';
    while (db.restaurants.some((r) => r.slug === slug)) slug += '-' + randomToken(3).toLowerCase();
    const rid = uid('rest_');
    db.restaurants.push({ id: rid, name, slug, category: ob.category, address: ob.address, phone: ob.phone, logo_text: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(), logo_url: null, cover_url: null, status: 'active', order_seq: 0, created_at: now() });
    db.restaurant_settings.push({
      restaurant_id: rid, tax_percent: 0, service_percent: 0, pay_policy: 'pay_first', channels: { qris: true, ewallet: true, va: false },
      open_time: ob.open || '08:00', close_time: ob.close || '21:00', notify_new_order: true, notify_sound: true,
      config: plan.configs[plan.configs.length - 1] === 'advanced' ? 'standard' : plan.configs[plan.configs.length - 1], shared_tablet: false, takeaway: !!ob.takeaway,
    });
    db.subscriptions.push({ id: uid('sub_'), restaurant_id: rid, plan_id: plan.id, status: 'pending', period: 'monthly', auto_renew: false, cancel_at_end: false, pending_plan_id: null, renew_failed: false, started_at: now(), ends_at: now() });
    for (let i = 1; i <= tables; i++) {
      const tid = uid('tbl_');
      db.tables.push({ id: tid, restaurant_id: rid, name: String(i).padStart(2, '0'), is_active: true, is_archived: false, created_at: now() });
      db.qr_codes.push({ id: uid('qr_'), restaurant_id: rid, table_id: tid, token: randomToken(16), is_active: true, created_at: now(), revoked_at: null });
    }
    db.restaurant_members.push({ id: uid('mem_'), restaurant_id: rid, user_id: u.id, roles: ['owner', 'cashier', 'kitchen', 'waiter'], is_active: true, created_at: now() });
    u.onboarding = false;
    audit(db, rid, { id: u.id, label: `${u.name} (Owner)` }, 'restaurant.created', name);
    return { kind: 'staff', userId: u.id, name: u.name, email: u.email, restaurantId: rid, roles: ['owner', 'cashier', 'kitchen', 'waiter'] };
  });
}

export function startTrial(session) {
  return transact((db) => {
    const { rid, actor } = requireStaff(db, session, 'settings.manage');
    const u = byId(db.users, session.userId);
    const s = currentSubscription(db, rid);
    if (!s || s.status !== 'pending') throw new ApiError('Langganan sudah dimulai.', 'invalid_state');
    const ps = platformSettings(db);
    if (!ps.trial_enabled) throw new ApiError('Program uji coba sedang tidak tersedia.', 'limit');
    if (u.trial_used) throw new ApiError('Uji coba gratis hanya bisa dipakai sekali per akun.', 'limit');
    Object.assign(s, { status: 'trial', started_at: now(), ends_at: now() + ps.trial_days * DAY });
    u.trial_used = true;
    audit(db, rid, actor, 'subscription.trial_started', `${ps.trial_days} hari`);
    return s;
  });
}

export const canStartTrial = (db, userId) => platformSettings(db).trial_enabled && !byId(db.users, userId)?.trial_used;


/* =====================================================================
   LUPA PASSWORD (tautan berlaku 30 menit, sekali pakai)
   ===================================================================== */
// Respons sama untuk email terdaftar maupun tidak, agar tidak membocorkan siapa yang punya akun.
// demoToken hanya ada di simulasi, menggantikan email yang di produk asli dikirim ke pengguna.
export function requestPasswordReset(email) {
  return transact((db) => {
    const u = db.users.find((x) => x.email.toLowerCase() === (email || '').trim().toLowerCase() && x.is_active);
    if (!u) return { sent: true };
    db.reset_tokens = (db.reset_tokens || []).filter((t) => t.user_id !== u.id);
    const t = { token: randomToken(24), user_id: u.id, expires_at: now() + 30 * 60000 };
    db.reset_tokens.push(t);
    return { sent: true, demoToken: t.token };
  });
}

export function resetPassword(token, password, password2) {
  return transact((db) => {
    const t = (db.reset_tokens || []).find((x) => x.token === token);
    if (!t || t.expires_at < now()) throw new ApiError('Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.', 'validation');
    if (!password || password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password)) throw new ApiError('Password minimal 8 karakter dan memuat huruf serta angka.', 'validation');
    if (password !== password2) throw new ApiError('Konfirmasi password tidak sama.', 'validation');
    byId(db.users, t.user_id).password = password;
    db.reset_tokens = db.reset_tokens.filter((x) => x !== t);
    return true;
  });
}
