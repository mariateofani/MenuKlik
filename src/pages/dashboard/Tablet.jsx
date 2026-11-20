import { useState } from 'react';
import { Segmented } from '../../components/ui.jsx';
import Kitchen from './Kitchen.jsx';
import Waiter from './Waiter.jsx';

// Tablet bersama (konfigurasi Standard): satu layar untuk dapur dan antar. Izin tetap mengikuti akun yang sedang masuk.
export default function Tablet() {
  const [tab, setTab] = useState('kitchen');
  return (
    <>
      <Segmented label="Tablet bersama" value={tab} onChange={setTab} options={[['kitchen', 'Dapur'], ['waiter', 'Antar']]} />
      {tab === 'kitchen' ? <Kitchen /> : <Waiter />}
    </>
  );
}
