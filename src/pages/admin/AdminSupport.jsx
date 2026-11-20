import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { useNow } from '../../hooks/useNow.js';
import { markTicketReadByAdmin, updateTicket } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { TicketRow, TicketThread } from '../../components/TicketThread.jsx';
import { Chips, Empty, Stat } from '../../components/ui.jsx';

const PRI = { kritis: 0, tinggi: 1, normal: 2 };
const FILTERS = {
  open: (t) => t.status !== 'resolved',
  kritis: (t) => t.priority === 'kritis' && t.status !== 'resolved',
  resolved: (t) => t.status === 'resolved',
  all: () => true,
};

// Kendala restoran: prioritas, target respons, ulasan, serta pengumuman gangguan ke semua restoran.
export default function AdminSupport() {
  const { session } = useOutletContext();
  const toast = useToast();
  const now = useNow(30000);
  const [filter, setFilter] = useState('open');
  const [selId, setSelId] = useState(null);
  const d = useDb((db) => ({ all: db.support_tickets, names: Object.fromEntries(db.restaurants.map((r) => [r.id, r.name]))}));
  const run = (fn, msg) => { try { fn(); if (msg) toast(msg, 'success'); return true; } catch (e) { toast(e.message, 'error'); return false; } };
  const list = d.all.filter(FILTERS[filter]).sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || PRI[a.priority] - PRI[b.priority] || b.created_at - a.created_at);
  const sel = d.all.find((t) => t.id === selId) || list[0];
  const resp = d.all.filter((t) => t.first_reply_at);
  const avg = resp.length ? Math.round(resp.reduce((x, t) => x + (t.first_reply_at - t.created_at), 0) / resp.length / 60000) : null;
  const rated = d.all.filter((t) => t.rating);
  const avgR = rated.length ? (rated.reduce((x, t) => x + t.rating, 0) / rated.length).toFixed(1) : '-';

  return (
    <>
      <div className="stats">
        <Stat label="Belum selesai" value={d.all.filter(FILTERS.open).length} />
        <Stat label="Kritis terbuka" value={d.all.filter(FILTERS.kritis).length} highlight={d.all.some(FILTERS.kritis)} />
        <Stat label="Rata-rata respons pertama" value={avg === null ? '-' : `${avg} mnt`} />
        <Stat label="Rata-rata ulasan" value={avgR} />
      </div>
      <Chips label="Filter" value={filter} onChange={setFilter} options={[['open', 'Belum selesai', d.all.filter(FILTERS.open).length], ['kritis', 'Kritis', d.all.filter(FILTERS.kritis).length], ['resolved', 'Selesai', d.all.filter(FILTERS.resolved).length], ['all', 'Semua', d.all.length]]} />
      {list.length === 0 ? <Empty title="Tidak ada laporan" icon="help" /> : (
        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(260px,.8fr) minmax(0,1.4fr)', alignItems: 'start' }}>
          <div className="stack">{list.map((t) => <TicketRow key={t.id} t={t} side="admin" selected={sel?.id === t.id} restName={d.names[t.restaurant_id]} onSelect={(id) => { setSelId(id); run(() => markTicketReadByAdmin(session, id)); }} />)}</div>
          {sel && (
            <TicketThread t={sel} side="admin" restName={d.names[sel.restaurant_id]} now={now}
              onReply={(text) => run(() => updateTicket(session, sel.id, { reply: text }), 'Balasan terkirim')}
              onStatus={(s) => run(() => updateTicket(session, sel.id, { status: s }), 'Status diperbarui')} />
          )}
        </div>
      )}
      <p className="note">Target respons (asumsi): Kritis 15 menit, Tinggi 2 jam, Normal 1 hari. Laporan hanya membawa konteks teknis; melihat data transaksi tetap butuh izin pemilik restoran.</p>
    </>
  );
}
