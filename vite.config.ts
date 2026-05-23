import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'server') {
    return {
      build: {
        ssr: resolve(__dirname, 'src/index.ts'),
        outDir: 'dist/server',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            entryFileNames: 'index.cjs',
            format: 'cjs',
          },
        },
      },
    };
  }

  return {
    root: resolve(__dirname, 'src/client'),
    build: {
      outDir: resolve(__dirname, 'dist/client'),
      emptyOutDir: true,
    },
  };
});
