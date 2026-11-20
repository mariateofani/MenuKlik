import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { selectPayments, togglePosRecorded } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Chips, Drawer, Empty, Forbidden, PageHeader, Pill, Segmented, Stat } from '../../components/ui.jsx';
import { can, CHANNELS } from '../../lib/constants.js';
import { DAY, dateTime, rp, startOfDay, time } from '../../lib/format.js';

const SOURCE = { gateway: 'Payment gateway', staff: 'Pegawai', system: 'Sistem' };

export default function Payments() {
  const { rid, roles } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState('today');
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [selId, setSelId] = useState(null);
  const from = range === 'today' ? startOfDay(Date.now()) : startOfDay(Date.now() - 6 * DAY);
  const payments = useDb((db) => selectPayments(db, rid, { from, to: Date.now() + DAY }));
  const list = useMemo(() => payments.filter((p) => (status === 'all' || p.status === status) && (method === 'all' || p.method === method)), [payments, status, method]);
  if (!can(roles, 'payments.view')) return <Forbidden />;
  const sel = payments.find((p) => p.id === selId);
  const togglePos = (orderId) => {
    try { togglePosRecorded(session, orderId); } catch (e) { toast(e.message, 'error'); }
  };
  const paidList = payments.filter((p) => p.status === 'paid');
  const cashIn = paidList.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  const digitalIn = paidList.filter((p) => p.method === 'digital').reduce((a, p) => a + p.amount, 0);
  const sum = (s) => payments.filter((p) => p.status === s).reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <PageHeader title="Pembayaran & kas" subtitle="Status pembayaran digital hanya berubah dari notifikasi resmi payment gateway. Pembayaran tunai dikonfirmasi kasir dari halaman Pesanan.">
        <Segmented label="Periode" value={range} onChange={setRange} options={[['today', 'Hari ini'], ['7d', '7 hari']]} />
      </PageHeader>
      <div className="stats">
        <Stat label="Tunai diterima" value={rp(cashIn)} />
        <Stat label="Digital lunas" value={rp(digitalIn)} />
        <Stat label="Lunas" value={rp(sum('paid'))} hint={`${payments.filter((p) => p.status === 'paid').length} transaksi`} />
        <Stat label="Menunggu" value={rp(sum('pending'))} hint={`${payments.filter((p) => p.status === 'pending').length} transaksi`} highlight={payments.some((p) => p.status === 'pending')} />
        <Stat label="Dikembalikan" value={rp(sum('refunded'))} />
        <Stat label="Gagal / kedaluwarsa" value={payments.filter((p) => ['failed', 'expired'].includes(p.status)).length} />
      </div>
      <div className="row">
        <Chips label="Status" value={status} onChange={setStatus} options={[['all', 'Semua'], ['pending', 'Belum dibayar'], ['paid', 'Lunas'], ['failed', 'Gagal'], ['expired', 'Kedaluwarsa'], ['refunded', 'Dikembalikan']]} />
        <Segmented label="Metode" value={method} onChange={setMethod} options={[['all', 'Semua'], ['digital', 'Digital'], ['cash', 'Tunai']]} />
      </div>
      {list.length === 0 ? (
        <Empty title="Tidak ada transaksi" icon="wallet" />
      ) : (
        <div className="table-wrap">
          <p className="note">MenuKlik tidak menggantikan POS di MVP. Aktifkan setelah transaksi dicatat di mesin kasir atau buku kas lama, agar tidak ada yang terlewat atau tercatat dua kali.</p>
          <table>
            <thead><tr><th>No. transaksi</th><th>Pesanan</th><th>Metode</th><th className="r">Nominal</th><th>Dibuat</th><th>Dibayar</th><th>Status</th><th>Ref. gateway</th><th>Dicatat di POS/buku kas</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setSelId(p.id)}>
                  <td className="mono">{p.payment_number}</td>
                  <td className="mono">{p.order?.order_number}</td>
                  <td>{CHANNELS[p.channel]}</td>
                  <td className="r num">{rp(p.amount)}</td>
                  <td className="num">{time(p.created_at)}</td>
                  <td className="num">{p.paid_at ? time(p.paid_at) : '-'}</td>
                  <td><Pill type="payment" value={p.status} /></td>
                  <td className="mono muted">{p.gateway_ref || '-'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {p.status === 'paid' && p.order ? (
                      <button type="button" className="switch" role="switch" aria-checked={!!p.order.pos_recorded} onClick={() => togglePos(p.order.id)}>
                        <span className="switch-track" />{p.order.pos_recorded ? 'Sudah' : 'Belum'}
                      </button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Drawer open={!!sel} title={sel ? `Transaksi ${sel.payment_number}` : ''} onClose={() => setSelId(null)}>
        {sel && (
          <>
            <dl className="kv num">
              <dt>Pesanan</dt><dd className="mono">{sel.order?.order_number}</dd>
              <dt>Metode</dt><dd>{CHANNELS[sel.channel]}</dd>
              <dt>Nominal</dt><dd>{rp(sel.amount)}</dd>
              <dt>Status</dt><dd><Pill type="payment" value={sel.status} /></dd>
              <dt>Dibuat</dt><dd>{dateTime(sel.created_at)}</dd>
              <dt>Dibayar</dt><dd>{sel.paid_at ? dateTime(sel.paid_at) : '-'}</dd>
              <dt>Ref. gateway</dt><dd className="mono">{sel.gateway_ref || '-'}</dd>
            </dl>
            <div className="stack" style={{ gap: 6 }}>
              <span className="tag">Riwayat event (payment_events)</span>
              <div className="history">
                {sel.events.map((e) => (
                  <div key={e.id}>
                    <span className="mono">{time(e.created_at)}</span>
                    <span>{e.summary} <span className="muted">· {SOURCE[e.source]}</span>{e.gateway_event_id && <span className="mono muted"> · {e.gateway_event_id}</span>}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="note">Setiap notifikasi gateway punya ID unik. Notifikasi dengan ID yang sama diabaikan, sehingga satu pembayaran tidak tercatat dua kali.</p>
          </>
        )}
      </Drawer>
    </>
  );
}
