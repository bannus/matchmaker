import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // tailwindcss must come before react — otherwise React refresh preamble gets suppressed
  plugins: [tailwindcss(), react()],
})
