# Supportberichten: beheer

## Werking

- `/contact` laat bezoekers zonder account een praktische vraag versturen. De vraag en uitgaande mailtaak worden samen in Supabase opgeslagen.
- Webnode SMTP (`smtp.mail.webnode.com`, poort 465) verstuurt een neutrale ontvangstmail of antwoordmelding. De inhoud van het gesprek staat alleen in MyGrowise.
- Een gast opent de eenmalige link uit de e-mail, bevestigt de toegang via een knop en krijgt een sessie voor precies dat gesprek. Een verloren of verlopen link kan op `/berichten/link` opnieuw worden aangevraagd.
- Accountklanten lezen hun gesprekken op `/account/ondersteuning`. Medewerkers behandelen alle vragen op `/admin/berichten`.

## Configuratie

Zet `SUPPORT_SMTP_USER` op het volledige Webnode-mailadres, `SUPPORT_SMTP_PASSWORD` op het SMTP-wachtwoord, en `SUPPORT_FROM_EMAIL` op hetzelfde afzenderadres. Zet `SUPPORT_SMTP_VERIFIED=true` pas na een geslaagde SMTP- en afleverproef. `CRON_SECRET` beveiligt `/api/cron/support-mail`. De productieomgeving gebruikt Vercel-omgevingsvariabelen; geheimen horen nooit in Git.

## Als meldingen blijven wachten

De admininbox toont het aantal niet-bezorgde taken. Controleer SMTP-toegang en afzenderinstellingen; gebruik daarna **Probeer verzending opnieuw**. Het bericht zelf blijft in de inbox beschikbaar. Nieuwe berichten proberen direct te verzenden; de Vercel-cron probeert openstaande taken dagelijks opnieuw. Fouten en pogingen staan in `support_mail_jobs` (`status`, `attempts`, `last_error`, `next_attempt_at`). Een taak met `failed` wordt via de adminknop opnieuw ingepland.

## Privacy en toegang

Gastlinks verlopen na 24 uur en worden na gebruik ongeldig; een gastsessie verloopt na zeven dagen. Interne notities worden niet getoond aan klanten of gasten en veroorzaken geen externe e-mail. De dagelijkse Supabase-opruimtaak verwijdert supportgesprekken twaalf maanden na het laatste bericht. Verwijs vragen over inzage of verwijdering naar `info@mygrowise.be`.

De privacyverklaring bevat momenteel een zichtbare aanvulmelding en `noindex` tot de officiële verantwoordelijke, het postadres en de volledige verwerkersgegevens bevestigd zijn.
