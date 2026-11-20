import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignIn from '../../components/GoogleSignIn.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import { Button, Field } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { DEMO_PASSWORD } from '../../services/seed.js';

export default function LoginForm({ title, subtitle, demoAccounts, expect, redirect }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const doLogin = (e, p) => {
    setError('');
    try {
      const s = login(e, p);
      // Setelah masuk, pengguna tetap di landing page. Tombol "Beralih ke dashboard" di sana mengarah sesuai peran.
      navigate(s.kind === 'onboarding' ? '/daftar' : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <Link to="/" className="brand" style={{ padding: 0 }}><span className="brand-logo"><Icon name="qr" size={18} /></span>MenuKlik</Link>
        <div>
          <h1 style={{ fontSize: 21 }}>{title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{subtitle}</p>
        </div>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); doLogin(email, password); }}>
          {error && <p className="alert alert-error">{error}</p>}
          <Field label="Email" htmlFor="l-email"><input id="l-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" htmlFor="l-pass"><input id="l-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button variant="primary" type="submit" block>Masuk</Button>
        </form>
        <div className="stack" style={{ gap: 8 }}>
          <span className="tag">Akun demo · password {DEMO_PASSWORD}</span>
          {demoAccounts.map((a) => (
            <button key={a.email} type="button" className="account" onClick={() => doLogin(a.email, DEMO_PASSWORD)}>
              <span className={`avatar ${a.role}`}>{a.name[0]}</span>
              <span style={{ display: 'grid', flex: 1 }}><b>{a.name}</b><small className="muted">{a.label} · {a.email}</small></span>
              <Icon name="next" size={16} />
            </button>
          ))}
        </div>
        <GoogleSignIn className="btn btn-block" label="Masuk dengan Google" />
        {expect === 'staff' && <Link className="small" to="/lupa-password"><b>Lupa password?</b></Link>}
        {expect === 'staff' && <p className="small">Pemilik usaha baru? <Link to="/daftar"><b>Daftar gratis</b></Link></p>}
        <p className="small muted">Ini versi simulasi tanpa server. Di produk asli, login memakai layanan autentikasi dengan password terenkripsi.</p>
      </div>
    </div>
  );
}
