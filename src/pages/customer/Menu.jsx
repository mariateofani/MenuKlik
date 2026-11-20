import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { CustomerHeader } from '../../layouts/CustomerLayout.jsx';
import { useDb } from '../../hooks/useDb.js';
import { cartTotals, getMenu } from '../../services/api.js';
import { Chips, Empty, ProductThumb } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { rp } from '../../lib/format.js';

export default function Menu() {
  const ctx = useOutletContext();
  const { restaurant, token, cart } = ctx;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const menu = useDb((db) => getMenu(db, restaurant.id));
  const totals = useDb((db) => cartTotals(db, restaurant.id, cart.lines));

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return menu.products.filter((p) => (cat === 'all' || p.category_id === cat) && (!s || p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)));
  }, [menu, q, cat]);

  return (
    <>
      <CustomerHeader title="Menu" back={`/t/${token}`} ctx={ctx} />
      <main className="cust-body">
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu, misalnya nasi goreng" aria-label="Cari menu" />
        </label>
        <Chips
          label="Kategori"
          value={cat}
          onChange={setCat}
          options={[['all', 'Semua'], ...menu.categories.map((c) => [c.id, c.name, menu.products.filter((p) => p.category_id === c.id).length])]}
        />
        {visible.length === 0 && <Empty title="Menu tidak ditemukan" icon="search">Coba kata kunci lain atau pilih kategori Semua.</Empty>}
        {menu.categories
          .filter((c) => visible.some((p) => p.category_id === c.id))
          .map((c) => (
            <section key={c.id} className="stack" style={{ gap: 10 }}>
              <h2 className="section-title">{c.name}</h2>
              {visible
                .filter((p) => p.category_id === c.id)
                .map((p) =>
                  p.is_available ? (
                    <Link key={p.id} to={`/t/${token}/menu/${p.id}`} className="product-row">
                      <ProductThumb product={p} />
                      <div className="txt">
                        <b>{p.name}</b>
                        <small>{p.description}</small>
                        <b className="num" style={{ marginTop: 2 }}>{rp(p.price)}</b>
                      </div>
                      <span className="add-dot" aria-hidden="true">
                        <Icon name="plus" size={18} />
                      </span>
                    </Link>
                  ) : (
                    <div key={p.id} className="product-row is-out" aria-disabled="true">
                      <ProductThumb product={p} />
                      <div className="txt">
                        <b>{p.name}</b>
                        <small>{p.description}</small>
                        <b className="num" style={{ marginTop: 2 }}>{rp(p.price)}</b>
                      </div>
                      <span className="sold">Habis</span>
                    </div>
                  ),
                )}
            </section>
          ))}
      </main>
      {cart.count > 0 && (
        <footer className="cust-foot">
          <Link to={`/t/${token}/cart`} className="btn btn-primary btn-lg btn-block" style={{ justifyContent: 'space-between' }}>
            <Icon name="cart" />
            <span>{cart.count} item</span>
            <span className="num">{rp(totals.total)}</span>
          </Link>
        </footer>
      )}
    </>
  );
}
