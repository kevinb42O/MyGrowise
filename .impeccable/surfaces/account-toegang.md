# Accounttoegang

Target: src/pages/account/inloggen.astro. Related: account/aanmaken, wachtwoord-vergeten, wachtwoord-herstellen, bevestigingslink; src/layouts/AuthLayout.astro; src/styles/auth.css. Mode: Operate.

Reuse PurchaseLayout's quiet logo/navigation/footer and purchase button vocabulary. Shared AuthLayout pairs sage and existing module photography with a functional white form. DM Serif Display carries the title, DM Sans labels and inputs. Muted rose #823f49, sage #e8eee7, 8px controls and a 16px shell intentionally follow the purchase workspace rather than the route-specific Startpunt specification in DESIGN.md.

On phones, the welcome is a short text strip, no photo or secondary purchase explanation. Inputs use 16px, password visibility is independently controllable, error/success notices use role alert/status, and previous/alternative paths remain available. No account is needed for purchase access. Do not change account ownership, roles or confirmation rules.

Recovery retains the sanitized destination from login through request, recovery mail and return to login. Failed or absent recovery sessions show a direct retry link. Network failure cannot leave a disabled save button indefinitely.

Image provenance: existing public/images/modules/zelfreflectie-hero-v2.webp, reused unchanged from the established module image bank; decorative. No generated or newly sourced raster.
