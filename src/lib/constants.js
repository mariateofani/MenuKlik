// Nilai status disimpan dalam bahasa Inggris (sesuai kolom database),
// label yang tampil di layar memakai bahasa Indonesia.

// Tiga status terpisah, tampil bersamaan (sesuai prototipe):
// pembayaran, dapur, dan penyajian. "Selesai" tidak disimpan, tetapi dihitung (lihat orderOverall).
export const KITCHEN_STATUS = {
  waiting: { label: 'Menunggu kasir', tone: 'blue' },
  accepted: { label: 'Antre di dapur', tone: 'violet' },
  preparing: { label: 'Sedang dimasak', tone: 'amber' },
  ready: { label: 'Siap', tone: 'green' },
};

export const SERVING_STATUS = {
  none: { label: 'Belum berlaku', tone: 'muted' },
  waiting_pickup: { label: 'Menunggu diambil', tone: 'orange' },
  picked_up: { label: 'Sedang diantar', tone: 'blue' },
  delivered: { label: 'Sudah diantar', tone: 'green' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Belum dibayar', tone: 'amber' },
  paid: { label: 'Lunas', tone: 'green' },
  failed: { label: 'Gagal', tone: 'red' },
  expired: { label: 'Kedaluwarsa', tone: 'red' },
  refunded: { label: 'Dikembalikan', tone: 'blue' },
};

export const SUB_STATUS = {
  trial: { label: 'Uji coba', tone: 'amber' },
  active: { label: 'Berlangganan', tone: 'green' },
  expired: { label: 'Habis masa', tone: 'red' },
  suspended: { label: 'Ditangguhkan', tone: 'red' },
};

export const TICKET_STATUS = {
  open: { label: 'Baru', tone: 'blue' },
  in_progress: { label: 'Diproses', tone: 'amber' },
  resolved: { label: 'Selesai', tone: 'muted' },
};

export const CHANNELS = { qris: 'QRIS', ewallet: 'E-wallet', va: 'Transfer bank (VA)', cash: 'Tunai di kasir' };

export const PAYMENT_METHOD = { digital: 'Bayar digital', cashier: 'Bayar di kasir' };

export const PAY_POLICY = {
  pay_first: { label: 'Bayar dulu', hint: 'Pesanan baru bisa diterima setelah lunas.' },
  pay_later: { label: 'Makan dulu, bayar belakangan', hint: 'Pesanan langsung bisa diterima; wajib lunas sebelum ditandai selesai.' },
};

export const ROLES = { owner: 'Owner', cashier: 'Kasir', kitchen: 'Dapur', waiter: 'Waiter' };
export const roleLabels = (roles = []) => roles.map((r) => ROLES[r]).join('/');

// Tiga konfigurasi perangkat. Struktur data dan aturan sama; yang berbeda hanya perangkat
// yang dipakai dan siapa yang boleh mencatat status.
export const CONFIGS = {
  basic: {
    name: 'Basic', dev: '1 HP pemilik', who: 'Warung kecil, 1 sampai 3 orang',
    list: ['HP pemilik untuk semua: terima pesanan, bayar, status masak, antar', 'Dapur diberi tahu secara lisan atau kertas', 'Tanpa KDS dan tanpa perangkat waiter'],
  },
  standard: {
    name: 'Standard', dev: 'Komputer kasir (+ tablet opsional)', who: 'Kedai dengan kasir tetap',
    list: ['Komputer kasir untuk pesanan dan pembayaran', 'Dapur memakai tablet bersama, atau prosedur manual yang dicatat kasir', 'Waiter memakai tablet bersama jika ada'],
  },
  advanced: {
    name: 'Advanced', dev: 'Kasir + KDS + HP waiter', who: 'Kafe atau restoran dengan pembagian tugas',
    list: ['Komputer kasir', 'Monitor dapur (KDS)', 'HP waiter', 'HP pemilik untuk memantau'],
  },
};

// Fitur paket (dipakai tabel harga dan pengaturan Super Admin).
export const FEATURES = [
  ['qr', 'Menu digital & QR per meja'], ['cashier', 'Dashboard pesanan & pembayaran'], ['digital_pay', 'Pembayaran digital pelanggan'],
  ['reports', 'Laporan harian'], ['tablet', 'Dapur & antar lewat tablet bersama'], ['reports_adv', 'Laporan lengkap & ekspor'],
  ['kds', 'Kitchen Display System (KDS)'], ['waiter', 'Dashboard waiter di HP'], ['priority', 'Bantuan prioritas'],
];

// Mode manual: tidak ada perangkat dapur/waiter, jadi peran Kasir boleh mencatat status dapur dan penyajian.
// Basic selalu manual. Standard manual jika tidak memakai tablet bersama.
export const isManual = (settings) => settings?.config === 'basic' || (settings?.config === 'standard' && !settings?.shared_tablet);

// Perangkat yang dipakai per konfigurasi (menentukan menu dashboard yang tampil).
export const devicesFor = (settings) => {
  const c = settings?.config || 'advanced';
  if (c === 'basic') return ['owner'];
  if (c === 'standard') return settings.shared_tablet ? ['cashier', 'tablet'] : ['cashier'];
  return ['cashier', 'kds', 'waiter', 'owner'];
};

// Matriks hak akses (role-based access control). Satu pegawai boleh punya beberapa peran;
// izinnya adalah gabungan semua perannya. Backend asli wajib memeriksa matriks yang sama.
export const PERMISSIONS = {
  owner: [
    'dashboard.view', 'orders.view', 'orders.cancel', 'orders.cancel_paid', 'payments.view', 'payments.confirm_cash', 'orders.accept',
    'menu.manage', 'tables.view', 'tables.manage', 'reports.view', 'settings.manage', 'staff.manage',
  ],
  cashier: ['orders.view', 'orders.accept', 'orders.cancel', 'payments.view', 'payments.confirm_cash', 'tables.view'],
  kitchen: ['kitchen.view', 'kitchen.update'],
  waiter: ['serving.view', 'serving.update'],
};

// `roles` boleh berupa array peran atau satu peran (string).
export const can = (roles, perm) => [].concat(roles || []).some((r) => PERMISSIONS[r]?.includes(perm));

// Hanya pesanan yang sedang berjalan. "Selesai" = sudah diantar dan lunas.
export const isActiveOrder = (o) => !o.cancelled && !(o.serving_status === 'delivered' && o.payment_status === 'paid');

export function orderOverall(o) {
  if (o.cancelled) return { label: 'Dibatalkan', tone: 'red' };
  if (o.serving_status === 'delivered') return o.payment_status === 'paid' ? { label: 'Selesai', tone: 'muted' } : { label: 'Diantar, belum dibayar', tone: 'amber' };
  return { label: 'Aktif', tone: 'blue' };
}

export const CANCEL_REASONS = ['Menu habis', 'Permintaan pelanggan', 'Pesanan ganda', 'Pelanggan tidak ditemukan', 'Lainnya'];

// Label perangkat untuk riwayat ("siapa, di perangkat apa"). area: cashier | kitchen | waiter.
export function deviceLabel(settings, area) {
  const c = settings?.config || 'advanced';
  if (c === 'basic') return 'HP pemilik';
  if (area === 'cashier') return 'Komputer kasir';
  if (c === 'advanced') return area === 'kitchen' ? 'Monitor dapur (KDS)' : 'HP waiter';
  return settings?.shared_tablet ? 'Tablet bersama' : 'Komputer kasir';
}

export function historyLabel(kind, to) {
  if (kind === 'order') return to === 'created' ? 'Pesanan dibuat' : 'Dibatalkan';
  if (kind === 'payment') return `Bayar: ${PAYMENT_STATUS[to].label}`;
  if (kind === 'kitchen') return `Dapur: ${KITCHEN_STATUS[to].label}`;
  return `Saji: ${SERVING_STATUS[to].label}`;
}

export const SUB_PHASE = {
  none: { label: 'Belum berlangganan', tone: 'muted' }, pending: { label: 'Menunggu pembayaran', tone: 'amber' },
  trial: { label: 'Uji coba', tone: 'violet' }, trial_ending: { label: 'Uji coba hampir berakhir', tone: 'orange' }, trial_expired: { label: 'Uji coba berakhir', tone: 'red' },
  active: { label: 'Aktif', tone: 'green' }, ending: { label: 'Hampir berakhir', tone: 'orange' }, canceling: { label: 'Berhenti di akhir periode', tone: 'amber' },
  grace: { label: 'Masa tenggang', tone: 'orange' }, renew_failed: { label: 'Perpanjangan gagal', tone: 'red' }, expired: { label: 'Kedaluwarsa', tone: 'red' },
  canceled: { label: 'Berhenti berlangganan', tone: 'muted' }, suspended: { label: 'Ditangguhkan', tone: 'red' },
};
export const INVOICE_STATUS = { unpaid: { label: 'Menunggu pembayaran', tone: 'amber' }, paid: { label: 'Lunas', tone: 'green' }, failed: { label: 'Gagal', tone: 'red' }, expired: { label: 'Kedaluwarsa', tone: 'red' } };
export const INVOICE_KIND = { new: 'Langganan baru', extend: 'Perpanjangan', renewal: 'Perpanjangan otomatis', resub: 'Berlangganan kembali', upgrade: 'Upgrade paket' };

export const TICKET_CATEGORIES = { order: 'Pesanan tidak masuk atau tidak muncul', payment: 'Pembayaran', qr: 'QR Code atau meja', device: 'Perangkat atau tampilan', other: 'Lainnya' };
// target = target respons pertama (menit). Angka contoh.
export const TICKET_PRIORITY = { kritis: { label: 'Kritis', tone: 'red', target: 15 }, tinggi: { label: 'Tinggi', tone: 'orange', target: 120 }, normal: { label: 'Normal', tone: 'muted', target: 1440 } };
export const TICKET_TEMPLATES = [
  ['Diterima', 'Terima kasih, laporan sudah kami terima dan sedang kami cek.'],
  ['Sudah diperbaiki', 'Masalah sudah kami perbaiki. Mohon coba lagi dan kabari jika masih terjadi.'],
  ['Minta info', 'Boleh kirim foto layar saat eror muncul dan jam kejadiannya?'],
];

// Status target respons (SLA) sebuah laporan.
export function ticketSla(t, nowMs) {
  const target = TICKET_PRIORITY[t.priority].target;
  if (t.first_reply_at) {
    const m = Math.round((t.first_reply_at - t.created_at) / 60000);
    return { label: `Direspons dalam ${m} mnt`, tone: m <= target ? 'green' : 'red' };
  }
  if (t.status === 'resolved') return { label: 'Selesai', tone: 'green' };
  const left = target - Math.floor((nowMs - t.created_at) / 60000);
  if (left < 0) return { label: 'Lewat target respons', tone: 'red' };
  return { label: `Target respons: sisa ${left >= 120 ? Math.round(left / 60) + ' jam' : left + ' mnt'}`, tone: left <= 10 ? 'orange' : 'muted' };
}

// Halaman awal tiap peran setelah beralih dari landing page.
export const ROLE_HOME = { owner: '/dashboard/overview', cashier: '/dashboard/orders', kitchen: '/dashboard/kitchen', waiter: '/dashboard/waiter' };
export const ROLE_TASK = { owner: 'Kelola usaha, menu, laporan, langganan', cashier: 'Terima pesanan dan konfirmasi pembayaran', kitchen: 'Masak pesanan di layar dapur', waiter: 'Ambil dan antar pesanan ke meja' };
