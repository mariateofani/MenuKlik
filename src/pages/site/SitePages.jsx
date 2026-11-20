import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useDb } from '../../hooks/useDb.js';
import { currentQr, planPrice } from '../../services/api.js';
import { MAIN_RESTAURANT_ID } from '../../services/seed.js';
import { QrImage } from '../../components/QrImage.jsx';
import { Segmented } from '../../components/ui.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import GoogleSignIn from '../../components/GoogleSignIn.jsx';
import RoleSwitcher, { dashboardTargets } from '../../components/RoleSwitcher.jsx';
import { roleLabels } from '../../lib/constants.js';
import { Icon } from '../../lib/icons.jsx';
import { CONFIGS, FEATURES } from '../../lib/constants.js';
import { rp } from '../../lib/format.js';

const Check = ({ children }) => <li><Icon name="check" size={14} />{children}</li>;
const Block = ({ icon, title, items }) => (
  <div className="card stack"><div className="row" style={{ flexWrap: 'nowrap' }}><span className="role-ic"><Icon name={icon} size={20} /></span><h3>{title}</h3></div><ul className="feat-list">{items.map((x) => <Check key={x}>{x}</Check>)}</ul></div>
);

function CtaBand() {
  const { trial } = useOutletContext();
  return (
    <section className="cta-band">
      <div><h2>Siap menerima pesanan dari meja?</h2><p>Daftar beberapa menit, isi menu, cetak QR, dan mulai terima pesanan. {trial.trial_enabled ? `Uji coba gratis ${trial.trial_days} hari.` : ''}</p></div>
      <div className="row"><Link className="btn btn-lg cta-light" to="/daftar">Daftar Sekarang</Link><Link className="btn btn-lg hero-ghost" to="/daftar">Coba Gratis</Link></div>
    </section>
  );
}

function PlanCards({ period }) {
  const navigate = useNavigate();
  const plans = useDb((db) => db.plans.filter((p) => p.is_active));
  return (
    <div className="grid-3">
      {plans.map((p, i) => (
        <div key={p.id} className={`card stack ${i === 1 ? 'plan-pop' : ''}`}>
          <div className="row-between"><h3>{p.name}</h3>{i === 1 && <span className="pill tone-orange">Paling banyak dipilih</span>}</div>
          <p className="small muted">{p.description}</p>
          <b className="num" style={{ fontSize: 24 }}>{rp(planPrice(p, period))}<small className="muted">/{period === 'yearly' ? 'tahun' : 'bulan'}</small></b>
          <ul className="feat-list">{FEATURES.map(([f, l]) => <li key={f} className={p.features.includes(f) ? '' : 'off'}><Icon name={p.features.includes(f) ? 'check' : 'x'} size={14} />{l}</li>)}</ul>
          <span className="small"><b>Kuota:</b> {p.max_tables ? `${p.max_tables} meja` : 'meja tanpa batas'} · {p.max_staff ? `${p.max_staff} pegawai` : 'pegawai tanpa batas'}</span>
          <button type="button" className={`btn ${i === 1 ? 'btn-cta' : 'btn-primary'}`} onClick={() => navigate('/daftar')}>Pilih {p.name}</button>
        </div>
      ))}
    </div>
  );
}
const PeriodToggle = ({ value, onChange }) => <Segmented label="Periode" value={value} onChange={onChange} options={[['monthly', 'Bulanan'], ['yearly', 'Tahunan']]} />;

function QrScene() {
  const qr = useDb((db) => { const t = db.tables.find((x) => x.restaurant_id === MAIN_RESTAURANT_ID && x.name === '02'); return t ? currentQr(db, t.id) : null; });
  return (
    <div className="qr-scene" aria-label="Ilustrasi pelanggan memindai QR di meja">
      <div className="tent"><QrImage text={`https://menuklik.example/t/${qr?.token || 'demo'}`} size={118} /><b>Meja 02</b><span>Scan untuk lihat menu & pesan</span></div>
      <div className="scene-arrow"><Icon name="next" size={20} /></div>
      <div className="mini-phone">
        <div className="mp-head"><b>Kedai Rasa Nusantara</b><span>Meja 02</span></div>
        {[['Nasi Goreng Spesial', 'Rp20.000', 'bowl'], ['Ayam Geprek', 'Rp17.000', 'bowl'], ['Es Teh', 'Rp5.000', 'cup']].map(([n, p, i]) => (
          <div key={n} className="mp-item"><span className="mp-ic"><Icon name={i} size={14} /></span><span>{n}<br /><small>{p}</small></span><span className="mp-add"><Icon name="plus" size={12} /></span></div>
        ))}
        <div className="mp-cart">2 item · Rp25.000</div>
      </div>
    </div>
  );
}

function Welcome() {
  const { session } = useAuth();
  if (!session) return null;
  const targets = dashboardTargets(session);
  return (
    <section className="welcome" aria-label="Akun yang sedang masuk">
      <div><span className="tag">Kamu sudah masuk</span><h2>Halo, {session.name}</h2><p className="small muted">{session.kind === 'staff' ? `Peran: ${roleLabels(session.roles)}.` : session.kind === 'admin' ? 'Peran: Super Admin.' : 'Lengkapi data usahamu untuk mulai.'} Kamu tetap di halaman utama sampai memilih beralih ke dashboard.</p></div>
      <div className="stack" style={{ gap: 6 }}>
        <RoleSwitcher />
        {targets.length > 1 && <span className="small muted">Satu akun, beberapa peran: pilih tugas yang ingin dijalankan.</span>}
      </div>
    </section>
  );
}

export function SiteHome() {
  const { trial } = useOutletContext();
  const { session } = useAuth();
  const [period, setPeriod] = useState('monthly');
  return (
    <>
      <Welcome />
      <section className="hero">
        <div className="stack" style={{ gap: 14 }}>
          <span className="tag" style={{ color: 'inherit', opacity: 0.85 }}>Menu digital & pemesanan dari meja</span>
          <h1>Pelanggan pesan dari HP. Pesanan langsung sampai ke kasir dan dapur.</h1>
          <p className="hero-sub">MenuKlik membantu warung, kafe, dan restoran menerima pesanan lewat QR Code di meja. Pelanggan tidak perlu mengunduh aplikasi, dan kamu tidak wajib membeli perangkat baru.</p>
          <div className="row">{!session && <GoogleSignIn className="btn btn-lg cta-light" label="Masuk dengan Google" />}<Link className="btn btn-lg hero-ghost" to="/daftar">{trial.trial_enabled ? `Coba Gratis ${trial.trial_days} Hari` : 'Coba Gratis'}</Link><Link className="btn btn-lg hero-ghost" to="/harga">Lihat Paket</Link></div>
          <Link className="link hero-link" to="/coba">Atau coba dulu sebagai pelanggan</Link>
        </div>
        <QrScene />
      </section>
      <section className="sec"><div className="sec-head"><span className="tag">Apa itu MenuKlik</span><h2>Satu sistem untuk pesanan dari meja sampai pesanan diantar</h2><p className="muted">Setiap meja punya QR Code sendiri. Pelanggan memindai, memilih menu, lalu membayar digital atau di kasir. Pesanan bergerak dari kasir ke dapur lalu ke waiter, dan statusnya terlihat di HP pelanggan.</p></div></section>
      <section className="sec"><div className="sec-head"><span className="tag">Manfaat</span><h2>Cocok untuk skala usahamu</h2></div>
        <div className="grid-3">
          {[['Warung', 'Basic', 'Satu HP cukup untuk menerima pesanan, mencatat bayar, dan menandai pesanan selesai.', ['Antrean di depan berkurang', 'Tidak ada pesanan yang lupa dicatat', 'Harga selalu sesuai menu']],
            ['Kafe', 'Standard', 'Kasir di komputer, dapur dan barista memakai tablet bersama bila ada.', ['Pesanan tambahan dari meja yang sama lebih rapi', 'Catatan khusus (kurang manis, tanpa es) tertulis jelas', 'Laporan penjualan harian']],
            ['Restoran', 'Advanced', 'Kasir, layar dapur, dan HP waiter bekerja bersamaan secara real-time.', ['Dapur melihat antrean dan lama memasak', 'Waiter tahu makanan mana yang siap diantar', 'Pemilik memantau semua dari HP']]].map(([t, p, d, b]) => (
            <div key={t} className="card stack"><div className="row-between"><h3>{t}</h3><span className="pill tone-green">Paket {p}</span></div><p className="small muted">{d}</p><ul className="feat-list">{b.map((x) => <Check key={x}>{x}</Check>)}</ul></div>
          ))}
        </div>
      </section>
      <section className="sec"><div className="sec-head"><span className="tag">Untuk setiap peran</span><h2>Tampilan berbeda untuk setiap pekerjaan</h2></div>
        <div className="feat-grid">
          {[['monitor', 'Kasir', 'Daftar pesanan, konfirmasi bayar tunai, teruskan pesanan ke dapur, dan riwayat transaksi.'], ['fire', 'Dapur', 'Kartu pesanan besar yang terbaca dari jauh, catatan khusus, lama menunggu, tombol mulai dan selesai masak.'], ['walk', 'Waiter', 'Makanan yang siap diambil, nomor meja besar, satu tombol untuk ambil dan sudah diantar.'], ['store', 'Pemilik', 'Menu, meja dan QR, pegawai, laporan, pengaturan, dan langganan dalam satu dashboard.']].map(([i, t, d]) => (
            <div key={t} className="card stack"><span className="role-ic"><Icon name={i} size={20} /></span><h3>{t}</h3><p className="small muted">{d}</p></div>
          ))}
        </div>
      </section>
      <section className="sec"><div className="sec-head"><span className="tag">Cara kerja</span><h2>Mulai dalam empat langkah</h2></div>
        <div className="feat-grid">
          {[['Daftar & verifikasi', 'Buat akun dengan email dan nomor HP.'], ['Isi profil usaha', 'Nama usaha, jam buka, dan jumlah meja.'], ['Isi menu & cetak QR', 'QR untuk setiap meja dibuat otomatis.'], ['Terima pesanan', 'Pesanan masuk ke dashboard secara real-time.']].map(([t, d], i) => (
            <div key={t} className="card stack"><span className="stepno">{i + 1}</span><h3>{t}</h3><p className="small muted">{d}</p></div>
          ))}
        </div>
        <Link className="btn" to="/cara-kerja" style={{ justifySelf: 'start' }}>Lihat cara kerja lengkap</Link>
      </section>
      <section className="sec"><div className="row-between"><div className="sec-head"><span className="tag">Paket</span><h2>Basic, Standard, atau Advanced</h2></div><PeriodToggle value={period} onChange={setPeriod} /></div><PlanCards period={period} /><Link className="btn" to="/harga" style={{ justifySelf: 'start' }}>Bandingkan semua fitur</Link></section>
      <section className="sec"><div className="sec-head"><span className="tag">Testimoni</span><h2>Kata pemilik usaha</h2><p className="small muted"><b>Contoh testimoni untuk prototype, bukan ulasan dari pengguna nyata.</b></p></div>
        <div className="grid-3">
          {[['Bu Wati', 'Warung makan, 6 meja', 'Dulu pas jam makan siang saya kewalahan mencatat. Sekarang pelanggan pesan sendiri, saya tinggal masak dan antar.'], ['Raka', 'Kafe, 12 meja', 'Pesanan kurang manis atau tanpa es tidak lagi tertukar, karena catatannya langsung muncul di tablet barista.'], ['Pak Hendra', 'Restoran keluarga, 25 meja', 'Waiter tidak perlu bolak-balik ke dapur menanyakan pesanan. Yang siap langsung muncul di HP mereka.']].map(([n, r, q]) => (
            <figure key={n} className="card testi stack"><span className="pill tone-muted" style={{ justifySelf: 'start' }}>Contoh</span><blockquote>{q}</blockquote><figcaption><b>{n}</b><br /><span className="small muted">{r}</span></figcaption></figure>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}

export function SiteFeatures() {
  const featureGroups = [
    {
      icon: 'phone',
      title: 'Pelanggan',
      color: '#2563EB',
      gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)',
      items: [
        'Scan QR di meja tanpa mengunduh aplikasi',
        'Menu dengan foto, harga, dan label habis',
        'Pilih variasi, tambahan, dan catatan khusus',
        'Pembayaran digital atau langsung di kasir',
        'Pantau status pesanan secara langsung',
      ],
    },
    {
      icon: 'monitor',
      title: 'Kasir',
      color: '#EA580C',
      gradient: 'linear-gradient(135deg, #EA580C, #FB923C)',
      items: [
        'Daftar pesanan yang perlu tindakan',
        'Konfirmasi pembayaran tunai',
        'Teruskan pesanan ke dapur',
        'Riwayat dan pencatatan transaksi',
      ],
    },
    {
      icon: 'fire',
      title: 'Dapur',
      color: '#DC2626',
      gradient: 'linear-gradient(135deg, #DC2626, #F87171)',
      items: [
        'Tampilan pesanan yang mudah dibaca',
        'Nomor meja dan catatan khusus',
        'Pantau antrean pesanan',
        'Tandai pesanan mulai dimasak dan siap',
      ],
    },
    {
      icon: 'walk',
      title: 'Waiter',
      color: '#7C3AED',
      gradient: 'linear-gradient(135deg, #7C3AED, #C084FC)',
      items: [
        'Daftar makanan yang siap diantar',
        'Nomor meja terlihat jelas',
        'Tandai pesanan sedang diantar',
        'Pantau pesanan yang belum disajikan',
      ],
    },
    {
      icon: 'store',
      title: 'Pemilik Restoran',
      color: '#0F766E',
      gradient: 'linear-gradient(135deg, #0F766E, #2DD4BF)',
      items: [
        'Kelola menu, kategori, dan harga',
        'Kelola meja dan QR Code',
        'Kelola karyawan dan hak akses',
        'Pantau laporan penjualan',
        'Kelola paket dan langganan',
      ],
    },
    {
      icon: 'shield',
      title: 'Keamanan Sistem',
      color: '#2563EB',
      gradient: 'linear-gradient(135deg, #1D4ED8, #60A5FA)',
      items: [
        'QR Code dengan token unik',
        'Hak akses berdasarkan peran',
        'Validasi status pembayaran',
        'Perlindungan dari pesanan ganda',
      ],
    },
  ];

  return (
    <>
      <section
        className="sec page-hero"
        style={{
          textAlign: 'center',
          paddingTop: 60,
          paddingBottom: 60,
        }}
      >
        <span className="tag">Fitur MenuKlik</span>

        <h1 style={{ maxWidth: 850, margin: '20px auto' }}>
          Semua kebutuhan restoran,
          <span
            style={{
              background: 'linear-gradient(135deg, #2563EB, #0F766E)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {' '}dalam satu sistem
          </span>
        </h1>

        <p
          className="muted"
          style={{
            maxWidth: 720,
            margin: '0 auto',
            lineHeight: 1.8,
            fontSize: 16,
          }}
        >
          Dari pelanggan memesan makanan, kasir mengelola transaksi,
          dapur menyiapkan pesanan, hingga pemilik memantau bisnis.
          Semua terhubung dalam satu platform.
        </p>
      </section>

      <section className="sec">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 22,
          }}
        >
          {featureGroups.map((group) => (
            <div
              key={group.title}
              className="card stack"
              style={{
                padding: 24,
                borderRadius: 18,
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 15,
                  background: group.gradient,
                  color: '#FFFFFF',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: `0 8px 20px ${group.color}30`,
                }}
              >
                <Icon name={group.icon} size={24} />
              </div>

              <div>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                  {group.title}
                </h2>

                <p className="small muted">
                  Fitur untuk mendukung pekerjaan {group.title.toLowerCase()}.
                </p>
              </div>

              <ul
                className="feat-list"
                style={{
                  gap: 12,
                  marginTop: 4,
                }}
              >
                {group.items.map((item) => (
                  <li key={item}>
                    <span style={{ color: group.color }}>
                      <Icon name="check" size={16} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section
        className="sec"
        style={{
          background: 'var(--surface)',
          borderRadius: 24,
          padding: 32,
        }}
      >
        <div className="sec-head">
          <span className="tag">Perangkat</span>

          <h2>
            Gunakan perangkat yang sudah kamu punya
          </h2>

          <p className="muted">
            Tidak perlu langsung membeli banyak perangkat.
            MenuKlik bisa menyesuaikan kebutuhan dan skala restoranmu.
          </p>
        </div>

        <div className="grid-3">
          {Object.entries(CONFIGS).map(([key, config]) => (
            <div key={key} className="card stack">
              <div className="row-between">
                <h3>{config.name}</h3>
                <span className="pill tone-green">
                  {config.dev}
                </span>
              </div>

              <p className="small muted">{config.who}</p>

              <ul className="feat-list">
                {config.list.map((item) => (
                  <Check key={item}>{item}</Check>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}

export function SiteHow() {
  const lane = [['phone', 'Pelanggan', 'Scan QR, pesan, bayar'], ['monitor', 'Kasir', 'Terima & teruskan'], ['fire', 'Dapur', 'Masak & tandai siap'], ['walk', 'Waiter', 'Ambil & antar'], ['flag', 'Selesai', 'Lunas & diantar']];
  return (
    <>
      <section className="sec page-hero"><span className="tag">Cara kerja</span><h1>Dari pendaftaran sampai pesanan diantar</h1></section>
      <section className="sec"><h2 style={{ fontSize: 20 }}>Untuk pemilik usaha</h2>
        <div className="feat-grid">{[['Daftar akun', 'Isi nama, email, nomor HP, dan password. Verifikasi dengan kode.'], ['Daftarkan usaha', 'Nama usaha, kategori, alamat, jam buka, dan jumlah meja.'], ['Pilih paket', 'Mulai uji coba gratis atau langsung berlangganan bulanan/tahunan.'], ['Isi menu & cetak QR', 'Tambah menu, lalu cetak QR untuk setiap meja.'], ['Terima pesanan', 'Pantau pesanan, pembayaran, dan laporan dari dashboard.']].map(([t, d], i) => (
          <div key={t} className="card stack"><span className="stepno">{i + 1}</span><h3>{t}</h3><p className="small muted">{d}</p></div>
        ))}</div>
      </section>
      <section className="sec"><h2 style={{ fontSize: 20 }}>Perjalanan satu pesanan</h2>
        <div className="card stack"><div className="lane">{lane.map(([i, n, s], k) => <div key={n} className={`node ${k < 4 ? 'done' : 'now'}`}><span className="ring"><Icon name={i} size={20} /></span><b>{n}</b><small>{s}</small></div>)}</div>
          <p className="small muted">Setiap pesanan punya tiga status yang tampil bersamaan: <b>pembayaran</b> (belum dibayar, lunas), <b>dapur</b> (menunggu kasir, antre, dimasak, siap), dan <b>penyajian</b> (menunggu diambil, sedang diantar, sudah diantar).</p></div>
      </section>
      <section className="sec"><div className="grid-2">
        <div className="card stack"><h3>Bayar digital</h3><p className="small muted">Pelanggan membayar lewat metode digital. Status lunas berubah otomatis setelah payment gateway mengirim konfirmasi resmi. Kasir lalu meneruskan pesanan ke dapur.</p></div>
        <div className="card stack"><h3>Bayar di kasir</h3><p className="small muted">Restoran memilih: pelanggan bayar dulu sebelum dimasak, atau makan dulu dan bayar setelahnya. Kasir mengonfirmasi uang yang diterima.</p></div>
      </div></section>
      <section className="sec"><Link className="btn btn-cta btn-lg" to="/coba" style={{ justifySelf: 'start' }}><Icon name="phone" size={16} /> Coba sebagai pelanggan</Link></section>
      <CtaBand />
    </>
  );
}

const FAQ = [
  ['Umum', 'Apakah pelanggan perlu mengunduh aplikasi?', 'Tidak. Pelanggan cukup memindai QR Code di meja dengan kamera HP, lalu menu terbuka di browser.'],
  ['Umum', 'Perangkat apa yang saya butuhkan?', 'Minimal satu HP untuk paket Basic. Kamu bisa menambah komputer kasir, tablet, monitor dapur, atau HP waiter sesuai paket.'],
  ['Umum', 'Apakah MenuKlik menggantikan mesin kasir saya?', 'Belum. Untuk versi awal, transaksi tetap dicatat di mesin kasir atau buku kas yang sudah ada. Dashboard kasir punya penanda "sudah dicatat" agar tidak terlewat.'],
  ['Umum', 'Bagaimana jika internet putus?', 'Perangkat menampilkan tanda offline dan perubahan tidak dianggap tersimpan sampai tersambung lagi, sehingga tidak ada status yang tampak berhasil padahal belum.'],
  ['Pembayaran', 'Bagaimana pelanggan membayar?', 'Pelanggan memilih bayar digital atau bayar di kasir. Pembayaran digital diverifikasi otomatis dari notifikasi resmi payment gateway, bukan dari tangkapan layar.'],
  ['Pembayaran', 'Apakah pembayaran makanan pelanggan masuk ke MenuKlik?', 'Tidak. Pembayaran makanan adalah transaksi antara pelanggan dan restoran. Tagihan langganan MenuKlik adalah transaksi terpisah antara restoran dan MenuKlik.'],
  ['Langganan', 'Bagaimana uji coba gratis bekerja?', (t) => (t.trial_enabled ? `Kamu bisa mencoba paket pilihan selama ${t.trial_days} hari tanpa pembayaran di depan. Uji coba berlaku sekali per akun, dan pengingat dikirim 3 hari serta 1 hari sebelum berakhir.` : 'Program uji coba sedang tidak tersedia.')],
  ['Langganan', 'Bisakah saya ganti paket?', 'Bisa. Upgrade langsung aktif setelah membayar selisih harga untuk sisa periode. Downgrade berlaku di akhir periode tanpa biaya tambahan.'],
  ['Langganan', 'Apa yang terjadi jika langganan berakhir?', (t) => `Ada masa tenggang ${t.grace_days} hari. Setelah itu pemesanan lewat QR dan fitur operasional dibatasi, tetapi kamu tetap bisa masuk, melihat data, dan membayar. Data restoran tidak dihapus.`],
  ['Langganan', 'Bisakah saya berhenti berlangganan?', 'Bisa kapan saja dari halaman Langganan. Layanan tetap aktif sampai akhir periode yang sudah dibayar.'],
  ['Data & keamanan', 'Apakah QR Code bisa disalahgunakan?', 'Setiap QR berisi kode acak, bukan nomor meja. Jika stiker rusak atau disalahgunakan, buat QR baru dan QR lama langsung tidak berlaku.'],
  ['Data & keamanan', 'Data pelanggan apa yang disimpan?', 'Hanya yang perlu untuk pesanan. Nama pelanggan bersifat opsional, dan pelanggan tidak perlu membuat akun.'],
  ['Data & keamanan', 'Bagaimana jika sistem bermasalah?', 'Laporkan dari menu Bantuan di dashboard. Laporan otomatis membawa keterangan teknis tanpa data pelanggan, dan tim MenuKlik membalas di tempat yang sama.'],
];
const FaqItem = ({ q, a, t }) => <details className="faq-item"><summary>{q}</summary><p className="small muted">{typeof a === 'function' ? a(t) : a}</p></details>;

export function SitePricing() {
  const { trial } = useOutletContext();
  const [period, setPeriod] = useState('monthly');
  const plans = useDb((db) => db.plans.filter((p) => p.is_active));
  return (
    <>
      <section className="sec page-hero"><span className="tag">Harga</span><h1>Pilih paket sesuai skala usaha</h1><p className="muted">{trial.trial_enabled ? `Semua paket bisa dicoba gratis ${trial.trial_days} hari tanpa pembayaran di depan. ` : ''}Ganti paket kapan saja.</p></section>
      <div className="row-between"><PeriodToggle value={period} onChange={setPeriod} /><span className="small muted">Tahunan lebih hemat dibanding 12 x bulanan.</span></div>
      <PlanCards period={period} />
      <section className="sec"><h2 style={{ fontSize: 20 }}>Perbandingan lengkap</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Fitur</th>{plans.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
          <tbody>
            <tr><td>Harga bulanan</td>{plans.map((p) => <td key={p.id} className="num">{rp(p.price_monthly)}</td>)}</tr>
            <tr><td>Harga tahunan</td>{plans.map((p) => <td key={p.id} className="num">{rp(p.price_yearly)}</td>)}</tr>
            {FEATURES.map(([f, l]) => <tr key={f}><td>{l}</td>{plans.map((p) => <td key={p.id}>{p.features.includes(f) ? <span className="yes"><Icon name="check" size={15} /></span> : <span className="no">-</span>}</td>)}</tr>)}
            <tr><td>Kuota meja</td>{plans.map((p) => <td key={p.id}>{p.max_tables || 'Tanpa batas'}</td>)}</tr>
            <tr><td>Kuota akun pegawai</td>{plans.map((p) => <td key={p.id}>{p.max_staff || 'Tanpa batas'}</td>)}</tr>
            <tr><td>Konfigurasi perangkat</td>{plans.map((p) => <td key={p.id}>{p.configs.map((c) => CONFIGS[c].name).join(', ')}</td>)}</tr>
          </tbody>
        </table></div>
      </section>
      <section className="sec"><h2 style={{ fontSize: 20 }}>Pertanyaan soal tagihan</h2><div className="faq">{FAQ.filter((x) => x[0] === 'Langganan').map(([, q, a]) => <FaqItem key={q} q={q} a={a} t={trial} />)}</div></section>
      <p className="small muted">Harga adalah contoh untuk prototype dan dapat diubah. Belum termasuk pajak bila berlaku.</p>
    </>
  );
}

export function SiteAbout() {
  return (
    <>
      <section className="sec page-hero"><span className="tag">Tentang Kami</span><h1>Teknologi pesanan yang terjangkau untuk usaha kuliner kecil</h1></section>
      <div className="grid-2">
        <div className="card stack"><h3>Kenapa MenuKlik dibuat</h3><p className="small muted">Banyak warung dan kafe kecil masih mencatat pesanan dengan kertas. Saat ramai, antrean memanjang, pesanan tertukar, dan pemilik sulit melihat menu apa yang paling laku. MenuKlik dirancang agar pemesanan digital bisa dipakai tanpa biaya perangkat yang besar dan tanpa harus mahir teknologi.</p></div>
        <div className="card stack"><h3>Prinsip produk</h3><ul className="feat-list">{['Mulai dari satu HP, tambah perangkat bila perlu', 'Mudah dipahami pegawai baru', 'Data restoran milik restoran dan tidak dihapus saat langganan berhenti', 'Status pembayaran hanya dari sumber resmi', 'Data pelanggan dikumpulkan seminimal mungkin'].map((x) => <Check key={x}>{x}</Check>)}</ul></div>
      </div>
      <div className="card stack"><h3>Status proyek</h3><p className="small muted">MenuKlik adalah nama kerja sebuah proyek produk digital yang sedang dikembangkan sebagai proyek kuliah dan calon usaha. Informasi perusahaan, alamat, dan kontak di situs ini adalah contoh.</p><div className="ctx"><span>Email: halo@menuklik.example (contoh)</span><span>WhatsApp bantuan: 0800-0000-000 (contoh)</span></div></div>
      <CtaBand />
    </>
  );
}

export function SiteFaq() {
  const { trial } = useOutletContext();
  const cats = [...new Set(FAQ.map((x) => x[0]))];
  return (
    <>
      <section className="sec page-hero"><span className="tag">FAQ</span><h1>Pertanyaan yang sering diajukan</h1></section>
      {cats.map((c) => <section key={c} className="sec"><h2 style={{ fontSize: 18 }}>{c}</h2><div className="faq">{FAQ.filter((x) => x[0] === c).map(([, q, a]) => <FaqItem key={q} q={q} a={a} t={trial} />)}</div></section>)}
      <div className="card stack"><h3>Masih ada pertanyaan?</h3><p className="small muted">Hubungi WhatsApp bantuan 0800-0000-000 (nomor contoh), atau daftar dan kirim pertanyaan dari menu Bantuan.</p></div>
      <CtaBand />
    </>
  );
}

// Demo pelanggan: menampilkan alur pelanggan yang sebenarnya (rute /t/:token) di dalam bingkai HP.
export function SiteDemo() {
  const qr = useDb((db) => { const t = db.tables.find((x) => x.restaurant_id === MAIN_RESTAURANT_ID && x.name === '02'); return t ? currentQr(db, t.id) : null; });
  return (
    <>
      <section className="sec page-hero"><span className="tag">Demo pelanggan</span><h1>Coba memesan seperti pelanggan</h1><p className="muted">Ini tampilan yang dilihat pelanggan setelah memindai QR di Kedai Rasa Nusantara (restoran contoh). Pesan menu, lalu pilih cara bayar.</p></section>
      <div className="demo-wrap">
        <div className="demo-phone">{qr ? <iframe title="Demo pelanggan" className="phone-frame" src={`/t/${qr.token}`} /> : <p className="muted">QR demo tidak ditemukan.</p>}</div>
        <div className="card stack">
          <h3>Yang bisa dicoba</h3>
          <ul className="feat-list">{['Cari menu dan pilih variasi atau tambahan', 'Tulis catatan untuk dapur', 'Bayar digital (simulasi) atau bayar di kasir', 'Lacak status pesanan setelah dikirim'].map((x) => <Check key={x}>{x}</Check>)}</ul>
          <p className="note">Pesanan yang kamu kirim di sini masuk ke dashboard Kedai Rasa Nusantara. Untuk melihat sisi restoran, masuk dengan akun demo di halaman Masuk.</p>
          <div className="row"><Link className="btn btn-cta" to="/daftar">Daftarkan usahamu</Link><Link className="btn" to="/login">Masuk akun demo</Link><Link className="btn" to="/demo">Simulasi & data demo</Link></div>
        </div>
      </div>
    </>
  );
}
