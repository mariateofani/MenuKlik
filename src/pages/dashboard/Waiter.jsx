import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import { useNow } from '../../hooks/useNow.js';
import { checkOrderAction, ORDER_ACTION_LABEL, runOrderAction, selectServingQueue } from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Empty, Forbidden, PageHeader, StatusTrio } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { can, deviceLabel } from '../../lib/constants.js';
import { minutesSince, time } from '../../lib/format.js';

const TABS = [['ready', 'Siap diambil', 'fire'], ['going', 'Diantar', 'walk'], ['all', 'Belum disajikan', 'list']];

// Dashboard waiter (mobile-first): nomor meja besar, satu tombol utama per kartu, tanpa harga.
export default function Waiter() {
  const { rid, roles, settings } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  useNow(30000);
  const [tab, setTab] = useState('ready');
  const queue = useDb((db) => selectServingQueue(db, rid));
  if (!can(roles, 'serving.view')) return <Forbidden />;

  const ready = queue.filter((o) => o.serving_status === 'waiting_pickup');
  const going = queue.filter((o) => o.serving_status === 'picked_up');
  const list = tab === 'ready' ? ready : tab === 'going' ? going : queue;
  const counts = { ready: ready.length, going: going.length, all: 0 };

  const act = (o, action) => {
    try {
      runOrderAction(session, o.id, action, { device: deviceLabel(settings, 'waiter') });
      toast(`${o.order_number}: ${ORDER_ACTION_LABEL[action]}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <PageHeader title="Waiter" subtitle="Makanan yang siap diambil muncul otomatis saat dapur menandai Siap." />
      <div className="chips" role="tablist" aria-label="Daftar waiter">
        {TABS.map(([k, l, icon]) => (
          <button key={k} type="button" className="chip" role="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>
            <Icon name={icon} size={14} /> {l}{counts[k] ? <span className="chip-n">{counts[k]}</span> : null}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty title="Tidak ada pesanan" icon="walk">{tab === 'ready' ? 'Belum ada makanan yang siap diambil.' : tab === 'going' ? 'Tidak ada yang sedang diantar.' : 'Semua pesanan sudah disajikan.'}</Empty>
      ) : (
        <div className="order-grid">
          {list.map((o) => {
            const action = o.serving_status === 'waiting_pickup' ? 'pickup' : o.serving_status === 'picked_up' ? 'deliver' : null;
            const full = { ...o, payment_method: 'cashier', pay_policy: 'pay_later', cancelled: false };
            const c = action ? checkOrderAction(full, roles, action, settings) : null;
            const quick = o.serving_status === 'waiting_pickup' ? checkOrderAction(full, roles, 'deliver', settings) : null;
            return (
              <article key={o.id} className={`wcard ${o.serving_status === 'waiting_pickup' ? 'hot' : ''}`}>
                <div className="row-between"><span className="wtable">Meja {o.table}</span><span className="mono small muted">{o.order_number}</span></div>
                <ul>{o.items.map((i) => <li key={i.id}>{i.qty}x {i.name}{i.options ? <span className="muted"> ({i.options})</span> : null}</li>)}</ul>
                <StatusTrio order={o} compact />
                {o.ready_at && <span className="small muted">Siap sejak {time(o.ready_at)} · {minutesSince(o.ready_at)} mnt</span>}
                {action && (
                  <>
                    <button type="button" className={`btn btn-block ${action === 'pickup' ? 'btn-cta' : 'btn-primary'}`} disabled={!c.ok} onClick={() => act(o, action)}>{ORDER_ACTION_LABEL[action]}</button>
                    {!c.ok && <p className="reason">{c.reason}</p>}
                  </>
                )}
                {quick?.ok && <button type="button" className="link small" onClick={() => act(o, 'deliver')}>Langsung tandai sudah diantar</button>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
