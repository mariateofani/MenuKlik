import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-box center">
        <h1 style={{ fontSize: 22 }}>Halaman tidak ditemukan</h1>
        <p className="muted">Alamat yang kamu buka tidak ada atau sudah dipindahkan.</p>
        <Link className="btn btn-primary" to="/">Ke halaman utama</Link>
      </div>
    </div>
  );
}
