import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Relative base so the build works at https://<user>.github.io/<repo>/ without hardcoding the repo name.
// Four pages: the map, and the guided cycles (gallery, predict-then-reveal, story).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        cycles: resolve(import.meta.dirname, 'cycles/index.html'),
        guess: resolve(import.meta.dirname, 'cycles/guess/index.html'),
        scroll: resolve(import.meta.dirname, 'cycles/scroll/index.html'),
      },
    },
  },
})
