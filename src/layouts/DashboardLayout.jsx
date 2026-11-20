import { useEffect, useRef } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useDb } from '../hooks/useDb.js';
import { useToast } from '../components/Toast.jsx';
import { orderNeed, planOf, serverNow, settingsOf, staffContext, subscriptionPhase, subscriptionState, currentSubscription } from '../services/api.js';
import { can, CONFIGS, isManual, roleLabels, SUB_PHASE } from '../lib/constants.js';
import { Icon } from '../lib/icons.jsx';
import { Pill } from '../components/ui.jsx';
import DemoBar from '../components/DemoBar.jsx';
import { DAY } from '../lib/format.js';

export const DASH_NAV = [
  { to: 'overview', label: 'Ringkasan', icon: 'home', perm: 'dashboard.view' },
  { to: 'orders', label: 'Pesanan & kasir', icon: 'monitor', perm: 'orders.view', badge: 'new' },
  { to: 'kitchen', label: 'Dapur (KDS)', icon: 'fire', perm: 'kitchen.view', badge: 'kitchen', device: true },
  { to: 'waiter', label: 'Waiter', icon: 'walk', perm: 'serving.view', badge: 'serve', device: true },
  { to: 'menu', label: 'Menu', icon: 'book', perm: 'menu.manage' },
  { to: 'categories', label: 'Kategori', icon: 'list', perm: 'menu.manage' },
  { to: 'tables', label: 'Meja & QR', icon: 'qr', perm: 'tables.view' },
  { to: 'payments', label: 'Pembayaran & kas', icon: 'wallet', perm: 'payments.view' },
  { to: 'reports', label: 'Laporan', icon: 'chart', perm: 'reports.view' },
  { to: 'staff', label: 'Pegawai & peran', icon: 'user', perm: 'staff.manage' },
  { to: 'settings', label: 'Pengaturan', icon: 'gear', perm: 'settings.manage' },
  { to: 'subscription', label: 'Langganan', icon: 'layers', perm: 'settings.manage' },
  { to: 'help', label: 'Bantuan', icon: 'help', perm: 'settings.manage', badge: 'help' },
];

// Bunyi singkat untuk pesanan baru (hanya berbunyi setelah pengguna pernah berinteraksi dengan halaman).
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ac = new Ctx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.35);
  } catch {
    /* browser menolak audio: abaikan */
  }
}

export default function DashboardLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useDb((db) => {
    const ctx = staffContext(db, session);
    if (!ctx) return null;
    const r = db.restaurants.find((x) => x.id === ctx.rid);
    const orders = db.orders.filter((o) => o.restaurant_id === ctx.rid);
    const sub = currentSubscription(db, ctx.rid);
    return {
      ...ctx,
      restaurant: r,
      settings: settingsOf(db, ctx.rid),
      subState: subscriptionState(db, ctx.rid),
      daysLeft: sub ? Math.ceil((sub.ends_at - serverNow()) / DAY) : 0,
      newOrders: orders.filter((o) => !o.cancelled && o.kitchen_status === 'waiting'),
      phase: subscriptionPhase(db, ctx.rid),
      plan: planOf(db, ctx.rid),
      needCount: orders.filter((o) => orderNeed(o, ctx.roles, settingsOf(db, ctx.rid))).length,
      kitchenCount: orders.filter((o) => !o.cancelled && o.kitchen_status === 'accepted').length,
      helpCount: db.support_tickets.filter((t) => t.restaurant_id === ctx.rid && t.owner_unread > 0).length,
      notice: db.platform_notice || null,
      serveCount: orders.filter((o) => !o.cancelled && o.serving_status === 'waiting_pickup').length,
    };
  });

  // Notifikasi pesanan baru secara real-time.
  const seen = useRef(null);
  useEffect(() => {
    if (!data) return;
    const ids = data.newOrders.map((o) => o.id);
    if (seen.current) {
      const fresh = data.newOrders.filter((o) => !seen.current.has(o.id));
      if (fresh.length && can(data.roles, 'orders.view') && data.settings.notify_new_order) {
        fresh.forEach((o) => toast(`Pesanan baru ${o.order_number}`, 'success'));
        if (data.settings.notify_sound) beep();
      }
    }
    seen.current = new Set(ids);
  }, [data, toast]);

  if (!session) return <Navigate to="/login" replace />;
  if (session.kind === 'admin') return <Navigate to="/admin" replace />;
  if (session.kind === 'onboarding') return <Navigate to="/daftar" replace />;
  if (!data) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1 style={{ fontSize: 18 }}>Akses dicabut</h1>
          <p className="muted">Akunmu sudah tidak terhubung ke restoran ini. Hubungi owner.</p>
          <button type="button" className="btn btn-primary" onClick={() => { logout(); navigate('/login'); }}>Kembali ke halaman masuk</button>
        </div>
      </div>
    );
  }

  // Menu dapur dan waiter hanya tampil jika konfigurasi punya perangkat untuk itu.
  // Mode manual (Basic, atau Standard tanpa tablet): kasir mencatat status dapur dan penyajian di halaman Pesanan.
  const manual = isManual(data.settings);
  const items = DASH_NAV.filter((n) => can(data.roles, n.perm));
  const badge = (n) => (n.badge === 'new' ? data.needCount : n.badge === 'kitchen' ? data.kitchenCount : n.badge === 'serve' ? data.serveCount : n.badge === 'help' ? data.helpCount : 0);
  const links = (cls) =>
    items.map((n) => (n.device && manual ? (
      <span key={n.to} className={`nav-link ${cls || ''} locked`} aria-disabled="true" title="Tidak dipakai di konfigurasi ini. Kasir mencatat statusnya dari halaman Pesanan.">
        <Icon name={n.icon} size={18} /><span>{n.label}</span><Icon name="lock" size={14} />
      </span>
    ) : (
      <NavLink key={n.to} to={`/dashboard/${n.to}`} className={({ isActive }) => `nav-link ${cls || ''} ${isActive ? 'active' : ''}`}>
        <Icon name={n.icon} size={18} />
        <span>{n.label}</span>
        {badge(n) > 0 && <span className="nav-count">{badge(n)}</span>}
      </NavLink>
    )));

  // Bilah panel demo tampil di atas dashboard, kecuali saat dashboard dimuat di bingkai perangkat (halaman Simulasi).
  const embedded = typeof window !== 'undefined' && window.self !== window.top;
  return (
    <>
    {!embedded && <div className="demobar-wrap"><DemoBar /></div>}
    <div className="shell">
      <aside className="sidebar" aria-label="Navigasi dashboard">
        <a className="brand" href="/"><span className="brand-logo"><Icon name="qr" size={18} /></span>MenuKlik</a>
        <div className="whoami">
          <span className="tag">{data.restaurant.name}</span>
          <b>{session.name}</b>
          <span className="small muted">{roleLabels(data.roles)}</span>
          <span className="small muted">Konfigurasi {CONFIGS[data.settings.config].name}</span>
          <span className={`pill tone-${SUB_PHASE[data.phase].tone}`}>{SUB_PHASE[data.phase].label}</span>
          <span className="small muted">Paket {data.plan?.name || '-'} · {data.daysLeft >= 0 ? `sisa ${data.daysLeft} hari` : `lewat ${-data.daysLeft} hari`}</span>
        </div>
        {links()}
        <NavLink to="/" end className="nav-link"><Icon name="home" size={18} /><span>Ke landing page</span></NavLink>
        <NavLink to="/coba" className="nav-link"><Icon name="phone" size={18} /><span>Coba sebagai pelanggan</span></NavLink>
        <div className="sidebar-spacer" />
        <button type="button" className="nav-link" onClick={() => { logout(); navigate('/login'); }}><Icon name="out" size={18} />Keluar</button>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <b>{data.restaurant.name}</b>
            <span className="small muted">{session.name} · {roleLabels(data.roles)}</span>
          </div>
          {data.subState === 'trial' && <Pill tone="amber" label={`Uji coba, sisa ${data.daysLeft} hari`} />}
          <button type="button" className="icon-btn" aria-label="Keluar" title="Keluar" onClick={() => { logout(); navigate('/login'); }}><Icon name="out" size={17} /></button>
        </header>
        {data.notice && (
          <div className="content" style={{ paddingBottom: 0 }}>
            <div className="banner tone-amber"><Icon name="bell" /> <span><b>Info dari MenuKlik:</b> {data.notice.text}</span></div>
          </div>
        )}
        {(data.subState === 'expired' || data.subState === 'suspended') && (
          <div className="content" style={{ paddingBottom: 0 }}>
            <div className="banner tone-red"><Icon name="lock" /> Langganan tidak aktif. Pelanggan tidak bisa memesan lewat QR sampai langganan diperpanjang.</div>
          </div>
        )}
        <main className="content">
          <Outlet context={data} />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navigasi dashboard">{links()}</nav>
    </div>
    </>
  );
}

export function DashboardIndex() {
  const { session } = useAuth();
  const roles = session?.roles;
  const first = DASH_NAV.find((n) => can(roles, n.perm));
  return <Navigate to={first ? `/dashboard/${first.to}` : '/login'} replace />;
}
