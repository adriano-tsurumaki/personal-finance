import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, './src/renderer/lib'),
      '@components': path.resolve(__dirname, './src/renderer/components'),
      '@modules': path.resolve(__dirname, './src/renderer/modules'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@store': path.resolve(__dirname, './src/renderer/store'),
    },
  },
});
