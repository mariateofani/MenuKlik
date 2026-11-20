import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { useNow } from '../../hooks/useNow.js';
import { orderNeed, selectOrders } from '../../services/api.js';
import OrderDetail from '../../components/OrderDetail.jsx';
import { Chips, Drawer, Empty, Forbidden, PageHeader, Pill, Segmented, StatusTrio } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { can, isActiveOrder, orderOverall } from '../../lib/constants.js';
import { DAY, rp, startOfDay, time, timeAgo } from '../../lib/format.js';

// Filter sesuai prototipe: "Perlu tindakan" dihitung dari peran pegawai yang sedang masuk.
const FILTERS = [
  ['action', 'Perlu tindakan', (o, need) => !!need(o)],
  ['active', 'Aktif', (o) => isActiveOrder(o)],
  ['unpaid', 'Belum dibayar', (o) => o.payment_status === 'pending' && !o.cancelled],
  ['done', 'Selesai', (o) => !o.cancelled && !isActiveOrder(o)],
  ['cancelled', 'Dibatalkan', (o) => o.cancelled],
  ['all', 'Semua', () => true],
];

export default function Orders() {
  const { rid, roles, settings } = useOutletContext();
  useNow(30000);
  const [range, setRange] = useState('today');
  const [filter, setFilter] = useState('action');
  const [view, setView] = useState('card');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const need = (o) => orderNeed(o, roles, settings);
  const from = range === 'today' ? startOfDay(Date.now()) : startOfDay(Date.now() - 6 * DAY);
  const orders = useDb((db) => selectOrders(db, rid, { from, to: Date.now() + DAY }));

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x[0] === filter)[2];
    const s = q.trim().toLowerCase();
    return orders.filter((o) => f(o, need) && (!s || o.order_number.toLowerCase().includes(s) || o.table?.name.toLowerCase().includes(s) || o.customer_name.toLowerCase().includes(s)));
  }, [orders, filter, q, roles, settings]);

  if (!can(roles, 'orders.view')) return <Forbidden />;
  // Tampilan kartu memakai dua panel (daftar di kiri, detail di kanan); tampilan tabel memakai laci.
  const split = view === 'card';
  const selected = orders.find((o) => o.id === selId) || (split ? visible[0] : null);

  return (
    <>
      <PageHeader title="Pesanan" subtitle="Garis oranye di kiri kartu menandai pesanan yang menunggu tindakan dari peranmu. Tiga status ditampilkan bersamaan: Bayar, Dapur, Saji.">
        <Segmented label="Periode" value={range} onChange={setRange} options={[['today', 'Hari ini'], ['7d', '7 hari']]} />
        <Segmented label="Tampilan" value={view} onChange={setView} options={[['card', 'Kartu'], ['table', 'Tabel']]} />
      </PageHeader>
      <div className="row">
        <label className="search" style={{ flex: '1 1 260px' }}>
          <Icon name="search" size={16} />
          <input type="search" placeholder="Cari nomor pesanan, meja, atau nama" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pesanan" />
        </label>
      </div>
      <Chips label="Filter status" value={filter} onChange={setFilter} options={FILTERS.map(([k, l, f]) => [k, l, orders.filter((o) => f(o, need)).length])} />

      {visible.length === 0 ? (
        <Empty title="Tidak ada pesanan" icon="list">Coba ubah filter atau periode.</Empty>
      ) : view === 'card' ? (
        <div className="orders-split">
        <div className="order-list">
          {visible.map((o) => (
            <button key={o.id} type="button" className={`order-card ${need(o) ? 'needs-action' : ''} ${split && selected?.id === o.id ? 'selected' : ''}`} onClick={() => setSelId(o.id)}>
              <div className="row-between"><b className="mono">{o.order_number}</b><span className="small muted">{time(o.created_at)} · {timeAgo(o.created_at)}</span></div>
              <div className="row-between"><b>Meja {o.table?.name}</b><span className="muted small">{o.customer_name}</span></div>
              <div className="items">{o.items.map((i) => `${i.qty}x ${i.product_name}`).join(', ')}</div>
              <div className="row-between"><b className="num">{rp(o.total)}</b><span className="small muted">{o.payment_method === 'digital' ? 'Digital' : 'Kasir'}</span></div>
              {need(o) ? <span className="need-txt">{need(o)}</span> : <span className="small muted">{orderOverall(o).label}</span>}
              <StatusTrio order={o} compact />
            </button>
          ))}
        </div>
        {selected && (
          <aside className="detail-panel card" aria-label="Detail pesanan">
            <div className="row-between"><div><span className="tag">Detail pesanan</span><h2 className="mono" style={{ fontSize: 20 }}>{selected.order_number}</h2></div><Pill tone={orderOverall(selected).tone} label={orderOverall(selected).label} /></div>
            <OrderDetail order={selected} roles={roles} settings={settings} />
          </aside>
        )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>No.</th><th>Waktu</th><th>Meja</th><th>Pelanggan</th><th>Menu</th><th className="r">Item</th><th className="r">Total</th><th>Metode</th><th>Status</th><th>Keadaan</th></tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => setSelId(o.id)}>
                  <td className="mono">{o.order_number}</td>
                  <td className="num">{time(o.created_at)}</td>
                  <td>{o.table?.name}</td>
                  <td>{o.customer_name || '-'}</td>
                  <td>{o.items.map((i) => i.product_name).join(', ')}</td>
                  <td className="r num">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td className="r num">{rp(o.total)}</td>
                  <td>{o.payment_method === 'digital' ? 'Digital' : 'Kasir'}</td>
                  <td><StatusTrio order={o} compact /></td>
                  <td><Pill tone={orderOverall(o).tone} label={orderOverall(o).label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!split && !!selected} title={selected ? `Pesanan ${selected.order_number}` : ''} onClose={() => setSelId(null)}>
        {selected && <OrderDetail order={selected} roles={roles} settings={settings} />}
      </Drawer>
    </>
  );
}
