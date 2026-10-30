# Bestellen en betalen

Target: src/pages/bestellen.astro. Related: src/components/astro/PaymentInstructions.astro. Mode: Operate.

Use the existing PurchaseLayout, shared with Mijn aankopen: MyGrowise logo, purchase/help links, quiet legal footer, no marketing navigation or page-load choreography. Preserve forest green, warm paper, DM Sans and a restrained DM Serif Display page title. This is a checkout refinement within the existing brand, not a replacement for the startpunt design system in DESIGN.md.

Show the actual order status, a compact introduction, order summary and bank-transfer instructions. On mobile the introduction and summary precede payment details so the buyer knows the product and total before paying. Totals use tabular DM Sans numerals; title 2.75rem desktop, 2.25rem mobile, 2rem small phone; functional text .8125–1rem. Panels have a single border and 12px corners. Use existing purchase sage for contextual recipient information.

IBAN is grouped for reading and copied without spaces. Amount and payment reference have labeled copy buttons with live feedback, including clipboard failure recovery. Without clipboard support or JavaScript, the bank details remain readable and selectable. The SEPA QR code is optional, collapsed in native details/summary, and explained beside the same bank details. Show the relationship between iTransform SLU and MyGrowise only for the known account name; the existing privacy page supplies this fact. Do not add unverified security badges, payment timing promises, or paid-state claims.

Keep ownership checks, private/no-store headers, checkout cookies, existing order form, consent fields, payment provider and manual confirmation unchanged. Paid and cancelled orders do not show payment instructions. Missing bank details have a contact recovery message.

Verification: local production build and typecheck; 99 existing tests; browser checks at 320, 390, 768, 1440 and 2048px with synthetic order details, clipboard success/failure, keyboard QR disclosure, and pending/paid/cancelled/form states. Review captures in .impeccable/review/checkout-*.png are synthetic, not real customer orders. No new raster assets or third-party services.
