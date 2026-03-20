import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Not standard

export default defineConfig({
  plugins: [
    react(),
     tailwindcss(), // Not needed; use PostCSS config instead
  ],
})