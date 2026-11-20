// Data awal untuk simulasi. Struktur setiap koleksi mengikuti rancangan tabel database MenuKlik.
// Semua data di sini fiktif dan hanya untuk demo.
import { uid, randomToken, startOfDay, DAY, MINUTE } from '../lib/format.js';

export const DB_VERSION = 4;
export const MAIN_RESTAURANT_ID = 'rest_krn';
export const DEMO_PASSWORD = 'demo123';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function emptyDb() {
  return {
    version: DB_VERSION,
    rev: 1,
    restaurants: [],
    users: [],
    restaurant_members: [],
    tables: [],
    qr_codes: [],
    categories: [],
    products: [],
    product_variants: [],
    orders: [],
    order_items: [],
    payments: [],
    payment_events: [],
    restaurant_settings: [],
    subscriptions: [],
    plans: [],
    order_status_history: [],
    // Tabel tambahan di luar 16 entitas minimum, dibutuhkan oleh Super Admin dan audit.
    subscription_invoices: [],
    support_tickets: [],
    access_requests: [],
    audit_logs: [], pending_registrations: [],
  };
}

export function createSeed({ withSamples = true } = {}) {
  const now = Date.now();
  const db = emptyDb();
  const R = MAIN_RESTAURANT_ID;

  const ALL_FEATURES = ['qr', 'cashier', 'digital_pay', 'reports', 'tablet', 'reports_adv', 'kds', 'waiter', 'priority'];
  db.plans.push(
    { id: 'plan_basic', name: 'Basic', price_monthly: 49000, price_yearly: 490000, max_tables: 10, max_staff: 2, duration_days: 30, configs: ['basic'], features: ['qr', 'cashier', 'digital_pay', 'reports'], description: 'Warung kecil yang mulai dengan satu HP.', is_active: true },
    { id: 'plan_standard', name: 'Standard', price_monthly: 99000, price_yearly: 990000, max_tables: 25, max_staff: 6, duration_days: 30, configs: ['basic', 'standard'], features: ['qr', 'cashier', 'digital_pay', 'reports', 'tablet', 'reports_adv'], description: 'Usaha dengan kasir dan operasional lebih lengkap.', is_active: true },
    { id: 'plan_advanced', name: 'Advanced', price_monthly: 199000, price_yearly: 1990000, max_tables: null, max_staff: null, duration_days: 30, configs: ['basic', 'standard', 'advanced'], features: ALL_FEATURES, description: 'Restoran dengan KDS, waiter, dan banyak perangkat.', is_active: true },
  );

  // [id, nama, alamat, telepon, logo, paket, status, mulai (hari), berakhir (hari), jumlah meja, pemilik, email pemilik]
  const restaurants = [
    [R, 'Kedai Rasa Nusantara', 'Jl. Melati No. 12', '0812-3456-7890', 'KRN', 'plan_standard', 'active', -20, 10, 4, 'Ratna Sari', 'owner@kedairasa.test'],
    ['rest_busri', 'Warung Bu Sri', 'Jl. Kenanga No. 3', '0813-1111-2222', 'WBS', 'plan_basic', 'active', -10, 20, 6, 'Sri Wahyuni', 'owner@warungbusri.test'],
    ['rest_teras', 'Kopi Teras Pagi', 'Jl. Flamboyan No. 8', '0857-3333-4444', 'KTP', 'plan_advanced', 'active', -100, 265, 12, 'Andika Putra', 'owner@kopiteras.test'],
    ['rest_bakso', 'Bakso Mas Gondrong', 'Jl. Cempaka No. 21', '0821-5555-6666', 'BMG', 'plan_standard', 'active', -40, -10, 5, 'Gunawan', 'owner@baksogondrong.test'],
    ['rest_nenek', 'Dapur Nenek', 'Jl. Anggrek No. 5', '0878-7777-8888', 'DN', 'plan_basic', 'trial', -12, 2, 3, 'Siti Aminah', 'owner@dapurnenek.test'],
  ];

  restaurants.forEach(([id, name, address, phone, logo, plan, subStatus, start, end, tableCount, ownerName, ownerEmail]) => {
    db.restaurants.push({ id, name, slug: id.replace('rest_', ''), address, phone, logo_text: logo, logo_url: null, cover_url: null, status: 'active', order_seq: 0, created_at: now + start * DAY });
    db.restaurant_settings.push({
      restaurant_id: id, tax_percent: 0, service_percent: 0, pay_policy: 'pay_first',
      channels: { qris: true, ewallet: true, va: false }, open_time: '08:00', close_time: '21:00',
      notify_new_order: true, notify_sound: true,
      // Konfigurasi perangkat: basic | standard | advanced. Tablet bersama hanya relevan untuk Standard.
      config: { rest_krn: 'standard', rest_busri: 'basic', rest_teras: 'advanced', rest_bakso: 'standard', rest_nenek: 'basic' }[id] || 'basic',
      shared_tablet: id === R,
    });
    db.subscriptions.push({ id: uid('sub_'), restaurant_id: id, plan_id: plan, status: subStatus, started_at: now + start * DAY, ends_at: now + end * DAY });
    for (let i = 1; i <= tableCount; i++) {
      const tid = id === R ? `tbl_0${i}` : uid('tbl_');
      db.tables.push({ id: tid, restaurant_id: id, name: String(i).padStart(2, '0'), is_active: true, is_archived: false, created_at: now + start * DAY });
      db.qr_codes.push({ id: uid('qr_'), restaurant_id: id, table_id: tid, token: randomToken(16), is_active: true, created_at: now + start * DAY, revoked_at: null });
    }
    if (id !== R) {
      const uidOwner = uid('user_');
      db.users.push({ id: uidOwner, name: ownerName, email: ownerEmail, password: DEMO_PASSWORD, platform_role: null, is_active: true, created_at: now + start * DAY });
      db.restaurant_members.push({ id: uid('mem_'), restaurant_id: id, user_id: uidOwner, roles: ['owner', 'cashier', 'kitchen', 'waiter'], is_active: true, created_at: now + start * DAY });
    }
  });

  // Pengguna restoran utama + Super Admin. Password disimpan polos HANYA karena ini simulasi.
  db.users.push(
    { id: 'user_owner', name: 'Ratna Sari', email: 'owner@kedairasa.test', password: DEMO_PASSWORD, platform_role: null, is_active: true, created_at: now - 5 * DAY },
    { id: 'user_cashier', name: 'Dimas Pratama', email: 'cashier@kedairasa.test', password: DEMO_PASSWORD, platform_role: null, is_active: true, created_at: now - 5 * DAY },
    { id: 'user_kitchen', name: 'Joko Susilo', email: 'kitchen@kedairasa.test', password: DEMO_PASSWORD, platform_role: null, is_active: true, created_at: now - 5 * DAY },
    { id: 'user_waiter', name: 'Sari Lestari', email: 'waiter@kedairasa.test', password: DEMO_PASSWORD, platform_role: null, is_active: true, created_at: now - 5 * DAY },
    { id: 'user_admin', name: 'Tim MenuKlik', email: 'admin@menuklik.test', password: DEMO_PASSWORD, platform_role: 'super_admin', is_active: true, created_at: now - 90 * DAY },
  );
  db.restaurant_members.push(
    { id: 'mem_owner', restaurant_id: R, user_id: 'user_owner', roles: ['owner', 'cashier', 'kitchen', 'waiter'], is_active: true, created_at: now - 5 * DAY },
    { id: 'mem_cashier', restaurant_id: R, user_id: 'user_cashier', roles: ['cashier', 'waiter'], is_active: true, created_at: now - 5 * DAY },
    { id: 'mem_kitchen', restaurant_id: R, user_id: 'user_kitchen', roles: ['kitchen'], is_active: true, created_at: now - 5 * DAY },
    { id: 'mem_waiter', restaurant_id: R, user_id: 'user_waiter', roles: ['waiter'], is_active: true, created_at: now - 5 * DAY },
  );

  // Kategori & menu restoran utama
  [['cat_main', 'Makanan Utama'], ['cat_snack', 'Makanan Ringan'], ['cat_drink', 'Minuman'], ['cat_dessert', 'Dessert'], ['cat_combo', 'Paket Hemat']].forEach(([id, name], i) =>
    db.categories.push({ id, restaurant_id: R, name, sort_order: i + 1, is_active: true, created_at: now - 5 * DAY }),
  );

  const product = (id, category_id, name, price, description, extra = {}) =>
    db.products.push({ id, restaurant_id: R, category_id, name, description, price, image_url: null, is_available: true, is_active: true, sort_order: db.products.length + 1, created_at: now - 5 * DAY, updated_at: now - 5 * DAY, ...extra });
  const option = (product_id, kind, group_name, name, price_delta = 0) =>
    db.product_variants.push({ id: `${product_id}_${db.product_variants.length}`, product_id, restaurant_id: R, kind, group_name, name, price_delta, sort_order: db.product_variants.length, is_active: true });
  const spicy = (pid, group = 'Level pedas', names = ['Tidak pedas', 'Sedang', 'Pedas']) => names.forEach((n) => option(pid, 'variant', group, n));

  product('p_nasgor', 'cat_main', 'Nasi Goreng Spesial', 20000, 'Nasi goreng bumbu rumahan dengan telur, ayam suwir, dan acar.');
  spicy('p_nasgor'); option('p_nasgor', 'addon', 'Tambahan', 'Telur ceplok', 4000); option('p_nasgor', 'addon', 'Tambahan', 'Kerupuk', 2000);
  product('p_miegoreng', 'cat_main', 'Mie Goreng Jawa', 18000, 'Mie kuning dengan kol, telur, dan kecap manis.');
  spicy('p_miegoreng'); option('p_miegoreng', 'addon', 'Tambahan', 'Telur ceplok', 4000); option('p_miegoreng', 'addon', 'Tambahan', 'Bakso', 5000);
  product('p_geprek', 'cat_main', 'Ayam Geprek', 17000, 'Ayam goreng tepung digeprek dengan sambal bawang dan nasi putih.');
  spicy('p_geprek', 'Level sambal', ['Level 1', 'Level 2', 'Level 3']); option('p_geprek', 'addon', 'Tambahan', 'Keju', 5000); option('p_geprek', 'addon', 'Tambahan', 'Nasi tambah', 4000);
  product('p_pisang', 'cat_snack', 'Pisang Goreng Keju', 10000, 'Pisang kepok goreng dengan parutan keju dan susu.', { is_available: false });
  product('p_esteh', 'cat_drink', 'Es Teh', 5000, 'Teh melati seduh dengan es batu.');
  ['Manis', 'Kurang manis', 'Tawar'].forEach((n) => option('p_esteh', 'variant', 'Rasa', n));
  option('p_esteh', 'variant', 'Ukuran', 'Reguler'); option('p_esteh', 'variant', 'Ukuran', 'Jumbo', 3000);
  product('p_kopisusu', 'cat_drink', 'Kopi Susu', 12000, 'Kopi robusta dengan susu kental manis.');
  ['Dingin', 'Panas'].forEach((n) => option('p_kopisusu', 'variant', 'Penyajian', n));
  product('p_escampur', 'cat_dessert', 'Es Campur', 12000, 'Serutan es dengan buah, cincau, dan sirup gula aren.');
  product('p_paket', 'cat_combo', 'Paket Nasi Goreng + Es Teh', 23000, 'Nasi Goreng Spesial dan Es Teh manis, lebih hemat.');

  db.subscription_invoices.push(
    { id: uid('inv_'), invoice_number: 'SUB-0309', restaurant_id: 'rest_bakso', plan_id: 'plan_standard', amount: 99000, status: 'unpaid', period_start: now - 7 * DAY, period_end: now + 23 * DAY, paid_at: null, note: 'Belum dibayar, langganan berhenti.', created_at: now - 8 * DAY },
    { id: uid('inv_'), invoice_number: 'SUB-0311', restaurant_id: 'rest_busri', plan_id: 'plan_basic', amount: 49000, status: 'paid', period_start: now - 10 * DAY, period_end: now + 20 * DAY, paid_at: now - 10 * DAY, note: '', created_at: now - 10 * DAY },
    { id: uid('inv_'), invoice_number: 'SUB-0312', restaurant_id: 'rest_teras', plan_id: 'plan_advanced', amount: 199000, status: 'paid', period_start: now - 18 * DAY, period_end: now + 12 * DAY, paid_at: now - 18 * DAY, note: '', created_at: now - 18 * DAY },
    { id: uid('inv_'), invoice_number: 'SUB-0298', restaurant_id: 'rest_teras', plan_id: 'plan_advanced', amount: 199000, status: 'paid', period_start: now - 48 * DAY, period_end: now - 18 * DAY, paid_at: now - 48 * DAY, note: '', created_at: now - 48 * DAY },
  );

  const M = 60000;
  const tk = (n, rid, o) => ({ id: uid('tkt_'), ticket_number: 'TKT-000' + n, restaurant_id: rid, code: '', context: [], status: 'open', replies: [], first_reply_at: null, resolved_at: null, rating: null, rating_note: '', owner_unread: 0, admin_unread: false, ...o });
  db.support_tickets.push(
    tk(3, 'rest_nenek', { category: 'order', priority: 'kritis', subject: 'Pesanan dari QR tidak muncul di kasir', message: 'Sejak jam 11 pelanggan bilang sudah pesan, tapi layar kasir kosong.', device: 'HP pemilik', config: 'Basic', code: 'SRV-503', context: ['HP pemilik: online'], created_at: now - 6 * M, admin_unread: true }),
    tk(2, 'rest_teras', { category: 'payment', priority: 'tinggi', subject: 'Status QRIS lama berubah jadi lunas', message: 'Beberapa transaksi butuh sekitar 3 menit sampai lunas.', device: 'Komputer kasir', config: 'Advanced', status: 'in_progress', created_at: now - 95 * M, first_reply_at: now - 70 * M, replies: [{ from: 'admin', who: 'Tim MenuKlik', text: 'Sedang kami cek bersama penyedia pembayaran.', at: now - 70 * M }] }),
    tk(1, 'rest_krn', { category: 'qr', priority: 'normal', subject: 'QR Meja 03 sulit dipindai setelah dilaminasi', message: 'Pelanggan bilang kamera HP susah membaca QR.', device: 'HP pemilik', config: 'Standard, tablet bersama', status: 'resolved', created_at: now - 26 * 60 * M, first_reply_at: now - 25 * 60 * M, resolved_at: now - 24 * 60 * M, rating: 5, rating_note: 'Cepat dan jelas.', replies: [{ from: 'admin', who: 'Tim MenuKlik', text: 'Laminasi mengilap memantulkan cahaya. Cetak ulang dengan laminasi doff, atau buat QR baru di menu Meja & QR.', at: now - 25 * 60 * M }, { from: 'sys', text: 'Status diubah menjadi Selesai', at: now - 24 * 60 * M }] }),
  );

  if (withSamples) seedOrders(db, now);
  return db;
}

/* -------- pesanan contoh: 6 hari terakhir + 3 pesanan hari ini -------- */
function seedOrders(db, now) {
  const R = MAIN_RESTAURANT_ID;
  const K = ['Dimas Pratama (Kasir/Waiter)', 'user_cashier', 'Komputer kasir'];
  const D = ['Joko Susilo (Dapur)', 'user_kitchen', 'Tablet bersama'];
  const W = ['Sari Lestari (Waiter)', 'user_waiter', 'Tablet bersama'];
  const firstOptions = (pid) => {
    const seen = new Set();
    return db.product_variants.filter((v) => v.product_id === pid && v.kind === 'variant' && !seen.has(v.group_name) && seen.add(v.group_name)).map((v) => v.id);
  };
  const tableIds = db.tables.filter((t) => t.restaurant_id === R).map((t) => t.id);
  const rand = rng(20261110);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const sellable = ['p_nasgor', 'p_miegoreng', 'p_geprek', 'p_esteh', 'p_kopisusu', 'p_escampur', 'p_paket'];

  for (let d = 6; d >= 1; d--) {
    const dayStart = startOfDay(now - d * DAY);
    const n = 16 + Math.floor(rand() * 12);
    for (let i = 0; i < n; i++) {
      const createdAt = dayStart + (10 * 60 + Math.floor(rand() * 600)) * MINUTE;
      const lines = [];
      const k = 1 + Math.floor(rand() * 3);
      for (let j = 0; j < k; j++) {
        const pid = pick(sellable);
        if (!lines.some((l) => l.pid === pid)) lines.push({ pid, opts: firstOptions(pid), qty: rand() < 0.75 ? 1 : 2 });
      }
      const digital = rand() < 0.45;
      const cancel = rand() < 0.05;
      seedOrder(db, {
        rid: R, tableId: pick(tableIds), lines, method: digital ? 'digital' : 'cashier', channel: digital ? (rand() < 0.7 ? 'qris' : 'ewallet') : 'cash', createdAt,
        paidAfter: cancel ? null : digital ? 1 : 2,
        cancelReason: 'Menu habis',
        steps: cancel ? [['cancelled', 3, ...K]] : [['accepted', 3, ...K], ['preparing', 2, ...D], ['ready', 8 + Math.floor(rand() * 10), ...D], ['picked_up', 2, ...W], ['delivered', 3, ...W]],
      });
    }
  }
  const ago = (m) => now - m * MINUTE;
  // Pesanan hari ini (4 pesanan, sama seperti "Reset dengan 4 pesanan contoh" di prototipe).
  const full = [['accepted', 1, ...K], ['preparing', 2, ...D], ['ready', 13, ...D], ['picked_up', 2, ...W], ['delivered', 1, ...W]];
  seedOrder(db, { rid: R, tableId: 'tbl_01', customer: 'Rina', lines: [{ pid: 'p_miegoreng', opts: firstOptions('p_miegoreng'), qty: 2 }, { pid: 'p_kopisusu', opts: firstOptions('p_kopisusu'), qty: 1 }], method: 'cashier', channel: 'cash', createdAt: ago(70), paidAfter: 2, steps: full });
  seedOrder(db, { rid: R, tableId: 'tbl_03', lines: [{ pid: 'p_geprek', opts: ['p_geprek_11'], qty: 1 }, { pid: 'p_esteh', opts: firstOptions('p_esteh'), qty: 1 }], method: 'digital', channel: 'qris', createdAt: ago(14), paidAfter: 1, steps: [['accepted', 2, ...K], ['preparing', 3, ...D]] });
  seedOrder(db, { rid: R, tableId: 'tbl_01', customer: 'Rina', note: 'Tambahan', lines: [{ pid: 'p_esteh', opts: firstOptions('p_esteh'), qty: 1 }], method: 'cashier', channel: 'cash', createdAt: ago(9), paidAfter: 1, steps: [['accepted', 0, ...K], ['preparing', 2, ...D], ['ready', 4, ...D]] });
  seedOrder(db, { rid: R, tableId: 'tbl_04', customer: 'Bayu', lines: [{ pid: 'p_kopisusu', opts: firstOptions('p_kopisusu'), qty: 2, note: 'Gula sedikit' }], method: 'cashier', channel: 'cash', createdAt: ago(3), steps: [] });
}

function seedOrder(db, o) {
  const restaurant = db.restaurants.find((x) => x.id === o.rid);
  restaurant.order_seq += 1;
  const t0 = o.createdAt;
  const items = o.lines.map((l) => {
    const p = db.products.find((x) => x.id === l.pid);
    const opts = (l.opts || []).map((id) => db.product_variants.find((v) => v.id === id)).filter(Boolean);
    const unit = p.price + opts.reduce((a, v) => a + v.price_delta, 0);
    return { id: uid('oi_'), order_id: null, restaurant_id: o.rid, product_id: p.id, product_name: p.name, base_price: p.price, options_text: opts.map((v) => (v.kind === 'variant' ? v.name : '+ ' + v.name)).join(', '), unit_price: unit, qty: l.qty, note: l.note || '', line_total: unit * l.qty };
  });
  const subtotal = items.reduce((a, i) => a + i.line_total, 0);
  const order = {
    id: uid('ord_'), restaurant_id: o.rid, table_id: o.tableId, order_number: 'MK-' + String(restaurant.order_seq).padStart(4, '0'),
    idempotency_key: uid('seed_'), customer_name: o.customer || '', note: o.note || '', payment_method: o.method, pay_policy: 'pay_first',
    // Tiga status terpisah + penanda batal + catatan sudah dicatat di POS/buku kas.
    payment_status: 'pending', kitchen_status: 'waiting', serving_status: null, cancelled: false, pos_recorded: false,
    subtotal, tax_amount: 0, service_amount: 0, total: subtotal, cancel_reason: '', created_at: t0, updated_at: t0,
  };
  items.forEach((i) => (i.order_id = order.id));
  db.orders.push(order);
  db.order_items.push(...items);

  const history = (kind, to, at, label, by, device = '') =>
    db.order_status_history.push({ id: uid('osh_'), order_id: order.id, restaurant_id: o.rid, kind, to_status: to, changed_by: by, changed_by_label: label, device, note: to === 'cancelled' ? o.cancelReason || '' : '', created_at: at });
  history('order', 'created', t0, 'Pelanggan (QR)', 'customer', 'HP pelanggan');

  const digital = o.method === 'digital';
  const pay = {
    id: uid('pay_'), restaurant_id: o.rid, order_id: order.id,
    payment_number: 'TRX-' + String(db.payments.filter((p) => p.restaurant_id === o.rid).length + 1).padStart(5, '0'),
    method: digital ? 'digital' : 'cash', channel: digital ? o.channel : 'cash', amount: subtotal, status: 'pending',
    gateway_ref: digital ? 'SIM-' + randomToken(8).toUpperCase() : null, paid_at: null, confirmed_by: null,
    expires_at: digital ? t0 + 15 * MINUTE : null, created_at: t0,
  };
  db.payments.push(pay);
  const event = (type, at, summary, source, gid = null) =>
    db.payment_events.push({ id: uid('pe_'), payment_id: pay.id, restaurant_id: o.rid, event_type: type, source, gateway_event_id: gid, summary, created_at: at });
  event('created', t0, digital ? 'Transaksi dibuat di payment gateway (simulasi)' : 'Menunggu pembayaran tunai di kasir', digital ? 'gateway' : 'system');

  if (o.paidAfter != null) {
    const at = t0 + o.paidAfter * MINUTE;
    pay.status = 'paid';
    pay.paid_at = at;
    order.payment_status = 'paid';
    if (digital) {
      event('webhook_paid', at, 'Notifikasi diterima: berhasil. Tanda tangan diverifikasi (simulasi).', 'gateway', 'evt_' + randomToken(10));
      history('payment', 'paid', at, 'Payment gateway (webhook)', 'gateway', 'Server');
    } else {
      pay.confirmed_by = 'user_cashier';
      event('cash_confirmed', at, 'Uang tunai diterima, dikonfirmasi oleh Dimas Pratama (Kasir/Waiter)', 'staff');
      history('payment', 'paid', at, 'Dimas Pratama (Kasir/Waiter)', 'user_cashier', 'Komputer kasir');
    }
  }

  let t = t0;
  (o.steps || []).forEach(([to, after, label, by, device]) => {
    t += after * MINUTE;
    if (to === 'cancelled') {
      order.cancelled = true;
      order.cancel_reason = o.cancelReason || 'Lainnya';
      history('order', 'cancelled', t, label, by, device);
      return;
    }
    if (['accepted', 'preparing', 'ready'].includes(to)) {
      order.kitchen_status = to;
      history('kitchen', to, t, label, by, device);
      if (to === 'ready') {
        order.serving_status = 'waiting_pickup';
        history('serving', 'waiting_pickup', t, 'Sistem', 'system', 'Server');
      }
    } else {
      order.serving_status = to;
      history('serving', to, t, label, by, device);
    }
  });
  order.updated_at = t;
  if (order.cancelled) {
    pay.status = 'failed';
    order.payment_status = 'failed';
    event('closed', t, 'Ditutup karena pesanan dibatalkan sebelum dibayar', 'system');
  }
  return order;
}
