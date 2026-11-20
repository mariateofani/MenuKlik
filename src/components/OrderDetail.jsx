import { useState } from 'react';
import { checkOrderAction, latestPayment, ORDER_ACTION_LABEL, runOrderAction } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from './Toast.jsx';
import { Button, Field, Pill, StatusTrio } from './ui.jsx';
import { CANCEL_REASONS, CHANNELS, deviceLabel, historyLabel, isActiveOrder, isManual, orderOverall, PAY_POLICY } from '../lib/constants.js';
import { dateTime, rp, time } from '../lib/format.js';

// Panel detail pesanan untuk kasir/owner. Tombol yang tidak boleh dipakai tetap tampil
// dalam keadaan terkunci beserta alasannya, agar pegawai paham urutan prosesnya.
// Mode manual (Basic, atau Standard tanpa tablet): kasir juga mencatat status dapur dan penyajian.
export default function OrderDetail({ order, roles, settings }) {
  const { session } = useAuth();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const p = latestPayment(order);
  const manual = isManual(settings);
  const overall = orderOverall(order);

  const run = (action, extra) => {
    try {
      runOrderAction(session, order.id, action, { ...extra, device: deviceLabel(settings, 'cashier') });
      toast(`${order.order_number}: ${ORDER_ACTION_LABEL[action]}`, 'success');
      setCancelOpen(false);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const actions = ['confirm_cash', 'accept', ...(manual ? ['start', 'ready', 'deliver'] : [])].filter((a) => !(a === 'confirm_cash' && order.payment_method !== 'cashier'));
  const cancelCheck = checkOrderAction(order, roles, 'cancel', settings);

  return (
    <div className="stack-lg">
      <div className="row-between">
        <StatusTrio order={order} />
        <Pill tone={overall.tone} label={overall.label} />
      </div>
      {order.cancelled && <p className="warn">Dibatalkan: {order.cancel_reason}</p>}
      <dl className="kv num">
        <dt>Meja</dt><dd>{order.table?.name}</dd>
        <dt>Waktu</dt><dd>{dateTime(order.created_at)}</dd>
        <dt>Pelanggan</dt><dd>{order.customer_name || '-'}</dd>
        <dt>Metode</dt><dd>{p ? CHANNELS[p.channel] : '-'}</dd>
        <dt>Kebijakan</dt><dd>{order.payment_method === 'digital' ? 'Bayar digital dulu' : PAY_POLICY[order.pay_policy].label}</dd>
      </dl>
      <div className="items-list">
        {order.items.map((i) => (
          <div key={i.id} className="it">
            <span>
              <b>{i.qty}x</b> {i.product_name}
              {(i.options_text || i.note) && <small>{[i.options_text, i.note && `Catatan: ${i.note}`].filter(Boolean).join(' · ')}</small>}
            </span>
            <span className="num">{rp(i.line_total)}</span>
          </div>
        ))}
        {order.note && <div className="note">Catatan pesanan: {order.note}</div>}
        {order.tax_amount > 0 && <div className="it muted"><span>Pajak</span><span className="num">{rp(order.tax_amount)}</span></div>}
        {order.service_amount > 0 && <div className="it muted"><span>Biaya layanan</span><span className="num">{rp(order.service_amount)}</span></div>}
        <div className="it" style={{ borderTop: '1px dashed var(--line)', paddingTop: 8 }}><b>Total</b><b className="num">{rp(order.total)}</b></div>
      </div>

      {!order.cancelled && (
        <div className="stack" style={{ gap: 8 }}>
          {manual && <p className="note">Mode manual: dapur dan penyajian tidak punya perangkat, jadi kasir mencatat statusnya. Riwayat tetap menyimpan siapa yang mencatat.</p>}
          {actions.map((a) => {
            const c = checkOrderAction(order, roles, a, settings);
            if (!c.ok && ['start', 'ready', 'deliver'].includes(a) && !isActiveOrder(order)) return null;
            const variant = a === 'confirm_cash' ? 'cta' : a === 'accept' ? 'primary' : 'default';
            return (
              <div key={a} className="stack" style={{ gap: 6 }}>
                <Button variant={variant} block disabled={!c.ok} onClick={() => run(a)}>{ORDER_ACTION_LABEL[a]}</Button>
                {!c.ok && <p className="reason">{c.reason}</p>}
              </div>
            );
          })}
          {['waiting', 'accepted'].includes(order.kitchen_status) && !cancelOpen && (
            <>
              <Button variant="danger" size="sm" disabled={!cancelCheck.ok} onClick={() => setCancelOpen(true)}>Batalkan pesanan</Button>
              {!cancelCheck.ok && <p className="reason">{cancelCheck.reason}</p>}
            </>
          )}
          {cancelOpen && (
            <div className="note stack" style={{ color: 'var(--fg)' }}>
              <b>Batalkan {order.order_number}?</b>
              {order.payment_status === 'paid' && <span className="muted">Pembayaran akan dicatat sebagai refund.</span>}
              <Field label="Alasan" htmlFor="cancel-reason">
                <select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {CANCEL_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <div className="row">
                <Button variant="danger" size="sm" onClick={() => run('cancel', { reason })}>Ya, batalkan</Button>
                <Button size="sm" onClick={() => setCancelOpen(false)}>Tidak jadi</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <span className="tag">Riwayat · siapa, di perangkat apa</span>
        <div className="history">
          {order.history.map((h) => (
            <div key={h.id}>
              <span className="mono">{time(h.created_at)}</span>
              <span>
                <b>{historyLabel(h.kind, h.to_status)}</b> <span className="muted">· {h.changed_by_label}{h.device && h.device !== '-' ? ` · ${h.device}` : ''}{h.note ? ` · ${h.note}` : ''}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tag">Catatan pembayaran ({order.payments.length})</span>
        <div className="history">
          {order.payments.map((x) => (
            <div key={x.id}>
              <span className="mono">{x.payment_number}</span>
              <span>{CHANNELS[x.channel]} · {rp(x.amount)} <Pill type="payment" value={x.status} /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
