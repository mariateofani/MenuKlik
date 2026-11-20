import { useState } from 'react';
import { useDb } from '../../hooks/useDb.js';
import { INVOICE_STATUS } from '../../lib/constants.js';
import { Chips, Empty, PageHeader, Pill, Stat } from '../../components/ui.jsx';
import { dateShort, rp } from '../../lib/format.js';

export default function AdminSubscriptions() {
  const [status, setStatus] = useState('all');
  const d = useDb((db) => ({
    invoices: [...db.subscription_invoices].sort((a, b) => b.created_at - a.created_at),
    names: Object.fromEntries(db.restaurants.map((r) => [r.id, r.name])),
    plans: Object.fromEntries(db.plans.map((p) => [p.id, p.name])),
  }));
  const list = d.invoices.filter((i) => status === 'all' || i.status === status);
  const paid = d.invoices.filter((i) => i.status === 'paid');

  return (
    <>
      <PageHeader title="Tagihan langganan" subtitle="Riwayat pembayaran langganan dari restoran ke MenuKlik." />
      <div className="stats">
        <Stat label="Total diterima" value={rp(paid.reduce((a, i) => a + i.amount, 0))} hint={`${paid.length} tagihan lunas`} />
        <Stat label="Belum lunas" value={d.invoices.filter((i) => i.status !== 'paid').length} />
      </div>
      <Chips label="Status" value={status} onChange={setStatus} options={[['all', 'Semua'], ['paid', 'Lunas'], ['unpaid', 'Menunggu'], ['failed', 'Gagal'], ['expired', 'Kedaluwarsa']]} />
      {list.length === 0 ? <Empty title="Tidak ada tagihan" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>No. tagihan</th><th>Restoran</th><th>Paket</th><th>Periode</th><th className="r">Nominal</th><th>Status</th><th>Catatan</th></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.invoice_number}</td>
                  <td>{d.names[i.restaurant_id]}</td>
                  <td>{d.plans[i.plan_id]}</td>
                  <td className="num">{dateShort(i.period_start)} - {dateShort(i.period_end)}</td>
                  <td className="r num">{rp(i.amount)}</td>
                  <td><Pill tone={(INVOICE_STATUS[i.status] || INVOICE_STATUS.unpaid).tone} label={(INVOICE_STATUS[i.status] || INVOICE_STATUS.unpaid).label} /></td>
                  <td className="muted">{i.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
