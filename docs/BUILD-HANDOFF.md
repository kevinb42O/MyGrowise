# MyGrowise — technische overdracht

**Gecontroleerd: 18 oktober 2026, `b2cfabd` plus de huidige werkboom.** Begin bij [MASTERPLAN.md](MASTERPLAN.md) en [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md). De huidige release bevat ook het eerder ongecommitte website-, catalogus-, module-, praktijk- en agendawerk.

## Systeemkaart

Astro 7 SSR draait op Vercel; React verzorgt de catalogusfilters en FullCalendar. Supabase bevat Auth, catalogus, orders, aankooprechten, afnames, materiaalversies, dossiers, agenda's en mailwachtrijen. De serverclient gebruikt een serversleutel; middleware, de permissiematrix en services controleren actor en eigendom. Databasefuncties beschermen de kritieke transacties opnieuw.

- `/profielen`, `/vragenlijsten`, `/modules`, `/samenstellen`: publieke catalogus, met bewerkbare inhoud en prijzen. Profielen en vragenlijsten hebben afzonderlijke detailtemplates.
- `/bestellen` en `/api/checkout/catalog-order`: gast- en accountcheckout. `COMMERCE_SALES_ENABLED` moet in productie expliciet `true` zijn voordat nieuwe orders mogelijk zijn. De oude Wise-aanmaakroute heeft dezelfde blokkade.
- `/aankopen`: beveiligde toegang zonder Auth-account; `/account` blijft bruikbaar. Een ingevuld e-mailadres of order-ID bewijst geen eigendom.
- `/admin/afnames` en `/admin/modules`: professioneel beheerde afname/rapporten en gecontroleerde PDF/audio-publicatie. Modules zijn nog niet leverbaar.
- `/afspraak`, `/praktijk`, dossier- en praktijkbeheer: direct bevestigde afspraak, dossierkoppeling, wijzigingen en mailtaken. Afspraken behouden accountplicht.
- `/contact`: praktische mailvraag; oudere supportgesprekken behouden hun eigen routes.
- `/admin/mail`: wachtrijtotalen en bewuste verwerking/herstart. Geen gevoelige mailinhoud in dit overzicht.
- `vercel.json`: alleen de dagelijkse geconsolideerde worker. Directe verzending gebeurt bij handelingen. De oude booking-mailcronroute blijft als beveiligde compatibiliteitsroute bestaan, zonder eigen schema.

## Lokaal controleren

```sh
npm ci
npm test
npm run check
npm run security:audit
npm run check:artifact
```

Databaseproeven staan in de onderwerp-runbooks en draaien terug. Voer ze na elkaar uit: tijdelijke HTTP-producten kunnen anders de gecontroleerde aantallen beïnvloeden. HTTP/Storage-proeven maken tijdelijke fixtures en verwijderen die na afloop. Gebruik `WEBSITE_MAIL_MODE=capture` alleen in development en een afzonderlijke devserver; stuur geen echte testmails naar klanten.

## Open bedrijfs- en productiepunten

De juridische verkoper/verantwoordelijke, definitieve voorwaarden/privacy, levering, btw/refundproces en professionele productgegevens vragen bevestiging door de eigenaar. Kevin verwacht de klantgegevens op 19 oktober. De bestaande standaardbankgegevens blijven ongewijzigd en moeten inhoudelijk gecontroleerd worden.

Echte inbox-/spamaflevering, Supabase Auth-mail, een echte betaling, eigenaaracceptatie, monitoring en back-upherstel zijn niet door een lokale build bewezen. Vercel Free is een vaste keuze; introduceer geen frequentere cron of betaald alternatief zonder nieuwe opdracht. Zie het releaserunbook voor de procedure voor verkoopvrijgave en herstel.
