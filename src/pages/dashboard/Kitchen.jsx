import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { useNow } from '../../hooks/useNow.js';
import { checkOrderAction, runOrderAction, selectKitchenQueue } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Forbidden } from '../../components/ui.jsx';
import { can, deviceLabel } from '../../lib/constants.js';
import { minutesSince, time } from '../../lib/format.js';

// Layar dapur (KDS): satu tampilan gelap kontras tinggi agar terbaca dari jauh.
// Tanpa harga, nama pelanggan, atau status pembayaran. Tiket lebih dari 15 menit ditandai merah.
export default function Kitchen() {
  const { rid, roles, settings } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  useNow(30000);
  const queue = useDb((db) => selectKitchenQueue(db, rid));
  if (!can(roles, 'kitchen.view')) return <Forbidden />;

  const act = (o, action, label) => {
    try {
      runOrderAction(session, o.id, action, { device: deviceLabel(settings, 'kitchen') });
      toast(label, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const cols = [
    ['Antrean', queue.filter((o) => o.kitchen_status === 'accepted'), 'queue'],
    ['Sedang dimasak', queue.filter((o) => o.kitchen_status === 'preparing'), 'cook'],
    ['Siap diambil', queue.filter((o) => o.kitchen_status === 'ready'), 'ready'],
  ];

  return (
    <div className="kds" aria-label="Layar dapur">
      <div className="kds-bar"><b>Dapur · {settings.config === 'advanced' ? 'Monitor dapur (KDS)' : 'Layar dapur'}</b><span className="kds-clock">{time(Date.now())}</span></div>
      <div className="kds-cols">
        {cols.map(([title, list, kind]) => (
          <section key={kind} className="kds-col" aria-label={title}>
            <h2>{title}<span>{list.length}</span></h2>
            {list.length === 0 && <div className="kds-empty">Kosong</div>}
            {list.map((o) => {
              const since = kind === 'ready' ? o.ready_at : o.accepted_at;
              const m = minutesSince(since);
              const late = kind !== 'ready' && m >= 15;
              const action = kind === 'queue' ? 'start' : kind === 'cook' ? 'ready' : null;
              const c = action ? checkOrderAction({ ...o, payment_method: 'cashier', payment_status: 'paid' }, roles, action, settings) : null;
              return (
                <article key={o.id} className={`tk ${late ? 'late' : ''}`}>
                  <div className="tk-h"><span className="tk-table">Meja {o.table}</span><span className="tk-no">{o.order_number}</span></div>
                  <span className={`tk-time ${late ? 'late' : ''}`}>
                    {kind === 'ready' ? 'Siap ' : 'Masuk '}{time(since)} · {m} mnt{kind === 'ready' ? (o.serving_status === 'picked_up' ? ' · sedang diantar' : ' · menunggu waiter') : ''}
                  </span>
                  <ul>
                    {o.items.map((i) => (
                      <li key={i.id}>
                        <b>{i.qty}x</b>{i.name}
                        {i.options && <small>{i.options}</small>}
                        {i.note && <span className="kn">{i.note}</span>}
                      </li>
                    ))}
                  </ul>
                  {o.note && <span className="kn" style={{ marginLeft: 0 }}>Pesanan: {o.note}</span>}
                  {action && (
                    <>
                      <button type="button" className={`kbtn ${action === 'start' ? 'start' : 'done'}`} disabled={!c.ok} onClick={() => act(o, action, `${o.order_number} ${action === 'start' ? 'mulai dimasak' : 'siap diambil'}`)}>
                        {action === 'start' ? 'Mulai memasak' : 'Selesai masak'}
                      </button>
                      {!c.ok && <span className="kds-reason">{c.reason}</span>}
                    </>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
