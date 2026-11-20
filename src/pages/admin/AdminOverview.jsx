import { Link } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { platformOverview } from '../../services/api.js';
import { Card, HBar, PageHeader, Pill, Stat } from '../../components/ui.jsx';
import { dateShort, rp } from '../../lib/format.js';

export default function AdminOverview() {
  const d = useDb((db) => ({ ...platformOverview(db), invoices: [...db.subscription_invoices].sort((a, b) => b.created_at - a.created_at).slice(0, 5), names: Object.fromEntries(db.restaurants.map((r) => [r.id, r.name])) }));
  const maxOrders = Math.max(1, ...d.rows.map((r) => r.orders7d));
  const expiring = d.rows.filter((r) => ['trial', 'active'].includes(r.subState) && r.daysLeft !== null && r.daysLeft <= 7);

  return (
    <>
      <PageHeader title="Ringkasan platform" subtitle="Angka agregat seluruh restoran. Isi transaksi restoran tidak ditampilkan di sini." />
      <div className="stats">
        <Stat label="Restoran terdaftar" value={d.registered} />
        <Stat label="Aktif" value={d.active} hint="Uji coba + berlangganan" />
        <Stat label="Masa uji coba" value={d.trial} />
        <Stat label="Berlangganan" value={d.subscribed} />
        <Stat label="Langganan habis" value={d.expired + d.suspended} highlight={d.expired + d.suspended > 0} />
        <Stat label="Pendapatan bulanan berulang" value={rp(d.mrr)} hint="Dari paket aktif" />
      </div>
      <div className="grid-2">
        <Card title="Penggunaan 7 hari" actions={<span className="small muted">{d.orders7d} pesanan · {Math.round(d.digitalShare * 100)}% digital</span>}>
          {d.rows.map((r) => <HBar key={r.id} label={r.name} value={r.orders7d} max={maxOrders} display={`${r.orders7d} pesanan`} />)}
          <p className="small muted">Hanya Kedai Rasa Nusantara yang punya data pesanan contoh.</p>
        </Card>
        <Card title="Perlu perhatian" actions={<Link className="btn btn-sm" to="/admin/restaurants">Lihat restoran</Link>}>
          {expiring.length === 0 && <p className="muted">Tidak ada langganan yang berakhir dalam 7 hari.</p>}
          {expiring.map((r) => (
            <div key={r.id} className="row-between"><span>{r.name}</span><span className="row" style={{ gap: 6 }}><Pill type="sub" value={r.subState} /><span className="small muted">sisa {r.daysLeft} hari</span></span></div>
          ))}
          <div className="row-between"><span>Tiket bantuan terbuka</span><Link to="/admin/support"><b>{d.openTickets}</b></Link></div>
        </Card>
      </div>
      <Card title="Tagihan langganan terbaru" actions={<Link className="btn btn-sm" to="/admin/subscriptions">Semua tagihan</Link>}>
        <div className="history">
          {d.invoices.map((i) => (
            <div key={i.id}><span className="mono">{i.invoice_number}</span><span>{d.names[i.restaurant_id]} · {rp(i.amount)} · {dateShort(i.created_at)} <Pill tone={i.status === 'paid' ? 'green' : 'red'} label={i.status === 'paid' ? 'Lunas' : 'Belum dibayar'} /></span></div>
          ))}
        </div>
      </Card>
    </>
  );
}
