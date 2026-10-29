# Mobiel herstel — 29 oktober 2026

De twaalf bevindingen uit [de mobiele audit](MOBILE-AUDIT-2026-10-29.md) zijn in de implementatie aangepakt. De wijzigingen zijn lokaal uitgevoerd en geverifieerd, en worden op verzoek van Kevin gecommit en gepusht voor een test via de bestaande Vercel-integratie.

## Uitgevoerde wijzigingen

| Audit | Herstel |
| --- | --- |
| M01 | Homepage meet telkens een schone kandidaatlayout, inclusief het verwijderen van eerdere animatietransforms uit de meetelementen. CSS en JavaScript gebruiken dezelfde `100svh`-stagehoogte. Resize bewaart de voortgang bij gelijkblijvende modus en het gelezen hoofdstuk bij een modusovergang. |
| M02 | De mobiele weergavevoorkeur staat bovenaan de opening en scrollt mee; hij ligt niet langer vast boven andere knoppen. ‘Alle modules’ heeft zijn eigen vrije klikvlak. |
| M03 | Prijskaarten gebruiken op mobiel een begrensde gridtrack, afbreekbare titels en passende afmetingen; prijzen en CTA's blijven binnen beeld. |
| M04 | Alle mobiele cataloguskaarten breken lange productnamen af. De verbetering geldt ook na zoeken/filteren. |
| M05 | Het geopende menu maakt de achtergrond inert, bevat een focuslus en herstelt focus bij Escape/sluiten. De volledige header inclusief sluitknop vormt tijdens het openen één modal navigatieoppervlak. |
| M06 | Checkbox en toestemmingstekst hebben een eigen tweekoloms layout. De tekst staat in één wrapper en de checkbox heeft een expliciete maat. Dit geldt ook voor de digitale-leveringsvariant. |
| M07 | Mobiele tekstinvoer, selects en tekstvakken gebruiken 16 px, inclusief de specifiekere checkoutregels die anders de globale correctie overschreven. |
| M08 | Mobiele menulinks, filterchips, catalogusacties, modulekeuze en cookieknoppen hebben minimaal 44 px hoogte. De samenstellingsbalk houdt rekening met de safe area. |
| M09 | De desktopnavigatie start op 1100 px. Kleinere tablets houden het ruime menu; labels worden niet meer over vier regels gedwongen. |
| M10 | De mobiele teamsectie gebruikt compactere portret-/tekstkolommen. Statische modulebeelden en routeblokken nemen minder ruimte in. Themafilters zijn mobiel uitklapbaar. De keuzehulp heeft een directe startlink en een compactere introductie. |
| M11 | Het gekozen productoverzicht staat in de mobiele checkout vóór het formulier. De desktopzijbalk blijft op zijn bestaande plek. |
| M12 | Vier gebruikte grote beelden hebben mobiele WebP-varianten op 640 en 960 px. Desktop houdt de oorspronkelijke bestanden. De praktijkfoto heeft geen onnodige hoge laadprioriteit meer; latere inhoud gebruikt passende lazy loading. |

De eerder aanwezige aanpassingen aan de herkenningsfoto en -typografie zijn behouden. Tijdens het werk verschenen ook wijzigingen aan `Footer.astro` en `BusinessDetails.astro` buiten deze taak; die zijn niet teruggedraaid of door dit herstel herschreven.

## Verificatie

- **Bestaande tests:** `npm test`, 65 geslaagd, 0 gefaald.
- **TypeScript en productiebuild:** `npm run check` geslaagd.
- **Laatste artifact:** productiebuild opnieuw geslaagd na de laatste mobiele CSS-aanpassing. `npm run check:artifact` controleerde 1647 bestanden en slaagde.
- **Browsertest:** vijftien publieke routes op zowel 320 als 390 px. Geen horizontale pagina-overflow of buiten beeld lopende onderzochte koppen/bediening. Zichtbare tekstinvoer/selects op 16 px; checkout daarna apart opnieuw op 16 px gecontroleerd.
- **Homepage:** 320×568, 360×800, 375×667, 390×844, 393×852, 412×915, 430×932, 768×1024 en landscape 844×390. Kleine schermen krijgen de leesbare documentweergave; voldoende ruime schermen behouden de scrollervaring.
- **Resize-regressie:** bij 390 px breed en 844→845→846→847→848 px hoog blijft dezelfde enhanced modus actief. De pagina verandert alleen met de normale stagehoogte en springt niet meer tussen een statische en geanimeerde documentstructuur.
- **Modulebediening:** hit-testing in het midden van ‘Alle modules’ geeft de link terug. De klik opende daadwerkelijk `/modules`.
- **Menu:** elf opeenvolgende Tab-stappen bleven binnen de header/menu-oppervlakte. Escape sloot het menu en gaf focus terug aan de menuknop.
- **Catalogus:** zoeken op SPM op 320 px toont de volledige productnaam binnen de kaart. Themafilter Emoties & coping leverde vijf producten; wissen en toevoegen werkten. Doorgaan naar checkout toonde de geselecteerde vragenlijst en het juiste totaal.
- **Checkout:** getest op 320 en 390 px, zonder persoonsgegevens in te vullen of een bestelling te plaatsen. Samenvatting vóór het formulier; checkbox 20×20 px naast de zin, binnen een label met minimaal 44 px hoogte.
- **Touch:** gesynthetiseerde Chromium-touchscroll op 390×844; scrollpositie veranderde van 0 naar circa 602 px. Touch-emulatie daarna uitgeschakeld.
- **Reduced motion:** Chromium-emulatie van `prefers-reduced-motion: reduce` verwijderde de enhanced klassen. Geen inhoudslaag bleef inert of `aria-hidden`.
- **Desktop:** vergeleken met een tijdelijke kopie van de oorspronkelijke homepage. Op 1440×900 waren de geometrie van de hero en header en de hoogtes van scrollreis, team, verhaal en FAQ gelijk. Titel, kaartbeeld en tekstkolom van de desktopmodules hadden eveneens dezelfde afmetingen en posities. De tijdelijke vergelijkingsbestanden zijn verwijderd.
- **Broncontrole:** `git diff --check` geslaagd. De Impeccable-detector gaf alleen twee reeds bestaande vormgevingsmeldingen in `global.css` (accentrand/raster); die zijn geen nieuw mobiel defect en zijn behouden binnen de bestaande identiteit.

Ruwe eindmetingen staan in [verification.json](audits/mobile-2026-10-29/after/verification.json). De daarin opgeslagen algemene headerproef liep op de prijzenpagina; de documentbreedte op grotere desktopformaten bevat de bestaande desktopprijskaarten en is geen meting van header-overflow. De header zelf paste op de gecontroleerde breedtes.

## Beeldoptimalisatie

| Bestand | Oorspronkelijk | Mobiel 960 px |
| --- | ---: | ---: |
| Praktijkfoto | circa 552 KiB | circa 60 KiB |
| Verhaalbeeld | circa 840 KiB | circa 153 KiB |
| Inzichtlandschap | circa 504 KiB | circa 99 KiB |
| Openingslandschap | circa 336 KiB | circa 96 KiB |

De 640px-varianten zijn nog kleiner. Dit zijn bestandsgroottes; er is geen nieuwe Core Web Vitals-score of meting van echte mobiele CPU-prestaties uit afgeleid.

## Bewijsbeelden

- [Mobiele modulekaart met vrije navigatie](audits/mobile-2026-10-29/after/modules-390.png)
- [Prijskaart op 320 px](audits/mobile-2026-10-29/after/prijzen-320.png)
- [Mobiel checkoutoverzicht](audits/mobile-2026-10-29/after/checkout-390.png)
- [Desktopmodules — oorspronkelijke versie](audits/mobile-2026-10-29/after/desktop-modules-before.png)
- [Desktopmodules — aangepaste versie](audits/mobile-2026-10-29/after/desktop-modules-after.png)

## Nog niet fysiek geverifieerd

Safari op een echte iPhone, Android-apparaten, schermtoetsenborden, systeemtekstvergroting en ingelogde agenda-/afname-/moduleflows zijn niet integraal getest. Er zijn geen berichten verzonden, afspraken vastgelegd, accounts aangemaakt of bestellingen geplaatst. De lokale testselectie is gewist. De desktopcompositie is behouden; dit document claimt geen goedkeuring van elke private productflow of elk fysiek toestel.

Alle controles zijn lokaal uitgevoerd. Geen GitHub Actions of betaalde dienst toegevoegd; de bestaande Vercel Free/Hobby-randvoorwaarde blijft gelden.

## Nacorrectie: compacte iPhone-intro

De eerste herstelronde behield een te strenge ondergrens van 600 px beschikbare stagehoogte voor de opening. Daardoor werd op een compacte telefoon met uitgeklapte Safari-balken ook het hoofd uitgeschakeld. De opening mag nu op telefoonbreedtes vanaf 520 px beschikbare hoogte animeren. De bestaande drempel en fit-controles voor de latere scrollsecties blijven intact.

Een aparte `compact-opening`-compositie laat de tekst, acties en het portret na de zoom zonder overlap landen. Zij wordt bepaald door dezelfde gemeten kleine viewport als de scrolllogica, zodat Safari's grotere layoutviewport de compacte opmaak niet per ongeluk omzeilt. Desktop, aanbod, checkout en de overige mobiele componenten zijn voor deze nacorrectie niet gewijzigd.

Gecontroleerd op 375 px breed met viewporthoogtes 601, 620, 640, 664 en 724 px: telkens `hero-enhanced` en `portal-enhanced`, zonder de uitgebreide latere scenes in te schakelen. Geen horizontale overflow en een positieve afstand tussen tekst/acties en het portret. Een daadwerkelijke browserscroll veranderde de schaal van het hoofd van 1 naar circa 7,51. Dit is Chromium-emulatie; de fysieke iPhone-test gebeurt door Kevin.

Drie regressietests bewaken de compacte hoogtegevallen, de ongewijzigde desktopgrens en de reduced-motion/handmatige rustige weergave. Alle 68 tests slagen. Bewijs: [compacte intro](audits/mobile-2026-10-29/after/iphone-mini-intro.png) en [metingen](audits/mobile-2026-10-29/after/iphone-mini-checks.json).
