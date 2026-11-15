import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// GitHub Pages serves this repo from /mission-architect/, so that is the
// default and nothing about the existing deploy changes. A host that serves
// from the root of a domain - Netlify, Vercel, a plain static bucket - needs
// base '/' instead, or every asset 404s and the page comes up blank.
//
//   GitHub Pages :  npm run build
//   Netlify      :  VITE_BASE=/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/mission-architect/',
})
