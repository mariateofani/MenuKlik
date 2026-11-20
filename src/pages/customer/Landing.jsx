import { Link, useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { getCustomerOrder, isOpenNow } from '../../services/api.js';
import { Icon } from '../../lib/icons.jsx';
import { Pill } from '../../components/ui.jsx';
import { rp, time } from '../../lib/format.js';

export default function Landing() {
  const ctx = useOutletContext();
  const { restaurant, table, settings, token, cart } = ctx;
  const open = isOpenNow(settings);
  const myOrders = useDb((db) => cart.myOrders.map((id) => getCustomerOrder(db, id, token)).filter(Boolean)).sort((a, b) => b.created_at - a.created_at);

  return (
    <>
      <div className="cover" style={restaurant.cover_url ? { backgroundImage: `url(${restaurant.cover_url})` } : undefined}>
        <div className="cover-logo">{restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : restaurant.logo_text}</div>
      </div>
      <main className="cust-body" style={{ paddingTop: 44 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{restaurant.name}</h1>
          <div className="row muted small" style={{ marginTop: 4, gap: 6 }}>
            <Icon name="pin" size={14} /> {restaurant.address}
          </div>
        </div>
        <div className="table-badge">
          <Icon name="qr" /> Kamu di Meja {table.name}
        </div>
        <div className="row small" style={{ gap: 8 }}>
          <span className={open ? 'dot-open' : 'dot-closed'} />
          <span>
            {open ? 'Buka sekarang' : 'Sedang tutup'} · {settings.open_time.replace(':', '.')} - {settings.close_time.replace(':', '.')}
          </span>
        </div>
        {!open && <p className="alert alert-warn">Restoran sedang di luar jam operasional. Pesanan tetap bisa dikirim, tetapi mungkin belum diproses.</p>}
        <p className="muted">Pilih menu, kirim pesanan, lalu pantau statusnya dari HP ini. Tidak perlu daftar akun atau unduh aplikasi.</p>

        {myOrders.length > 0 && (
          <section className="card" style={{ padding: 12 }}>
            <h2 style={{ fontSize: 14 }}>Pesanan kamu di meja ini</h2>
            {myOrders.map((o) => (
              <Link key={o.id} to={`/t/${token}/orders/${o.id}`} className="product-row" style={{ padding: 10 }}>
                <div className="txt">
                  <b className="mono">{o.order_number}</b>
                  <small>
                    {time(o.created_at)} · {rp(o.total)}
                  </small>
                </div>
                <Pill tone={orderOverall(o).tone} label={orderOverall(o).label} />
                <Icon name="next" size={16} />
              </Link>
            ))}
          </section>
        )}
      </main>
      <footer className="cust-foot">
        <Link to={`/t/${token}/menu`} className="btn btn-cta btn-lg btn-block">
          Mulai memesan
        </Link>
      </footer>
    </>
  );
}
