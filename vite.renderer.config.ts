import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig(async () => {
  // The plugin is ESM-only; import() preserves compatibility with the CommonJS config.
  const { default: tailwindcss } = await import('@tailwindcss/vite');

  return {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, 'src/html/index.html'),
          titlebar: path.resolve(__dirname, 'src/html/titlebar.html'),
        },
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
  };
});
