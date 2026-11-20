import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import DemoBar from '../components/DemoBar.jsx';
import { Icon } from '../lib/icons.jsx';

// Kerangka halaman masuk dan daftar: bilah panel demo + header ramping, seperti di prototipe.
export default function AuthShell() {
  const { session } = useAuth();
  return (
    <div className="site auth-shell">
      <DemoBar />
      <header className="site-head"><div className="site-head-in">
        <Link to="/" className="brand-btn"><span className="brand-logo"><Icon name="qr" size={16} /></span>MenuKlik</Link><span style={{ flex: 1 }} />
        <Link className="btn btn-sm btn-ghost" to="/">{session ? 'Ke beranda' : 'Kembali ke beranda'}</Link>
      </div></header>
      <main className="site-body"><Outlet /></main>
    </div>
  );
}
