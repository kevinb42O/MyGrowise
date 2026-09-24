import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
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
