import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Relative base so the build works at https://<user>.github.io/<repo>/ without hardcoding the repo name.
// Five pages: the map, the guided cycles (gallery, predict-then-reveal, story) and About.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        cycles: resolve(import.meta.dirname, 'cycles/index.html'),
        guess: resolve(import.meta.dirname, 'cycles/guess/index.html'),
        scroll: resolve(import.meta.dirname, 'cycles/scroll/index.html'),
        about: resolve(import.meta.dirname, 'about/index.html'),
      },
    },
  },
})
