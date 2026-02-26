import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-proposal-class-properties']
      }
    }),
    {
      name: 'admin-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.originalUrl || req.url;
          console.log('Request URL:', url);

          // 如果是后台管理系统相关路径，返回 admin-entry.html
          if (url && (url.startsWith('/dashboard') ||
              url.startsWith('/admin') ||
              url.startsWith('/users') ||
              url.startsWith('/agents') ||
              url.startsWith('/products') ||
              url.startsWith('/orders') ||
              url.startsWith('/positions') ||
              url.startsWith('/finance') ||
              url.startsWith('/commission') ||
              url.startsWith('/risk') ||
              url.startsWith('/settings'))) {

            const adminHtmlPath = path.resolve(__dirname, 'admin-entry.html');
            try {
              const adminHtml = fs.readFileSync(adminHtmlPath, 'utf-8');
              res.setHeader('Content-Type', 'text/html');
              res.end(adminHtml);
              return;
            } catch (err) {
              console.error('Failed to read admin-entry.html:', err);
            }
          }
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        adminEntry: resolve(__dirname, 'admin-entry.html')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['all']
  },