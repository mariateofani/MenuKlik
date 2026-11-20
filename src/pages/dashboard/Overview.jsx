import { Link, useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import { currentSubscription, getReport, planOf, selectActivity, selectTables, serverNow, shiftTime, subscriptionPhase, platformSettings } from '../../services/api.js';
import { BarChart, Card, Empty, Forbidden, HBar, PageHeader, Pill, Stat } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { can, CHANNELS, historyLabel, SUB_PHASE } from '../../lib/constants.js';
import { DAY, dateShort, rp, startOfDay, time } from '../../lib/format.js';

export default function Overview() {
  const { rid, roles, restaurant } = useOutletContext();
  const { session } = useAuth();
  const data = useDb((db) => {
    const today = getReport(db, rid, startOfDay(Date.now()), Date.now() + DAY);
    const week = getReport(db, rid, startOfDay(Date.now() - 6 * DAY), Date.now() + DAY);
    const sub = currentSubscription(db, rid);
    return {
      today, week, activity: selectActivity(db, rid, 10), tables: selectTables(db, rid), sub, plan: planOf(db, rid), phase: subscriptionPhase(db, rid), nowMs: serverNow(),
      offset: db.time_offset || 0, grace: platformSettings(db).grace_days,
      counts: { menu: db.products.filter((x) => x.restaurant_id === rid && !x.is_archived).length, qr: db.qr_codes.filter((x) => x.restaurant_id === rid && x.is_active).length, staff: db.restaurant_members.filter((x) => x.restaurant_id === rid && x.is_active).length },
    };
  });
  if (!can(roles, 'dashboard.view')) return <Forbidden />;
  const { today, week, activity, tables, sub, plan, phase, nowMs, counts } = data;
  const daysLeft = sub ? Math.ceil((sub.ends_at - nowMs) / DAY) : 0;
  const total = sub ? Math.max(1, Math.round((sub.ends_at - sub.started_at) / DAY)) : 1;
  const pct = Math.max(0, Math.min(100, Math.round((daysLeft / total) * 100))); // sisa masa aktif
  const notices = sub ? [[7, 'Langganan berakhir dalam 7 hari'], [1, 'Langganan berakhir dalam 1 hari'], [0, 'Masa langganan berakhir']].map(([d, t]) => ({ t, at: sub.ends_at - d * DAY })) : [];
  const shift = (days, jump) => shiftTime(session, days, jump);
  const live = today.orders.filter((o) => !o.cancelled);
  const waiting = live.filter((o) => o.kitchen_status === 'waiting').length;
  const inKitchen = live.filter((o) => ['accepted', 'preparing'].includes(o.kitchen_status)).length;
  const pickup = live.filter((o) => o.serving_status === 'waiting_pickup').length;
  const done = live.filter((o) => o.serving_status === 'delivered' && o.payment_status === 'paid').length;
  const mx = Math.max(today.methods.digital.count, today.methods.cashier.count, 1);
  const topMax = today.topItems[0]?.qty || 1;

  return (
    <>
      <PageHeader title="Ringkasan" subtitle={`Selamat datang, ${session.name}.`}>
        <Link className="btn btn-primary" to="/dashboard/orders">Buka pesanan</Link>
      </PageHeader>
      <div className="stats">
        <Stat label="Pesanan hari ini" value={today.orderCount} />
        <Stat label="Menunggu kasir" value={waiting} highlight={waiting > 0} />
        <Stat label="Sedang diproses" value={inKitchen + pickup} />
        <Stat label="Penjualan lunas" value={rp(today.sales)} />
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        <Card title={restaurant.name} actions={<Pill tone={SUB_PHASE[phase].tone} label={SUB_PHASE[phase].label} />}>
          <span className="tag">{restaurant.category || 'Restoran'}</span>
          <div className="feat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            {[['Paket', plan?.name || '-'], ['Mulai', sub ? dateShort(sub.started_at) : '-'], ['Berlaku sampai', sub ? dateShort(sub.ends_at) : '-'], ['Sisa masa aktif', daysLeft >= 0 ? `${daysLeft} hari` : `lewat ${-daysLeft} hari`]].map(([k, v]) => <div key={k} className="card stack" style={{ gap: 4, padding: 10 }}><span className="small muted">{k}</span><b style={{ fontSize: 17 }}>{v}</b></div>)}
          </div>
          <div className="progress-bar" aria-label={`Sisa masa langganan ${pct}%`}><span style={{ width: `${pct}%` }} /></div>
          <div className="row">
            <Link className="btn btn-primary" to="/dashboard/subscription">Kelola langganan</Link>
            <Link className="btn" to="/dashboard/menu">Kelola menu</Link>
            <Link className="btn" to="/dashboard/tables">Meja & QR</Link>
            <Link className="btn" to="/simulasi">Buka simulasi operasional</Link>
          </div>
        </Card>
        <Card title="Langkah awal">
          <ul className="feat-list">
            {[['Profil usaha diisi', true], ['Paket dipilih', !!plan], [`Menu ditambahkan (${counts.menu})`, counts.menu > 0], [`QR Code meja dibuat (${counts.qr})`, counts.qr > 0], [`Pegawai diundang (${counts.staff})`, counts.staff > 1]].map(([l, ok]) => <li key={l} className={ok ? '' : 'off'}><Icon name={ok ? 'check' : 'x'} size={14} />{l}</li>)}
          </ul>
        </Card>
      </div>
      <div className="grid-2">
        <Card title="Pemberitahuan langganan">
          {notices.map((n) => <div key={n.t} className="row-between"><span className="row" style={{ flexWrap: 'nowrap' }}><Icon name="bell" size={14} />{n.t}</span><Pill tone={n.at <= nowMs ? 'green' : 'muted'} label={`${n.at <= nowMs ? 'Terkirim' : 'Terjadwal'} ${dateShort(n.at)}`} /></div>)}
          <p className="small muted">Dikirim lewat email dan notifikasi dashboard (simulasi).</p>
        </Card>
        <Card title="Restoran saya">
          <div className="card stack" style={{ gap: 2, borderColor: 'var(--green)' }}><div className="row-between"><b>{restaurant.name}</b><Pill tone="green" label="Aktif" /></div><span className="small muted">{restaurant.address}</span></div>
          <button type="button" className="btn btn-block" disabled>+ Tambah restoran lain</button>
          <p className="small muted">Satu akun dengan beberapa restoran belum tersedia di versi ini.</p>
        </Card>
      </div>
      <div className="sim-card">
        <div className="row-between"><span className="tag" style={{ color: 'var(--violet)' }}>Simulasi waktu (khusus demo)</span><span className="small">Tanggal simulasi: <b>{dateShort(nowMs)}</b></span></div>
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => shift(1)}>+1 hari</button>
          <button type="button" className="btn btn-sm" onClick={() => shift(7)}>+7 hari</button>
          <button type="button" className="btn btn-sm" onClick={() => shift(0, -2)}>2 hari sebelum berakhir</button>
          <button type="button" className="btn btn-sm" onClick={() => shift(0, 1)}>1 hari setelah berakhir</button>
          <button type="button" className="btn btn-sm" onClick={() => shift(0, data.grace + 1)}>Lewat masa tenggang</button>
          {data.offset ? <button type="button" className="btn btn-sm" onClick={() => shift(0)}>Kembali ke hari ini</button> : null}
        </div>
      </div>
      <h2 style={{ fontSize: 16 }}>Analitik operasional</h2>
      <div className="grid-2">
        <Card title="Penjualan 7 hari terakhir">
          <BarChart data={week.series.map((d) => ({ label: new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' }), value: d.sales }))} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}rb` : v)} />
          <div className="row-between small muted"><span>Total 7 hari</span><b className="num" style={{ color: 'var(--fg)' }}>{rp(week.sales)}</b></div>
        </Card>
        <Card title="Pesanan lunas per metode (hari ini)">
          <HBar label="Bayar digital" value={today.methods.digital.count} max={mx} display={`${today.methods.digital.count} · ${rp(today.methods.digital.amount)}`} />
          <HBar label="Bayar di kasir" value={today.methods.cashier.count} max={mx} display={`${today.methods.cashier.count} · ${rp(today.methods.cashier.amount)}`} alt />
          <h2 style={{ fontSize: 15, marginTop: 6 }}>Menu terlaris hari ini</h2>
          {today.topItems.length ? today.topItems.slice(0, 5).map((t) => <HBar key={t.name} label={t.name} value={t.qty} max={topMax} display={`${t.qty} porsi`} />) : <p className="muted">Belum ada pesanan hari ini.</p>}
        </Card>
      </div>
      <div className="grid-2">
        <Card title="Aktivitas terbaru">
          {activity.length ? (
            <div className="feed">
              {activity.map((a, i) => (
                <div key={i} className="feed-item">
                  <span className="mono muted">{time(a.at)}</span>
                  {a.kind === 'paid' ? (
                    <span><b className="mono">{a.order}</b> lunas {rp(a.amount)} <span className="muted">via {CHANNELS[a.channel]}</span></span>
                  ) : (
                    <span><b className="mono">{a.order}</b> {historyLabel(a.hkind, a.status)} <span className="muted">· {a.device && a.device !== '-' ? a.device : a.by}</span></span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Belum ada aktivitas" />
          )}
        </Card>
        <Card title="Meja" actions={<Link className="btn btn-sm" to="/dashboard/tables">Kelola</Link>}>
          <div className="chips wrap">
            {tables.map((t) => (
              <span key={t.id} className="chip" style={{ cursor: 'default' }}>
                Meja {t.name}
                {!t.is_active ? <span className="chip-n">nonaktif</span> : t.activeOrders > 0 ? <span className="chip-n">{t.activeOrders} aktif</span> : <span className="chip-n">kosong</span>}
              </span>
            ))}
          </div>
          <div className="pills">
            <Pill tone="green" label={`${tables.filter((t) => t.activeOrders > 0).length} meja punya pesanan aktif`} />
          </div>
        </Card>
      </div>
    </>
  );
}
