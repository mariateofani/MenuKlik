import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Membuat gambar QR dari teks (URL meja). Warna hitam di atas putih agar mudah dipindai.
export function useQrDataUrl(text, size = 320) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#FFFFFF' } })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''));
    return () => {
      alive = false;
    };
  }, [text, size]);
  return url;
}

export function QrImage({ text, size = 180, label = 'QR Code', stamp }) {
  const url = useQrDataUrl(text, size * 2);
  return (
    <div className="qr" style={{ width: size }}>
      {url ? <img src={url} alt={label} width={size} height={size} /> : <div className="qr-loading" style={{ height: size }} />}
      {stamp && <span className="qr-stamp">{stamp}</span>}
    </div>
  );
}
