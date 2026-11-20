import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true agar bisa dibuka dari HP di jaringan Wi-Fi yang sama (untuk mencoba scan QR).
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
