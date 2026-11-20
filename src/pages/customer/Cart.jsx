import { Link, useOutletContext } from 'react-router-dom';
import { CustomerHeader } from '../../layouts/CustomerLayout.jsx';
import { useDb } from '../../hooks/useDb.js';
import { cartTotals, priceLine } from '../../services/api.js';
import { Empty, Field, IconButton, ProductThumb, Stepper } from '../../components/ui.jsx';
import { rp } from '../../lib/format.js';

export default function Cart() {
  const ctx = useOutletContext();
  const { restaurant, table, token, cart, settings } = ctx;
  const lines = useDb((db) => cart.lines.map((l) => ({ ...l, info: priceLine(db, l) })));
  const totals = useDb((db) => cartTotals(db, restaurant.id, cart.lines.filter((l) => priceLine(db, l))));
  const problems = lines.filter((l) => !l.info || l.info.unavailable);

  if (!cart.lines.length) {
    return (
      <>
        <CustomerHeader title="Keranjang" back={`/t/${token}/menu`} ctx={ctx} showCart={false} />
        <main className="cust-body">
          <Empty title="Keranjang masih kosong" icon="cart">Pilih menu dulu, lalu kembali ke sini.</Empty>
          <Link to={`/t/${token}/menu`} className="btn btn-primary">Lihat menu</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <CustomerHeader title="Keranjang" back={`/t/${token}/menu`} ctx={ctx} showCart={false} />
      <main className="cust-body">
        {problems.length > 0 && <p className="alert alert-error">Ada menu yang baru saja habis atau berubah. Hapus dulu dari keranjang untuk melanjutkan.</p>}
        {lines.map((l) => (
          <div key={l.key} className={`line-item ${!l.info || l.info.unavailable ? 'has-problem' : ''}`}>
            {l.info ? <ProductThumb product={l.info.product} size="sm" /> : <span />}
            <div className="stack" style={{ gap: 4 }}>
              <div className="row-between">
                <b>{l.info ? l.info.product.name : 'Menu tidak tersedia'}</b>
                <IconButton icon="trash" label="Hapus" onClick={() => cart.remove(l.key)} />
              </div>
              {l.info?.optionsText && <small className="muted">{l.info.optionsText}</small>}
              {l.note && <small className="muted">Catatan: {l.note}</small>}
              {(!l.info || l.info.unavailable) && <small style={{ color: 'var(--red)', fontWeight: 600 }}>Menu ini baru saja habis atau berubah</small>}
              <div className="row-between">
                <Stepper small value={l.qty} min={0} onChange={(v) => cart.setQty(l.key, v)} />
                <b className="num">{rp(l.info ? l.info.total : 0)}</b>
              </div>
            </div>
          </div>
        ))}

        <Field label="Catatan pesanan (opsional)" htmlFor="order-note">
          <textarea id="order-note" rows={2} maxLength={200} value={cart.note} onChange={(e) => cart.setMeta({ note: e.target.value })} placeholder="Misalnya: minta sendok dua" />
        </Field>
        <Field label="Nama kamu (opsional)" hint="Agar pegawai mudah memanggil saat mengantar." htmlFor="cust-name">
          <input id="cust-name" maxLength={40} value={cart.name} onChange={(e) => cart.setMeta({ name: e.target.value })} placeholder="Contoh: Andi" />
        </Field>

        <div className="summary">
          <div className="r"><span className="muted">Subtotal</span><span>{rp(totals.subtotal)}</span></div>
          {settings.tax_percent > 0 && <div className="r"><span className="muted">Pajak {settings.tax_percent}%</span><span>{rp(totals.tax)}</span></div>}
          {settings.service_percent > 0 && <div className="r"><span className="muted">Biaya layanan {settings.service_percent}%</span><span>{rp(totals.service)}</span></div>}
          <div className="r"><span className="muted">Meja</span><span>{table.name}</span></div>
          <div className="r total"><span>Total</span><span>{rp(totals.total)}</span></div>
        </div>
      </main>
      <footer className="cust-foot">
        {problems.length ? (
          <button type="button" className="btn btn-cta btn-lg btn-block" disabled>Lanjutkan pemesanan</button>
        ) : (
          <Link to={`/t/${token}/checkout`} className="btn btn-cta btn-lg btn-block">Lanjutkan pemesanan</Link>
        )}
      </footer>
    </>
  );
}
