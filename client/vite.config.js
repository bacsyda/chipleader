import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi chạy `npm run dev` ở client, chuyển Socket.IO sang server Node cổng 3000.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] }, proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } },
});
