import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../../services/api.js';
import { Button, Field } from '../../components/ui.jsx';

// /lupa-password: minta tautan. /atur-ulang/:token: pilih password baru.
export default function ForgotPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null);
  const [pw, setPw] = useState({ a: '', b: '' });
  const [err, setErr] = useState('');
  const run = (fn) => { try { setErr(''); fn(); } catch (e) { setErr(e.message); } };

  if (token) {
    return (
      <form className="auth-box" onSubmit={(e) => { e.preventDefault(); run(() => { resetPassword(token, pw.a, pw.b); navigate('/login', { replace: true, state: { notice: 'Password berhasil diganti. Silakan masuk.' } }); }); }}>
        <h1 style={{ fontSize: 21 }}>Atur password baru</h1>
        {err && <p className="alert alert-error">{err}</p>}
        <Field label="Password baru" htmlFor="np1" hint="Minimal 8 karakter, ada huruf dan angka"><input id="np1" type="password" required value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
        <Field label="Ulangi password" htmlFor="np2"><input id="np2" type="password" required value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
        <Button variant="primary" type="submit" block>Simpan password</Button>
      </form>
    );
  }
  return (
    <form className="auth-box" onSubmit={(e) => { e.preventDefault(); run(() => setSent(requestPasswordReset(email))); }}>
      <h1 style={{ fontSize: 21 }}>Lupa password</h1>
      {sent && <p className="alert alert-ok">Jika email terdaftar, tautan atur ulang sudah dikirim. Tautan berlaku 30 menit dan hanya bisa dipakai sekali.</p>}
      {sent?.demoToken && <div className="ctx"><span className="tag">Simulasi email</span><Link to={`/atur-ulang/${sent.demoToken}`}><b>Buka tautan atur ulang password</b></Link></div>}
      {err && <p className="alert alert-error">{err}</p>}
      <Field label="Email akun" htmlFor="fg-email"><input id="fg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Button variant="primary" type="submit" block>Kirim tautan atur ulang</Button>
      <Link className="small" to="/login">Kembali ke Masuk</Link>
    </form>
  );
}
