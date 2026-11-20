import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { clearNotice, selectNotice, setNotice } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Card, PageHeader } from '../../components/ui.jsx';

// Pengumuman gangguan untuk semua restoran, agar pemilik tidak melapor berulang.
export default function AdminNotice() {
  const { session } = useOutletContext();
  const toast = useToast();
  const [text, setText] = useState('Pembayaran QRIS sedang lambat. Tim kami sedang menangani. Sementara gunakan bayar di kasir.');
  const notice = useDb((db) => selectNotice(db));
  const run = (fn, msg) => { try { fn(); toast(msg, 'success'); } catch (e) { toast(e.message, 'error'); } };
  return (
    <>
      <PageHeader title="Gangguan & pengumuman" subtitle="Tampil sebagai banner di dashboard semua restoran." />
      <Card title="Pengumuman aktif">
        {notice ? (
          <>
            <div className="banner tone-amber"><span style={{ flex: 1 }}><b>Info dari MenuKlik:</b> {notice.text}</span></div>
            <div><Button size="sm" onClick={() => run(() => clearNotice(session), 'Pengumuman dicabut')}>Cabut pengumuman</Button></div>
          </>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(() => setNotice(session, text), 'Pengumuman tampil di semua restoran'); }}>
            <textarea rows={3} aria-label="Isi pengumuman" value={text} onChange={(e) => setText(e.target.value)} />
            <div><Button variant="primary" size="sm" type="submit">Umumkan ke semua restoran</Button></div>
          </form>
        )}
        <p className="small muted">Dengan pengumuman ini pemilik tidak perlu mengirim laporan yang sama berulang kali.</p>
      </Card>
    </>
  );
}
