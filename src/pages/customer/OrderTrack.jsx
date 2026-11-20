import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { CustomerHeader } from '../../layouts/CustomerLayout.jsx';
import { useDb } from '../../hooks/useDb.js';
import { getCustomerOrder, latestPayment } from '../../services/api.js';
import { Empty, Pill } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { CHANNELS } from '../../lib/constants.js';
import { rp, time } from '../../lib/format.js';

function paymentText(o) {
  if (o.payment_status === 'pending') {
    if (o.payment_method === 'digital') return 'Menunggu pembayaran';
    return o.pay_policy === 'pay_first' ? 'Bayar dulu di kasir' : 'Bayar di kasir setelah makan';
  }
  return { paid: 'Lunas', failed: 'Gagal', expired: 'Kedaluwarsa', refunded: 'Dikembalikan' }[o.payment_status];
}

// Linimasa pelanggan dibangun dari tiga status terpisah: pembayaran, dapur, dan penyajian.
function buildSteps(o) {
  const ki = ['waiting', 'accepted', 'preparing', 'ready'].indexOf(o.kitchen_status);
  const at = (kind, to) => o.history.find((h) => h.kind === kind && h.to_status === to)?.created_at;
  const paid = o.payment_status === 'paid' || o.payment_status === 'refunded';
  const bad = ['failed', 'expired'].includes(o.payment_status);
  const later = o.payment_method === 'cashier' && o.pay_policy === 'pay_later';
  const blocked = !later && o.payment_status !== 'paid';
  const st = (done, now) => (o.cancelled ? 'todo' : done ? 'done' : now ? 'now' : 'todo');
  const pay = {
    title: o.payment_method === 'digital' ? 'Pembayaran digital' : 'Pembayaran di kasir',
    sub: paymentText(o),
    state: paid ? 'done' : bad ? 'bad' : o.cancelled ? 'todo' : 'now',
  };
  const kitchen = [
    { title: 'Diterima kasir', sub: at('kitchen', 'accepted') ? time(at('kitchen', 'accepted')) : 'Pesanan diteruskan ke dapur', state: st(ki >= 1, ki === 0 && !blocked) },
    { title: 'Sedang dimasak', sub: at('kitchen', 'preparing') ? time(at('kitchen', 'preparing')) : 'Dapur menyiapkan pesananmu', state: st(ki >= 2, ki === 1) },
    { title: 'Siap disajikan', sub: at('kitchen', 'ready') ? time(at('kitchen', 'ready')) : 'Menunggu diambil pegawai', state: st(ki >= 3, ki === 2) },
    { title: 'Diantar ke meja', sub: o.serving_status === 'picked_up' ? 'Pegawai sedang menuju mejamu' : at('serving', 'delivered') ? time(at('serving', 'delivered')) : 'Selamat menikmati', state: st(o.serving_status === 'delivered', ['waiting_pickup', 'picked_up'].includes(o.serving_status)) },
  ];
  const first = { title: 'Pesanan dikirim', sub: time(o.created_at), state: 'done' };
  return later ? [first, ...kitchen, pay] : [first, pay, ...kitchen];
}

export default function OrderTrack() {
  const ctx = useOutletContext();
  const { token, cart } = ctx;
  const { orderId } = useParams();
  const isNew = new URLSearchParams(useLocation().search).get('baru') === '1';
  const order = useDb((db) => getCustomerOrder(db, orderId, token));
  const others = useDb((db) => cart.myOrders.filter((id) => id !== orderId).map((id) => getCustomerOrder(db, id, token)).filter(Boolean));

  if (!order) {
    return (
      <>
        <CustomerHeader title="Pesanan" back={`/t/${token}`} ctx={ctx} showCart={false} />
        <main className="cust-body"><Empty title="Pesanan tidak ditemukan">Pesanan hanya bisa dilihat dari QR meja tempat pesanan dibuat.</Empty></main>
      </>
    );
  }
  const p = latestPayment(order);
  const steps = buildSteps(order);
  const needPay = order.payment_method === 'digital' && ['pending', 'failed', 'expired'].includes(order.payment_status) && !order.cancelled;

  return (
    <>
      <CustomerHeader title="Pesanan saya" back={`/t/${token}`} ctx={ctx} showCart={false} />
      <main className="cust-body">
        {isNew && <p className="alert alert-ok">Pesanan terkirim ke restoran.</p>}
        <div className="stack center" style={{ gap: 2 }}>
          <div className="big-number">{order.order_number}</div>
          <small className="muted">Meja {order.table?.name} · {time(order.created_at)}{order.customer_name ? ` · ${order.customer_name}` : ''}</small>
        </div>
        {order.cancelled && (
          <p className="alert alert-error">
            Pesanan dibatalkan restoran. Alasan: {order.cancel_reason}.{order.payment_status === 'refunded' ? ' Pembayaran dicatat untuk dikembalikan.' : ''}
          </p>
        )}
        <div className="status3">
          <div><span className="tag">Bayar</span><Pill type="payment" value={order.payment_status} /></div>
          <div><span className="tag">Dapur</span><Pill type="kitchen" value={order.kitchen_status} /></div>
          <div><span className="tag">Saji</span><Pill type="serving" value={order.serving_status || 'none'} /></div>
        </div>
        <section className="card">
          <div className="timeline">
            {steps.map((s) => (
              <div key={s.title} className={`step ${s.state}`}>
                <span className="step-dot">{s.state === 'done' ? <Icon name="check" size={14} /> : s.state === 'bad' ? <Icon name="x" size={13} /> : null}</span>
                <div><b>{s.title}</b><small>{s.sub}</small></div>
              </div>
            ))}
          </div>
        </section>
        <div className="summary">
          {order.items.map((i) => (
            <div key={i.id} className="r">
              <span>
                {i.qty} x {i.product_name}
                {(i.options_text || i.note) && <><br /><small className="muted">{[i.options_text, i.note && `Catatan: ${i.note}`].filter(Boolean).join(' · ')}</small></>}
              </span>
              <span>{rp(i.line_total)}</span>
            </div>
          ))}
          {order.tax_amount > 0 && <div className="r"><span className="muted">Pajak</span><span>{rp(order.tax_amount)}</span></div>}
          {order.service_amount > 0 && <div className="r"><span className="muted">Biaya layanan</span><span>{rp(order.service_amount)}</span></div>}
          <div className="r total"><span>Total</span><span>{rp(order.total)}</span></div>
          <div className="r"><span className="muted">Metode</span><span>{p ? CHANNELS[p.channel] : '-'}</span></div>
        </div>
        <p className="note">Estimasi waktu saji belum tersedia di versi ini. Halaman ini ter-update sendiri saat pegawai mengubah status.</p>
        {others.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="tag">Pesanan lain dari meja ini</span>
            <div className="chips wrap">
              {others.map((o) => (
                <Link key={o.id} to={`/t/${token}/orders/${o.id}`} className="chip">{o.order_number} · <Pill type="order" value={o.status} /></Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer className="cust-foot">
        {needPay && <Link className="btn btn-cta btn-lg btn-block" to={`/t/${token}/orders/${order.id}/pay`}>Lanjutkan pembayaran</Link>}
        {ctx.closed ? <p className="note">Pemesanan baru dari QR ini sedang ditutup. Pesananmu tetap diproses dan statusnya tetap bisa dipantau di sini.</p> : <Link className="btn btn-block" to={`/t/${token}/menu`}><Icon name="plus" size={16} /> Pesan lagi dari meja ini</Link>}
      </footer>
    </>
  );
}
