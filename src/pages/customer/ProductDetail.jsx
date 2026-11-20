import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CustomerHeader } from '../../layouts/CustomerLayout.jsx';
import { useDb } from '../../hooks/useDb.js';
import { defaultOptionIds, groupOptions, optionsOf } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Empty, Field, ProductThumb, Stepper } from '../../components/ui.jsx';
import { rp } from '../../lib/format.js';

export default function ProductDetail() {
  const ctx = useOutletContext();
  const { productId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useDb((db) => {
    const p = db.products.find((x) => x.id === productId && x.restaurant_id === ctx.restaurant.id && x.is_active);
    return p ? { product: p, options: optionsOf(db, p.id) } : null;
  });

  const [variant, setVariant] = useState({});
  const [addons, setAddons] = useState([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!data) return;
    const g = groupOptions(data.options).groups;
    setVariant(Object.fromEntries(g.map((x) => [x.name, x.options[0].id])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!data) {
    return (
      <>
        <CustomerHeader title="Detail menu" back={`/t/${ctx.token}/menu`} ctx={ctx} />
        <main className="cust-body">
          <Empty title="Menu tidak ditemukan">Menu ini mungkin sudah tidak dijual.</Empty>
        </main>
      </>
    );
  }

  const { product, options } = data;
  const { groups, addons: addonList } = groupOptions(options);
  const chosenVariantIds = groups.map((g) => variant[g.name] || defaultOptionIds(options)[groups.indexOf(g)]);
  const optionIds = [...chosenVariantIds, ...addons];
  const unit = product.price + options.filter((o) => optionIds.includes(o.id)).reduce((a, o) => a + o.price_delta, 0);

  const add = () => {
    ctx.cart.add({ productId: product.id, optionIds, qty, note: note.trim() });
    toast(`${qty} ${product.name} masuk keranjang`, 'success');
    navigate(`/t/${ctx.token}/menu`);
  };

  return (
    <>
      <CustomerHeader title="Detail menu" back={`/t/${ctx.token}/menu`} ctx={ctx} />
      <ProductThumb product={product} size="lg" />
      <main className="cust-body">
        <div>
          <h1 style={{ fontSize: 21 }}>{product.name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{product.description}</p>
          <p className="num" style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>{rp(product.price)}</p>
        </div>
        {!product.is_available && <p className="alert alert-error">Menu ini sedang habis.</p>}

        {groups.map((g) => (
          <fieldset key={g.name} className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend className="section-title" style={{ marginBottom: 8 }}>
              {g.name} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· pilih satu</span>
            </legend>
            {g.options.map((o) => (
              <label key={o.id} className="option">
                <input type="radio" name={g.name} checked={chosenVariantIds.includes(o.id)} onChange={() => setVariant((v) => ({ ...v, [g.name]: o.id }))} />
                <span>{o.name}</span>
                {o.price_delta > 0 && <small className="muted">+{rp(o.price_delta)}</small>}
              </label>
            ))}
          </fieldset>
        ))}

        {addonList.length > 0 && (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend className="section-title" style={{ marginBottom: 8 }}>
              Tambahan <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· opsional</span>
            </legend>
            {addonList.map((o) => (
              <label key={o.id} className="option">
                <input type="checkbox" checked={addons.includes(o.id)} onChange={(e) => setAddons((a) => (e.target.checked ? [...a, o.id] : a.filter((x) => x !== o.id)))} />
                <span>{o.name}</span>
                <small className="muted">+{rp(o.price_delta)}</small>
              </label>
            ))}
          </fieldset>
        )}

        <Field label="Catatan untuk dapur" htmlFor="note">
          <textarea id="note" rows={2} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misalnya: tanpa acar" />
        </Field>
      </main>
      <footer className="cust-foot" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center' }}>
        <Stepper value={qty} onChange={setQty} min={1} />
        <button type="button" className="btn btn-cta btn-lg" disabled={!product.is_available} onClick={add}>
          Tambah · <span className="num">{rp(unit * qty)}</span>
        </button>
      </footer>
    </>
  );
}
