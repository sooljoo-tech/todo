import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

// GitHub Pages 배포 경로: https://<계정>.github.io/todo/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/todo/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
