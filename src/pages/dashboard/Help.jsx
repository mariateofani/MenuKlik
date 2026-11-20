import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { useNow } from '../../hooks/useNow.js';
import { createSupportTicket, markTicketRead, rateTicket, reopenTicket, replyTicketAsOwner, selectNotice, settingsOf } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { TicketRow, TicketThread } from '../../components/TicketThread.jsx';
import { Button, Card, Empty, Field, Forbidden, PageHeader } from '../../components/ui.jsx';
import { can, CONFIGS, devicesFor, TICKET_CATEGORIES } from '../../lib/constants.js';

const DEVICE_LABEL = { owner: 'HP pemilik', cashier: 'Komputer kasir', tablet: 'Tablet bersama', kds: 'Monitor dapur (KDS)', waiter: 'HP waiter' };

// Bantuan untuk pemilik: laporan kendala dengan konteks otomatis, target respons, dan ulasan.
export default function Help() {
  const { rid, roles, restaurant } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  const now = useNow(30000);
  const d = useDb((db) => ({ s: settingsOf(db, rid), mine: db.support_tickets.filter((t) => t.restaurant_id === rid).sort((a, b) => b.created_at - a.created_at), notice: selectNotice(db) }));
  const devices = devicesFor(d.s).map((x) => DEVICE_LABEL[x]);
  const [f, setF] = useState({ category: 'order', device: devices[0], subject: '', message: '', critical: false });
  const [selId, setSelId] = useState(null);
  if (!can(roles, 'settings.manage')) return <Forbidden />;
  const sel = d.mine.find((t) => t.id === selId);
  const run = (fn, msg) => { try { fn(); if (msg) toast(msg, 'success'); return true; } catch (e) { toast(e.message, 'error'); return false; } };
  const select = (id) => { setSelId(id); run(() => markTicketRead(session, id)); };

  return (
    <>
      <PageHeader title="Bantuan" subtitle="Laporkan kendala ke tim MenuKlik. Konteks teknis terlampir otomatis, jadi kamu tidak perlu menjelaskan dari nol." />
      {d.notice && <div className="banner tone-amber"><span style={{ flex: 1 }}><b>Info dari MenuKlik:</b> {d.notice.text}</span></div>}
      <div className="grid-2">
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (run(() => createSupportTicket(session, f), 'Laporan terkirim ke tim MenuKlik')) setF({ ...f, subject: '', message: '', critical: false }); }}>
          <h2 style={{ fontSize: 15 }}>Laporkan kendala</h2>
          <Field label="Jenis kendala" htmlFor="h-cat"><select id="h-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Terjadi di perangkat" htmlFor="h-dev"><select id="h-dev" value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })}>{devices.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Judul singkat" htmlFor="h-sub"><input id="h-sub" required placeholder="Mis. Pesanan tidak muncul di kasir" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Apa yang terjadi?" htmlFor="h-msg"><textarea id="h-msg" rows={3} required placeholder="Apa yang sedang dilakukan dan apa yang muncul di layar" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
          <label className="row small" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" checked={f.critical} onChange={(e) => setF({ ...f, critical: e.target.checked })} /><span><b>Restoran tidak bisa menerima pesanan sama sekali</b><br /><span className="muted">Ditandai Kritis, target respons 15 menit</span></span></label>
          <Button variant="cta" type="submit">Kirim ke tim MenuKlik</Button>
          <p className="note">Terkirim otomatis: konfigurasi ({CONFIGS[d.s.config].name}), perangkat, waktu, kode eror, dan jenis aktivitas terakhir. Data pelanggan tidak ikut. Jika aplikasi sama sekali tidak bisa dibuka, hubungi WhatsApp bantuan 0800-0000-000 (nomor contoh).</p>
        </form>
        <Card title="Laporan saya">
          {d.mine.length === 0 ? <Empty title="Belum ada laporan" icon="help" /> : d.mine.map((t) => <TicketRow key={t.id} t={t} side="owner" selected={t.id === selId} onSelect={select} />)}
        </Card>
      </div>
      {sel && (
        <TicketThread t={sel} side="owner" restName={restaurant.name} now={now}
          onReply={(text) => run(() => replyTicketAsOwner(session, sel.id, text), 'Terkirim ke tim MenuKlik')}
          onReopen={() => run(() => reopenTicket(session, sel.id), 'Laporan dibuka kembali')}
          onRate={(r, n) => run(() => rateTicket(session, sel.id, { rating: r, note: n }), 'Terima kasih atas ulasanmu')} />
      )}
    </>
  );
}
