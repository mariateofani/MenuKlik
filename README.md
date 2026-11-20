# MenuKlik Frontend (versi simulasi)

Frontend lengkap MenuKlik, sistem pemesanan makanan berbasis QR Code untuk warung, kedai, dan kafe kecil. Proyek ini berisi tiga area:

| Area | Alamat | Pengguna |
| --- | --- | --- |
| Website pelanggan | `/t/<token-qr>` | Pelanggan, tanpa login |
| Dashboard restoran | `/login`, `/dashboard/...` | Owner, Kasir, Dapur, Waiter |
| Super Admin | `/admin/login`, `/admin/...` | Tim pengelola platform |

Versi ini **belum memakai server**. Semua data disimpan di browser (localStorage) melalui "backend simulasi" di `src/services/`. Tidak ada login sungguhan, tidak ada pembayaran sungguhan, dan tidak ada uang yang berpindah.

---

## 1. Cara menjalankan

Yang dibutuhkan: **Node.js versi LTS** (18 atau lebih baru). Unduh di https://nodejs.org.

```bash
# 1. Ekstrak zip, lalu masuk ke folder proyek
cd menuklik-frontend

# 2. Pasang dependensi (sekali saja, butuh internet)
npm install

# 3. Jalankan
npm run dev
```

Buka alamat yang muncul di terminal, biasanya http://localhost:5173.

**Mencoba dari HP:** sambungkan HP dan laptop ke Wi-Fi yang sama. Terminal akan menampilkan alamat `Network`, misalnya `http://192.168.1.5:5173`. Buka alamat itu di HP. Catatan: data simulasi tersimpan per browser, jadi HP dan laptop punya data masing-masing. Untuk melihat pesanan berpindah secara langsung, pakai beberapa tab di **browser yang sama**.

Perintah lain:

```bash
npm run build     # membuat versi siap online di folder dist/
npm run preview   # mencoba hasil build secara lokal
```

## 2. Akun demo

Semua password: `demo123`

| Peran | Email |
| --- | --- |
| Owner (semua peran) | owner@kedairasa.test |
| Kasir (+ Waiter) | cashier@kedairasa.test |
| Dapur | kitchen@kedairasa.test |
| Waiter | waiter@kedairasa.test |
| Super Admin | admin@menuklik.test |

Sesi login disimpan per tab. Kamu bisa membuka tab Kasir, tab Dapur, dan tab pelanggan sekaligus. Perubahan di satu tab langsung terlihat di tab lain.

## 3. Skenario demo

**Andi, bayar digital (Meja 02)**
1. Buka halaman utama `/`, klik **Kosongkan data** agar pesanan pertama bernomor MK-0001.
2. Klik **Meja 02**. Pesan 1 Nasi Goreng Spesial (Rp20.000) dan 1 Es Teh (Rp5.000). Total Rp25.000.
3. Di keranjang, isi nama "Andi". Pilih **Bayar digital**, lalu **Kirim pesanan**.
4. Di panel simulasi, tekan **Pembayaran berhasil**.
5. Tab Kasir: buka **Pesanan & kasir**, pilih MK-0001, tekan **Terima & kirim ke dapur**.
6. Tab Dapur: **Mulai memasak**, lalu **Selesai masak**. Penyajian otomatis menjadi "Menunggu diambil".
7. Tab Waiter: **Ambil pesanan**, lalu **Sudah diantar ke meja**. Pesanan lunas dan diantar dihitung Selesai.
8. Cek **Pembayaran & kas** (termasuk kolom "dicatat di POS/buku kas") dan **Laporan**.

**Konfigurasi perangkat**
Owner > **Pengaturan > Konfigurasi perangkat**: Basic, Standard (dengan/tanpa tablet bersama), Advanced. Di mode manual (Basic, atau Standard tanpa tablet) menu Dapur dan Waiter disembunyikan dan Kasir mencatat status dapur dan penyajian dari detail pesanan. Konfigurasi dibatasi paket (Basic hanya Basic, Standard sampai Standard, Advanced semuanya).

**Bayar di kasir**
1. Masuk sebagai Owner, buka **Pengaturan > Pembayaran & pajak**, pilih kebijakan "Bayar dulu" atau "Makan dulu, bayar belakangan".
2. Dari HP pelanggan, pesan dan pilih **Bayar di kasir**.
3. Dengan "Bayar dulu", tombol Terima terkunci sampai kasir menekan **Konfirmasi pembayaran tunai**.
4. Dengan "Bayar belakangan", pesanan langsung bisa diterima dan dimasak, tetapi tidak bisa ditandai selesai sebelum lunas.

**Hal lain yang bisa diuji**
- Ubah menu menjadi **Habis** saat menu itu masih ada di keranjang pelanggan, lalu kirim pesanan: server menolak.
- Ubah harga menu: pesanan lama tetap memakai harga lama.
- **Meja & QR > QR baru**: tab pelanggan yang memakai QR lama langsung ditolak.
- Klik **Kirim pesanan** berkali-kali: hanya satu pesanan yang dibuat.
- Di halaman pembayaran berhasil, **Kirim ulang notifikasi**: tidak diproses dua kali.
- Super Admin minta akses data restoran; Owner menyetujui di **Pengaturan > Akses data & bantuan**.

## 4. Struktur folder

```
src/
├── main.jsx, App.jsx        # titik awal aplikasi dan daftar rute
├── services/
│   ├── seed.js              # data awal (restoran, menu, meja, pesanan contoh)
│   ├── db.js                # "database" localStorage + sinkron antartab
│   └── api.js               # semua aturan bisnis (pengganti backend)
├── hooks/                   # useDb, useAuth, useCart, useNow
├── components/              # komponen UI bersama, QR, detail pesanan, form menu
├── layouts/                 # kerangka halaman pelanggan, dashboard, super admin
├── pages/
│   ├── customer/            # Landing, Menu, ProductDetail, Cart, Checkout, Payment, OrderTrack
│   ├── dashboard/           # Overview, Orders, Kitchen (KDS), Waiter, MenuManage, Tables, Payments, Reports, Settings
│   ├── admin/               # AdminOverview, AdminRestaurants, AdminPlans, AdminSubscriptions, AdminSupport
│   └── auth/                # halaman masuk
├── lib/                     # konstanta status & hak akses, format, ikon
└── styles/global.css        # seluruh tampilan (token warna terang & gelap)
```

## 5. Data dan aturan bisnis

Koleksi data di `seed.js` mengikuti 16 tabel rancangan: `restaurants`, `users`, `restaurant_members`, `tables`, `qr_codes`, `categories`, `products`, `product_variants`, `orders`, `order_items`, `payments`, `payment_events`, `restaurant_settings`, `subscriptions`, `plans`, `order_status_history`. Ada empat tambahan yang dibutuhkan fitur Super Admin dan audit: `subscription_invoices`, `support_tickets`, `access_requests`, `audit_logs`.

Aturan yang sudah ditegakkan di `api.js`:

- Setiap data operasional terikat `restaurant_id`; restoran lain diperlakukan seolah datanya tidak ada.
- QR memakai token acak 16 karakter dan divalidasi (token, status QR, status meja, status langganan).
- Harga disalin ke `order_items` saat checkout (snapshot).
- Stok dan pilihan variasi divalidasi ulang saat pesanan dikirim.
- Kunci idempoten mencegah pesanan ganda.
- Status pesanan dan status pembayaran disimpan terpisah.
- Pembayaran digital hanya berubah lewat notifikasi gateway; notifikasi dengan ID sama diabaikan.
- Kebijakan bayar disalin ke setiap pesanan saat dibuat.
- Tiga status terpisah per pesanan: pembayaran, dapur (`waiting/accepted/preparing/ready`), penyajian (`waiting_pickup/picked_up/delivered`). "Selesai" dihitung (diantar dan lunas), "Dibatalkan" berupa penanda terpisah.
- Satu pegawai boleh punya beberapa peran; izin = gabungan perannya (`checkOrderAction` di `api.js`, `PERMISSIONS` di `lib/constants.js`). Riwayat mencatat siapa dan di perangkat apa.
- Kuota paket (meja, pegawai) dan konfigurasi perangkat ditegakkan di `api.js`; aksi pegawai dibatasi saat langganan tidak aktif.
- Pesanan lunas hanya bisa dibatalkan owner, dan tercatat sebagai refund.
- Menu yang pernah dipesan diarsipkan, tidak dihapus permanen.
- Super Admin hanya melihat angka agregat. Data pesanan butuh izin owner, berlaku 24 jam, tanpa nama pelanggan.

**Asumsi** yang dipakai: pajak dan biaya layanan dihitung dari subtotal; pembayaran digital kedaluwarsa 15 menit; masa uji coba 14 hari; harga paket Starter dan Pro hanya contoh.

## 6. Rekomendasi teknologi untuk versi online

Rekomendasi ini masih perlu kamu cek ulang (biaya, kuota gratis, dan syarat layanan bisa berubah):

| Kebutuhan | Rekomendasi | Alasan |
| --- | --- | --- |
| Frontend | React + Vite (proyek ini) | Sudah jadi, bisa di-hosting gratis sebagai situs statis |
| Database, login, real-time | Supabase | Satu layanan untuk database PostgreSQL, autentikasi, update real-time, penyimpanan foto, dan Row Level Security untuk isolasi data per restoran |
| Logika server (webhook, validasi pesanan) | Supabase Edge Functions | Verifikasi tanda tangan webhook dan validasi pesanan wajib di server, tidak boleh di browser |
| Pembayaran | Payment gateway Indonesia yang mendukung QRIS dan webhook (misalnya Midtrans atau Xendit) | Mulai dari mode sandbox; pilih setelah membandingkan biaya dan proses verifikasi usaha |
| Hosting frontend | Vercel atau Netlify | File `vercel.json` dan `public/_redirects` sudah disiapkan agar rute seperti `/t/...` tidak error 404 |

**Jalur migrasi:** halaman-halaman tidak perlu ditulis ulang. Yang diganti adalah `services/db.js` dan `services/api.js`: setiap fungsi di `api.js` dipindahkan menjadi query Supabase atau Edge Function dengan nama dan aturan yang sama. Fungsi `simulateGatewayNotification` diganti endpoint webhook sungguhan, dan panel simulasi di halaman pembayaran pelanggan dihapus.

## 7. Keterbatasan versi ini

- Data hanya ada di satu browser. Menghapus data situs akan menghapus semuanya.
- Dua tab yang mengubah data pada detik yang sama bisa saling menimpa.
- Password tersimpan tanpa enkripsi (khusus demo).
- Foto menu disimpan di localStorage; kapasitasnya kecil (sekitar 5 MB per situs di banyak browser).
- Integrasi POS belum ada dan memang di luar cakupan MVP.

## 8. Pengujian yang sudah dilakukan

Di lingkungan pembuatan proyek ini, akses internet untuk `npm install` tidak tersedia, sehingga `npm run dev` belum dijalankan. Yang sudah dilakukan:

- Seluruh kode dikompilasi dengan esbuild tanpa error.
- 50 render halaman (semua halaman untuk ketiga peran restoran, Super Admin, dan pelanggan) berhasil tanpa error.
- 16 uji aturan bisnis lulus, termasuk skenario Andi (MK-0001, Rp25.000), idempotensi, webhook ganda, hak akses dapur, kebijakan bayar belakangan, snapshot harga, validasi stok, QR yang diganti, isolasi tenant, refund, dan izin akses Super Admin.

Jika menemukan error saat `npm install` atau `npm run dev`, salin pesan error dari terminal untuk diperbaiki.


## 9. Tema warna

- Super Admin: biru (atribut `data-theme="admin"` pada `<html>`, dipasang otomatis oleh `ThemeSync` di `App.jsx`).
- Landing page, pelanggan, dan semua peran lain (Owner, Kasir, Dapur, Waiter): merah dan putih dominan, aksen amber untuk tombol utama.
- Warna hijau hanya untuk arti "berhasil" (Lunas, Siap, Aktif) lewat variabel `--ok*`, terpisah dari warna merek (`--green*`).
- Semua warna ada di blok `:root` paling atas `src/styles/global.css`, lengkap dengan mode gelap. Ganti nilainya di sana untuk mengubah tema.

## 10. Alur penggunaan

1. Sistem dimulai dari landing page (`/`): pengenalan produk, fitur, cara kerja, harga, dan FAQ.
2. Pengguna masuk lewat **Masuk dengan Google** (simulasi), **Masuk** dengan email dan password, atau **Daftar** sebagai pemilik baru.
3. Setelah masuk, pengguna **tetap di landing page**. Di header dan di kartu sambutan muncul tombol **Beralih ke dashboard**:
   - Super Admin: langsung ke dashboard Super Admin.
   - Pegawai dengan satu peran (Kasir, Dapur, atau Waiter): langsung ke dashboard perannya.
   - Pemilik atau pegawai dengan beberapa peran: menu pilihan "Dashboard Owner / Kasir / Dapur / Waiter".
   - Akun baru yang belum punya usaha: "Lanjutkan pendaftaran usaha".
4. Dari dashboard, tautan **Ke landing page** di sidebar (atau di header Super Admin) kembali ke halaman utama.

Catatan: "Masuk dengan Google" adalah simulasi. Tidak ada koneksi ke Google. Email dipercaya apa adanya, dan email baru menjadi akun pemilik baru. Di produk asli, backend harus memverifikasi token OAuth dari Google sebelum membuat sesi. Akun contoh ada di pilihan akun Google, dan password email demo adalah `demo123`.

## 11. Peta halaman (mengikuti prototipe)

| Alamat | Isi |
|---|---|
| `/`, `/fitur`, `/cara-kerja`, `/harga`, `/tentang`, `/faq` | Situs pemasaran dengan bilah panel demo |
| `/coba` | Demo pelanggan di bingkai HP (alur `/t/:token` yang sebenarnya) |
| `/simulasi` | Simulasi multi-perangkat: jalur pesanan, tiga status, riwayat, dan perangkat berdampingan (HP pelanggan, komputer kasir, tablet bersama/KDS/HP waiter/HP pemilik sesuai konfigurasi) dengan pilihan akun per perangkat |
| `/demo` | Data demo: tautan QR, reset dan isi ulang data |
| `/login`, `/daftar`, `/lupa-password`, `/atur-ulang/:token` | Masuk, pendaftaran + verifikasi + onboarding, lupa password |
| `/dashboard/...` | Dashboard restoran (Kategori dan Pegawai & peran kini halaman sendiri; bilah demo tampil di atas dashboard) (Ringkasan dengan kartu paket, langkah awal, jadwal pemberitahuan, simulasi waktu; menu Dapur/Waiter terkunci bila tidak dipakai di konfigurasi): pesanan & kasir (dua panel), dapur (KDS), waiter, tablet bersama, menu, meja & QR, pembayaran & kas, laporan, pengaturan, langganan, bantuan |
| `/admin/...` | Super Admin tanpa sidebar: lima tab (Kendala restoran, Restoran & langganan, Transaksi langganan, Paket/harga/uji coba, Gangguan & pengumuman) |

## 12. Status penyesuaian dengan prototipe

Sudah disesuaikan: situs pemasaran lengkap, simulasi multi-perangkat, kasir dua panel, lupa password, pendaftaran pemilik, tiga status pesanan, peran Waiter dan multi-peran, tiga konfigurasi perangkat + mode manual, KDS gelap, dashboard Waiter, langganan mandiri, laporan kendala + pengumuman gangguan, pengaturan paket Super Admin, transaksi data atomik.

Belum dipindahkan dari prototipe: tab Konsep, simulasi offline per perangkat dan simulasi gangguan server, satu akun dengan beberapa restoran, "Jejak data" dan pemilih restoran di bilah demo, pencocokan tampilan per layar untuk halaman Menu, Meja, Laporan, dan Pengaturan. Alur pelanggan (landing, menu) sudah dicek dan selaras.
