import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Not standard

export default defineConfig({
  plugins: [
    react(),
     tailwindcss(), // Not needed; use PostCSS config instead
  ],  
  server: {
    proxy: {
      "/api": {
        target: "https://lms-78k90o3v5-satyam-singhs-projects-68ded00b.vercel.app",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

