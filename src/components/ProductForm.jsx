import { useState } from 'react';
import { Button, Field, IconButton, Modal, ProductThumb, Switch } from './ui.jsx';
import { resizeImage } from '../lib/image.js';

const blankOption = (kind) => ({ key: Math.random().toString(36).slice(2), kind, group_name: kind === 'addon' ? 'Tambahan' : '', name: '', price_delta: 0 });

export default function ProductForm({ open, product, options = [], categories, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: product?.id,
    name: product?.name || '',
    category_id: product?.category_id || categories[0]?.id || '',
    price: product?.price ?? '',
    description: product?.description || '',
    image_url: product?.image_url || null,
    is_available: product ? product.is_available : true,
    is_active: product ? product.is_active : true,
  }));
  const [opts, setOpts] = useState(() => options.map((o) => ({ ...o, key: o.id })));
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setOpt = (key, patch) => setOpts((list) => list.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      set({ image_url: await resizeImage(file) });
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    try {
      onSave({ ...form, options: opts.map(({ key, ...o }) => o) });
    } catch (err) {
      setError(err.message);
    }
  };

  const variants = opts.filter((o) => o.kind === 'variant');
  const addons = opts.filter((o) => o.kind === 'addon');

  return (
    <Modal
      open={open}
      wide
      title={product ? `Ubah ${product.name}` : 'Tambah menu baru'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" type="submit" form="product-form">{product ? 'Simpan perubahan' : 'Tambah menu'}</Button>
        </>
      }
    >
      <form id="product-form" className="stack-lg" onSubmit={submit}>
        {error && <p className="alert alert-error">{error}</p>}
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <ProductThumb product={{ ...form, category_id: form.category_id }} />
          <div className="stack" style={{ flex: 1, minWidth: 200 }}>
            <Field label="Foto menu" hint="JPG atau PNG. Foto dikecilkan otomatis." htmlFor="pf-photo">
              <input id="pf-photo" type="file" accept="image/*" onChange={onFile} />
            </Field>
            {form.image_url && <button type="button" className="link-btn small" style={{ justifySelf: 'start' }} onClick={() => set({ image_url: null })}>Hapus foto</button>}
          </div>
        </div>
        <div className="form-grid">
          <Field label="Nama menu" htmlFor="pf-name">
            <input id="pf-name" required maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Contoh: Soto Ayam" />
          </Field>
          <Field label="Kategori" htmlFor="pf-cat">
            <select id="pf-cat" value={form.category_id} onChange={(e) => set({ category_id: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Harga (Rp)" hint={product ? 'Harga baru hanya berlaku untuk pesanan baru.' : undefined} htmlFor="pf-price">
            <input id="pf-price" type="number" min="0" step="500" required value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="15000" />
          </Field>
        </div>
        <Field label="Deskripsi" htmlFor="pf-desc">
          <textarea id="pf-desc" rows={2} maxLength={160} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Bahan utama dan rasa" />
        </Field>
        <div className="row" style={{ gap: 20 }}>
          <Switch checked={form.is_available} onChange={(v) => set({ is_available: v })} label={form.is_available ? 'Tersedia hari ini' : 'Habis'} />
          <Switch checked={form.is_active} onChange={(v) => set({ is_active: v })} label={form.is_active ? 'Ditampilkan di menu' : 'Disembunyikan'} />
        </div>

        <div className="stack">
          <div className="row-between">
            <div><b>Variasi</b><div className="small muted">Pelanggan wajib memilih satu dari setiap grup, misalnya Ukuran atau Level pedas.</div></div>
            <Button size="sm" icon="plus" onClick={() => setOpts((l) => [...l, blankOption('variant')])}>Variasi</Button>
          </div>
          {variants.map((o) => (
            <div key={o.key} className="option-row">
              <input className="input" aria-label="Nama grup" placeholder="Grup, mis. Ukuran" value={o.group_name} onChange={(e) => setOpt(o.key, { group_name: e.target.value })} />
              <input className="input" aria-label="Nama pilihan" placeholder="Pilihan, mis. Jumbo" value={o.name} onChange={(e) => setOpt(o.key, { name: e.target.value })} />
              <input className="input" aria-label="Tambahan harga" type="number" step="500" min="0" value={o.price_delta} onChange={(e) => setOpt(o.key, { price_delta: e.target.value })} />
              <IconButton icon="trash" label="Hapus pilihan" onClick={() => setOpts((l) => l.filter((x) => x.key !== o.key))} />
            </div>
          ))}
          {!variants.length && <p className="small muted">Belum ada variasi.</p>}
        </div>
        <div className="stack">
          <div className="row-between">
            <div><b>Tambahan (topping)</b><div className="small muted">Opsional, boleh dipilih lebih dari satu.</div></div>
            <Button size="sm" icon="plus" onClick={() => setOpts((l) => [...l, blankOption('addon')])}>Tambahan</Button>
          </div>
          {addons.map((o) => (
            <div key={o.key} className="option-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px auto' }}>
              <input className="input" aria-label="Nama tambahan" placeholder="Mis. Telur ceplok" value={o.name} onChange={(e) => setOpt(o.key, { name: e.target.value })} />
              <input className="input" aria-label="Harga tambahan" type="number" step="500" min="0" value={o.price_delta} onChange={(e) => setOpt(o.key, { price_delta: e.target.value })} />
              <IconButton icon="trash" label="Hapus tambahan" onClick={() => setOpts((l) => l.filter((x) => x.key !== o.key))} />
            </div>
          ))}
          {!addons.length && <p className="small muted">Belum ada tambahan.</p>}
        </div>
      </form>
    </Modal>
  );
}
