import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { platformSettings, savePlatformConfig } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Card, Field, PageHeader } from '../../components/ui.jsx';
import { CONFIGS, FEATURES } from '../../lib/constants.js';

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function PlanCard({ plan, f, set }) {
  const up = (k) => (e) => set({ ...f, [k]: e.target.value });
  return (
    <Card title={f.name || plan.name}>
      <Field label="Nama paket" htmlFor={`n-${plan.id}`}><input id={`n-${plan.id}`} value={f.name} onChange={up('name')} /></Field>
      <div className="form-grid">
        <Field label="Harga per bulan (Rp)" htmlFor={`pm-${plan.id}`}><input id={`pm-${plan.id}`} type="number" min="0" step="1000" value={f.price_monthly} onChange={up('price_monthly')} /></Field>
        <Field label="Harga per tahun (Rp)" htmlFor={`py-${plan.id}`}><input id={`py-${plan.id}`} type="number" min="0" step="1000" value={f.price_yearly} onChange={up('price_yearly')} /></Field>
        <Field label="Kuota meja" hint="Kosong = tanpa batas" htmlFor={`pt-${plan.id}`}><input id={`pt-${plan.id}`} type="number" min="1" value={f.max_tables} placeholder="tanpa batas" onChange={up('max_tables')} /></Field>
        <Field label="Kuota pegawai" hint="Kosong = tanpa batas" htmlFor={`ps-${plan.id}`}><input id={`ps-${plan.id}`} type="number" min="1" value={f.max_staff} placeholder="tanpa batas" onChange={up('max_staff')} /></Field>
      </div>
      <Field label="Deskripsi" htmlFor={`d-${plan.id}`}><textarea id={`d-${plan.id}`} rows={2} value={f.description} onChange={up('description')} /></Field>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 4 }}>
        <legend className="small"><b>Fitur</b></legend>
        {FEATURES.map(([k, l]) => <label key={k} className="small row" style={{ flexWrap: 'nowrap', gap: 6 }}><input type="checkbox" checked={f.features.includes(k)} onChange={() => set({ ...f, features: toggle(f.features, k) })} /> {l}</label>)}
      </fieldset>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 4 }}>
        <legend className="small"><b>Konfigurasi perangkat yang diizinkan</b></legend>
        {Object.entries(CONFIGS).map(([k, c]) => <label key={k} className="small row" style={{ flexWrap: 'nowrap', gap: 6 }}><input type="checkbox" checked={f.configs.includes(k)} disabled={k === 'basic'} onChange={() => set({ ...f, configs: toggle(f.configs, k) })} /> {c.name}</label>)}
      </fieldset>
    </Card>
  );
}

// Paket, harga, kuota, fitur, uji coba, dan aturan akses saat langganan berakhir.
export default function AdminPlans() {
  const { session } = useOutletContext();
  const toast = useToast();
  const d = useDb((db) => ({ plans: db.plans, ps: platformSettings(db) }));
  const [forms, setForms] = useState(() => Object.fromEntries(d.plans.map((p) => [p.id, { name: p.name, description: p.description, price_monthly: p.price_monthly, price_yearly: p.price_yearly, max_tables: p.max_tables ?? '', max_staff: p.max_staff ?? '', features: p.features, configs: p.configs }])));
  const [ps, setPs] = useState(d.ps);
  const save = (e) => {
    e.preventDefault();
    try {
      savePlatformConfig(session, { plans: forms, settings: ps });
      toast('Paket dan aturan disimpan', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <form className="stack-lg" onSubmit={save}>
      <PageHeader title="Paket, harga & aturan" subtitle="Harga dan batas di sini adalah angka contoh untuk demo, belum keputusan bisnis." />
      <div className="grid-3">{d.plans.map((p) => <PlanCard key={p.id} plan={p} f={forms[p.id]} set={(v) => setForms({ ...forms, [p.id]: v })} />)}</div>
      <div className="grid-3">
        <Card title="Uji coba gratis">
          <label className="small row" style={{ flexWrap: 'nowrap', gap: 6 }}><input type="checkbox" checked={ps.trial_enabled} onChange={(e) => setPs({ ...ps, trial_enabled: e.target.checked })} /> Program uji coba tersedia</label>
          <Field label="Durasi (hari)" htmlFor="tr-days"><input id="tr-days" type="number" min="1" max="90" value={ps.trial_days} onChange={(e) => setPs({ ...ps, trial_days: e.target.value })} /></Field>
          <p className="small muted">Sekali per akun. Berlaku untuk pendaftaran berikutnya.</p>
        </Card>
        <Card title="Saat langganan berakhir">
          <Field label="Masa tenggang (hari)" htmlFor="gr-days"><input id="gr-days" type="number" min="0" max="30" value={ps.grace_days} onChange={(e) => setPs({ ...ps, grace_days: e.target.value })} /></Field>
          <label className="small row" style={{ flexWrap: 'nowrap', gap: 6 }}><input type="checkbox" checked={ps.qr_when_expired} onChange={(e) => setPs({ ...ps, qr_when_expired: e.target.checked })} /> Pemesanan QR tetap aktif setelah kedaluwarsa</label>
          <label className="small row" style={{ flexWrap: 'nowrap', gap: 6 }}><input type="checkbox" checked={ps.staff_when_expired} onChange={(e) => setPs({ ...ps, staff_when_expired: e.target.checked })} /> Aksi pegawai tetap aktif setelah kedaluwarsa</label>
          <p className="small muted">Data restoran dan transaksi tidak pernah dihapus otomatis. Pemilik selalu bisa masuk, melihat data, dan membayar.</p>
        </Card>
        <Card title="Simpan perubahan">
          <p className="small muted">Harga baru berlaku untuk tagihan berikutnya; tagihan yang sudah dibuat tidak berubah. Restoran yang sedang berlangganan disesuaikan tanpa menghapus data: konfigurasi yang tidak lagi diizinkan diganti, meja berlebih dinonaktifkan.</p>
          <Button variant="primary" type="submit">Simpan paket & aturan</Button>
        </Card>
      </div>
    </form>
  );
}
