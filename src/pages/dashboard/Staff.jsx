import { useOutletContext } from 'react-router-dom';
import { Forbidden, PageHeader } from '../../components/ui.jsx';
import { can } from '../../lib/constants.js';
import { StaffTab } from './Settings.jsx';

// Pegawai & peran: satu orang satu akun, boleh punya beberapa peran.
export default function Staff() {
  const { rid, roles } = useOutletContext();
  if (!can(roles, 'staff.manage')) return <Forbidden />;
  return (
    <>
      <PageHeader title="Pegawai & peran" subtitle="Izin seseorang adalah gabungan semua perannya. Kuota akun pegawai mengikuti paket." />
      <StaffTab rid={rid} />
    </>
  );
}
