# Vereenvoudigde aankoopflow Fien — 18 november 2026

## Gedrag

De klant bestelt het ebook, ontvangt overschrijvingsgegevens en betaalt zelf via de bank. Virginie controleert de ontvangst binnen **1 werkdag**, zoals door Kevin bevestigd. Pas na haar handmatige bevestiging komt het volledige boek beschikbaar. De betaalmail bevat een persoonlijke knop **Open mijn boek** in plaats van een over te typen activatiecode.

De toegangslink is eenmalig, 30 minuten geldig en wordt expliciet met een knop ingewisseld. Een mailscanner die alleen de link opent verbruikt hem niet. De sessie duurt zeven dagen. Daarna, of op een ander apparaat, kan de koper met het besteladres een nieuwe link aanvragen. De aankoop blijft behouden.

## Harde betaalvoorwaarde

Alle routes voor het volledige boek gebruiken dezelfde voorwaarden, ook bij oude boeksessies:

- Een geverifieerde aankoopidentiteit of geldige, beperkte boeksessie.
- Een actief aankooprecht voor dit specifieke boek.
- De bijbehorende bestelling is `paid` of `fulfilled` en heeft provider `wise_manual`.
- `payment_verified_at` is vastgelegd door de handmatige betaalbevestiging.

Een bestelling aanmaken, een e-mailadres bevestigen of alleen de status `paid` hebben is dus onvoldoende. Het verwijderen van de extra codevoorwaarde verwijdert geen betaalvoorwaarde. Terugbetaalde, geannuleerde en ingetrokken rechten krijgen geen nieuwe reader- of downloadlinks.

In het beheer gaat **Controleer betaling** eerst naar de bestelling. Virginie controleert daar het getoonde bedrag en de mededeling, vinkt de ontvangst aan en bevestigt vervolgens. De API controleert ook zelf de beheerbevoegdheid en de expliciete ontvangstbevestiging. De bestaande betaal-RPC, transactie, auditregistratie en idempotentie blijven behouden.

## Herstel en betrouwbaarheid

- De losse boekcheckout vraagt alleen e-mail en naam, behoudt afzonderlijke toestemmingen en verwijst terug naar Fien.
- Fouten worden bij ingeschakeld JavaScript in het formulier getoond, met behoud van invoer en de submission-key. Dubbele submits worden tijdens verwerking geblokkeerd; een onzekere netwerkuitkomst kan veilig met dezelfde aanvraag worden herhaald.
- De bestelresponse wacht niet op SMTP. De bestelling en mailjob zijn vóór het starten van de achtergrondverzending opgeslagen.
- Een nieuw aangevraagde aankooplink claimt zijn eigen verse mailjob met een voorwaardelijke update. Hij hoeft niet achter een oude wachtrij te wachten. De bestaande worker en diens leases blijven de fallback bij een fout.
- Bij een verlopen token blijft de gecontroleerde bestemming naar boek of betaalgegevens behouden.
- De boekomgeving heeft afzonderlijke uitleg voor wachten op betaalbevestiging, terugbetaling en annulering.
- Oude activatiecodes blijven werken. Hun beperkte boeksessie geeft geen brede toegang tot Mijn aankopen of persoonlijke rapporten; de navigatie houdt daar rekening mee.
- Het bestelbeheer toont betaling en verzending afzonderlijk. Een verzendfout draait de betaalbevestiging niet terug; een klant kan ook een nieuwe link aanvragen.
- De voorwaarden zijn inhoudelijk gelijkgetrokken met de nieuwe leveringsroute en hebben versie `2026-11-18.4`. Eerdere bestellingen behouden hun opgeslagen voorwaarden.

## Verificatie

- `npm run check`: typecheck en productiebuild geslaagd.
- `npm test`: **230 tests geslaagd**, geen mislukkingen of skips.
- Nieuwe gerichte tests: geen toegang vóór handmatige bevestiging, geen toegang door een losse paid-status, geverifieerde eigenaar zonder activatielicentie, oude boeksessie, andere eigenaar, PDF/EPUB, refund/annulering/intrekking, verlopen sessies en tokens, veilige terugkeerbestemming, beheerrechten en ontvangstcheckbox, nieuwe gerichte mailclaim en JSON-formulierfouten.
- De opslagworker is getest tegen ongetekende, verlopen en gewijzigde URL's; die raken de bucket niet.
- `tests/ebook-purchase-isolated-db.mjs` uitgevoerd met PGlite, volledig in geheugen. De test gebruikt de bestaande productie-SQL voor handmatige betaalbevestiging, rechtenaanmaak, audit/idempotentie, e-mailtokens en oude code-inwisseling. Geen productiedata gewijzigd.
- De nieuwe geneste autorisatiequery is bovendien met een alleen-lezen schema-aanvraag tegen de gekoppelde backend gecontroleerd, gericht op een niet-bestaande product-ID. Geen klantgegevens opgevraagd.
- Checkout en boektoegang bekeken in Chrome, inclusief geëmuleerde telefoonbreedtes van 375 en 440 pixels. De synthetische tokenlink toont de expliciete openingsknop en verwijdert het token uit de adresbalk. Geen fysieke telefoon/bankapp of volledige schermlezertest uitgevoerd.
- Impeccable-detector: uitsluitend advisories, hoofdzakelijk tegen het alleen voor Startpunt geldende DESIGN.md. Geen niet-adviserende meldingen.
- `npm run check:artifact` en `git diff --check`: geslaagd.

## Grenzen en uitrol

Geen echte bestelling, betaalbevestiging, geldtransfer of e-mail tijdens de verificatie uitgevoerd. De volledige live transactie met echte mail en bestanden is niet herhaald. Een aanvullende live HEAD-controle van de downloadopslag kon niet draaien omdat `EBOOK_R2_DOWNLOAD_ORIGIN` niet in de lokale omgeving staat; de workerbeveiliging is lokaal getest. De bestaande productieconfiguratie is niet aangepast.

De dagelijkse cron blijft behouden; automatische foutafhandeling heeft dus geen gegarandeerde retry elke paar minuten. Verse toegangsaanvragen worden wel direct behandeld, en beheer toont wanneer mailopvolging nodig is. Er is geen extra scheduler, abonnement of GitHub Actions toegevoegd.

Een al uitgegeven ondertekende bestandslink blijft bruikbaar tot zijn korte vervaltijd; een al gedownload bestand kan niet worden teruggehaald. Nieuwe toegang wordt opnieuw gecontroleerd.

Geen databasewijziging of migratie nodig voor deze flow. De wijzigingen zijn lokaal uitgewerkt en niet door deze taak gepubliceerd. Andere gelijktijdige wijzigingen aan de interactieve reader zijn niet onderdeel van deze aankoopflowaanpassing.
