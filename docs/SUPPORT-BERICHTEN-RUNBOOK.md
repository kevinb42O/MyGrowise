# Support en mailopvolging

**Stand: 18 oktober 2026.** Nieuwe publieke contactvragen gaan rechtstreeks naar de mailbox; oudere beveiligde gesprekken blijven werken. Zie [CONTACT-BERICHTENPLAN.md](CONTACT-BERICHTENPLAN.md) voor die grens en [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) voor de hosting-/releaseprocedure.

## Dagelijkse werking

`/contact` slaat één praktische mailtaak op met een gevalideerd bezoekersadres als Reply-To. Het team antwoordt vanuit de mailbox. Er wordt geen nieuw beveiligd supportgesprek gemaakt. Bestaande gastgesprekken en de accountinbox blijven beschikbaar; hun interne notities gaan niet naar klanten en veroorzaken geen externe mail.

Nieuwe taken proberen direct te verzenden. Vercel Free heeft één dagelijkse geconsolideerde cron om support-, commerce-, boekings- en websitemail te verwerken. De dagelijkse ronde gebruikt kleine batches en geeft geen garantie op herstel binnen vijf minuten. `/admin/mail` toont wachtende, lopende en mislukte taken, met expliciete verwerking/herstart door bevoegd integratiebeheer. Controleer eerst oorzaak en mogelijke eerdere bezorging voordat mislukte taken worden herstart.

## Configuratie en storingen

`SUPPORT_SMTP_USER`, `SUPPORT_SMTP_PASSWORD` en `SUPPORT_FROM_EMAIL` configureren Webnode SMTP. `SUPPORT_SMTP_VERIFIED=true` vereist een werkelijke aanmeld-/afleverproef. `CRON_SECRET` beschermt de mailworker; Supabase Auth-mail heeft een afzonderlijke configuratie. Bewaar geheimen alleen lokaal of in Vercel. Capture is uitsluitend voor development.

SMTP-falen draait een bevestigde boeking of gemaakte order niet terug. Leases, beperkte retries en backoff bewaren de taken. SMTP-acceptatie en database-update zijn geen gezamenlijke transactie: na een onderbreking kan een retry een dubbele mail opleveren. Een opgeslagen `sent`-status bevestigt provideracceptatie, geen inboxplaatsing.

## Privacy

Gebruik support/mail alleen voor praktische vragen. Rapporten en betaalde inhoud gaan via de private aankooptoegang; behandelnotities horen in dossiers. Bestaande gastlinks zijn 24 uur geldig, supportsessies zeven dagen; supportretentie is twaalf maanden na het laatste zichtbare bericht. Aankooplinks hebben hun eigen kortere geldigheid. Mailboxretentie en juridische uitzonderingen moeten nog met de eigenaar bevestigd worden.
