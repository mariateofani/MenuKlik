import { Link, NavLink } from 'react-router-dom';
import { Icon } from '../lib/icons.jsx';

// Bilah panel demo di bagian atas semua halaman non-dashboard (seperti prototipe).
export default function DemoBar() {
  return (
    <div className="demobar">
      <span className="demobar-brand"><span className="brand-logo"><Icon name="qr" size={16} /></span><b>MenuKlik</b><span className="pill tone-orange">Panel demo</span></span>
      <nav className="demobar-tabs" aria-label="Panel demo">
        <NavLink to="/" end className="demo-tab">Website & dashboard</NavLink>
        <NavLink to="/simulasi" className="demo-tab">Simulasi multi-perangkat</NavLink>
        <NavLink to="/demo" className="demo-tab">Data demo</NavLink>
        <NavLink to="/admin" className="demo-tab">Super Admin</NavLink>
      </nav>
    </div>
  );
}
