import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'src/html/index.html'),
        titlebar: path.resolve(__dirname, 'src/html/titlebar.html'),
      },
    },
  },
});
