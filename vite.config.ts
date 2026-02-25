import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-proposal-class-properties']
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['all']
  },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          '@btn-height-default': '40px',
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'tdesign-react', 'tdesign-icons-react', 'echarts-for-react']
  }
})
