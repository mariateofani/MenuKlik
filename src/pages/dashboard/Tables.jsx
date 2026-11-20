import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { addTable, deleteTable, planOf, regenerateQr, selectTables, updateTable } from '../../services/api.js';
import { QrImage, useQrDataUrl } from '../../components/QrImage.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Button, Empty, Forbidden, IconButton, Modal, PageHeader, Pill, Switch } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { can } from '../../lib/constants.js';

export const tableUrl = (token) => `${window.location.origin}/t/${token}`;

function TableCard({ t, manage, onAction }) {
  const url = tableUrl(t.qr.token);
  const png = useQrDataUrl(url, 640);
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Tautan meja disalin');
    } catch {
      toast('Tidak bisa menyalin otomatis. Salin tautan secara manual.', 'error');
    }
  };
  return (
    <article className={`table-card ${t.is_active ? '' : 'off'}`}>
      <div className="row-between">
        <b style={{ fontSize: 18 }}>Meja {t.name}</b>
        {!t.is_active ? <Pill tone="red" label="Nonaktif" /> : t.activeOrders ? <Pill tone="amber" label={`${t.activeOrders} pesanan aktif`} /> : <Pill tone="muted" label="Kosong" />}
      </div>
      <div style={{ display: 'grid', justifyItems: 'center' }}><QrImage text={url} size={150} label={`QR Meja ${t.name}`} /></div>
      <div className="url mono">{url}</div>
      <div className="row" style={{ gap: 6 }}>
        <IconButton icon="copy" label="Salin tautan" onClick={copy} />
        {png && <a className="icon-btn" href={png} download={`qr-meja-${t.name}.png`} aria-label="Unduh QR" title="Unduh QR"><Icon name="download" size={17} /></a>}
        <a className="icon-btn" href={url} target="_blank" rel="noreferrer" aria-label="Buka sebagai pelanggan" title="Buka sebagai pelanggan"><Icon name="external" size={17} /></a>
      </div>
      {manage && (
        <>
          <Switch checked={t.is_active} onChange={(v) => onAction('active', t, v)} label={t.is_active ? 'Menerima pesanan' : 'Tidak menerima pesanan'} />
          <div className="row" style={{ gap: 6 }}>
            <Button size="sm" icon="edit" onClick={() => onAction('rename', t)}>Ganti nama</Button>
            <Button size="sm" icon="refresh" onClick={() => onAction('regen', t)}>QR baru</Button>
            <IconButton icon="trash" label="Hapus meja" onClick={() => onAction('delete', t)} />
          </div>
        </>
      )}
    </article>
  );
}

export default function Tables() {
  const { rid, roles } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [dialog, setDialog] = useState(null); // {type, table, value}
  const data = useDb((db) => ({ tables: selectTables(db, rid), plan: planOf(db, rid) }));
  if (!can(roles, 'tables.view')) return <Forbidden />;
  const manage = can(roles, 'tables.manage');

  const run = (fn, msg) => {
    try {
      fn();
      if (msg) toast(msg, 'success');
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };
  const onAction = (type, t, value) => {
    if (type === 'active') run(() => updateTable(session, t.id, { is_active: value }), value ? `Meja ${t.name} menerima pesanan` : `Meja ${t.name} ditutup sementara`);
    else setDialog({ type, table: t, value: t.name });
  };
  const confirm = () => {
    const { type, table, value } = dialog;
    const ok =
      type === 'rename' ? run(() => updateTable(session, table.id, { name: value }), 'Nama meja disimpan')
        : type === 'regen' ? run(() => regenerateQr(session, table.id), `QR baru untuk Meja ${table.name}. Cetak ulang dan ganti stiker lama.`)
          : run(() => deleteTable(session, table.id), `Meja ${table.name} dihapus`);
    if (ok) setDialog(null);
  };

  return (
    <>
      <PageHeader title="Meja & QR Code" subtitle="Setiap QR berisi token acak, bukan nomor meja, dan diperiksa server setiap kali dipindai. QR lama langsung tidak berlaku saat QR baru dibuat.">
        <Link className="btn" to="/dashboard/tables/print" target="_blank"><Icon name="print" size={17} /> Cetak semua QR</Link>
      </PageHeader>
      {manage ? (
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (run(() => addTable(session, name), `Meja ${name.trim()} dan QR-nya dibuat`)) setName(''); }}>
          <input className="input" style={{ flex: '1 1 220px', maxWidth: 320 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama meja, mis. 05 atau Teras 1" aria-label="Nama meja baru" required />
          <Button variant="primary" icon="plus" type="submit">Tambah meja</Button>
          {data.plan?.max_tables && <span className="small muted">{data.tables.length} dari {data.plan.max_tables} meja (paket {data.plan.name})</span>}
        </form>
      ) : (
        <p className="note">Kasir hanya dapat melihat dan menyalin tautan QR. Pengelolaan meja dilakukan owner.</p>
      )}
      {data.tables.length === 0 ? (
        <Empty title="Belum ada meja" icon="qr">Tambahkan meja pertama untuk membuat QR Code.</Empty>
      ) : (
        <div className="table-grid">{data.tables.map((t) => <TableCard key={t.id} t={t} manage={manage} onAction={onAction} />)}</div>
      )}

      <Modal
        open={!!dialog}
        title={dialog?.type === 'rename' ? 'Ganti nama meja' : dialog?.type === 'regen' ? 'Buat QR baru?' : 'Hapus meja?'}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Batal</Button>
            <Button variant={dialog?.type === 'delete' ? 'danger' : 'primary'} onClick={confirm}>{dialog?.type === 'rename' ? 'Simpan' : dialog?.type === 'regen' ? 'Buat QR baru' : 'Hapus meja'}</Button>
          </>
        }
      >
        {dialog?.type === 'rename' && <input className="input" value={dialog.value} onChange={(e) => setDialog({ ...dialog, value: e.target.value })} aria-label="Nama meja" autoFocus />}
        {dialog?.type === 'regen' && <p>QR lama untuk <b>Meja {dialog.table.name}</b> langsung tidak berlaku. Gunakan ini jika stiker QR rusak, hilang, atau disalahgunakan. Jangan lupa cetak dan tempel QR yang baru.</p>}
        {dialog?.type === 'delete' && <p>Meja <b>{dialog.table.name}</b> akan dihapus dan QR-nya dinonaktifkan. Riwayat pesanan dari meja ini tetap tersimpan.</p>}
      </Modal>
    </>
  );
}
