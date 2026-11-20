import { Component } from 'react';

// Mencegah layar putih total: jika satu halaman gagal ditampilkan, pengguna melihat pesan dan tombol muat ulang,
// bukan layar kosong. Data pesanan tidak terpengaruh.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Tampilan gagal dimuat:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="cust-body center" style={{ paddingTop: 64 }} role="alert">
        <h1 style={{ fontSize: 19 }}>Tampilan gagal dimuat</h1>
        <p className="muted" style={{ maxWidth: 320 }}>Pesananmu aman. Muat ulang halaman untuk melihat status terbaru.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Muat ulang</button>
      </div>
    );
  }
}
