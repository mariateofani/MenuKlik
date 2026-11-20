import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { deleteCategory, deleteProduct, moveCategory, optionsOf, saveCategory, saveProduct, setProductFlag } from '../../services/api.js';
import ProductForm from '../../components/ProductForm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Button, Chips, Empty, Forbidden, IconButton, Modal, PageHeader, ProductThumb, Segmented, Switch } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { can } from '../../lib/constants.js';
import { rp } from '../../lib/format.js';

// `only`: 'menu' atau 'categories' menampilkan satu bagian saja (halaman Menu dan Kategori terpisah).
export default function MenuManage({ only }) {
  const { rid, roles } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  const [tabState, setTab] = useState('menu');
  const tab = only || tabState;
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | productId
  const [confirmDel, setConfirmDel] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState(null);

  const data = useDb((db) => ({
    categories: db.categories.filter((c) => c.restaurant_id === rid).sort((a, b) => a.sort_order - b.sort_order),
    products: db.products.filter((p) => p.restaurant_id === rid && !p.is_archived).sort((a, b) => a.sort_order - b.sort_order),
    optionsFor: (pid) => optionsOf(db, pid),
  }));
  if (!can(roles, 'menu.manage')) return <Forbidden />;

  const run = (fn, msg) => {
    try {
      const r = fn();
      if (msg) toast(typeof msg === 'function' ? msg(r) : msg, 'success');
      return r;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };

  const s = q.trim().toLowerCase();
  const list = data.products.filter((p) => (cat === 'all' || p.category_id === cat) && (!s || p.name.toLowerCase().includes(s)));
  const catName = (id) => data.categories.find((c) => c.id === id)?.name || '-';
  const editProduct = editing && editing !== 'new' ? data.products.find((p) => p.id === editing) : null;

  return (
    <>
      <PageHeader title={only === 'categories' ? 'Kategori' : only === 'menu' ? 'Menu' : 'Menu & Kategori'} subtitle="Ubah ketersediaan harian dengan satu klik. Perubahan harga tidak mengubah pesanan lama karena harga disalin saat checkout.">
        {!only && <Segmented label="Bagian" value={tab} onChange={setTab} options={[['menu', 'Menu'], ['categories', 'Kategori']]} />}
        {tab === 'menu' && <Button variant="primary" icon="plus" onClick={() => setEditing('new')} disabled={!data.categories.length}>Tambah menu</Button>}
      </PageHeader>

      {tab === 'menu' ? (
        <>
          <div className="row">
            <label className="search" style={{ flex: '1 1 240px' }}>
              <Icon name="search" size={16} />
              <input type="search" placeholder="Cari menu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari menu" />
            </label>
          </div>
          <Chips label="Kategori" value={cat} onChange={setCat} options={[['all', 'Semua', data.products.length], ...data.categories.map((c) => [c.id, c.name, data.products.filter((p) => p.category_id === c.id).length])]} />
          {list.length === 0 ? (
            <Empty title="Belum ada menu di sini" icon="book" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Menu</th><th>Kategori</th><th className="r">Harga</th><th>Variasi / tambahan</th><th>Stok hari ini</th><th>Tampil</th><th /></tr></thead>
                <tbody>
                  {list.map((p) => {
                    const opts = data.optionsFor(p.id);
                    const groups = [...new Set(opts.filter((o) => o.kind === 'variant').map((o) => o.group_name))];
                    const addons = opts.filter((o) => o.kind === 'addon').length;
                    return (
                      <tr key={p.id}>
                        <td><div className="row" style={{ flexWrap: 'nowrap' }}><ProductThumb product={p} size="sm" /><b>{p.name}</b></div></td>
                        <td>{catName(p.category_id)}</td>
                        <td className="r num">{rp(p.price)}</td>
                        <td className="muted">{[...groups, addons ? `${addons} tambahan` : null].filter(Boolean).join(', ') || '-'}</td>
                        <td><Switch checked={p.is_available} onChange={(v) => run(() => setProductFlag(session, p.id, 'is_available', v), `${p.name}: ${v ? 'tersedia' : 'habis'}`)} label={p.is_available ? 'Tersedia' : 'Habis'} /></td>
                        <td><Switch checked={p.is_active} onChange={(v) => run(() => setProductFlag(session, p.id, 'is_active', v))} label={p.is_active ? 'Ya' : 'Tidak'} /></td>
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                            <IconButton icon="edit" label={`Ubah ${p.name}`} onClick={() => setEditing(p.id)} />
                            <IconButton icon="trash" label={`Hapus ${p.name}`} onClick={() => setConfirmDel(p)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="grid-2">
          <section className="card">
            <div className="card-head"><h2>Daftar kategori</h2><span className="small muted">Urutan ini dipakai di menu pelanggan</span></div>
            {data.categories.map((c, i) => {
              const count = data.products.filter((p) => p.category_id === c.id).length;
              return (
                <div key={c.id} className="row-between" style={{ borderTop: i ? '1px solid var(--line)' : 0, paddingTop: i ? 10 : 0 }}>
                  {renaming?.id === c.id ? (
                    <form className="row" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); if (run(() => saveCategory(session, { id: c.id, name: renaming.name, is_active: c.is_active }), 'Kategori disimpan')) setRenaming(null); }}>
                      <input className="input" style={{ flex: 1 }} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} aria-label="Nama kategori" autoFocus />
                      <Button size="sm" variant="primary" type="submit">Simpan</Button>
                      <Button size="sm" onClick={() => setRenaming(null)}>Batal</Button>
                    </form>
                  ) : (
                    <>
                      <div><b>{c.name}</b> <span className="small muted">· {count} menu</span></div>
                      <div className="row" style={{ gap: 6 }}>
                        <Switch checked={c.is_active} onChange={(v) => run(() => saveCategory(session, { id: c.id, name: c.name, is_active: v }))} label={c.is_active ? 'Tampil' : 'Sembunyi'} />
                        <IconButton icon="back" label="Naikkan" className="rot90" onClick={() => run(() => moveCategory(session, c.id, -1))} disabled={i === 0} />
                        <IconButton icon="next" label="Turunkan" className="rot90" onClick={() => run(() => moveCategory(session, c.id, 1))} disabled={i === data.categories.length - 1} />
                        <IconButton icon="edit" label="Ganti nama" onClick={() => setRenaming({ id: c.id, name: c.name })} />
                        <IconButton icon="trash" label="Hapus kategori" onClick={() => run(() => deleteCategory(session, c.id), 'Kategori dihapus')} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </section>
          <form className="card" onSubmit={(e) => { e.preventDefault(); if (run(() => saveCategory(session, { name: newCat }), 'Kategori ditambahkan')) setNewCat(''); }}>
            <h2 style={{ fontSize: 15 }}>Tambah kategori</h2>
            <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Contoh: Gorengan" aria-label="Nama kategori baru" required />
            <Button variant="primary" type="submit">Tambah kategori</Button>
            <p className="note">Kategori tanpa menu aktif tidak ditampilkan ke pelanggan. Kategori hanya bisa dihapus jika sudah kosong.</p>
          </form>
        </div>
      )}

      {editing && (
        <ProductForm
          key={editing}
          open
          product={editProduct}
          options={editProduct ? data.optionsFor(editProduct.id) : []}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            saveProduct(session, input);
            toast(editProduct ? 'Menu disimpan' : `${input.name} ditambahkan`, 'success');
            setEditing(null);
          }}
        />
      )}

      <Modal
        open={!!confirmDel}
        title="Hapus menu?"
        onClose={() => setConfirmDel(null)}
        footer={
          <>
            <Button onClick={() => setConfirmDel(null)}>Batal</Button>
            <Button variant="danger" onClick={() => { run(() => deleteProduct(session, confirmDel.id), (r) => (r?.archived ? 'Menu diarsipkan karena pernah dipesan' : 'Menu dihapus')); setConfirmDel(null); }}>Hapus</Button>
          </>
        }
      >
        <p>
          <b>{confirmDel?.name}</b> akan dihapus dari daftar menu. Jika menu ini pernah dipesan, sistem mengarsipkannya agar riwayat pesanan tetap utuh.
        </p>
      </Modal>
    </>
  );
}
