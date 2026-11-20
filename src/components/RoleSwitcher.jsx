import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { ROLE_HOME, ROLES, ROLE_TASK, roleLabels } from '../lib/constants.js';
import { Icon } from '../lib/icons.jsx';

// Tujuan "beralih ke dashboard" menurut sesi: Super Admin, pegawai (satu atau beberapa peran), atau pemilik baru.
export function dashboardTargets(session) {
  if (!session) return [];
  if (session.kind === 'admin') return [['/admin', 'Dashboard Super Admin', 'Kendala, restoran, langganan, dan paket']];
  if (session.kind === 'onboarding') return [['/daftar', 'Lanjutkan pendaftaran usaha', 'Isi profil usaha lalu pilih paket']];
  return session.roles.map((r) => [ROLE_HOME[r], `Dashboard ${ROLES[r]}`, ROLE_TASK[r]]);
}

// Tombol "Beralih ke dashboard". Satu tujuan jadi tombol langsung; beberapa peran jadi menu pilihan.
export default function RoleSwitcher({ size = '', variant = 'btn-cta' }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const targets = dashboardTargets(session);
  if (!targets.length) return null;
  if (targets.length === 1) return <Link className={`btn ${size} ${variant}`} to={targets[0][0]}><Icon name="monitor" size={15} /> {session.kind === 'onboarding' ? targets[0][1] : `Beralih ke ${targets[0][1].toLowerCase()}`}</Link>;
  return (
    <details className="menu-dd">
      <summary className={`btn ${size} ${variant}`}><Icon name="monitor" size={15} /> Beralih ke dashboard</summary>
      <div className="menu-pop" role="menu" aria-label={`Peran: ${roleLabels(session.roles)}`}>
        {targets.map(([to, l, d]) => <button key={to} type="button" role="menuitem" onClick={() => navigate(to)}><b>{l}</b><span className="small muted">{d}</span></button>)}
      </div>
    </details>
  );
}
