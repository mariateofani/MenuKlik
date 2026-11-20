import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { CustomerHeader } from '../../layouts/CustomerLayout.jsx';
import { useDb } from '../../hooks/useDb.js';
import { cartTotals, placeOrder } from '../../services/api.js';
import { CHANNELS, PAY_POLICY } from '../../lib/constants.js';
import { Empty } from '../../components/ui.jsx';
import { rp, uid } from '../../lib/format.js';

export default function Checkout() {
  const ctx = useOutletContext();
  const { restaurant, table, token, cart, settings } = ctx;
  const navigate = useNavigate();
  const totals = useDb((db) => cartTotals(db, restaurant.id, cart.lines));
  const channels = Object.keys(settings.channels).filter((k) => settings.channels[k]);
  const [method, setMethod] = useState(channels.length ? 'digital' : 'cashier');
  const [channel, setChannel] = useState(channels[0] || 'qris');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Kunci idempoten: dibuat sekali per sesi checkout. Klik berulang memakai kunci yang sama,
  // sehingga server hanya membuat satu pesanan.
  const idempotencyKey = useMemo(() => uid('idem_'), []);

  if (!cart.lines.length) {
    return (
      <>
        <CustomerHeader title="Pembayaran" back={`/t/${token}/menu`} ctx={ctx} showCart={false} />
        <main className="cust-body">
          <Empty title="Keranjang kosong" icon="cart" />
          <Link to={`/t/${token}/menu`} className="btn btn-primary">Lihat menu</Link>
        </main>
      </>
    );
  }

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 500)); // simulasi jeda jaringan
      const { order } = placeOrder({
        token, lines: cart.lines, customerName: cart.name, note: cart.note,
        paymentMethod: method, channel: method === 'digital' ? channel : 'cash', idempotencyKey,
      });
      cart.clearAfterOrder(order.id);
      navigate(order.payment_method === 'digital' ? `/t/${token}/orders/${order.id}/pay` : `/t/${token}/orders/${order.id}?baru=1`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <CustomerHeader title="Pembayaran" back={`/t/${token}/cart`} ctx={ctx} showCart={false} />
      <main className="cust-body">
        {error && (
          <div className="alert alert-error">
            {error} <Link to={`/t/${token}/cart`}>Buka keranjang</Link>
          </div>
        )}
        <h2 className="section-title">Pilih cara bayar</h2>
        {channels.length > 0 && (
          <div role="radio" tabIndex={0} aria-checked={method === 'digital'} className="pay-option" onClick={() => setMethod('digital')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setMethod('digital')}>
            <div className="hd">
              <span className="radio-dot" />
              <div>
                <b>Bayar digital</b>
                <div className="small muted">Lunas otomatis setelah pembayaran terverifikasi.</div>
              </div>
            </div>
            {method === 'digital' && (
              <div className="chips wrap">
                {channels.map((k) => (
                  <button key={k} type="button" className="chip" aria-pressed={channel === k} onClick={(e) => { e.stopPropagation(); setChannel(k); }}>
                    {CHANNELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div role="radio" tabIndex={0} aria-checked={method === 'cashier'} className="pay-option" onClick={() => setMethod('cashier')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setMethod('cashier')}>
          <div className="hd">
            <span className="radio-dot" />
            <div>
              <b>Bayar di kasir</b>
              <div className="small muted">
                {settings.pay_policy === 'pay_first'
                  ? 'Bayar dulu di kasir. Pesanan mulai dimasak setelah kasir mencatat pembayaranmu.'
                  : 'Pesanan langsung diproses. Bayar di kasir setelah selesai makan.'}
              </div>
              <div className="small" style={{ marginTop: 4 }}><span className="tag">Kebijakan restoran:</span> {PAY_POLICY[settings.pay_policy].label}</div>
            </div>
          </div>
        </div>
        <div className="summary">
          <div className="r"><span className="muted">{totals.count} item · Meja {table.name}</span><span /></div>
          {totals.tax > 0 && <div className="r"><span className="muted">Pajak</span><span>{rp(totals.tax)}</span></div>}
          {totals.service > 0 && <div className="r"><span className="muted">Biaya layanan</span><span>{rp(totals.service)}</span></div>}
          <div className="r total"><span>Total</span><span>{rp(totals.total)}</span></div>
        </div>
        <p className="note">Harga dihitung ulang dan ketersediaan menu diperiksa ulang oleh server saat pesanan dikirim.</p>
      </main>
      <footer className="cust-foot">
        <button type="button" className="btn btn-cta btn-lg btn-block" onClick={submit} disabled={submitting}>
          {submitting ? 'Mengirim pesanan...' : method === 'digital' ? `Kirim pesanan & bayar ${rp(totals.total)}` : 'Kirim pesanan'}
        </button>
      </footer>
    </>
  );
}
