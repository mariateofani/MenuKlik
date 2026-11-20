import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { adminGrantedOrders, adminRestaurantRows, assignPlan, extendSubscription, requestDataAccess, setRestaurantStatus } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Chips, Drawer, Field, PageHeader, Pill } from '../../components/ui.jsx';
import { dateShort, dateTime, rp } from '../../lib/format.js';

export default function AdminRestaurants() {
  const { session } = useOutletContext();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [selId, setSelId] = useState(null);
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState('plan_basic');
  const d = useDb((db) => ({ rows: adminRestaurantRows(db), plans: db.plans.filter((p) => p.id !== 'plan_trial') }));
  const sel = d.rows.find((r) => r.id === selId);
  const granted = useDb((db) => {
    if (!sel?.grant) return null;
    try {
      return adminGrantedOrders(db, session, sel.id);
    } catch {
      return null;
    }
  });

  const run = (fn, msg) => {
    try {
      fn();
      toast(msg, 'success');
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };
  const list = d.rows.filter((r) => filter === 'all' || r.subState === filter);
  const count = (s) => d.rows.filter((r) => r.subState === s).length;

  return (
    <>
      <PageHeader title="Akun restoran" subtitle="Kelola status akun dan langganan. Data pesanan hanya bisa dilihat dengan izin pemilik restoran." />
      <Chips label="Filter" value={filter} onChange={setFilter} options={[['all', 'Semua', d.rows.length], ['trial', 'Uji coba', count('trial')], ['active', 'Berlangganan', count('active')], ['expired', 'Habis masa', count('expired')], ['suspended', 'Ditangguhkan', count('suspended')]]} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Restoran</th><th>Pemilik</th><th>Status</th><th>Paket</th><th>Berakhir</th><th className="r">Meja</th><th className="r">Pegawai</th><th className="r">Pesanan 7 hari</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => setSelId(r.id)}>
                <td><b>{r.name}</b></td>
                <td>{r.owner?.name || '-'}<br /><small className="muted">{r.owner?.email}</small></td>
                <td><Pill type="sub" value={r.subState} /></td>
                <td>{r.plan?.name || '-'}</td>
                <td className="num">{r.subscription ? dateShort(r.subscription.ends_at) : '-'}</td>
                <td className="r num">{r.tableCount}</td>
                <td className="r num">{r.memberCount}</td>
                <td className="r num">{r.orders7d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={!!sel} title={sel?.name || ''} onClose={() => { setSelId(null); setReason(''); }}>
        {sel && (
          <>
            <dl className="kv">
              <dt>Status</dt><dd><Pill type="sub" value={sel.subState} /></dd>
              <dt>Paket</dt><dd>{sel.plan?.name || '-'}</dd>
              <dt>Berakhir</dt><dd>{sel.subscription ? `${dateShort(sel.subscription.ends_at)} (${sel.daysLeft} hari)` : '-'}</dd>
              <dt>Alamat</dt><dd>{sel.address}</dd>
              <dt>Kontak</dt><dd>{sel.phone}</dd>
            </dl>
            <div className="stack">
              <span className="tag">Langganan</span>
              <div className="row">
                <Button size="sm" onClick={() => run(() => extendSubscription(session, sel.id, 7), 'Diperpanjang 7 hari')}>Perpanjang 7 hari</Button>
                <select className="input" style={{ width: 'auto' }} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Paket">
                  {d.plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({rp(p.price_monthly)})</option>)}
                </select>
                <Button size="sm" variant="primary" onClick={() => run(() => assignPlan(session, sel.id, plan), 'Paket diaktifkan dan tagihan dicatat')}>Aktifkan paket</Button>
              </div>
            </div>
            <div className="stack">
              <span className="tag">Status akun</span>
              {sel.status === 'suspended' ? (
                <Button size="sm" variant="primary" onClick={() => run(() => setRestaurantStatus(session, sel.id, 'active'), 'Akun diaktifkan kembali')}>Aktifkan kembali</Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => run(() => setRestaurantStatus(session, sel.id, 'suspended'), 'Akun ditangguhkan')}>Tangguhkan akun</Button>
              )}
              <p className="small muted">Akun yang ditangguhkan tidak bisa menerima pesanan dari QR.</p>
            </div>
            <div className="stack">
              <span className="tag">Akses data transaksi</span>
              {sel.grant ? (
                <>
                  <p className="alert alert-ok">Disetujui {sel.grant.decided_by} sampai {dateTime(sel.grant.expires_at)}. Alasan: {sel.grant.reason}</p>
                  {granted?.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>No.</th><th>Waktu</th><th className="r">Total</th><th>Status</th></tr></thead>
                        <tbody>{granted.map((o) => <tr key={o.id}><td className="mono">{o.order_number}</td><td>{dateTime(o.created_at)}</td><td className="r num">{rp(o.total)}</td><td><Pill tone={o.cancelled ? 'red' : o.serving_status === 'delivered' ? 'muted' : 'blue'} label={o.cancelled ? 'Dibatalkan' : o.serving_status === 'delivered' ? 'Diantar' : 'Aktif'} /> <Pill type="payment" value={o.payment_status} /></td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="muted small">Belum ada pesanan.</p>}
                  <p className="small muted">Nama pelanggan dan catatan tidak ditampilkan, walaupun izin sudah diberikan.</p>
                </>
              ) : sel.pendingRequest ? (
                <p className="alert alert-warn">Menunggu jawaban pemilik restoran. Alasan: {sel.pendingRequest.reason}</p>
              ) : (
                <form className="stack" onSubmit={(e) => { e.preventDefault(); if (run(() => requestDataAccess(session, sel.id, reason), 'Permintaan dikirim ke pemilik restoran')) setReason(''); }}>
                  <Field label="Alasan operasional" hint="Contoh: menelusuri laporan pembayaran ganda dari tiket bantuan." htmlFor="acc-reason">
                    <textarea id="acc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} />
                  </Field>
                  <Button size="sm" type="submit">Minta izin akses</Button>
                  <p className="small muted">Pemilik menyetujui atau menolak di Pengaturan, tab Akses data. Izin berlaku 24 jam dan tercatat.</p>
                </form>
              )}
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
