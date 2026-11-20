import { useEffect } from 'react';
import { Icon } from '../lib/icons.jsx';
import { KITCHEN_STATUS, SERVING_STATUS, PAYMENT_STATUS, SUB_STATUS, TICKET_STATUS } from '../lib/constants.js';

export function Button({ variant = 'default', size, block, icon, children, className = '', type = 'button', ...rest }) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={17} />
    </button>
  );
}

const MAPS = { kitchen: KITCHEN_STATUS, serving: SERVING_STATUS, payment: PAYMENT_STATUS, sub: SUB_STATUS, ticket: TICKET_STATUS };
export function Pill({ type, value, label, tone }) {
  const def = type ? MAPS[type][value] : null;
  return <span className={`pill tone-${tone || def?.tone || 'muted'}`}>{label || def?.label || value}</span>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, highlight }) {
  return (
    <div className={`stat ${highlight ? 'stat-hl' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Empty({ title, children, icon = 'layers' }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <b>{title}</b>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <small className="field-error">{error}</small> : hint && <small className="muted">{hint}</small>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} className="switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="switch-track" />
      {label}
    </button>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(([v, l, count]) => (
        <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
          {count !== undefined && <span className="chip-n">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 50, small }) {
  return (
    <div className={`stepper ${small ? 'stepper-sm' : ''}`}>
      <button type="button" aria-label="Kurangi" onClick={() => onChange(value - 1)} disabled={value <= min}>
        <Icon name="minus" size={15} />
      </button>
      <b className="num">{value}</b>
      <button type="button" aria-label="Tambah" onClick={() => onChange(value + 1)} disabled={value >= max}>
        <Icon name="plus" size={15} />
      </button>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Tutup" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay overlay-drawer" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Tutup" onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function BarChart({ data, format = (v) => v, highlightLast = true }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
      {data.map((d, i) => (
        <div key={d.label + i} className={`bar ${highlightLast && i === data.length - 1 ? 'bar-hl' : ''}`} title={`${d.label}: ${format(d.value)}`}>
          <span className="bar-v">{format(d.value)}</span>
          <div className="bar-col" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}

export function HBar({ label, value, max, display, alt }) {
  return (
    <div className="hbar">
      <div className="hbar-row">
        <span>{label}</span>
        <b className="num">{display ?? value}</b>
      </div>
      <div className="hbar-track">
        <div className={`hbar-fill ${alt ? 'hbar-alt' : ''}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export function ProductThumb({ product, size = 'md' }) {
  const drink = /minum|kopi|teh|jus/i.test(product.categoryName || '') || product.category_id === 'cat_drink';
  if (product.image_url) return <img className={`thumb thumb-${size}`} src={product.image_url} alt="" />;
  return (
    <div className={`thumb thumb-${size} ${drink ? 'thumb-drink' : 'thumb-food'}`} aria-hidden="true">
      <Icon name={drink ? 'cup' : 'bowl'} size={size === 'lg' ? 56 : size === 'sm' ? 18 : 26} />
    </div>
  );
}

export function Forbidden() {
  return <Empty title="Halaman ini tidak tersedia untuk peranmu" icon="lock">Hubungi owner restoran jika kamu butuh akses.</Empty>;
}


// Tiga status pesanan sekaligus: Bayar, Dapur, Saji.
export function StatusTrio({ order, compact }) {
  return (
    <span className="trio">
      <span className={`pill tone-${PAYMENT_STATUS[order.payment_status].tone}`}>{compact ? '' : <b>Bayar: </b>}{PAYMENT_STATUS[order.payment_status].label}</span>
      <span className={`pill tone-${KITCHEN_STATUS[order.kitchen_status].tone}`}>{compact ? '' : <b>Dapur: </b>}{KITCHEN_STATUS[order.kitchen_status].label}</span>
      <span className={`pill tone-${SERVING_STATUS[order.serving_status || 'none'].tone}`}>{compact ? '' : <b>Saji: </b>}{SERVING_STATUS[order.serving_status || 'none'].label}</span>
    </span>
  );
}
