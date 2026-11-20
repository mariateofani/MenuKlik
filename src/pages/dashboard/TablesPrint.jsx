import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { selectTables, staffContext } from '../../services/api.js';
import { QrImage } from '../../components/QrImage.jsx';
import { can } from '../../lib/constants.js';

const url = (token) => `${window.location.origin}/t/${token}`;

// Halaman siap cetak: satu kartu per meja. Buka, lalu tekan tombol Cetak.
export default function TablesPrint() {
  const { session } = useAuth();
  const data = useDb((db) => {
    const ctx = staffContext(db, session);
    if (!ctx) return null;
    return { ctx, restaurant: db.restaurants.find((r) => r.id === ctx.rid), tables: selectTables(db, ctx.rid).filter((t) => t.is_active) };
  });
  if (!data) return <Navigate to="/login" replace />;
  if (!can(data.ctx.roles, 'tables.view')) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="no-print row-between" style={{ padding: '16px var(--gutter)' }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Cetak QR meja</h1>
          <p className="muted small">Kartu ditata dua kolom saat dicetak. Hanya meja aktif yang ditampilkan.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Cetak</button>
      </div>
      <div className="print-sheet">
        {data.tables.map((t) => (
          <div key={t.id} className="print-card">
            <b>{data.restaurant.name}</b>
            <h2>Meja {t.name}</h2>
            <QrImage text={url(t.qr.token)} size={200} label={`QR Meja ${t.name}`} />
            <p>Pindai untuk lihat menu dan pesan langsung dari HP.</p>
            <small>Tanpa unduh aplikasi · MenuKlik</small>
          </div>
        ))}
      </div>
    </div>
  );
}
