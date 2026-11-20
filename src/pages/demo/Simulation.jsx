import { useEffect, useState } from 'react';
import { Navigate, Outlet, useSearchParams, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { useNow } from '../../hooks/useNow.js';
import { currentQr, login, placeOrder, selectOrders, settingsOf, updateSettings } from '../../services/api.js';
import { DEMO_PASSWORD, MAIN_RESTAURANT_ID } from '../../services/seed.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Pill, Segmented, StatusTrio } from '../../components/ui.jsx';
import DemoBar from '../../components/DemoBar.jsx';
import { Icon } from '../../lib/icons.jsx';
import { CONFIGS, deviceLabel, historyLabel, isActiveOrder, orderOverall } from '../../lib/constants.js';
import { startOfDay, time, uid } from '../../lib/format.js';

const R = MAIN_RESTAURANT_ID;
const USERS = [['owner@kedairasa.test', 'Ratna · Owner'], ['cashier@kedairasa.test', 'Dimas · Kasir/Waiter'], ['kitchen@kedairasa.test', 'Joko · Dapur'], ['waiter@kedairasa.test', 'Sari · Waiter']];
const DEVICES = {
  customer: { label: 'HP pelanggan', icon: 'phone', phone: true },
  owner: { label: 'HP pemilik', icon: 'phone', phone: true, user: 0, to: '/dashboard/orders' },
  cashier: { label: 'Komputer kasir', icon: 'monitor', user: 1, to: '/dashboard/orders', wide: true },
  tablet: { label: 'Tablet bersama', icon: 'monitor', user: 2, to: '/dashboard/tablet' },
  kds: { label: 'Monitor dapur (KDS)', icon: 'fire', user: 2, to: '/dashboard/kitchen' },
  waiter: { label: 'HP waiter', icon: 'walk', phone: true, user: 3, to: '/dashboard/waiter' },
};
const layoutFor = (s) => (s.config === 'basic' ? ['customer', 'owner'] : s.config === 'standard' ? (s.shared_tablet ? ['customer', 'cashier', 'tablet'] : ['customer', 'cashier']) : ['customer', 'cashier', 'kds', 'waiter', 'owner']);

// Kerangka halaman demo: hanya bilah panel demo di atas.
export function DemoLayout() {
  return (
    <div className="site" style={{ maxWidth: 1500 }}>
      <DemoBar />
      <main className="site-body" style={{ paddingTop: 0 }}><Outlet /></main>
    </div>
  );
}

// Pintu masuk perangkat (dipakai di dalam iframe): masuk otomatis dengan akun demo lalu menuju layar perangkat.
export function DeviceEntry() {
  const [sp] = useSearchParams();
  const { signIn } = useAuth();
  const [to] = useState(sp.get('to') || '/dashboard');
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { signIn(login(sp.get('as'), DEMO_PASSWORD)); } catch (e) { setErr(e.message); }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="alert alert-error" style={{ margin: 16 }}>{err}</p>;
  return ready ? <Navigate to={to} replace /> : null;
}

function Node({ icon, name, sub, state }) {
  return <div className={`node ${state}`}><span className="ring"><Icon name={icon} size={20} /></span><b>{name}</b><small>{sub}</small></div>;
}

function laneOf(o, s) {
  if (o.cancelled) return { states: ['done', 'bad', 'todo', 'todo', 'todo'], subs: ['Pesanan dikirim', `Dibatalkan: ${o.cancel_reason}`, '', '', ''] };
  const k = o.kitchen_status;
  const paySub = o.payment_status === 'paid' ? 'Sudah dibayar' : o.payment_method === 'digital' ? 'Menunggu pembayaran digital' : 'Menunggu bayar tunai';
  if (o.serving_status === 'delivered') {
    const paid = o.payment_status === 'paid';
    return { states: ['done', paid ? 'done' : 'warn', 'done', 'done', paid ? 'done' : 'todo'], subs: ['Pesanan dikirim', paid ? 'Sudah dibayar' : 'Tagih pembayaran', deviceLabel(s, 'kitchen'), deviceLabel(s, 'waiter'), paid ? 'Lunas dan diantar' : 'Belum lunas'] };
  }
  if (k === 'waiting') return { states: ['done', 'now', 'todo', 'todo', 'todo'], subs: ['Pesanan dikirim', o.payment_status === 'paid' ? 'Menunggu diterima kasir' : paySub, deviceLabel(s, 'kitchen'), deviceLabel(s, 'waiter'), 'Lunas dan diantar'] };
  if (k === 'accepted' || k === 'preparing') return { states: ['done', 'done', 'now', 'todo', 'todo'], subs: ['Pesanan dikirim', 'Diterima kasir', k === 'preparing' ? 'Sedang dimasak' : 'Antre di dapur', deviceLabel(s, 'waiter'), 'Lunas dan diantar'] };
  return { states: ['done', 'done', 'done', 'now', 'todo'], subs: ['Pesanan dikirim', 'Diterima kasir', 'Sudah siap', o.serving_status === 'picked_up' ? 'Sedang diantar' : 'Menunggu diambil', 'Lunas dan diantar'] };
}

function DeviceFrame({ kind, tables }) {
  const d = DEVICES[kind];
  const [user, setUser] = useState(d.user ?? 0);
  const [table, setTable] = useState(tables[1]?.token || tables[0]?.token);
  const src = kind === 'customer' ? `/t/${table}` : `/device/entry?as=${USERS[user][0]}&to=${encodeURIComponent(d.to)}`;
  return (
    <section className={`dev ${d.wide ? 'dev-wide' : ''}`} aria-label={d.label}>
      <header className="dev-head">
        <b><Icon name={d.icon} size={15} /> {d.label}</b>
        {kind === 'customer'
          ? <select aria-label="Scan QR meja" value={table} onChange={(e) => setTable(e.target.value)}>{tables.map((t) => <option key={t.token} value={t.token}>Scan QR: Meja {t.name}</option>)}</select>
          : <select aria-label={`Akun di ${d.label}`} value={user} onChange={(e) => setUser(+e.target.value)}>{USERS.map(([, n], i) => <option key={n} value={i}>{n}</option>)}</select>}
      </header>
      <iframe key={src} title={d.label} className={d.phone ? 'dev-frame phone' : 'dev-frame'} src={src} />
    </section>
  );
}

export default function Simulation() {
  const toast = useToast();
  const now = useNow(30000);
  const [selId, setSelId] = useState(null);
  const d = useDb((db) => ({
    s: settingsOf(db, R),
    orders: selectOrders(db, R, { from: startOfDay(Date.now() - 6 * 86400000), to: Date.now() + 86400000 }),
    tables: db.tables.filter((t) => t.restaurant_id === R && !t.is_archived && t.is_active).map((t) => ({ name: t.name, token: currentQr(db, t.id)?.token })),
  }));
  const owner = () => login('owner@kedairasa.test', DEMO_PASSWORD);
  const set = (patch) => { try { updateSettings(owner(), patch); } catch (e) { toast(e.message, 'error'); } };
  const recent = [...d.orders].sort((a, b) => b.created_at - a.created_at).slice(0, 4);
  const sel = d.orders.find((o) => o.id === selId) || recent.find(isActiveOrder) || recent[0];
  const lane = sel && laneOf(sel, d.s);
  const addOrder = () => {
    try {
      const tk = d.tables[1] || d.tables[0];
      const r = placeOrder({ token: tk.token, lines: [{ productId: 'p_nasgor', optionIds: ['p_nasgor_0'], qty: 1 }, { productId: 'p_esteh', optionIds: [], qty: 1 }], customerName: 'Andi', paymentMethod: 'cashier', idempotencyKey: uid('sim_') });
      setSelId(r.order.id);
      toast(`Pesanan ${r.order.order_number} dikirim dari HP Andi`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  const devices = layoutFor(d.s);

  return (
    <div className="stack-lg">
      <section className="card stack">
        <div className="row-between">
          <div><span className="tag">Jalur pesanan · konfigurasi {CONFIGS[d.s.config].name}</span><h2 style={{ fontSize: 20 }}>{sel ? <><span className="mono">{sel.order_number}</span> · Meja {sel.table?.name}{sel.customer_name ? ` · ${sel.customer_name}` : ''}</> : 'Belum ada pesanan'}</h2></div>
          <div className="row">{sel && <Pill tone={orderOverall(sel).tone} label={orderOverall(sel).label} />}<Button variant="cta" size="sm" icon="cart" onClick={addOrder}>Isi keranjang Andi</Button></div>
        </div>
        {sel && (
          <>
            <div className="lane">
              {[['phone', 'Pelanggan'], ['monitor', 'Kasir'], ['fire', 'Dapur'], ['walk', 'Waiter'], ['flag', 'Selesai']].map(([i, n], k) => <Node key={n} icon={i} name={n} sub={lane.subs[k]} state={lane.states[k]} />)}
            </div>
            <div className="grid-2">
              <div className="stack" style={{ gap: 6 }}><span className="tag">Tiga status, tampil bersamaan</span><StatusTrio order={sel} /></div>
              <div className="stack" style={{ gap: 6 }}><span className="tag">Riwayat · siapa, di perangkat apa</span>
                <div className="history">{sel.history.map((h) => <div key={h.id}><span className="mono">{time(h.created_at)}</span><span><b>{historyLabel(h.kind, h.to_status)}</b> <span className="muted">· {h.changed_by_label}{h.device && h.device !== '-' ? ` · ${h.device}` : ''}</span></span></div>)}</div></div>
            </div>
            <div className="row"><span className="small muted">Pantau pesanan lain:</span>{recent.map((o) => <button key={o.id} type="button" className="chip" aria-pressed={o.id === sel.id} onClick={() => setSelId(o.id)}>{o.order_number}</button>)}</div>
          </>
        )}
      </section>
      <div className="row-between">
        <div><span className="tag">Perangkat dalam konfigurasi {CONFIGS[d.s.config].name}</span><p className="small muted">Ganti akun di tiap perangkat untuk menguji multi-peran. Semua perangkat membaca data yang sama dan berubah bersamaan.</p></div>
        <div className="row">
          <Segmented label="Konfigurasi" value={d.s.config} onChange={(v) => set({ config: v })} options={Object.entries(CONFIGS).map(([k, c]) => [k, c.name])} />
          {d.s.config === 'standard' && <label className="small row" style={{ gap: 6 }}><input type="checkbox" checked={d.s.shared_tablet} onChange={(e) => set({ shared_tablet: e.target.checked })} /> Pakai tablet bersama untuk dapur & waiter</label>}
        </div>
      </div>
      <div className="dev-grid">{devices.map((k) => <DeviceFrame key={k} kind={k} tables={d.tables} />)}</div>
    </div>
  );
}
