# MyGrowise rebuild — technical handoff

## What is implemented

- A new, responsive brand and design system.
- One clear homepage with two conversion routes.
- Product overview and a dedicated stress- and emotion-profile page.
- Professionals overview with links to the existing secure booking environment.
- Modules, pricing, story, contact, privacy and conditions routes.
- Centralized public content in `src/content/site.ts`.
- Safe disabled API routes: no mock payment can be marked as paid.
- Astro 7 server build with no React runtime, Supabase mock or Mollie mock.
- One H1 per page, canonical metadata, skip link, reduced-motion support and mobile navigation.

## Commands

```bash
npm install
npm run dev
npm run build
```

## Launch blockers

1. Confirm whether Wise must be the customer checkout or only the payout account.
2. Connect and test the approved production payment provider.
3. Replace e-mail purchase requests with a real order and entitlement flow.
4. Connect a user-friendly CMS after the owner completes the CMS usability test.
5. Verify all professional titles, profile price, biographies and booking URLs.
6. Supply and approve the final privacy statement and terms.
7. Decide the exact deliverable and access flow for the first profile.
8. Configure deployment, domain, redirects, analytics and transactional e-mail.

## Content editing during this stage

Products, professionals, frequently asked questions and recognition copy live in:

`src/content/site.ts`

This is deliberately a temporary structured source. It should be replaced by the chosen CMS before operational handoff to the owner.

## Safety decisions

- Checkout endpoints return `503` until a real provider is configured.
- The retired Mollie webhook returns `410`.
- Internal booking endpoints are disabled; the site uses the existing client environment.
- Privacy and conditions pages are `noindex` and explicitly marked as pre-launch drafts.
- No intake notes, questionnaire answers or health data are collected by this build.
