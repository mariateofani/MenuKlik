import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { loginWithGoogle } from '../services/api.js';
import { useToast } from './Toast.jsx';
import { Button, Field } from './ui.jsx';

const ACCOUNTS = [
  ['Ratna Sari', 'owner@kedairasa.test', 'Pemilik · Kedai Rasa Nusantara'],
  ['Dimas Pratama', 'cashier@kedairasa.test', 'Kasir dan Waiter'],
  ['Joko Susilo', 'kitchen@kedairasa.test', 'Dapur'],
  ['Sari Lestari', 'waiter@kedairasa.test', 'Waiter'],
  ['Tim MenuKlik', 'admin@menuklik.test', 'Super Admin'],
];

const GLogo = () => <span className="g-logo" aria-hidden="true">G</span>;

// Tombol "Masuk dengan Google" (SIMULASI). Memilih akun membuat sesi lalu tetap di halaman saat ini
// (landing page). Email baru menjadi pemilik baru dan diarahkan ke pendaftaran usaha.
export default function GoogleSignIn({ label = 'Masuk dengan Google', className = 'btn' }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(false);
  const [f, setF] = useState({ name: '', email: '' });
  const go = (email, name) => {
    try {
      const s = signIn(loginWithGoogle({ email, name }));
      setOpen(false);
      setOther(false);
      if (s.kind === 'onboarding') { toast('Akun Google baru. Lengkapi data usahamu.', 'success'); navigate('/daftar'); } else toast(`Masuk sebagai ${s.name}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <>
      <button type="button" className={`${className} google-btn`} onClick={() => setOpen(true)}><GLogo />{label}</button>
      {open && (
        <div className="modal-back" role="presentation" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Pilih akun Google" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ gap: 8 }}><GLogo /><b>Masuk dengan Google</b></div>
            <p className="small muted">Simulasi: tidak terhubung ke Google sungguhan. Pilih salah satu akun contoh di bawah.</p>
            {!other ? (
              <>
                <div className="stack" style={{ gap: 6 }}>
                  {ACCOUNTS.map(([n, e, r]) => (
                    <button key={e} type="button" className="acct" onClick={() => go(e, n)}>
                      <span className="avatar">{n[0]}</span><span><b>{n}</b><br /><span className="small muted">{e} · {r}</span></span>
                    </button>
                  ))}
                </div>
                <button type="button" className="link small" onClick={() => setOther(true)}>Gunakan akun Google lain</button>
              </>
            ) : (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); go(f.email, f.name); }}>
                <Field label="Nama" htmlFor="g-name"><input id="g-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
                <Field label="Email Google" htmlFor="g-email"><input id="g-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
                <div className="row"><Button variant="primary" type="submit">Lanjutkan</Button><Button type="button" onClick={() => setOther(false)}>Kembali</Button></div>
              </form>
            )}
            <Button size="sm" onClick={() => setOpen(false)}>Batal</Button>
          </div>
        </div>
      )}
    </>
  );
}
