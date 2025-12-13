import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  
  // 🎯 CORREÇÃO CRÍTICA PARA GITHUB PAGES
  base: '/academic-os/', // Use o nome do seu repositório aqui
  
  plugins: [react()],
})