import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/chloe4/',
  // Own port = own localStorage, so Chloe3's saved 12-bit patterns never mix with Chloe4's 24-step ones
  server: { port: 5174, strictPort: true },
})
