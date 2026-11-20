import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import {
  currentSubscription, inviteMember, planOf, respondAccessRequest, selectMembers, settingsOf,
  subscriptionState, updateMember, updateRestaurantProfile, updateSettings,
} from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Card, Field, Forbidden, PageHeader, Pill, Segmented, Switch } from '../../components/ui.jsx';
import { can, CHANNELS, CONFIGS, FEATURES, PAY_POLICY, ROLES, roleLabels } from '../../lib/constants.js';
import { resizeImage } from '../../lib/image.js';
import { DEMO_PASSWORD } from '../../services/seed.js';
import { dateShort, dateTime, rp } from '../../lib/format.js';

const TABS = [['profile', 'Profil'], ['config', 'Konfigurasi perangkat'], ['payment', 'Pembayaran & pajak'], ['notif', 'Notifikasi'], ['sub', 'Langganan'], ['access', 'Akses data & bantuan']];

export default function Settings() {
  const { rid, roles } = useOutletContext();
  const [tab, setTab] = useState('profile');
  if (!can(roles, 'settings.manage')) return <Forbidden />;
  return (
    <>
      <PageHeader title="Pengaturan restoran" subtitle="Perubahan kebijakan pembayaran, pajak, dan biaya layanan hanya berlaku untuk pesanan baru." />
      <div className="chips" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" className="chip" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab rid={rid} />}
      {tab === 'config' && <ConfigTab rid={rid} />}
      {tab === 'payment' && <PaymentTab rid={rid} />}
      {tab === 'notif' && <NotifTab rid={rid} />}
      {tab === 'sub' && <SubscriptionTab />}
      {tab === 'access' && <AccessTab rid={rid} />}
    </>
  );
}

function useRun() {
  const toast = useToast();
  return (fn, msg) => {
    try {
      fn();
      if (msg) toast(msg, 'success');
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };
}

function ConfigTab({ rid }) {
  const { session } = useAuth();
  const run = useRun();
  const d = useDb((db) => ({ s: settingsOf(db, rid), plan: planOf(db, rid), plans: db.plans.filter((p) => p.is_active) }));
  const allowed = (k) => !d.plan || d.plan.configs.includes(k);
  const planFor = (k) => d.plans.find((p) => p.configs.includes(k))?.name;
  return (
    <div className="stack-lg">
      <div className="grid-3">
        {Object.entries(CONFIGS).map(([k, c]) => (
          <button key={k} type="button" className="cfg" aria-pressed={d.s.config === k} onClick={() => run(() => updateSettings(session, { config: k }), `Konfigurasi ${c.name}`)}>
            <div className="row-between"><b style={{ fontSize: 16 }}>{c.name}</b><Pill tone={allowed(k) ? 'green' : 'muted'} label={allowed(k) ? c.dev : `Butuh paket ${planFor(k)}`} /></div>
            <span className="small muted">{c.who}</span>
            <ul>{c.list.map((x) => <li key={x}>{x}</li>)}</ul>
          </button>
        ))}
      </div>
      {d.s.config === 'standard' && (
        <Card>
          <Switch checked={d.s.shared_tablet} onChange={(v) => run(() => updateSettings(session, { shared_tablet: v }))} label="Ada tablet bersama untuk dapur & waiter" />
          <p className="small muted">Jika dimatikan, kasir mencatat status dapur dan penyajian dari halaman Pesanan (mode manual).</p>
        </Card>
      )}
      <p className="note">Konfigurasi bisa diganti kapan saja tanpa kehilangan data. Pesanan yang sedang berjalan tetap lanjut di perangkat yang tersedia. Paket {d.plan?.name || '-'} mengizinkan: {d.plan ? d.plan.configs.map((c) => CONFIGS[c].name).join(', ') : '-'}.</p>
    </div>
  );
}

function ProfileTab({ rid }) {
  const { session } = useAuth();
  const run = useRun();
  const { r, s } = useDb((db) => ({ r: db.restaurants.find((x) => x.id === rid), s: db.restaurant_settings.find((x) => x.restaurant_id === rid) }));
  const [f, setF] = useState({ name: r.name, address: r.address, phone: r.phone, logo_text: r.logo_text, logo_url: r.logo_url, cover_url: r.cover_url, open_time: s.open_time, close_time: s.close_time });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const pick = (key, max) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      set({ [key]: await resizeImage(file, max) });
    } catch (err) {
      run(() => { throw err; });
    }
  };
  const save = (e) => {
    e.preventDefault();
    run(() => {
      updateRestaurantProfile(session, f);
      updateSettings(session, { open_time: f.open_time, close_time: f.close_time });
    }, 'Profil disimpan');
  };
  return (
    <form className="grid-2" onSubmit={save}>
      <Card title="Identitas">
        <Field label="Nama restoran" htmlFor="s-name"><input id="s-name" required value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Alamat" htmlFor="s-addr"><input id="s-addr" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Kontak" htmlFor="s-phone"><input id="s-phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Inisial logo" hint="Dipakai jika belum ada logo" htmlFor="s-init"><input id="s-init" maxLength={4} value={f.logo_text} onChange={(e) => set({ logo_text: e.target.value.toUpperCase() })} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Jam buka" htmlFor="s-open"><input id="s-open" type="time" value={f.open_time} onChange={(e) => set({ open_time: e.target.value })} /></Field>
          <Field label="Jam tutup" htmlFor="s-close"><input id="s-close" type="time" value={f.close_time} onChange={(e) => set({ close_time: e.target.value })} /></Field>
        </div>
      </Card>
      <Card title="Logo & foto sampul">
        <div className="row">
          <div className="cover-logo" style={{ position: 'static' }}>{f.logo_url ? <img src={f.logo_url} alt="" /> : f.logo_text}</div>
          <Field label="Logo" htmlFor="s-logo"><input id="s-logo" type="file" accept="image/*" onChange={pick('logo_url', 240)} /></Field>
        </div>
        <div className="cover" style={{ borderRadius: 12, height: 120, ...(f.cover_url ? { backgroundImage: `url(${f.cover_url})` } : {}) }} />
        <Field label="Foto sampul" htmlFor="s-cover"><input id="s-cover" type="file" accept="image/*" onChange={pick('cover_url', 900)} /></Field>
        <div className="row">
          {f.logo_url && <button type="button" className="link-btn small" onClick={() => set({ logo_url: null })}>Hapus logo</button>}
          {f.cover_url && <button type="button" className="link-btn small" onClick={() => set({ cover_url: null })}>Hapus sampul</button>}
        </div>
      </Card>
      <div><Button variant="primary" type="submit">Simpan profil</Button></div>
    </form>
  );
}

function PaymentTab({ rid }) {
  const { session } = useAuth();
  const run = useRun();
  const s = useDb((db) => db.restaurant_settings.find((x) => x.restaurant_id === rid));
  const [f, setF] = useState({ tax_percent: s.tax_percent, service_percent: s.service_percent, pay_policy: s.pay_policy, channels: { ...s.channels } });
  const example = 25000;
  const tax = Math.round((example * (Number(f.tax_percent) || 0)) / 100);
  const svc = Math.round((example * (Number(f.service_percent) || 0)) / 100);
  return (
    <form className="grid-2" onSubmit={(e) => { e.preventDefault(); run(() => updateSettings(session, f), 'Pengaturan pembayaran disimpan'); }}>
      <Card title="Pajak & biaya layanan">
        <div className="form-grid">
          <Field label="Pajak (%)" htmlFor="p-tax"><input id="p-tax" type="number" min="0" max="30" step="0.5" value={f.tax_percent} onChange={(e) => setF({ ...f, tax_percent: e.target.value })} /></Field>
          <Field label="Biaya layanan (%)" htmlFor="p-svc"><input id="p-svc" type="number" min="0" max="30" step="0.5" value={f.service_percent} onChange={(e) => setF({ ...f, service_percent: e.target.value })} /></Field>
        </div>
        <p className="note">Contoh pesanan {rp(example)}: pajak {rp(tax)}, layanan {rp(svc)}, total {rp(example + tax + svc)}. Keduanya dihitung dari subtotal.</p>
        <h2 style={{ fontSize: 15 }}>Metode pembayaran digital</h2>
        {['qris', 'ewallet', 'va'].map((k) => (
          <label key={k} className="option"><input type="checkbox" checked={!!f.channels[k]} onChange={(e) => setF({ ...f, channels: { ...f.channels, [k]: e.target.checked } })} /><span>{CHANNELS[k]}</span></label>
        ))}
        <p className="small muted">Di produk asli, metode baru aktif setelah akun payment gateway restoran dikonfigurasi dan diverifikasi.</p>
      </Card>
      <Card title="Kebijakan bayar di kasir">
        {Object.entries(PAY_POLICY).map(([k, v]) => (
          <label key={k} className="option">
            <input type="radio" name="policy" checked={f.pay_policy === k} onChange={() => setF({ ...f, pay_policy: k })} />
            <span><b>{v.label}</b><br /><small className="muted">{v.hint}</small></span>
          </label>
        ))}
        <p className="note">Pembayaran digital selalu wajib lunas sebelum pesanan diterima.</p>
      </Card>
      <div><Button variant="primary" type="submit">Simpan</Button></div>
    </form>
  );
}

function NotifTab({ rid }) {
  const { session } = useAuth();
  const run = useRun();
  const s = useDb((db) => db.restaurant_settings.find((x) => x.restaurant_id === rid));
  return (
    <Card title="Notifikasi di dashboard">
      <Switch checked={s.notify_new_order} onChange={(v) => run(() => updateSettings(session, { notify_new_order: v }))} label="Tampilkan pemberitahuan saat pesanan baru masuk" />
      <Switch checked={s.notify_sound} onChange={(v) => run(() => updateSettings(session, { notify_sound: v }))} label="Bunyikan suara pesanan baru" />
      <p className="note">Browser hanya mengizinkan suara setelah pegawai mengklik halaman setidaknya sekali. Notifikasi WhatsApp atau push ke HP pegawai direncanakan untuk versi berikutnya.</p>
    </Card>
  );
}

function RoleChecks({ value, onChange, disabled, label }) {
  const toggle = (r) => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  return (
    <div className="row" role="group" aria-label={label} style={{ gap: 10 }}>
      {Object.entries(ROLES).map(([k, l]) => (
        <label key={k} className="small row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          <input type="checkbox" checked={value.includes(k)} disabled={disabled} onChange={() => toggle(k)} aria-label={`${label}: ${l}`} /> {l}
        </label>
      ))}
    </div>
  );
}

export function StaffTab({ rid }) {
  const { session } = useAuth();
  const run = useRun();
  const members = useDb((db) => selectMembers(db, rid));
  const [f, setF] = useState({ name: '', email: '', roles: ['cashier'] });
  return (
    <div className="grid-2">
      <Card title="Pegawai & peran">
        {members.map((m) => (
          <div key={m.id} className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, opacity: m.is_active ? 1 : 0.6, gap: 8 }}>
            <div className="row-between">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span className={`avatar ${m.roles[0]}`}>{m.user?.name?.[0]}</span>
                <div><b>{m.user?.name}</b>{m.user_id === session.userId && <span className="small muted"> (kamu)</span>}<div className="small muted">{m.user?.email} · {roleLabels(m.roles)}</div></div>
              </div>
              <Switch checked={m.is_active} disabled={m.user_id === session.userId} onChange={(v) => run(() => updateMember(session, m.id, { is_active: v }), v ? 'Akses diaktifkan' : 'Akses dicabut')} label={m.is_active ? 'Aktif' : 'Nonaktif'} />
            </div>
            <RoleChecks label={`Peran ${m.user?.name}`} value={m.roles} disabled={m.user_id === session.userId} onChange={(roles) => run(() => updateMember(session, m.id, { roles }), 'Peran diperbarui')} />
          </div>
        ))}
        <p className="note">Izin seseorang adalah gabungan semua perannya. Coba cabut peran Dapur dari Joko, lalu lihat tombol di layar dapur terkunci beserta alasannya. Minimal harus ada satu Owner.</p>
      </Card>
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (run(() => inviteMember(session, f), `Undangan dibuat. Password demo: ${DEMO_PASSWORD}`)) setF({ name: '', email: '', roles: ['cashier'] }); }}>
        <h2 style={{ fontSize: 15 }}>Undang pegawai</h2>
        <Field label="Nama" htmlFor="m-name"><input id="m-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="m-email"><input id="m-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Peran (boleh lebih dari satu)" htmlFor="m-role"><RoleChecks label="Peran pegawai baru" value={f.roles} onChange={(roles) => setF({ ...f, roles })} /></Field>
        <Button variant="primary" type="submit">Kirim undangan</Button>
        <p className="note">Satu orang satu akun, agar setiap aksi tercatat atas nama yang benar. Di versi simulasi, akun baru langsung aktif dengan password {DEMO_PASSWORD}. Kuota akun pegawai mengikuti paket.</p>
      </form>
    </div>
  );
}

function SubscriptionTab() {
  return (
    <Card title="Langganan">
      <p className="muted">Ganti paket, perpanjang, batalkan, dan lihat tagihan sekarang ada di halaman Langganan.</p>
      <Link className="btn btn-primary" to="/dashboard/subscription">Buka halaman Langganan</Link>
    </Card>
  );
}

function AccessTab({ rid }) {
  const { session } = useAuth();
  const run = useRun();
  const d = useDb((db) => ({ requests: db.access_requests.filter((a) => a.restaurant_id === rid).sort((a, b) => b.created_at - a.created_at)}));
  return (
    <div className="grid-2">
      <Card title="Permintaan akses data dari tim MenuKlik">
        <p className="small muted">Tim MenuKlik tidak bisa melihat pesanan dan transaksi restoranmu tanpa izin. Izin berlaku 24 jam dan tercatat.</p>
        {d.requests.length === 0 && <p className="muted">Belum ada permintaan.</p>}
        {d.requests.map((a) => (
          <div key={a.id} className="note stack" style={{ color: 'var(--fg)' }}>
            <div className="row-between"><b>{a.requested_by}</b><Pill tone={a.status === 'approved' ? 'green' : a.status === 'declined' ? 'red' : 'amber'} label={{ pending: 'Menunggu', approved: 'Disetujui', declined: 'Ditolak' }[a.status]} /></div>
            <span>Alasan: {a.reason}</span>
            <span className="small muted">{dateTime(a.created_at)}{a.expires_at ? ` · berlaku sampai ${dateTime(a.expires_at)}` : ''}</span>
            {a.status === 'pending' && (
              <div className="row">
                <Button size="sm" variant="primary" onClick={() => run(() => respondAccessRequest(session, a.id, true), 'Akses disetujui selama 24 jam')}>Setujui 24 jam</Button>
                <Button size="sm" onClick={() => run(() => respondAccessRequest(session, a.id, false), 'Permintaan ditolak')}>Tolak</Button>
              </div>
            )}
          </div>
        ))}
      </Card>
      <Card title="Bantuan">
        <p className="muted">Laporan kendala, target respons, dan ulasan penanganan ada di halaman Bantuan.</p>
        <Link className="btn btn-primary" to="/dashboard/help">Buka halaman Bantuan</Link>
      </Card>
    </div>
  );
}
