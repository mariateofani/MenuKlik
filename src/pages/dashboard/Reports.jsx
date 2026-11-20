import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { getReport } from '../../services/api.js';
import { BarChart, Button, Card, Empty, Field, Forbidden, HBar, PageHeader, Pill, Stat } from '../../components/ui.jsx';
import { can, orderOverall, PAYMENT_METHOD, PAYMENT_STATUS } from '../../lib/constants.js';
import { DAY, dateShort, dateTime, downloadText, fromDateInput, rp, startOfDay, toCsv, toDateInput } from '../../lib/format.js';

export default function Reports() {
  const { rid, roles, restaurant } = useOutletContext();
  const [from, setFrom] = useState(toDateInput(Date.now() - 6 * DAY));
  const [to, setTo] = useState(toDateInput(Date.now()));
  const fromTs = fromDateInput(from);
  const toTs = fromDateInput(to) + DAY;
  const r = useDb((db) => getReport(db, rid, fromTs, toTs));
  const items = useDb((db) => {
    const ids = new Map(r.orders.map((o) => [o.id, o]));
    return db.order_items.filter((i) => ids.has(i.order_id));
  });
  const tableName = useDb((db) => Object.fromEntries(db.tables.map((t) => [t.id, t.name])));
  if (!can(roles, 'reports.view')) return <Forbidden />;
  const preset = (days) => {
    setFrom(toDateInput(startOfDay(Date.now() - (days - 1) * DAY)));
    setTo(toDateInput(Date.now()));
  };
  const exportCsv = () => {
    const rows = [['Nomor pesanan', 'Waktu', 'Meja', 'Keadaan pesanan', 'Status bayar', 'Metode', 'Subtotal', 'Pajak', 'Layanan', 'Total', 'Item']];
    r.orders.forEach((o) => rows.push([o.order_number, dateTime(o.created_at), tableName[o.table_id] || '-', orderOverall(o).label, PAYMENT_STATUS[o.payment_status].label, PAYMENT_METHOD[o.payment_method], o.subtotal, o.tax_amount, o.service_amount, o.total, items.filter((i) => i.order_id === o.id).map((i) => `${i.qty}x ${i.product_name}`).join('; ')]));
    downloadText(`laporan-${restaurant.slug}-${from}-sd-${to}.csv`, toCsv(rows));
  };
  const maxQty = r.topItems[0]?.qty || 1;
  const mx = Math.max(r.methods.digital.amount, r.methods.cashier.amount, 1);
  const invalid = fromTs >= toTs;

  return (
    <>
      <PageHeader title="Laporan" subtitle="Penjualan dihitung dari pesanan yang lunas. Pesanan yang dibatalkan dan direfund tidak dihitung.">
        <Button icon="download" onClick={exportCsv} disabled={!r.orders.length}>Unduh CSV</Button>
      </PageHeader>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Dari" htmlFor="rf"><input id="rf" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Sampai" htmlFor="rt"><input id="rt" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button size="sm" onClick={() => preset(1)}>Hari ini</Button>
        <Button size="sm" onClick={() => preset(7)}>7 hari</Button>
        <Button size="sm" onClick={() => preset(30)}>30 hari</Button>
      </div>
      {invalid ? (
        <p className="alert alert-error">Tanggal awal harus sebelum tanggal akhir.</p>
      ) : (
        <>
          <div className="stats">
            <Stat label="Total penjualan" value={rp(r.sales)} />
            <Stat label="Total pesanan" value={r.orderCount} hint={`${r.completed} selesai`} />
            <Stat label="Rata-rata per pesanan" value={rp(r.avg)} />
            <Stat label="Pesanan dibatalkan" value={r.cancelled.length} />
          </div>
          <div className="grid-2">
            <Card title="Penjualan per hari">
              {r.series.length > 31 ? <p className="muted">Pilih rentang maksimal 31 hari untuk melihat grafik harian.</p> : <BarChart data={r.series.map((d) => ({ label: dateShort(d.date), value: d.sales }))} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}rb` : v)} />}
            </Card>
            <Card title="Metode pembayaran (lunas)">
              <HBar label={`Bayar digital · ${r.methods.digital.count} pesanan`} value={r.methods.digital.amount} max={mx} display={rp(r.methods.digital.amount)} />
              <HBar label={`Bayar di kasir · ${r.methods.cashier.count} pesanan`} value={r.methods.cashier.amount} max={mx} display={rp(r.methods.cashier.amount)} alt />
            </Card>
          </div>
          <div className="grid-2">
            <Card title="Menu paling banyak dipesan">
              {r.topItems.length ? r.topItems.slice(0, 8).map((t) => <HBar key={t.name} label={t.name} value={t.qty} max={maxQty} display={`${t.qty} porsi · ${rp(t.revenue)}`} />) : <Empty title="Belum ada data" />}
            </Card>
            <Card title="Pesanan dibatalkan">
              {r.cancelled.length ? (
                <div className="history">
                  {r.cancelled.map((o) => (
                    <div key={o.id}><span className="mono">{o.order_number}</span><span>{dateTime(o.created_at)} · {o.cancel_reason} <Pill type="payment" value={o.payment_status} /></span></div>
                  ))}
                </div>
              ) : <p className="muted">Tidak ada pembatalan.</p>}
            </Card>
          </div>
          <Card title={`Riwayat transaksi (${r.orders.length})`}>
            {r.orders.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>No.</th><th>Waktu</th><th>Metode</th><th>Bayar</th><th>Pesanan</th><th className="r">Total</th></tr></thead>
                  <tbody>
                    {r.orders.slice(0, 100).map((o) => (
                      <tr key={o.id}>
                        <td className="mono">{o.order_number}</td>
                        <td className="num">{dateTime(o.created_at)}</td>
                        <td>{PAYMENT_METHOD[o.payment_method]}</td>
                        <td><Pill type="payment" value={o.payment_status} /></td>
                        <td><Pill tone={orderOverall(o).tone} label={orderOverall(o).label} /></td>
                        <td className="r num">{rp(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="Tidak ada transaksi pada rentang ini" />}
            {r.orders.length > 100 && <p className="small muted">Menampilkan 100 transaksi terbaru. Unduh CSV untuk data lengkap.</p>}
          </Card>
        </>
      )}
    </>
  );
}
