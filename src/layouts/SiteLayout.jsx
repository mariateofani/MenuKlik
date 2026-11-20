import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useDb } from '../hooks/useDb.js';
import { platformSettings } from '../services/api.js';
import DemoBar from '../components/DemoBar.jsx';
import { Icon } from '../lib/icons.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import RoleSwitcher from '../components/RoleSwitcher.jsx';
import { roleLabels } from '../lib/constants.js';

export const SITE_NAV = [['/', 'Beranda'], ['/fitur', 'Fitur'], ['/cara-kerja', 'Cara Kerja'], ['/harga', 'Harga'], ['/tentang', 'Tentang Kami'], ['/faq', 'FAQ']];

// Kerangka situs pemasaran: bilah panel demo di atas, header situs, isi halaman, lalu footer.
export default function SiteLayout() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const trial = useDb((db) => platformSettings(db));
  return (
    <div className="site">
      <DemoBar />
      <header className="site-head">
        <div className="site-head-in">
          <Link to="/" className="brand-btn" aria-label="MenuKlik, ke beranda"><span className="brand-logo"><Icon name="qr" size={16} /></span>MenuKlik</Link>
          <nav className={`site-links ${open ? 'open' : ''}`} aria-label="Menu utama">
            {SITE_NAV.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'} className="site-link" onClick={() => setOpen(false)}>{l}</NavLink>)}
          </nav>
          <div className="site-cta">
            {session ? (
              <>
                <span className="user-chip" title={session.email}><span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{session.name[0]}</span><span><b>{session.name}</b><small>{session.kind === 'staff' ? roleLabels(session.roles) : session.kind === 'admin' ? 'Super Admin' : 'Pemilik baru'}</small></span></span>
                <RoleSwitcher size="btn-sm" />
                <button type="button" className="btn btn-sm btn-ghost" onClick={logout}>Keluar</button>
              </>
            ) : (
              <><GoogleSignIn className="btn btn-sm" label="Masuk dengan Google" /><Link className="btn btn-sm btn-ghost" to="/login">Masuk</Link><Link className="btn btn-sm btn-cta" to="/daftar">Daftar</Link></>
            )}
            <button type="button" className="icon-btn menu-toggle" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="list" size={16} /></button>
          </div>
        </div>
      </header>
      <main className="site-body"><Outlet context={{ trial }} /></main>
      <footer className="site-foot">
        <div className="foot-grid">
          <div className="stack" style={{ gap: 6 }}><span className="brand" style={{ fontSize: 16, padding: 0 }}><span className="brand-logo"><Icon name="qr" size={16} /></span>MenuKlik</span><p className="small muted">Menu digital dan pemesanan dari meja untuk warung, kedai, kafe, dan restoran.</p></div>
          <div className="stack" style={{ gap: 4 }}><b className="small">Produk</b>{[['/fitur', 'Fitur'], ['/cara-kerja', 'Cara Kerja'], ['/harga', 'Harga'], ['/coba', 'Coba sebagai pelanggan']].map(([to, l]) => <Link key={to} to={to} className="foot-link">{l}</Link>)}</div>
          <div className="stack" style={{ gap: 4 }}><b className="small">Perusahaan</b><Link to="/tentang" className="foot-link">Tentang Kami</Link><Link to="/faq" className="foot-link">FAQ</Link><span className="small muted">Bantuan: 0800-0000-000 (contoh)</span></div>
          <div className="stack" style={{ gap: 4 }}><b className="small">Akun</b><Link to="/login" className="foot-link">Masuk</Link><Link to="/daftar" className="foot-link">Daftar Sekarang</Link></div>
        </div>
        <p className="small muted foot-note">Prototype simulasi. MenuKlik adalah nama kerja. Harga, testimoni, dan informasi perusahaan di situs ini adalah contoh. Tidak ada transaksi uang sungguhan.</p>
      </footer>
    </div>
  );
}
