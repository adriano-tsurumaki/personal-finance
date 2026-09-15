import { defineConfig } from 'vite';
// import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
  resolve: {
    alias: {
      // '@renderer': path.resolve(__dirname, './src/renderer'),
      // '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
});
