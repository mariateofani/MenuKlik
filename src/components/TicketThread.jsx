import { useState } from 'react';
import { Button, Pill } from './ui.jsx';
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS, TICKET_TEMPLATES, ticketSla } from '../lib/constants.js';
import { dateTime, time } from '../lib/format.js';

export function TicketRow({ t, side, selected, restName, onSelect }) {
  const unread = side === 'owner' ? t.owner_unread > 0 : t.admin_unread;
  return (
    <button type="button" className={`order-card ${selected ? 'selected' : ''} ${unread ? 'needs-action' : ''}`} onClick={() => onSelect(t.id)}>
      <div className="row-between"><span className="mono small muted">{t.ticket_number}{side === 'admin' ? ` · ${restName}` : ''}</span><span className="small muted">{time(t.created_at)}</span></div>
      <b style={{ fontSize: 13.5 }}>{t.subject}</b>
      <div className="trio">
        <Pill type="ticket" value={t.status} />
        <Pill tone={TICKET_PRIORITY[t.priority].tone} label={TICKET_PRIORITY[t.priority].label} />
        {unread && <Pill tone="blue" label={side === 'owner' ? 'Balasan baru' : 'Belum dibaca'} />}
        {t.rating && <Pill tone="orange" label={`Ulasan ${t.rating}/5`} />}
      </div>
    </button>
  );
}

// Percakapan laporan, dipakai pemilik (side="owner") dan Super Admin (side="admin").
export function TicketThread({ t, side, restName, now, onReply, onStatus, onReopen, onRate }) {
  const [text, setText] = useState('');
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState('');
  const sla = ticketSla(t, now);
  const msgs = [{ from: 'owner', who: restName, text: t.message, at: t.created_at }, ...t.replies];
  return (
    <div className="card stack">
      <div className="row-between">
        <div><span className="tag">{t.ticket_number} · {TICKET_CATEGORIES[t.category]}</span><h2 style={{ fontSize: 16 }}>{t.subject}</h2></div>
        <div className="trio">
          <Pill type="ticket" value={t.status} />
          <Pill tone={TICKET_PRIORITY[t.priority].tone} label={TICKET_PRIORITY[t.priority].label} />
          <Pill tone={sla.tone} label={sla.label} />
        </div>
      </div>
      <div className="ctx">
        <b>Konteks otomatis</b>
        <span>Restoran: {restName} · Konfigurasi: {t.config} · Perangkat: {t.device || '-'}</span>
        {t.code && <span>Kode eror: <b className="mono">{t.code}</b></span>}
        {t.context.map((c) => <span key={c}>{c}</span>)}
        <span className="muted">Tidak memuat data pelanggan atau isi transaksi.</span>
      </div>
      <div className="thread">
        {msgs.map((m, i) => m.from === 'sys'
          ? <div key={i} className="msg sys">{m.text} · {time(m.at)}</div>
          : <div key={i} className={`msg ${m.from}`}><small>{m.who || (m.from === 'admin' ? 'Tim MenuKlik' : restName)} · {dateTime(m.at)}</small>{m.text}</div>)}
      </div>
      {side === 'admin' && (
        <div className="row">{TICKET_TEMPLATES.map(([l, x]) => <button key={l} type="button" className="chip" onClick={() => setText(x)}>{l}</button>)}</div>
      )}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (text.trim() && onReply(text)) setText(''); }}>
        <textarea rows={2} aria-label="Balasan" placeholder={side === 'admin' ? 'Tulis balasan untuk pemilik restoran' : 'Tambahkan informasi'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <Button variant="primary" size="sm" type="submit" disabled={!text.trim()}>Kirim balasan</Button>
          {side === 'admin' && Object.entries(TICKET_STATUS).filter(([k]) => k !== t.status).map(([k, v]) => <Button key={k} size="sm" onClick={() => onStatus(k)}>Tandai {v.label.toLowerCase()}</Button>)}
          {side === 'owner' && t.status === 'resolved' && <Button size="sm" variant="danger" onClick={onReopen}>Masih bermasalah</Button>}
        </div>
      </form>
      {side === 'owner' && t.status === 'resolved' && !t.rating && (
        <div className="stack" style={{ gap: 6 }}>
          <b className="small">Beri ulasan penanganan</b>
          <div className="row">{[1, 2, 3, 4, 5].map((n) => <label key={n} className="small row" style={{ gap: 3 }}><input type="radio" name="star" checked={stars === n} onChange={() => setStars(n)} /> {n}</label>)}</div>
          <input aria-label="Komentar ulasan" placeholder="Komentar (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="cta" onClick={() => onRate(stars, note)}>Kirim ulasan</Button>
        </div>
      )}
      {t.rating && <p className="alert alert-ok">Ulasan pemilik: {t.rating}/5{t.rating_note ? ` · ${t.rating_note}` : ''}</p>}
    </div>
  );
}
