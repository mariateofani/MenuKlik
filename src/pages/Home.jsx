import { Link } from 'react-router-dom';

const features = [
  {
    icon: '📱',
    title: 'Menu Digital dengan QR',
    description:
      'Pelanggan cukup scan QR di meja untuk melihat menu restoran lengkap dengan foto, harga, dan deskripsi.',
  },
  {
    icon: '🛒',
    title: 'Pesan Tanpa Antre',
    description:
      'Pelanggan memilih makanan dan minuman langsung dari HP. Pesanan dikirim tanpa harus memanggil pelayan.',
  },
  {
    icon: '👨‍🍳',
    title: 'Terhubung ke Dapur',
    description:
      'Pesanan masuk secara langsung ke sistem restoran sehingga kasir dan dapur dapat bekerja lebih terorganisir.',
  },
  {
    icon: '💳',
    title: 'Pembayaran Fleksibel',
    description:
      'Dukung pembayaran digital maupun pembayaran langsung di kasir sesuai kebutuhan restoran.',
  },
  {
    icon: '📊',
    title: 'Laporan Penjualan',
    description:
      'Pantau pesanan, transaksi, dan performa penjualan restoran dalam satu dashboard.',
  },
  {
    icon: '🏪',
    title: 'Kelola Restoran',
    description:
      'Atur menu, meja, karyawan, pesanan, dan operasional restoran dalam satu sistem.',
  },
];

const steps = [
  ['01', 'Scan QR', 'Pelanggan memindai kode QR yang tersedia di meja.'],
  ['02', 'Pilih Menu', 'Pelanggan melihat menu dan memilih pesanan.'],
  ['03', 'Pesanan Diproses', 'Pesanan diterima kasir dan dapur secara langsung.'],
  ['04', 'Nikmati Hidangan', 'Pesanan disiapkan dan disajikan kepada pelanggan.'],
];

export default function Home() {
  return (
    <div style={{ color: 'var(--text)', overflow: 'hidden' }}>
      {/* HERO */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--surface)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <span className="pill tone-orange">
            Sistem Pemesanan Digital untuk Restoran
          </span>

          <h1
            style={{
              fontSize: 'clamp(36px, 6vw, 64px)',
              lineHeight: 1.12,
              letterSpacing: '-2px',
              margin: '24px 0',
            }}
          >
            Restoran Lebih Praktis.
            <br />
            Pelanggan Lebih Nyaman.
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.8,
              maxWidth: 700,
              margin: '0 auto 32px',
              color: 'var(--muted)',
            }}
          >
            MenuKlik membantu restoran mengelola menu digital, pesanan,
            pembayaran, kasir, dan dapur dalam satu sistem yang mudah digunakan.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <Link to="/daftar" className="btn btn-primary">
              Mulai Berlangganan →
            </Link>

            <Link to="/fitur" className="btn">
              Pelajari Fitur
            </Link>
          </div>

          <p className="small muted" style={{ marginTop: 18 }}>
            Tidak perlu aplikasi tambahan untuk pelanggan.
          </p>
        </div>
      </section>

      {/* VALUE */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: 32 }}>
              Semua Operasional Restoran dalam Satu Sistem
            </h2>
            <p className="muted">
              Dirancang untuk membantu pemilik restoran dan tim bekerja lebih mudah.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 20,
            }}
          >
            {features.map((feature) => (
              <div
                key={feature.title}
                className="card"
                style={{ padding: 24 }}
              >
                <div style={{ fontSize: 32, marginBottom: 16 }}>
                  {feature.icon}
                </div>

                <h3 style={{ marginBottom: 10 }}>{feature.title}</h3>

                <p className="muted" style={{ lineHeight: 1.7 }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        style={{
          padding: '64px 24px',
          background: 'var(--surface)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 32 }}>Cara Kerja MenuKlik</h2>
            <p className="muted">
              Empat langkah sederhana untuk pengalaman makan yang lebih praktis.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 20,
            }}
          >
            {steps.map(([number, title, description]) => (
              <div key={number} style={{ padding: 20 }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: 'var(--primary)',
                    marginBottom: 12,
                  }}
                >
                  {number}
                </div>

                <h3>{title}</h3>

                <p className="muted" style={{ lineHeight: 1.7 }}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PANEL DEMO SEMENTARA */}
      <section
        style={{
          padding: '48px 24px',
          background: 'var(--surface)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span className="pill tone-orange">
              Panel Pengembangan
            </span>

            <h2 style={{ fontSize: 32, marginTop: 16 }}>
              Demo MenuKlik
            </h2>

            <p className="muted">
              Akses sementara untuk menguji setiap halaman dan peran
              selama proses pengembangan.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {[
              {
                icon: '📱',
                title: 'Demo Pelanggan',
                description: 'Coba scan QR dan pesan menu.',
                link: '/coba',
              },
              {
                icon: '🏪',
                title: 'Dashboard Restoran',
                description: 'Masuk ke dashboard operasional restoran.',
                link: '/dashboard',
              },
              {
                icon: '👨‍🍳',
                title: 'Simulasi',
                description: 'Buka pusat simulasi dan demo.',
                link: '/demo',
              },
              {
                icon: '🛡️',
                title: 'Super Admin',
                description: 'Kelola platform MenuKlik.',
                link: '/admin',
              },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.link}
                className="card"
                style={{
                  padding: 24,
                  textDecoration: 'none',
                  color: 'var(--text)',
                  display: 'block',
                  transition: 'transform 0.2s',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>
                  {item.icon}
                </div>

                <h3 style={{ marginBottom: 8 }}>
                  {item.title}
                </h3>

                <p className="small muted">
                  {item.description}
                </p>

                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 16,
                    color: 'var(--primary)',
                    fontWeight: 700,
                  }}
                >
                  Buka Demo →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '72px 24px', textAlign: 'center' }}>
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: 36,
            borderRadius: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <h2 style={{ fontSize: 32 }}>
            Siap Membawa Restoranmu Lebih Digital?
          </h2>

          <p className="muted" style={{ lineHeight: 1.8, margin: '16px 0 24px' }}>
            Mulai kelola restoran dengan lebih praktis menggunakan MenuKlik.
            Daftarkan restoranmu dan pilih paket yang sesuai.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <Link to="/daftar" className="btn btn-primary">
              Daftarkan Restoran
            </Link>

            <Link to="/harga" className="btn">
              Lihat Paket Harga
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}