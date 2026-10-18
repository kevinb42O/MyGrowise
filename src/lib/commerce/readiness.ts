/** New sales require the owner to finish the legal and delivery details.
 * Existing orders, reconciliation and private purchase access remain available.
 * Local development stays usable for isolated, captured-mail acceptance tests.
 */
export const salesEnabled = () => import.meta.env.COMMERCE_SALES_ENABLED === 'true' || !import.meta.env.PROD && import.meta.env.COMMERCE_SALES_ENABLED !== 'false';
export const salesPausedMessage = 'Nieuwe bestellingen zijn binnenkort beschikbaar. We ronden de praktische verkoopinformatie af. Voor vragen over het aanbod kun je contact opnemen; bestaande aankopen blijven toegankelijk.';
