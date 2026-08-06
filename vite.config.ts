import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

/**
 * CEP loads the production build from `file:`, where a `crossorigin` script or
 * stylesheet is subject to a CORS check it cannot satisfy. The attribute buys
 * nothing for local assets, so it is stripped from the built HTML.
 */
function stripCrossOriginAttributes(): Plugin {
  return {
    name: 'sequoia-strip-crossorigin',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(?==|\s|>)/g, '')
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), stripCrossOriginAttributes()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'chrome99',
    // CEP has no HTTP/2 push, and preload links on `file:` only add failed
    // requests, so assets are referenced directly instead.
    modulePreload: false,
  },
})
