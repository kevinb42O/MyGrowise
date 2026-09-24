# MyGrowise rebuild — technical handoff

## What is implemented

- A new, responsive brand and design system.
- One clear homepage with two conversion routes.
- Product overview and a dedicated stress- and emotion-profile page.
- Professionals overview with links to the existing secure booking environment.
- Modules, pricing, story, contact, privacy and conditions routes.
- Centralized public content in `src/content/site.ts`.
- Product CTA leads to the MyGrowise account and manual Wise order flow.
- Wise orders use a unique transfer reference; customer payment claims remain pending until a superadmin verifies the incoming transfer.
- Admin Wise reconciliation shows open/claimed/confirmed orders. Virginie compares references, amount and currency against a Wise statement she opens locally; the statement is not uploaded to MyGrowise.
- Astro 7 server build with no React runtime, Supabase mock or Mollie mock.
- One H1 per page, canonical metadata, skip link, reduced-motion support and mobile navigation.

## Commands

```bash
npm install
npm run dev
npm run build
```

## Launch blockers

1. Apply the manual-Wise database migration and confirm the account/order flow in the intended deployment.
2. Agree and implement the operational delivery step for the Stress- en Emotieprofiel after payment confirmation; account entitlement alone does not send questionnaires or the report.
3. Connect a user-friendly CMS after the owner completes the CMS usability test.
4. Verify all professional titles, profile price, biographies and booking URLs.
5. Supply and approve the final privacy statement and terms.
6. Configure deployment, domain, redirects, analytics and transactional e-mail.

## Content editing during this stage

Products, professionals, frequently asked questions and recognition copy live in:

`src/content/site.ts`

This is deliberately a temporary structured source. It should be replaced by the chosen CMS before operational handoff to the owner.

## Safety decisions

- The retired hosted Wise checkout endpoint returns `410`; the manual Wise checkout requires configured account details and a human payment confirmation before entitlement activation.
- Wise statement PDFs stay outside MyGrowise: do not upload or store them. The reconciliation screen stores order and confirmation data only.
- The retired Mollie webhook returns `410`.
- Internal booking endpoints are disabled; the site uses the existing client environment.
- Privacy and conditions pages are `noindex` and explicitly marked as pre-launch drafts.
- No intake notes, questionnaire answers or health data are collected by this build.
