import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useDb } from '../hooks/useDb.js';
import DemoBar from '../components/DemoBar.jsx';

const TABS = [
  ['/admin/support', 'Kendala restoran', 'support'],
  ['/admin/restaurants', 'Restoran & langganan'],
  ['/admin/subscriptions', 'Transaksi langganan'],
  ['/admin/plans', 'Paket, harga & uji coba'],
  ['/admin/notice', 'Gangguan & pengumuman'],
];

// Super Admin tanpa sidebar: header, lima tab, lalu isi halaman (seperti prototipe).
export default function AdminLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useDb((db) => db.support_tickets.filter((t) => t.admin_unread && t.status !== 'resolved').length);
  if (!session) return <Navigate to="/admin/login" replace />;
  if (session.kind !== 'admin') return <Navigate to="/dashboard" replace />;
  return (
    <div className="site" style={{ maxWidth: 1280 }}>
      <DemoBar />
      <main className="site-body" style={{ paddingTop: 0 }}>
        <div className="row-between">
          <div><span className="tag">Platform MenuKlik · data restoran lain adalah contoh</span><h1 style={{ fontSize: 26, letterSpacing: '-.02em' }}>Super Admin</h1></div>
          <span className="row"><NavLink to="/" end className="btn btn-sm">Ke landing page</NavLink><button type="button" className="btn btn-sm" onClick={() => { logout(); navigate('/'); }}>Keluar ({session.name})</button></span>
        </div>
        <nav className="chips" aria-label="Menu Super Admin">
          {TABS.map(([to, label, badge]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `chip ${isActive ? 'active' : ''}`} aria-current={undefined}>
              {label}{badge && unread > 0 ? <span className="chip-badge">{unread}</span> : null}
            </NavLink>
          ))}
        </nav>
        <Outlet context={{ session }} />
      </main>
    </div>
  );
}
