import { useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { CustomerHeader } from '../../layouts/CustomerLayout.jsx';
import { useDb } from '../../hooks/useDb.js';
import { getCustomerOrder, latestPayment, retryDigitalPayment, simulateGatewayNotification, switchToCashier } from '../../services/api.js';
import { QrImage } from '../../components/QrImage.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Empty } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { CHANNELS } from '../../lib/constants.js';
import { randomToken, rp, time } from '../../lib/format.js';

export default function Payment() {
  const ctx = useOutletContext();
  const { token, settings } = ctx;
  const { orderId } = useParams();
  const toast = useToast();
  const order = useDb((db) => getCustomerOrder(db, orderId, token));
  const lastEvent = useRef(null);
  const [channel, setChannel] = useState(Object.keys(settings.channels).find((k) => settings.channels[k]) || 'qris');

  if (!order) {
    return (
      <>
        <CustomerHeader title="Pembayaran" back={`/t/${token}`} ctx={ctx} showCart={false} />
        <main className="cust-body"><Empty title="Pesanan tidak ditemukan" /></main>
      </>
    );
  }
  const p = latestPayment(order);
  const trackUrl = `/t/${token}/orders/${order.id}`;

  const notify = (result) => {
    const id = 'evt_' + randomToken(10);
    lastEvent.current = id;
    simulateGatewayNotification({ paymentId: p.id, result, gatewayEventId: id });
  };
  const resend = () => {
    const r = simulateGatewayNotification({ paymentId: p.id, result: 'paid', gatewayEventId: lastEvent.current || 'evt_tidak_dikenal' });
    toast(r.duplicate ? 'Notifikasi ganda diabaikan. Tidak diproses dua kali.' : 'Status sudah final, tidak ada perubahan.');
  };
  const run = (fn) => {
    try {
      fn();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (p.method !== 'digital') {
    return (
      <>
        <CustomerHeader title="Pembayaran" back={trackUrl} ctx={ctx} showCart={false} />
        <main className="cust-body center">
          <p>Pesanan ini dibayar di kasir.</p>
          <Link className="btn btn-primary" to={trackUrl}>Lihat status pesanan</Link>
        </main>
      </>
    );
  }

  if (p.status === 'paid') {
    return (
      <>
        <CustomerHeader title="Pembayaran" ctx={ctx} showCart={false} />
        <main className="cust-body">
          <div className="stack center">
            <div className="result-icon" style={{ background: 'var(--ok)', color: 'var(--on-ok)' }}><Icon name="check" size={30} /></div>
            <h1 style={{ fontSize: 20 }}>Pembayaran berhasil</h1>
            <div className="big-number">{order.order_number}</div>
            <p className="muted small">Status lunas datang dari notifikasi resmi payment gateway, bukan dari tangkapan layar.</p>
          </div>
          <div className="sim-panel">
            <span className="tag">Panel simulasi</span>
            <button type="button" className="btn btn-sm" onClick={resend}>Kirim ulang notifikasi yang sama</button>
            <small className="muted">Menunjukkan bahwa notifikasi ganda dari gateway tidak memproses pembayaran dua kali.</small>
          </div>
        </main>
        <footer className="cust-foot"><Link className="btn btn-primary btn-lg btn-block" to={trackUrl}>Lacak pesanan</Link></footer>
      </>
    );
  }

  if (p.status === 'failed' || p.status === 'expired' || order.cancelled) {
    const channels = Object.keys(settings.channels).filter((k) => settings.channels[k]);
    return (
      <>
        <CustomerHeader title="Pembayaran" back={trackUrl} ctx={ctx} showCart={false} />
        <main className="cust-body">
          <div className="stack center">
            <div className="result-icon tone-red"><Icon name="x" size={28} /></div>
            <h1 style={{ fontSize: 20 }}>{order.cancelled ? 'Pesanan dibatalkan' : p.status === 'failed' ? 'Pembayaran gagal' : 'Waktu pembayaran habis'}</h1>
            <p className="muted">{order.cancelled ? `Alasan: ${order.cancel_reason}` : `Pesanan ${order.order_number} belum diteruskan ke dapur. Coba lagi atau bayar di kasir.`}</p>
          </div>
          {order.status !== 'cancelled' && channels.length > 0 && (
            <div className="chips wrap">
              {channels.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={channel === k} onClick={() => setChannel(k)}>{CHANNELS[k]}</button>
              ))}
            </div>
          )}
        </main>
        {order.status !== 'cancelled' && (
          <footer className="cust-foot">
            {channels.length > 0 && <button type="button" className="btn btn-cta btn-lg btn-block" onClick={() => run(() => retryDigitalPayment({ orderId: order.id, token, channel }))}>Coba bayar digital lagi</button>}
            <button type="button" className="btn btn-block" onClick={() => run(() => switchToCashier({ orderId: order.id, token }))}>Ganti ke bayar di kasir</button>
          </footer>
        )}
      </>
    );
  }

  return (
    <>
      <CustomerHeader title="Menunggu pembayaran" back={trackUrl} ctx={ctx} showCart={false} />
      <main className="cust-body">
        <div className="stack center" style={{ gap: 4 }}>
          <span className="tag">Total dibayar</span>
          <div className="big-number">{rp(p.amount)}</div>
          <small className="muted">{order.order_number} · {CHANNELS[p.channel]} · {p.payment_number}</small>
          {p.expires_at && <small className="muted">Bayar sebelum pukul {time(p.expires_at)}</small>}
        </div>
        <div style={{ display: 'grid', justifyItems: 'center' }}>
          <QrImage text={`SIMULASI ${p.payment_number} ${p.gateway_ref}`} size={190} stamp="SIMULASI" label="QR pembayaran simulasi" />
        </div>
        <p className="muted small" style={{ textAlign: 'center' }}>
          Di produk asli, QR atau halaman ini berasal dari payment gateway. Versi ini tidak memproses uang sungguhan.
        </p>
        <div className="sim-panel">
          <span className="tag">Panel simulasi notifikasi payment gateway</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => notify('paid')}><Icon name="check" size={15} /> Pembayaran berhasil</button>
          <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => notify('failed')}>Gagal</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => notify('expired')}>Kedaluwarsa</button>
          </div>
          <small className="muted">Di sistem asli tombol ini tidak ada. Status dikirim server payment gateway ke backend.</small>
        </div>
      </main>
      <footer className="cust-foot"><Link className="btn btn-block" to={trackUrl}>Lihat status pesanan</Link></footer>
    </>
  );
}
