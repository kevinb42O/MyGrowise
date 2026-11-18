# Audit aankoopflow ebook Fien — 18 november 2026

## Oordeel en reikwijdte

De flow is functioneel zorgvuldig opgebouwd, maar vraagt voor een ebook van €14,95 onnodig veel handelingen. Vooral de combinatie van overschrijving, handmatige betaalcontrole, eenmalige activatiecode en een afzonderlijke aankooptoegang veroorzaakt frictie. Vereenvoudigen kan zonder de controles op betaling en eigendom te verminderen.

Geen applicatiecode gewijzigd, geen echte bestelling geplaatst, geen geld overgemaakt en geen mails verstuurd. Bestaande wijzigingen in de werkmap zijn ongemoeid gelaten.

De publieke productpagina is via Chrome uitgelezen; de live checkout is daarnaast via HTTP gecontroleerd. De browser gaf na navigatie geen bruikbare paginaweergave/AX-inhoud meer terug. Daardoor zijn geen claims gedaan over visuele kwaliteit, actuele mobiele weergave, schermlezerbediening of contrast. De volledige achterliggende keten is in de code en migraties nagegaan, inclusief mail, betaalbevestiging, activering, herstel, reader en downloads. Geen volledige live aankoop of nieuwe database-integratietest uitgevoerd.

## Huidige route

1. Productpagina: €14,95, interactieve editie, PDF en EPUB; overschrijving wordt vermeld.
2. Checkout: e-mailadres, voornaam, achternaam, akkoord voorwaarden en afzonderlijke toestemming digitale levering. Bij alleen het boek worden geen geboortedatum of geslacht gevraagd.
3. Bestelling wordt aangemaakt; betaalgegevens verschijnen. Bestelmail verwijst via een aankooplink naar de betaalgegevens.
4. Klant neemt ontvanger, IBAN, bedrag en mededeling over in de bankapp; SEPA QR is beschikbaar als alternatief.
5. Een bevoegde beheerder bevestigt de ontvangen overschrijving handmatig.
6. Betaalmail bevat een activatiecode en een knop naar een leeg activatieformulier.
7. Klant kopieert de code en activeert het boek. Dat maakt een aparte boeksessie aan.
8. Boekomgeving biedt interactieve reader, PDF lezen, PDF downloaden en EPUB downloaden.
9. Op een ander apparaat of na sessieverloop: aankooplink per e-mail aanvragen, mail openen, op bevestigingspagina nogmaals klikken, boek weer openen. Voor een nog niet geactiveerd boek blijft de code nodig.

## Bevindingen

### P1 — Activering voegt een overbodige handmatige stap toe

Bronnen: `src/lib/catalog/mail.ts:23–27`, `src/pages/boeken/activeren.astro`, `src/lib/ebooks/server.ts:42–47`.

Zelfs een via e-mail geverifieerde eigenaar met een betaalde aankoop mag het boek pas lezen als ook `activated_at` is gezet. De betaalmail linkt naar `/boeken/activeren`, zonder de code mee te nemen. Kopiëren of typen is verplicht; de code bevat FIEN plus twintig tekens.

De code is geen onafhankelijke tweede factor: hij komt via dezelfde mailbox. De aparte boeksessie heeft wel een nuttige beperkte bevoegdheid. Vervang de handmatige activering door een veilige eenmalige link naar precies dit boek, of gebruik de bestaande geverifieerde aankooptoegang en leid rechtstreeks naar het boek. Behoud de servercontrole op betaalstatus en actief recht. Een boektoken mag geen toegang tot andere aankopen of persoonlijke rapporten geven.

### P1 — Succesvolle activering geeft geen toegang tot ‘Mijn aankopen’

Bronnen: `src/pages/api/boeken/activeren.ts`, `src/lib/ebooks/server.ts:58–72`, `src/lib/commerce/purchases.ts:31–39`, `src/pages/aankopen/index.astro`, `src/pages/aankopen/boeken/[slug].astro`.

Activering zet `mg_ebook`. ‘Mijn aankopen’ verwacht `mg_purchase` of een bevestigd klantaccount. Een nieuwe koper die alleen de code heeft geactiveerd kan dus vanuit de boekomgeving op ‘Mijn aankopen’ klikken en opnieuw om toegang worden gevraagd. Dit is expliciet terug te zien in de bestaande ebook-HTTP-test; die test is tijdens deze audit niet uitgevoerd.

Maak navigatie passend bij de bevoegdheid: een boeksessie moet een bruikbare boekroute houden. Geef een boektoken niet zomaar brede aankooptoegang; daar kunnen gevoelige rapporten tussen zitten.

### P1 — Fallback voor mails is te traag voor aankooptoegang

Bronnen: `src/lib/catalog/mail.ts:43–45`, `src/lib/commerce/websiteMail.ts`, `src/lib/mailWorker.ts`, `vercel.json`.

Verzending wordt direct geprobeerd en fouten worden in een wachtrij bewaard. De geplande fallback draait echter eenmaal per dag om 08:00 UTC. De dagelijkse worker vraagt per relevante wachtrij een batch van twee jobs op. Eén mislukte verzending kan daardoor tot de volgende dagelijkse run blijven wachten; bij achterstand kan dit langer duren. De minutenlange backoff in de job leidt op zichzelf niet tot een nieuwe uitvoering op dat tijdstip.

Behandel ‘betaling bevestigd’ en ‘toegangsmail verzonden’ als afzonderlijke operationele statussen. Bied veilige, begrensde herpogingen bij relevante klantacties, zichtbare mislukte levering in beheer en een gerichte handmatige herverzendactie. Behoud Vercel Hobby en de bestaande integratie; geen betaalde scheduler of GitHub Actions nodig voor deze verbeteringen. Een nieuwe gegarandeerde automatische retryfrequentie vraagt apart ontwerp binnen die randvoorwaarden.

### P1 — Wachttijd na overschrijving blijft onbepaald

Bronnen: `src/pages/bestellen.astro:38–42`, `src/pages/boeken/[slug].astro`, `src/pages/api/admin/wise-reconciliation/[id].ts`.

De klant hoort dat controle handmatig gebeurt, maar krijgt geen concrete verwachte verwerkingstijd. Er is geen automatische betaalbevestiging in deze route. De oude payment-statusroute en Mollie-webhook zijn niet actief en worden hier ook niet gebruikt.

Toon vóór bestellen en op het wachtsscherm een door de eigenaar bevestigde verwerkingstermijn. Maak de fases zichtbaar: bestelling ontvangen → wachten op betaling → betaling bevestigd → boek beschikbaar. Een lokale terugkeer of refresh mag nooit op zichzelf gelden als betalingsbewijs. Volledig automatische online betaling is een afzonderlijke integratiekeuze; hiervoor is geen leverancier of prijsmodel onderzocht.

### P2 — Serverfouten verlaten het formulier; melding is soms onjuist

Bron: `src/pages/api/checkout/catalog-order.ts:25–45`.

Validatie- en limietfouten leveren kale tekstpagina’s op. De algemene melding voor ongeldige contactgegevens noemt ook geboortedatum en geslacht, terwijl deze velden bij het ebook niet worden gevraagd. Iedere niet specifiek herkende databasefout wordt als een gewijzigde prijs/beschikbaarheid behandeld. Dat kan een storing voorstellen als een productwijziging.

Geef fouten in het bestelscherm weer met behoud van invoer en een duidelijke herstelactie. Onderscheid ongeldige invoer, verlopen offerte, tijdelijk technisch probleem en reeds ingediende bestelling. Vermeld alleen de velden die op deze checkout staan.

### P2 — Een verlopen aankooplink verliest zijn bestemming

Bron: `src/pages/api/aankopen/toegang.ts`, met name de foutredirect.

Bij een mislukte tokeninwisseling gaat de klant naar `/aankopen/toegang?error=expired`, zonder de oorspronkelijke `next`. De nieuwe aanvraag leidt standaard naar het algemene overzicht in plaats van terug naar boek of betaalgegevens.

Behoud de door `purchaseNext` gecontroleerde bestemming tijdens de volledige herstelroute. De extra bevestigingsklik op een geldige link is wel verdedigbaar: een expliciete POST voorkomt dat alleen het openen door een mailscanner de link verbruikt.

### P2 — De checkout spreekt te veel de taal van het brede platform

Bronnen: `src/pages/bestellen.astro`, `src/pages/aankopen/toegang.astro`, `src/pages/boeken/activeren.astro`.

De koper ziet herhaaldelijk accountkeuzes, algemene aankopen, werkboeken/audio/resultaten en een toestemmingstekst die meerdere productsoorten noemt. ‘Bestellen en betalen’ leidt naar instructies voor een latere overschrijving. De teruglink gaat naar `/samenstellen` in plaats van de boekpagina. Dat zijn onnodige zijpaden voor één boek.

Gebruik een boekgerichte variant: ‘Je e-book bestellen’, ‘Bestelling plaatsen · €14,95’ met duidelijke tekst ‘Je betaalt daarna via overschrijving’, terug naar Fien en hersteltekst ‘Open je boek opnieuw’. Behoud afzonderlijke registratie van voorwaarden en toestemming; eventuele verkorting van juridische teksten vraagt inhoudelijke validatie.

### P2 — Een sessie van zeven dagen wordt niet concreet uitgelegd

Bronnen: `src/lib/commerce/purchases.ts:13`, `supabase/migrations/20261109130000_ebook_purchase_access.sql:47`, `src/pages/boeken/activeren.astro`.

De boeksessie duurt zeven dagen; de interface zegt vooral dat het boek op hetzelfde apparaat beschikbaar blijft. Daarna kan dezelfde activatiecode nooit meer worden gebruikt. De aankoop blijft bestaan, maar de koper moet wisselen naar de e-maillinkroute.

Communiceer dat de aankoop behouden blijft en bied altijd één herkenbare herstelactie. Overweeg een langere boekgebonden sessie op vertrouwde apparaten, los van toegang tot gevoelige rapporten. Bewaar de mogelijkheid om nieuwe toegang in te trekken bij terugbetaling.

## Wat behouden moet blijven

- Geen verplicht account; alleen relevante contactvelden bij een losse boekaankoop.
- Prijs/offerte wordt servermatig opnieuw gecontroleerd; dezelfde submission heeft idempotent gedrag.
- Betaling en actieve entitlement worden gecontroleerd bij readerpagina’s en downloads.
- Boektabellen hebben RLS en expliciet ingetrokken directe clientrechten in de migratie.
- Geheimen en sessies worden als hashes opgeslagen; boeksleutel wordt via HMAC afgeleid.
- Eenmalige code wordt atomair geactiveerd; gelijktijdige inwisseling wordt in SQL afgevangen.
- HttpOnly/SameSite-cookies, origincontroles, rate limits, no-store en no-referrer zijn aanwezig.
- Downloads gebruiken kort geldige ondertekende URL’s: 60 seconden voor downloaden; R2-openlinks 300 seconden.
- Een terugbetaling blokkeert nieuwe autorisatie. Reeds gedownloade bestanden kunnen niet worden teruggehaald; reeds uitgegeven links blijven tot hun korte vervaltijd bruikbaar.
- Neutrale antwoorden bij toegang aanvragen beperken uitlekken of een e-mailadres aankopen heeft.
- Betaalgegevens hebben kopieerknoppen en een SEPA QR-alternatief; ontvangersnaam wordt toegelicht.

Dit is een beoordeling van de bekeken implementatie, geen bewijs dat de productieconfiguratie of externe opslag integraal is gepentest.

## Gewenste eenvoudige flow

Productpagina → korte checkout → overschrijvingsgegevens en concrete wachttijd → handmatige bevestiging → e-mail ‘Je boek staat klaar’ → persoonlijke link → expliciete knop ‘Open mijn boek’ → boekomgeving.

Geen over te typen activatiecode. Voor later gebruik één route: ‘Boek al gekocht? Open opnieuw via e-mail’. Een ingelogde, geverifieerde eigenaar van een betaalde aankoop hoeft geen extra code te gebruiken. Behoud boekgebonden bevoegdheden waar bredere aankooptoegang persoonlijke gegevens zou ontsluiten.

## Verificatie en technische auditdekking

Lokaal uitgevoerd: `node --experimental-strip-types --test tests/release.test.mjs tests/transactional-email.test.mjs tests/auth-recovery.test.mjs`. Resultaat: **15 tests geslaagd, 0 mislukt**. Dit verifieert onder meer verkoopgate, aparte digitale toestemming, mailopbouw/escaping, capturemodus en herstelbestemmingen van accountwachtwoorden. Het is geen volledige ebook-integratietest.

`impeccable detect` uitgevoerd op checkout, activering en boekomgeving. Alleen advisories over fonts, kleuren en radii tegenover DESIGN.md. Dat document geldt expliciet voor `/startpunt`; deze signalen zijn daarom geen bevestigde defects van deze aankoopflow.

Voor de vijf technische auditdimensies geldt: toegankelijkheid gedeeltelijk op broncode gecontroleerd (labels, statusrollen en foutafhandeling); performance gedeeltelijk op broncode (onder meer herhaalde autorisatiequeries); theming geen algemeen toepasselijk referentiekader; responsive alleen CSS beoordeeld; implementatie-integriteit wel op de hele flow nagegaan. Geen betrouwbare numerieke score of totaal op twintig toegekend zonder werkende render-, mobiele, contrast- en bedieningstests.

Voor volledige acceptatie na verbetering: gast en account; betalen bevestigd/niet bevestigd; geldige/verbruikte/verlopen link; mailscanner; tweede apparaat; sessieverloop; verkeerde code; mailstoring; dubbele submit; gewijzigde prijs; terugbetaling; PDF/EPUB-bestandsinhoud; mobiele bankapp en toetsenbord/schermlezer. De bestaande `tests/ebook-http.mjs` muteert de geconfigureerde database en zet synthetische betaalstatussen; die is hier bewust niet uitgevoerd.

## Aanpak in volgorde

1. `$impeccable harden`: toegang, sessies, bestemming bij herstel en mailfouten consistent maken; serverautorisatie behouden.
2. `$impeccable distill`: handmatige code uit het standaardpad halen en boekgericht bestelpad vereenvoudigen.
3. `$impeccable clarify`: concrete levertijd, fases, knopteksten en productgerichte foutmeldingen.
4. `$impeccable adapt`: mobiele aankoop en wisselen naar bankapp/mail op werkelijke render controleren.
5. `$impeccable polish`: afronden na volledige geïsoleerde acceptatietest en visuele controle.
