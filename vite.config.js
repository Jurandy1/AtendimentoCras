import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: './', // Garante caminhos relativos para Electron

  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    fs: {
      strict: false,
      allow: ['..']
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Garante caminhos relativos para todos os assets
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // manualChunks removido: causava "Cannot access 'me' before initialization" por ordem de carregamento
      }
    }
  }
});
