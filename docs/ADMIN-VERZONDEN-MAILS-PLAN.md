# Verzonden e-mails zichtbaar in superadmin

Datum: 18 november 2026. Status: geïmplementeerd, lokaal gecontroleerd en uitgerold via de bestaande Vercel-integratie; databasemigratie toegepast.

## Doel

In `/admin/mail` kan de superadmin naast geplande, lopende en mislukte taken ook succesvol verzonden e-mails bekijken. Het overzicht bevat aantallen per wachtrij en een gepagineerde verzendhistoriek met verzenddatum.

Gebruik het label **Verzonden**. Leg kort uit dat dit een geslaagde overdracht aan de mailserver betekent; de huidige code registreert geen bevestigde ontvangst in de inbox of leesbevestiging.

## Vaststellingen vóór uitvoering

- `src/pages/admin/mail.astro` en `src/components/admin/AdminMailSummary.astro` tonen alleen `pending`, `sending` en `failed`.
- `src/lib/adminMail.ts` accepteert alleen die drie filters en selecteert geen `sent_at`.
- De vier bestaande wachtrijen bewaren al `status = sent` en `sent_at`: support, bestellingen/afnames, afspraken en contact/aankooplinks.
- Bij bestellingen markeert `src/lib/catalog/mail.ts` een overgeslagen levering ook als `sent`, met `last_error = delivery_access_inactive`.
- Bij website-aankooplinks markeert `src/lib/commerce/websiteMail.ts` ook aanvragen zonder bekende koper als `sent`, zonder vast te leggen dat geen mail werd verstuurd. Historische aankooplinktaken zijn daardoor niet betrouwbaar als succesvol verzonden te classificeren.
- Website-mailtaken worden momenteel verwijderd zodra ze `sent` zijn en hun aanmaakdatum ouder is dan 365 dagen. Reeds verwijderde historiek kan niet uit deze tabel worden hersteld.
- De pagina en het bijbehorende herstelendpoint vallen onder de bestaande bevoegdheid `integrations.manage`.

## Implementatievolgorde

### 1. Succesvolle verzending correct afbakenen

Definieer centraal welke taken meetellen als verzonden, en hergebruik exact dezelfde selectie voor telling en lijst:

- Support en afspraken: `status = sent`, met geregistreerde verzenddatum.
- Bestellingen/afnames: dezelfde selectie, met uitsluiting van `delivery_access_inactive`; houd rekening met `last_error IS NULL` in de filterlogica.
- Contact/aankooplinks: voeg via een kleine migratie een nullable `delivery_outcome` toe aan `website_mail_jobs`, met toegestane waarden `sent` en `skipped`. De worker registreert de uitkomst expliciet, verhoogt de verzendteller alleen na daadwerkelijke verzending en vult bij nieuwe overgeslagen taken geen `sent_at` in. Bestaande wachtrijstatussen kunnen behouden blijven om claim- en retrygedrag te bewaren.
- Historische website-contacttaken met `status = sent` en `sent_at` kunnen als verzonden worden gemarkeerd: die code verstuurt altijd vóór de statuswijziging. Historische aankooplinktaken blijven onbekend; de huidige kopergegevens bewijzen niet of destijds een mail werd verstuurd.
- Toon overgeslagen en historisch onzekere afgeronde taken in een afzonderlijk filter **Overgeslagen of onbevestigd**, met een begrijpelijke toelichting. Ze tellen niet mee bij **Verzonden**. Dezelfde selectie moet ook overgeslagen commerce-taken bereikbaar houden.

Dit is een beperkte aanpassing van verzendregistratie; geen nieuwe maildienst of scheduler. Behoud bestaande beveiliging via leases en beperk migratie-updates tot aantoonbaar classificeerbare historische gegevens.

### 2. Overzicht en filters uitbreiden

- Voeg **Verzonden** toe aan de samenvatting voor elk van de vier wachtrijen. Klikken opent direct de overeenkomstige historiek.
- Voeg **Verzonden** en het afzonderlijke filter voor overgeslagen/onbevestigde taken toe aan de statuskeuze.
- Centraliseer statusdefinities en labels zodat pagina, tellingen en links dezelfde indeling gebruiken; vervang kwetsbare indexafhankelijkheden zoals `states[2]` door benoemde statussen.
- Behoud standaard **Mislukt**, zodat taken die aandacht vragen direct zichtbaar blijven.
- Behoud wachtrij en status tijdens paginering; gebruik de bestaande paginagrootte van 25.

### 3. Verzendhistoriek begrijpelijk tonen

- Toon taakreferentie, aanmaakdatum, aantal pogingen en **Verzonden op** in Belgische tijd (`Europe/Brussels`).
- Sorteer verzonden taken op `sent_at` aflopend, met `id` als vaste tweede sortering: recentste verzending eerst.
- Toon bij verzonden taken geen volgende poging, foutdiagnose of herstelknop. Toon bij overige statussen informatie die bij die toestand past.
- Geef een gerichte lege toestand: “Geen verzonden e-mails in deze wachtrij”.
- Vermeld dat de historiek de nog bewaarde taken omvat en dat oudere website-mailtaken worden opgeruimd. Pas de bestaande bewaartermijn in deze opdracht niet aan.
- Toon operationele gegevens, inclusief cliëntnaam en bestemmingsadres. Mailinhoud en persoonlijke toegangslinks blijven buiten het overzicht. Dit is aangevuld op expliciet verzoek van Kevin; zie [ontvangers](ADMIN-MAIL-ONTVANGERS-2026-11-18.md).

### 4. Lokaal controleren

- Breid de bestaande mailtests uit met geslaagde verzendingen in alle vier wachtrijen, uitsluiting van overgeslagen taken en eerlijke behandeling van historische aankooplinktaken.
- Test website-mailregistratie voor bekende en onbekende kopers, inclusief uitkomst, verzendteller en verzenddatum.
- Controleer dat aantallen en lijst exact dezelfde selectie gebruiken, ook bij een lege lijst en meerdere pagina's.
- Test sortering op verzenddatum, behoud van filters bij paginering en ongeldige statusparameters.
- Behoud regressiedekking voor handmatig herstel: alleen mislukte taken kunnen opnieuw worden klaargezet.
- Werk de mailfixtures in `tests/admin-audit-browser.mjs` bij en controleer samenvatting, mobiele tabel en toetsenbordbediening.
- Voer relevante lokale tests, `npm run typecheck` en `npm run build` uit. GitHub Actions niet gebruiken.

## Acceptatiecriteria

1. De superadmin kan voor elke bestaande wachtrij via een klik het aantal en de lijst met verzonden mails openen.
2. Elke mail in **Verzonden** heeft een geregistreerde succesvolle verzendpoging en een zichtbare verzenddatum; bekende overslagen en onzekere historische aankooplinktaken ontbreken uit deze telling.
3. Recent verzonden mails staan bovenaan; ook meer dan 25 resultaten blijven bereikbaar.
4. Geplande en mislukte taken blijven werken zoals voorheen; verzonden en overgeslagen taken krijgen geen retryactie.
5. Succesvolle verzendingen veroorzaken geen melding dat opvolging nodig is.
6. De interface verduidelijkt de betekenis van “Verzonden”, de beperkte historische beschikbaarheid en de afzonderlijke onzekere taken.

## Scope en uitrol

De uitbreiding komt op de bestaande mailopvolgingspagina binnen `/admin`; een extra dashboardwidget is niet nodig voor deze opdracht. Supabase Auth-mails blijven buiten dit overzicht, omdat ze niet via deze vier wachtrijen lopen.

Bij uitvoering: eerst de additieve databasemigratie toepassen, vervolgens de applicatie uitrollen via de bestaande Vercel-integratie binnen Free/Hobby. Controleer daarna met een gecontroleerde testverzending de telling, historiek en tijdweergave. De migratie is op 18 november toegepast; de applicatie-uitrol en nacontrole zijn hieronder vastgelegd.


## Uitvoering en bewijs op 18 november 2026

- Centrale statusdefinities en gedeelde queryselectie voor tellingen en historiek ingevoerd in `src/lib/adminMail.ts`.
- Samenvatting uitgebreid met **Verzonden** en **Overgeslagen of onbevestigd**; de lijstcomponent `AdminMailTasks.astro` toont statusafhankelijke kolommen, Belgische tijd en gepagineerde historiek.
- Website-worker registreert daadwerkelijke verzending versus overslaan; onbekende kopers verhogen de verzendteller niet meer.
- Migratie `20261118130000_website_mail_delivery_outcome.sql` eerst binnen een transactie gerepeteerd en teruggedraaid, daarna toegepast en geregistreerd. Alle zeven bestaande website-taken behouden: vier aantoonbare contactverzendingen en drie historisch onzekere aankooplinktaken.
- Alle 191 lokale tests geslaagd, inclusief zes nieuwe tests voor historiek, tellingen, paginering en worker-uitkomsten. Bestaande herstel- en autorisatietests blijven groen.
- TypeScript, productiebuild en artifactcontrole geslaagd. Browsercontrole met synthetische gegevens op 1440px en 390px geslaagd, inclusief datumweergave, mobiele statuslabels, geen pagina-overloop, focusbare links en afwezigheid van retryacties bij verzonden mails. Screenshots lokaal onder `/tmp/mygrowise-admin-audit-fixes/mail-{desktop,mobile}.png` visueel beoordeeld.
- De echte Supabase/PostgREST-query's tegen de gemigreerde database gecontroleerd: tellingen en historiek stemmen overeen voor alle wachtrijen. Op dat moment: support 0 verzonden, commerce 8, afspraken 6, website 4; website 3 onbevestigd, afspraken 3 gepland.
- Geen nieuwe echte e-mail verstuurd tijdens de verificatie. De tests gebruiken gesimuleerd transport; succesvolle overdracht van een nieuwe productiemail en inboxontvangst zijn in deze ronde niet bewezen.
- Implementatiecommit `31bfa02` naar `origin/main` gepusht. De bestaande Vercel-integratie bevestigt **Deployment has completed**: [deployment](https://vercel.com/lanternnetworks-projects/mygrowise/3gU89opQn7kJVPCn4gj46UxMwsvR).
- Productie-HTTP-controle: zowel de nieuwe verzonden- als onbevestigd-filterlink wordt zonder sessie met 303 naar de adminlogin doorgestuurd, met behoud van de volledige vervolg-URL. De ingelogde productiepagina is niet opnieuw visueel beoordeeld; de visuele controles betreffen de echte componenten met synthetische gegevens lokaal.
