import {readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

// The adapter excludes exact paths; expand local directories rather than passing globs.
const localFiles=dir=>existsSync(dir)?readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?localFiles(join(dir,e.name)):[join(dir,e.name)]):[];
// https://astro.build/config
export default defineConfig({
  site: 'https://mygrowise.be',
  output: 'server',
  adapter: vercel({excludeFiles: [...localFiles('output'),...localFiles('tests'),...readdirSync('.').filter(name=>name.startsWith('.env'))]}),
  integrations: [react()],
  vite: {
    // Development and production optimizers must not overwrite each other's React cache.
    cacheDir: process.env.NODE_ENV === 'production' ? 'node_modules/.vite-production' : 'node_modules/.vite-development',
    resolve: { dedupe: ['react', 'react-dom'] },
  },
  security: {
    // Vercel can invoke SSR functions with an internal URL that breaks Astro's
    // built-in checkOrigin. The middleware performs an explicit origin check.
    checkOrigin: false,
    allowedDomains: [
      { hostname: 'mygrowise.be', protocol: 'https' },
      { hostname: 'www.mygrowise.be', protocol: 'https' },
      { hostname: 'mygrowise.vercel.app', protocol: 'https' },
    ],
  },
});
