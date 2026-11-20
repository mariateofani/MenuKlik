import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { useDb } from '../hooks/useDb.js';
import { useCart } from '../hooks/useCart.js';
import { resolveQr } from '../services/api.js';
import { Icon } from '../lib/icons.jsx';

const REASONS = {
  not_found: ['QR tidak dikenali', 'Kode pada QR ini tidak terdaftar. Pastikan kamu memindai QR yang tertempel di meja, atau minta bantuan pegawai.'],
  revoked: ['QR sudah tidak berlaku', 'Restoran sudah mengganti QR untuk meja ini. Minta pegawai menunjukkan QR yang baru.'],
  table_inactive: ['Meja sedang tidak menerima pesanan', 'Pemesanan dari meja ini sedang ditutup. Silakan pesan langsung ke kasir atau pindah meja.'],
  subscription: ['Pemesanan online belum tersedia', 'Restoran ini sedang tidak bisa menerima pesanan lewat QR. Silakan pesan langsung ke kasir.'],
  restaurant_inactive: ['Pemesanan online belum tersedia', 'Restoran ini sedang tidak bisa menerima pesanan lewat QR. Silakan pesan langsung ke kasir.'],
};

export default function CustomerLayout() {
  const { token } = useParams();
  const qr = useDb(() => resolveQr(token));
  const cart = useCart(token);
  const { pathname } = useLocation();
  // Memantau pesanan yang sudah dibuat tidak boleh hilang hanya karena QR, meja, atau langganan berubah.
  const tracking = /\/orders\//.test(pathname) && qr.reason !== 'not_found';

  if (!qr.ok && !tracking) {
    const [title, msg] = REASONS[qr.reason] || REASONS.not_found;
    return (
      <div className="cust">
        <div className="cust-body center" style={{ paddingTop: 72 }}>
          <div className="result-icon tone-red">
            <Icon name="shield" size={30} />
          </div>
          <h1 style={{ fontSize: 20 }}>{title}</h1>
          <p className="muted" style={{ maxWidth: 340 }}>{msg}</p>
          {qr.restaurant && <p className="small muted">{qr.restaurant.name}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="cust">
      <ErrorBoundary>
        <Outlet context={{ ...qr, token, cart, closed: qr.ok ? null : qr.reason }} />
      </ErrorBoundary>
    </div>
  );
}

// Header standar halaman pelanggan.
export function CustomerHeader({ title, back, ctx, showCart = true }) {
  const navigate = useNavigate();
  return (
    <header className="cust-head">
      {back && (
        <button type="button" className="icon-btn" aria-label="Kembali" onClick={() => (back === -1 ? navigate(-1) : navigate(back))}>
          <Icon name="back" />
        </button>
      )}
      <div className="t">
        <b>{title}</b>
        <span>
          {ctx.restaurant.name} · Meja {ctx.table.name}
        </span>
      </div>
      {showCart && (
        <Link to={`/t/${ctx.token}/cart`} className="icon-btn cart-badge" aria-label={`Keranjang, ${ctx.cart.count} item`}>
          <Icon name="cart" />
          {ctx.cart.count > 0 && <i>{ctx.cart.count}</i>}
        </Link>
      )}
    </header>
  );
}
