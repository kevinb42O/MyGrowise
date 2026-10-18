# Contact en bestaande berichten

**Stand: 18 oktober 2026.** Het publieke contactformulier is omgezet naar eenvoudige e-mailafhandeling volgens het [websiteherstelplan](WEBSITE-HERSTELPLAN.md). Zie [uitvoering en tests](WEBSITE-HERSTEL-RUNBOOK.md). De eerdere gespreksroute is geen vereiste meer voor nieuwe contactvragen. Het [oorspronkelijke ontwerp](archive/CONTACT-BERICHTENPLAN-2026-09-25.md) blijft archief.

## Nieuwe publieke contactvragen

`/contact` werkt voor gasten en accountgebruikers. De bezoeker kiest Bestelling, Module, Afspraak of Profiel en vult een e-mailadres en praktische vraag in; naam is optioneel. `POST /api/contact` controleert origin, invoer, honeypot, submission key en gedeelde begrenzing per IP/adres. Er wordt één duurzame taak in `website_mail_jobs` bewaard. Pas daarna verschijnt de ontvangstmelding.

De worker verstuurt de praktische vraag naar `info@mygrowise.be`, vanuit de vaste domeinafzender. Het gevalideerde bezoekersadres is Reply-To. Het team kan vanuit de mailbox antwoorden. Er wordt geen nieuwe supportconversatie of beveiligde gesprekslink aangemaakt vanuit dit formulier. Gevoelige dossierinhoud en rapporten horen in de private leverroute, niet in deze mail.

Een tijdelijke verzendfout laat de taak klaarstaan voor retry met backoff. Er zijn maximaal zes pogingen en een lease tegen gelijktijdige verwerking. De directe verzendpoging en de dagelijkse geconsolideerde worker verwerken deze taken; bevoegd beheer kan via `/admin/mail` expliciet opnieuw proberen. Als mail niet geconfigureerd/geverifieerd is, toont het formulier een rechtstreekse mailuitwijkroute. Het systeem belooft geen aflevering voordat een taak is opgeslagen.

## Bestaande gesprekken

Bestaande supportgesprekken, gasttokens en -sessies, teamantwoorden, interne notities en hun mailtaken blijven behouden. De accountondersteuning en bestaande gastlinks zijn niet verwijderd. Het [support-runbook](SUPPORT-BERICHTEN-RUNBOOK.md) beschrijft die oudere stroom; verwijzingen daarin naar het publieke contactformulier zijn historisch. De bestaande SQL-retentie van supportgesprekken blijft gelden. Nieuwe verzendtaken hebben hun eigen opslag en verwijdering; zie de privacytekst en het uitvoeringsrunbook.

## Gecontroleerd en nog extern te bewijzen

Gast en account zijn via het echte endpoint getest met dezelfde submission key: één mailtaak, geen extra supportgesprek, vaste ontvanger en correct Reply-To. MIME is lokaal opgevangen; er zijn geen echte mails verzonden. De bestaande SMTP-configuratie is aanwezig en als geverifieerd ingesteld. Werkelijke inbox-/spamaflevering, DNS, bounceverwerking en de gedeployde cron zijn in deze bouwstap niet bewezen. De bestaande supportretentie en een intern protocol voor onverwacht ontvangen gevoelige inhoud blijven operationele aandachtspunten.
