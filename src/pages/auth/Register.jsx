import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import {
  BIZ_CATEGORIES, canStartTrial, createRestaurantFromOnboarding, planPrice, platformSettings, resendOtp, startRegistration, startTrial, verifyRegistration,
} from '../../services/api.js';
import { Button, Card, Field, Segmented } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { CONFIGS, FEATURES } from '../../lib/constants.js';
import { DAY, dateShort, rp } from '../../lib/format.js';

const STEPS = ['Akun', 'Verifikasi', 'Profil usaha', 'Operasional', 'Paket', 'Mulai'];

function Progress({ at }) {
  return (
    <ol className="progress" aria-label="Langkah pendaftaran">
      {STEPS.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''}><span>{i < at ? '✓' : i + 1}</span>{s}</li>)}
    </ol>
  );
}

// Pendaftaran pemilik: daftar, verifikasi kode, profil usaha, operasional, pilih paket, lalu uji coba atau bayar.
export default function Register() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const plans = useDb((db) => db.plans.filter((p) => p.is_active));
  const trialOk = useDb((db) => (session ? canStartTrial(db, session.userId) : true));
  const TRIAL_DAYS = useDb((db) => platformSettings(db).trial_days);
  const [step, setStep] = useState(session?.kind === 'onboarding' ? 'ob1' : 'register');
  const [err, setErr] = useState('');
  const [reg, setReg] = useState({ name: '', email: '', phone: '', password: '', password2: '', terms: false });
  const [pending, setPending] = useState(null); // { regId, otp, email, phone }
  const [code, setCode] = useState('');
  const [ob, setOb] = useState({ name: '', category: BIZ_CATEGORIES[0], address: '', phone: '', open: '08:00', close: '21:00', tables: 5, takeaway: false });
  const [period, setPeriod] = useState('monthly');
  const [planId, setPlanId] = useState(null);

  if (session?.kind === 'staff' && step !== 'start') return <Navigate to="/dashboard" replace />;
  if (session?.kind === 'admin') return <Navigate to="/admin" replace />;

  const guard = (fn) => { try { setErr(''); fn(); } catch (e) { setErr(e.message); } };
  const set = (o, setO) => (k) => (e) => setO({ ...o, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const at = { register: 0, verify: 1, ob1: 2, ob2: 3, plans: 4, start: 5 }[step];
  const plan = plans.find((p) => p.id === planId);
  const nowMs = Date.now();

  const pickPlan = (id) => guard(() => {
    const s = createRestaurantFromOnboarding(session, ob, id);
    signIn(s);
    setPlanId(id);
    setStep('start');
  });

  return (
    <div className="auth-page">
      <div className="auth-box" style={{ maxWidth: step === 'plans' ? 980 : 480 }}>
        <Link to="/" className="brand" style={{ padding: 0 }}><span className="brand-logo"><Icon name="qr" size={18} /></span>MenuKlik</Link>
        <Progress at={at} />
        {err && <p className="alert alert-error">{err}</p>}

        {step === 'register' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); guard(() => { setPending(startRegistration(reg)); setCode(''); setStep('verify'); }); }}>
            <h1 style={{ fontSize: 21 }}>Buat akun pemilik usaha</h1>
            <Field label="Nama pemilik" htmlFor="r-name"><input id="r-name" required value={reg.name} onChange={set(reg, setReg)('name')} /></Field>
            <Field label="Email" htmlFor="r-email"><input id="r-email" type="email" required value={reg.email} onChange={set(reg, setReg)('email')} /></Field>
            <Field label="Nomor HP" htmlFor="r-phone"><input id="r-phone" inputMode="tel" placeholder="08xxxxxxxxxx" required value={reg.phone} onChange={set(reg, setReg)('phone')} /></Field>
            <Field label="Password" htmlFor="r-pass" hint="Minimal 8 karakter, ada huruf dan angka"><input id="r-pass" type="password" required value={reg.password} onChange={set(reg, setReg)('password')} /></Field>
            <Field label="Ulangi password" htmlFor="r-pass2"><input id="r-pass2" type="password" required value={reg.password2} onChange={set(reg, setReg)('password2')} /></Field>
            <label className="row small" style={{ flexWrap: 'nowrap' }}><input type="checkbox" checked={reg.terms} onChange={set(reg, setReg)('terms')} /> Saya menyetujui Syarat & Ketentuan serta Kebijakan Privasi MenuKlik (dokumen contoh)</label>
            <Button variant="cta" type="submit" block>Buat akun</Button>
            <p className="small muted">Sudah punya akun? <Link to="/login">Masuk</Link></p>
          </form>
        )}

        {step === 'verify' && pending && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); guard(() => { signIn(verifyRegistration(pending.regId, code)); setStep('ob1'); }); }}>
            <h1 style={{ fontSize: 21 }}>Verifikasi akun</h1>
            <p className="muted small">Kami mengirim kode 6 digit ke <b>{pending.email}</b> dan <b>{pending.phone}</b>.</p>
            <div className="ctx"><span className="tag">Simulasi email / SMS</span><span>Kode verifikasi kamu: <b className="mono" style={{ fontSize: 18, letterSpacing: '.2em' }}>{pending.otp}</b></span></div>
            <Field label="Masukkan kode" htmlFor="r-otp"><input id="r-otp" inputMode="numeric" maxLength={6} className="mono" style={{ fontSize: 20, letterSpacing: '.3em' }} value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></Field>
            <Button variant="primary" type="submit" block>Verifikasi</Button>
            <button type="button" className="link small" onClick={() => guard(() => setPending({ ...pending, otp: resendOtp(pending.regId).otp }))}>Kirim ulang kode</button>
          </form>
        )}

        {step === 'ob1' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); guard(() => {
            if (!ob.name.trim()) throw new Error('Isi nama usaha.');
            if (!ob.address.trim()) throw new Error('Isi alamat usaha.');
            if (!/^[0-9+\-\s]{8,16}$/.test(ob.phone)) throw new Error('Nomor telepon usaha tidak valid.');
            setStep('ob2');
          }); }}>
            <h1 style={{ fontSize: 21 }}>Profil usaha</h1>
            <Field label="Nama restoran atau warung" htmlFor="o-name"><input id="o-name" required value={ob.name} onChange={set(ob, setOb)('name')} /></Field>
            <Field label="Kategori usaha" htmlFor="o-cat"><select id="o-cat" value={ob.category} onChange={set(ob, setOb)('category')}>{BIZ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Alamat usaha" htmlFor="o-addr"><textarea id="o-addr" rows={2} required value={ob.address} onChange={set(ob, setOb)('address')} /></Field>
            <Field label="Nomor telepon usaha" htmlFor="o-phone"><input id="o-phone" inputMode="tel" required value={ob.phone} onChange={set(ob, setOb)('phone')} /></Field>
            <p className="small muted">Logo dan foto usaha bisa diisi nanti di Pengaturan.</p>
            <Button variant="primary" type="submit" block>Lanjut</Button>
          </form>
        )}

        {step === 'ob2' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); guard(() => {
            const t = Math.round(Number(ob.tables));
            if (!(t >= 1 && t <= 100)) throw new Error('Jumlah meja antara 1 dan 100.');
            if (ob.open === ob.close) throw new Error('Jam buka dan tutup tidak boleh sama.');
            setOb({ ...ob, tables: t });
            setStep('plans');
          }); }}>
            <h1 style={{ fontSize: 21 }}>Operasional</h1>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Field label="Jam buka" htmlFor="o-open"><input id="o-open" type="time" value={ob.open} onChange={set(ob, setOb)('open')} /></Field>
              <Field label="Jam tutup" htmlFor="o-close"><input id="o-close" type="time" value={ob.close} onChange={set(ob, setOb)('close')} /></Field>
            </div>
            <Field label="Jumlah meja" htmlFor="o-tables" hint="QR Code dibuat otomatis untuk setiap meja."><input id="o-tables" type="number" min={1} max={100} value={ob.tables} onChange={set(ob, setOb)('tables')} /></Field>
            <label className="row small" style={{ flexWrap: 'nowrap' }}><input type="checkbox" checked disabled /> Makan di tempat (scan QR di meja)</label>
            <label className="row small" style={{ flexWrap: 'nowrap' }}><input type="checkbox" checked={ob.takeaway} onChange={set(ob, setOb)('takeaway')} /> Bungkus / bawa pulang <span className="muted">(dicatat untuk versi berikutnya)</span></label>
            <div className="row"><Button type="button" onClick={() => setStep('ob1')}>Kembali</Button><Button variant="primary" type="submit">Lanjut pilih paket</Button></div>
          </form>
        )}

        {step === 'plans' && (
          <div className="stack-lg">
            <div className="row-between">
              <div><h1 style={{ fontSize: 21 }}>Pilih paket untuk {ob.name || 'restoranmu'}</h1><p className="muted small">Paket menentukan fitur, kuota, dan perangkat yang bisa dipakai. Bisa diganti kapan saja.</p></div>
              <Segmented label="Periode" value={period} onChange={setPeriod} options={[['monthly', 'Bulanan'], ['yearly', 'Tahunan']]} />
            </div>
            <div className="grid-3">
              {plans.map((p) => {
                const over = p.max_tables && ob.tables > p.max_tables;
                return (
                  <Card key={p.id} title={p.name}>
                    <p className="small muted">{p.description}</p>
                    <b className="num" style={{ fontSize: 22 }}>{rp(planPrice(p, period))}<small className="muted">/{period === 'yearly' ? 'tahun' : 'bulan'}</small></b>
                    <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{FEATURES.map(([f, l]) => <li key={f} style={{ opacity: p.features.includes(f) ? 1 : 0.4, textDecoration: p.features.includes(f) ? 'none' : 'line-through' }}>{l}</li>)}</ul>
                    <span className="small"><b>Kuota:</b> {p.max_tables ? `${p.max_tables} meja` : 'meja tanpa batas'} · {p.max_staff ? `${p.max_staff} pegawai` : 'pegawai tanpa batas'}</span>
                    <span className="small muted">Perangkat: {p.configs.map((c) => CONFIGS[c].name).join(' / ')}</span>
                    <Button variant="primary" block disabled={!!over} onClick={() => pickPlan(p.id)}>Pilih {p.name}</Button>
                    {over && <p className="reason">Kamu mengisi {ob.tables} meja; kuota paket ini {p.max_tables}.</p>}
                  </Card>
                );
              })}
            </div>
            <Button onClick={() => setStep('ob2')}>Kembali</Button>
          </div>
        )}

        {step === 'start' && plan && (
          <div className="stack-lg">
            <h1 style={{ fontSize: 21 }}>Paket {plan.name} dipilih</h1>
            <Card title="Pilihan 1: mulai uji coba gratis">
              {trialOk ? (
                <>
                  <p className="small muted">Coba semua fitur paket {plan.name} selama <b>{TRIAL_DAYS} hari</b>, tanpa pembayaran di depan.</p>
                  <div className="ctx"><span>Mulai: <b>{dateShort(nowMs)}</b></span><span>Berakhir: <b>{dateShort(nowMs + TRIAL_DAYS * DAY)}</b></span><span>Pengingat dikirim 3 hari dan 1 hari sebelum berakhir.</span></div>
                  <Button variant="primary" onClick={() => guard(() => { startTrial(session); navigate('/dashboard', { replace: true }); })}>Mulai uji coba {TRIAL_DAYS} hari</Button>
                </>
              ) : <p className="note">Uji coba gratis tidak tersedia untuk akun ini: program sedang ditutup, atau akun ini sudah memakainya (sekali per akun).</p>}
            </Card>
            <Card title="Pilihan 2: berlangganan sekarang">
              <p className="small muted">Bayar bulanan atau tahunan. Langganan aktif setelah pembayaran terverifikasi.</p>
              <Button variant="cta" onClick={() => navigate('/dashboard/subscription', { replace: true, state: { checkout: { kind: 'new', planId: plan.id } } })}>Lanjut ke pembayaran</Button>
            </Card>
            <p className="small muted">Restoran {ob.name} dan {ob.tables} QR meja sudah dibuat. Sebelum langganan dimulai, fitur operasional dibatasi, tetapi data tetap aman.</p>
          </div>
        )}
      </div>
    </div>
  );
}
