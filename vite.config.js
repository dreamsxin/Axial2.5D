import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'Axial25D',
      fileName: 'axial25d',
    },
  },
  server: {
    port: 3001,
    open: '/examples/html/framework.html',
  },
  optimizeDeps: {
    include: [],
  },
});
