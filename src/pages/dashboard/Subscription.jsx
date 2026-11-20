import { useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDb } from '../../hooks/useDb.js';
import {
  confirmPlanChange, createSubscriptionInvoice, currentSubscription, invoicesOf, planChangeQuote, planPrice, serverNow,
  setSubscriptionFlag, shiftTime, simulateAutoRenew, simulateSubscriptionGateway, subscriptionPhase, platformSettings,
} from '../../services/api.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Card, Empty, Forbidden, PageHeader, Pill, Segmented } from '../../components/ui.jsx';
import { Icon } from '../../lib/icons.jsx';
import { can, CONFIGS, FEATURES, INVOICE_KIND, INVOICE_STATUS, SUB_PHASE } from '../../lib/constants.js';
import { DAY, dateShort, rp } from '../../lib/format.js';
import { QrImage } from '../../components/QrImage.jsx';

const METHODS = { qris: 'QRIS', va: 'Transfer bank (VA)', ewallet: 'E-wallet' };
const featName = (f) => FEATURES.find((x) => x[0] === f)?.[1];

function notices(phase, s, plans, GRACE_DAYS) {
  const d = Math.ceil((s.ends_at - serverNow()) / DAY);
  const end = dateShort(s.ends_at);
  const out = {
    pending: ['warn', 'Selesaikan pembayaran untuk mengaktifkan langganan.'],
    trial_ending: ['warn', `Uji coba berakhir dalam ${d} hari (${end}). Pilih periode langganan agar layanan tidak terhenti.`],
    trial_expired: ['bad', 'Uji coba sudah berakhir. Data tetap aman, tetapi pemesanan QR dan fitur operasional dibatasi.'],
    ending: ['warn', `Langganan berakhir dalam ${d} hari (${end}). ${s.auto_renew ? 'Akan diperpanjang otomatis jika pembayaran berhasil.' : ''}`],
    canceling: ['info', `Langganan berhenti pada ${end}. Semua fitur tetap bisa dipakai sampai tanggal itu.`],
    grace: ['warn', `Masa langganan habis ${end}. Masa tenggang ${GRACE_DAYS} hari; setelah itu fitur operasional dibatasi.`],
    renew_failed: ['bad', 'Pembayaran perpanjangan gagal. Bayar ulang agar layanan tidak dibatasi.'],
    expired: ['bad', 'Langganan kedaluwarsa. Pelanggan tidak bisa memesan lewat QR. Data menu, meja, dan transaksi tetap tersimpan.'],
    canceled: ['info', 'Kamu sudah berhenti berlangganan. Data tetap tersimpan dan bisa dipakai lagi saat berlangganan kembali.'],
  }[phase];
  const list = out ? [out] : [];
  if (s.pending_plan_id) list.push(['info', `Paket akan berganti ke ${plans.find((p) => p.id === s.pending_plan_id)?.name} pada ${end}.`, 'undo']);
  return list;
}

export default function Subscription() {
  const { rid, roles } = useOutletContext();
  const { session } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState('monthly');
  const loc = useLocation();
  const co = loc.state?.checkout;
  const [step, setStep] = useState(co ? { name: 'checkout', kind: co.kind, planId: co.planId, period: 'monthly', method: 'qris' } : { name: 'main' }); // main | quote | checkout | pay
  const [cancelAsk, setCancelAsk] = useState(false);
  const d = useDb((db) => {
    const s = currentSubscription(db, rid);
    return { s, phase: subscriptionPhase(db, rid), plans: db.plans.filter((p) => p.is_active), invoices: invoicesOf(db, rid), quote: step.name === 'quote' ? planChangeQuote(db, rid, step.planId) : null, offset: db.time_offset || 0, grace: platformSettings(db).grace_days };
  });
  if (!can(roles, 'settings.manage')) return <Forbidden />;
  const run = (fn, msg) => { try { const r = fn(); if (msg) toast(typeof msg === 'function' ? msg(r) : msg, 'success'); return r; } catch (e) { toast(e.message, 'error'); return null; } };
  const { s, phase } = d;
  if (!s) return <Empty title="Belum ada langganan" icon="layers">Hubungi tim MenuKlik.</Empty>;
  const plan = d.plans.find((p) => p.id === s.plan_id);
  const left = Math.ceil((s.ends_at - serverNow()) / DAY);
  const canCancel = ['active', 'ending'].includes(phase);
  const canExtend = ['active', 'ending', 'canceling', 'grace', 'renew_failed'].includes(phase);
  const back = () => { setStep({ name: 'main' }); setCancelAsk(false); };
  const checkout = (kind, planId) => setStep({ name: 'checkout', kind, planId, period: s.period || period, method: 'qris' });

  /* ---- bayar tagihan ---- */
  if (step.name === 'pay') {
    const inv = d.invoices.find((i) => i.id === step.id);
    const pl = d.plans.find((p) => p.id === inv.plan_id);
    const gw = (res) => run(() => simulateSubscriptionGateway(inv.id, res), (r) => (res === 'paid' ? `Pembayaran berhasil${r.notes.length ? '. ' + r.notes.join('. ') : ''}` : `Pembayaran ${res === 'failed' ? 'gagal' : 'kedaluwarsa'}`));
    return (
      <>
        <PageHeader title="Pembayaran langganan"><Button onClick={back}>Kembali ke Langganan</Button></PageHeader>
        <Card>
          <div className="row"><b className="mono" style={{ fontSize: 24 }}>{rp(inv.amount)}</b><Pill tone={INVOICE_STATUS[inv.status].tone} label={INVOICE_STATUS[inv.status].label} /></div>
          <p className="small muted">{inv.invoice_number} · {INVOICE_KIND[inv.kind]} · {pl.name} · {inv.period === 'yearly' ? 'Tahunan' : 'Bulanan'} · {METHODS[inv.method]}</p>
          {inv.note && <p className="small muted">{inv.note}</p>}
          {inv.status === 'unpaid' && inv.method === 'qris' && <div className="qrbox"><QrImage text={`SIMULASI ${inv.invoice_number}`} size={180} stamp="SIMULASI" /></div>}
          {inv.status === 'unpaid' && inv.method === 'va' && <div className="ctx"><span>Nomor virtual account (simulasi)</span><b className="mono">8808 {inv.invoice_number.replace(/\D/g, '').padStart(8, '0')}</b></div>}
          {inv.status === 'unpaid' ? (
            <div className="ctx">
              <span className="tag">Server payment gateway (simulasi)</span>
              <span className="small muted">Di sistem asli, status ini dikirim server gateway ke backend. Bukti transfer atau tangkapan layar tidak mengubah status.</span>
              <div className="row"><Button variant="primary" size="sm" icon="check" onClick={() => gw('paid')}>Pembayaran berhasil</Button><Button variant="danger" size="sm" onClick={() => gw('failed')}>Gagal</Button><Button variant="danger" size="sm" onClick={() => gw('expired')}>Kedaluwarsa</Button></div>
            </div>
          ) : <p className={inv.status === 'paid' ? 'alert alert-ok' : 'warn'}>{inv.status === 'paid' ? `Lunas. Langganan aktif sampai ${dateShort(s.ends_at)}.` : 'Tagihan tidak dibayar. Langganan belum berubah.'}</p>}
          <div className="history">{inv.events.map((e, i) => <div key={i}><span>{e.t}</span></div>)}</div>
        </Card>
      </>
    );
  }

  /* ---- pilih periode & metode ---- */
  if (step.name === 'checkout') {
    const pl = d.plans.find((p) => p.id === step.planId);
    const amount = planPrice(pl, step.period);
    return (
      <>
        <PageHeader title={`${INVOICE_KIND[step.kind]}: paket ${pl.name}`}><Button onClick={back}>Batal</Button></PageHeader>
        <div className="grid-2">
          <Card title="Periode & metode">
            <div className="row">{['monthly', 'yearly'].map((p) => <label key={p} className="chip" style={{ cursor: 'pointer' }}><input type="radio" name="per" checked={step.period === p} onChange={() => setStep({ ...step, period: p })} /> {p === 'monthly' ? 'Bulanan' : 'Tahunan'} · {rp(planPrice(pl, p))}</label>)}</div>
            <div className="chips">{Object.entries(METHODS).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={step.method === k} onClick={() => setStep({ ...step, method: k })}>{l}</button>)}</div>
            <p className="note">{step.kind === 'new' && phase.startsWith('trial') ? `Masa berbayar dimulai setelah uji coba berakhir (${dateShort(s.ends_at)}), jadi sisa uji coba tidak hilang.` : step.kind === 'extend' ? `Masa aktif ditambah dari ${dateShort(Math.max(s.ends_at, serverNow()))}.` : 'Langganan aktif setelah pembayaran berhasil.'}</p>
          </Card>
          <Card title="Ringkasan tagihan">
            <div className="row-between"><span className="muted">Paket {pl.name} · {step.period === 'yearly' ? '12 bulan' : '1 bulan'}</span><b className="num">{rp(amount)}</b></div>
            {step.period === 'yearly' && <p className="small muted">Hemat {rp(pl.price_monthly * 12 - pl.price_yearly)} dibanding 12 x bulanan.</p>}
            <Button variant="cta" onClick={() => { const inv = run(() => createSubscriptionInvoice(session, { kind: step.kind, planId: pl.id, period: step.period, method: step.method })); if (inv) setStep({ name: 'pay', id: inv.id }); }}>Bayar {rp(amount)}</Button>
            <p className="small muted">Simulasi. Tidak ada uang yang ditarik.</p>
          </Card>
        </div>
      </>
    );
  }

  /* ---- rincian ganti paket ---- */
  if (step.name === 'quote' && d.quote) {
    const q = d.quote;
    return (
      <>
        <PageHeader title={`${q.up ? 'Upgrade' : 'Downgrade'} paket: ${q.cur.name} → ${q.tp.name}`}><Button onClick={back}>Batal</Button></PageHeader>
        <div className="grid-2">
          <Card title={`Fitur yang ${q.up ? 'didapat' : 'hilang'}`}>
            {(q.up ? q.gained : q.lost).map((f) => <div key={f} className="small">{q.up ? '+' : '−'} {featName(f)}</div>)}
            {!(q.up ? q.gained : q.lost).length && <span className="small muted">Tidak ada perubahan fitur.</span>}
            <p className="small">Meja: {q.cur.max_tables || 'tanpa batas'} → {q.tp.max_tables || 'tanpa batas'} · Pegawai: {q.cur.max_staff || 'tanpa batas'} → {q.tp.max_staff || 'tanpa batas'}</p>
            <p className="small">Konfigurasi: {q.cur.configs.map((c) => CONFIGS[c].name).join(', ')} → {q.tp.configs.map((c) => CONFIGS[c].name).join(', ')}</p>
          </Card>
          <Card title="Biaya">
            {q.mode === 'upgrade' && <><div className="row-between small"><span className="muted">Selisih harga × sisa {q.rem} dari {q.pd} hari</span><span className="num">{rp(q.diff)} × {q.rem}/{q.pd}</span></div><div className="row-between"><b>Dibayar sekarang</b><b className="num">{rp(q.charge)}</b></div><p className="note">Fitur baru langsung aktif setelah pembayaran. Tanggal berakhir tetap {dateShort(s.ends_at)}.</p></>}
            {q.mode === 'downgrade' && <p className="note">Tanpa biaya dan tanpa pengembalian dana. Paket {q.cur.name} berlaku sampai {dateShort(s.ends_at)}, lalu berganti ke {q.tp.name}.</p>}
            {q.mode === 'trial' && <p className="note">Kamu sedang uji coba. Paket langsung berganti tanpa biaya; tanggal berakhir uji coba tetap {dateShort(s.ends_at)}.</p>}
            {q.mode === 'resub' && <p className="note">Langganan tidak aktif. Pilih periode dan bayar untuk berlangganan kembali dengan paket {q.tp.name}.</p>}
            {q.warn.map((w) => <p key={w} className="warn">{w}</p>)}
            <Button variant="cta" onClick={() => { const r = run(() => confirmPlanChange(session, q.tp.id), (x) => (x.scheduled ? `Downgrade dijadwalkan pada ${dateShort(s.ends_at)}` : x.invoice || x.checkout ? '' : `Paket berganti ke ${q.tp.name}${x.notes?.length ? '. ' + x.notes.join('. ') : ''}`)); if (!r) return; if (r.invoice) setStep({ name: 'pay', id: r.invoice.id }); else if (r.checkout) checkout('resub', r.checkout.planId); else back(); }}>
              {q.mode === 'upgrade' ? `Konfirmasi dan bayar ${rp(q.charge)}` : q.mode === 'downgrade' ? `Jadwalkan downgrade ke ${q.tp.name}` : q.mode === 'trial' ? `Ganti uji coba ke ${q.tp.name}` : 'Lanjut ke pembayaran'}
            </Button>
          </Card>
        </div>
      </>
    );
  }

  /* ---- halaman utama ---- */
  return (
    <>
      <PageHeader title="Langganan" subtitle="Tagihan langganan (pemilik ke MenuKlik) dicatat terpisah dari pembayaran makanan pelanggan." />
      {notices(phase, s, d.plans, d.grace).map(([tone, text, act], i) => (
        <div key={i} className={`banner tone-${tone === 'bad' ? 'red' : tone === 'warn' ? 'amber' : 'blue'}`}><Icon name="bell" /> <span style={{ flex: 1 }}>{text}</span>
          {act === 'undo' && <Button size="sm" onClick={() => run(() => setSubscriptionFlag(session, 'undo_downgrade'), 'Perubahan paket dibatalkan')}>Batalkan perubahan</Button>}</div>
      ))}
      <div className="grid-2">
        <Card title={`Paket ${plan?.name}`} actions={<Pill tone={SUB_PHASE[phase].tone} label={SUB_PHASE[phase].label} />}>
          <div className="ctx">
            <span>Periode: <b>{s.status === 'trial' ? `Uji coba ${Math.round((s.ends_at - s.started_at) / DAY)} hari` : s.period === 'yearly' ? 'Tahunan' : 'Bulanan'}</b></span>
            <span>Mulai {dateShort(s.started_at)} · Berakhir {dateShort(s.ends_at)} ({left >= 0 ? `sisa ${left} hari` : `lewat ${-left} hari`})</span>
            {s.status === 'active' && <span>Perpanjangan otomatis: <b>{s.auto_renew && !s.cancel_at_end ? 'aktif' : 'mati'}</b></span>}
          </div>
          <div className="row">
            {phase.startsWith('trial') && phase !== 'trial_expired' && <Button variant="cta" onClick={() => checkout('new', s.plan_id)}>Berlangganan sekarang</Button>}
            {phase === 'trial_expired' && <Button variant="cta" onClick={() => checkout('new', s.plan_id)}>Berlangganan sekarang</Button>}
            {canExtend && <Button variant="primary" onClick={() => checkout('extend', s.pending_plan_id || s.plan_id)}>Perpanjang</Button>}
            {['expired', 'canceled'].includes(phase) && <Button variant="cta" onClick={() => checkout('resub', s.plan_id)}>Berlangganan kembali</Button>}
            {phase === 'canceling' && <Button onClick={() => run(() => setSubscriptionFlag(session, 'resume'), 'Langganan dilanjutkan')}>Lanjutkan langganan</Button>}
            {canCancel && (cancelAsk ? <><span className="small">Yakin berhenti di akhir periode?</span><Button size="sm" variant="danger" onClick={() => { run(() => setSubscriptionFlag(session, 'cancel'), `Langganan berhenti pada ${dateShort(s.ends_at)}. Data tetap aman.`); setCancelAsk(false); }}>Ya, berhenti</Button><Button size="sm" onClick={() => setCancelAsk(false)}>Tidak</Button></> : <Button variant="danger" onClick={() => setCancelAsk(true)}>Batalkan langganan</Button>)}
          </div>
          {canCancel && <p className="small muted">Jika dibatalkan, langganan tetap aktif sampai akhir periode dan tidak diperpanjang. Data tidak dihapus.</p>}
        </Card>
        <Card title="Hak akses saat ini">
          <div className="ctx">
            <span>Pemesanan QR pelanggan: <b>{['expired', 'suspended', 'canceled', 'trial_expired', 'pending'].includes(phase) ? 'dibatasi' : 'aktif'}</b></span>
            <span>Aksi kasir, dapur, waiter: <b>{['expired', 'suspended', 'canceled', 'trial_expired', 'pending'].includes(phase) ? 'dibatasi' : 'aktif'}</b></span>
            <span>Melihat data, laporan, dan membayar: <b>selalu bisa</b></span>
            <span>Konfigurasi perangkat: <b>{plan?.configs.map((c) => CONFIGS[c].name).join(', ')}</b></span>
            <span>Kuota: {plan?.max_tables ? `${plan.max_tables} meja` : 'meja tanpa batas'}, {plan?.max_staff ? `${plan.max_staff} pegawai` : 'pegawai tanpa batas'}</span>
          </div>
        </Card>
      </div>

      <div className="row-between"><h2 style={{ fontSize: 16 }}>Ganti paket</h2><Segmented label="Periode" value={period} onChange={setPeriod} options={[['monthly', 'Bulanan'], ['yearly', 'Tahunan']]} /></div>
      <div className="grid-3">
        {d.plans.map((p) => (
          <Card key={p.id} title={p.name} actions={p.id === s.plan_id ? <Pill tone="green" label="Paket kamu" /> : null}>
            <p className="small muted">{p.description}</p>
            <b className="num" style={{ fontSize: 22 }}>{rp(planPrice(p, period))}<small className="muted">/{period === 'yearly' ? 'tahun' : 'bulan'}</small></b>
            <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{FEATURES.map(([f, l]) => <li key={f} style={{ opacity: p.features.includes(f) ? 1 : 0.4, textDecoration: p.features.includes(f) ? 'none' : 'line-through' }}>{l}</li>)}</ul>
            <span className="small"><b>Kuota:</b> {p.max_tables ? `${p.max_tables} meja` : 'meja tanpa batas'} · {p.max_staff ? `${p.max_staff} pegawai` : 'pegawai tanpa batas'}</span>
            <Button variant={p.id === s.plan_id ? 'default' : 'primary'} block disabled={p.id === s.plan_id} onClick={() => setStep({ name: 'quote', planId: p.id })}>{p.id === s.plan_id ? 'Paket saat ini' : 'Pilih paket'}</Button>
          </Card>
        ))}
      </div>
      <p className="small muted">Harga adalah contoh untuk prototype. Belum termasuk pajak bila berlaku.</p>

      <Card title="Riwayat pembayaran langganan">
        {d.invoices.length === 0 ? <p className="muted">Belum ada transaksi langganan.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>No. invoice</th><th>Tanggal</th><th>Jenis</th><th>Paket</th><th className="r">Total</th><th>Status</th><th /></tr></thead>
            <tbody>{d.invoices.map((i) => { const st = INVOICE_STATUS[i.status] || INVOICE_STATUS.unpaid; return (
              <tr key={i.id}><td className="mono">{i.invoice_number}</td><td>{dateShort(i.created_at)}</td><td>{INVOICE_KIND[i.kind] || 'Langganan'}</td><td>{d.plans.find((p) => p.id === i.plan_id)?.name}{i.period ? ` · ${i.period === 'yearly' ? 'Tahunan' : 'Bulanan'}` : ''}</td><td className="r num">{rp(i.amount)}</td><td><Pill tone={st.tone} label={st.label} /></td>
                <td>{i.events && <Button size="sm" variant={i.status === 'unpaid' ? 'cta' : 'default'} onClick={() => setStep({ name: 'pay', id: i.id })}>{i.status === 'unpaid' ? 'Bayar' : 'Lihat'}</Button>}</td></tr>); })}</tbody>
          </table></div>
        )}
        <p className="note">Dokumen simulasi, bukan faktur pajak.</p>
      </Card>

      <Card title="Simulasi waktu (khusus demo)">
        <p className="small">Tanggal server simulasi: <b>{dateShort(serverNow())}</b>{d.offset ? ` (${Math.round(d.offset / DAY)} hari dari hari ini)` : ''}</p>
        <div className="row">
          <Button size="sm" onClick={() => run(() => shiftTime(session, 1))}>+1 hari</Button>
          <Button size="sm" onClick={() => run(() => shiftTime(session, 7))}>+7 hari</Button>
          <Button size="sm" onClick={() => run(() => shiftTime(session, 0, -2))}>2 hari sebelum berakhir</Button>
          <Button size="sm" onClick={() => run(() => shiftTime(session, 0, 1))}>1 hari setelah berakhir</Button>
          <Button size="sm" onClick={() => run(() => shiftTime(session, 0, d.grace + 1))}>Lewat masa tenggang</Button>
          {d.offset ? <Button size="sm" onClick={() => run(() => shiftTime(session, 0))}>Kembali ke hari ini</Button> : null}
        </div>
        {s.auto_renew && s.status === 'active' && ['ending', 'grace', 'renew_failed'].includes(phase) && (
          <div className="row"><span className="small muted">Perpanjangan otomatis oleh sistem:</span>
            <Button size="sm" variant="primary" onClick={() => { const r = run(() => simulateAutoRenew(session)); if (r) run(() => simulateSubscriptionGateway(r.inv.id, 'paid'), 'Perpanjangan otomatis berhasil'); }}>Tagihan berhasil</Button>
            <Button size="sm" variant="danger" onClick={() => { const r = run(() => simulateAutoRenew(session)); if (r) run(() => simulateSubscriptionGateway(r.inv.id, 'failed'), 'Tagihan perpanjangan gagal. Pemilik mendapat pemberitahuan.'); }}>Tagihan gagal</Button></div>
        )}
      </Card>
    </>
  );
}
