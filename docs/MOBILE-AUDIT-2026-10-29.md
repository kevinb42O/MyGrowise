# Mobiele audit en herstelplan — 29 oktober 2026

Status: historische audit op codebasis `1ed6130`. De beschreven punten zijn inmiddels lokaal aangepakt; zie [herstel en verificatie](MOBILE-HERSTEL-2026-10-29.md). De bevindingen en oorspronkelijke meetgegevens hieronder blijven bewaard als referentie.

Tijdens het afronden verschenen buiten deze audit wijzigingen in `src/scripts/homeExperience.js` en `src/styles/homeExperience.css` voor de mobiele herkenningssectie. Die zijn behouden. Een gerichte lokale hertest met die wijzigingen reproduceerde M01 nog steeds: bij 390 px breed en hoogtes 845→846→847→848 wisselde de pagina tussen statisch (12.694 px) en enhanced (16.180/16.210 px). Zie [latest-local-retest.json](audits/mobile-2026-10-29/latest-local-retest.json). Deze audit heeft zelf uitsluitend het rapport en bewijsbestanden toegevoegd.

## Uitkomst

De mobiele implementatie bevat **12 bevindingen: 5 P1 en 7 P2**. Geen P0 vastgesteld binnen de geteste publieke routes. De ernstigste oorzaak is een instabiele homepage-meetcyclus: een minimale wijziging van de viewporthoogte kan de volledige pagina tussen twee layouts laten wisselen. Daarnaast onderschept een vaste knop een andere link, lopen prijskaarten buiten beeld en worden enkele productnamen afgeknipt.

De bestaande visuele identiteit is coherent. Het probleem zit vooral in de technische vertaling naar kleine schermen: overlappende vaste bediening, veel afhankelijke animatieklassen, verschillende breakpoints en te kleine tekst/bediening. Desktop is de te behouden referentie.

## Bewijs en dekking

- Lokale website: `http://localhost:4321`. Publieke productiecontrole: `https://mygrowise.vercel.app`.
- Chromium in de bestaande Chrome-browser, met expliciete viewportemulatie. Dit is geen fysieke iPhone- of Androidtest.
- 23 publieke routes gecontroleerd op 320×568; 16 daarvan aanvullend op 390×844. Homepage apart onderzocht op 320, 360, 375, 390, 393, 412, 430, 768 en 844 px breed, met verschillende hoogtes; header ook op 860×800.
- Interacties: menu openen/sluiten en Tab-navigatie, homepage-intro overslaan en scrollen, catalogus zoeken en product toevoegen, combinatie-overzicht, checkout openen, drie keuzehulpvragen en resultaat.
- Eén aanraakscroll gesynthetiseerd met Chromium CDP, met touch-emulatie ingeschakeld; scrollpositie veranderde naar circa 699 px. Touch-emulatie daarna uitgeschakeld. Dit bewijst geen Safari-gedrag, performance op een echte telefoon of alle aanraakscenario's.
- Geen berichten verzonden, accounts aangemaakt, afspraken geboekt of bestellingen geplaatst. De toegevoegde testselectie is via de UI gewist.
- Belangrijkste homepage-resizefout, prijsoverflow en overlappende homepagebediening zijn ook op productie bevestigd.
- Ruwe geometrische metingen: [measurements.json](audits/mobile-2026-10-29/measurements.json). De brede homepage-matrix is verkennend: layoutmodus kan van voorafgaande meetcycli afhangen. De gerichte opeenvolgende resizeproeven hieronder zijn het reproduceerbare bewijs.

### Grenzen van de audit

Ingelogde klantomgeving, beheeromgeving, praktijkagenda, daadwerkelijke vragenlijstafname en betaalde module-inhoud zijn niet interactief getest. De boekingsdetailpagina toont zonder cliëntlogin alleen de aanmeldstap; de kalender achter die stap is dus niet goedgekeurd. Geen volledige screenreadertest, 200%-teksttest, fysieke schermtoetsenbordtest, netwerkthrottling, Core Web Vitals- of FPS-meting uitgevoerd. Deze onderdelen blijven expliciete acceptatiecontroles voor het herstel.

## Indicatieve technische score

Dit is een implementatiescore voor de onderzochte mobiele publieke website, geen Lighthouse-score of toegankelijkheidscertificering. Performance en theming zijn op broncode/assets beoordeeld, niet integraal geprofileerd.

| Dimensie | Score | Onderbouwing |
| --- | ---: | --- |
| Toegankelijkheid | 2/4 | Menu laat focus achter de overlay; kleine bediening en formuliertekst |
| Performance | 2/4 | Grote gedeelde desktopbeelden zonder passende mobiele varianten; werkelijke snelheid nog te meten |
| Theming | 3/4 | Herkenbare kleuren/tokens; daarnaast veel lokale vaste waarden en overrides |
| Responsive gedrag | 1/4 | Resize-instabiliteit, afgesneden kaarten en onderschepte link |
| Implementatie-integriteit | 2/4 | Coherente vormgeving, maar afhankelijke meetcycli en stapelende mobiele overrides |
| **Totaal** | **10/20** | **Aanzienlijk herstel nodig** |

De Impeccable-brondetector is lokaal uitgevoerd over stijlen, gedeelde Astro-componenten, prijzen en checkout. De zes meldingen gaan over accentranden, fontkeuze en een decoratief raster. Die bewijzen geen mobiele fout en zijn geen reden om de goedgekeurde desktopstijl te wijzigen. De concrete bevindingen hieronder komen uit rendering, geometrie, hit-testing, toetsenbordinteractie en broncodecontrole.

## P1 — eerst herstellen

### M01. Homepage wisselt bij minimale hoogtewijzigingen tussen twee complete layouts

- **Categorie:** responsive / implementatie-integriteit.
- **Locatie:** `src/scripts/homeExperience.js:96` (`measure`), vooral regels 101–123 en resize-handler op 371; `src/styles/homeExperience.css:23` en 2129 (`100svh`).
- **Bewijs lokaal:** bij opeenvolgende hoogtes 846, 847, 848 en 849 px, steeds 390 px breed, wisselde de rootklasse tussen `home-experience` en alle `*-enhanced`-klassen. Paginahoogtes waren achtereenvolgens 12.694, 16.195, 12.694 en 16.225 px.
- **Bewijs productie:** 390×844 → enhanced, 16.150 px hoog; 390×845 → statisch, 12.694 px; 390×846 → enhanced, 16.180 px.
- **Oorzaak:** `measure()` verandert klassen en beoordeelt de hoogte terwijl andere layoutklassen en vorige inline-stijlen nog invloed hebben. Een eerdere meting bepaalt daardoor de volgende uitkomst. In de enhanced eindtoestand werd bovendien 516 px scrollinhoud in een herkenningscontainer van 504 px gemeten. CSS gebruikt `100svh` voor de stage, JS `innerHeight` voor de scrollafstanden; op mobiele browsers kan dat twee verschillende geometrieën opleveren.
- **Impact:** grote verandering van documenthoogte en andere content op dezelfde scrollpositie. Mobiele browserbalken en oriëntatie zijn relevante triggers om fysiek te testen; het exacte Safari-effect is nog niet gemeten.
- **Fix:** maak de moduskeuze onafhankelijk van eerder toegepaste klassen/stijlen; kies één viewportmaat voor stage en scrollscore; houd de mobiele modus stabiel bij kleine hoogtewijzigingen; behoud het gelezen hoofdstuk bij echte oriëntatie-/breedtewissels.
- **Acceptatie:** meerdere meetcycli bij identieke afmetingen geven identieke klassen/geometrie. Een reeks 844→845→846→847 px veroorzaakt geen layoutwissel of sprong naar andere inhoud. Herhaal midden in herkenning en modules, met en zonder hash.
- **Aanpak:** `$impeccable adapt`, daarna `$impeccable harden`.

### M02. ‘Rustige weergave’ onderschept ‘Alle modules’

- **Categorie:** responsive / interactie.
- **Locatie:** `src/styles/homeExperience.css:2207` en 2298 (`.motion-toggle`), plus `.enhanced .all-modules` en `.module-nav`.
- **Bewijs productie op 430×932:** `Alle modules` bezet x≈300–400, y=878–922; de vaste weergaveknop x≈324–414, y=880–924. `elementFromPoint` in het midden van de modulelink geeft de weergaveknop terug.
- **Impact:** een normale tik in het midden van de modulelink verandert de scrollmodus in plaats van de modulepagina te openen. De labels zijn ook visueel over elkaar gedrukt.
- **Fix:** geef de mobiele weergavevoorkeur een eigen gereserveerde plaats, buiten module-acties. Controleer alle vaste elementen gezamenlijk, inclusief cookiemelding en safe area.
- **Acceptatie:** geen overlap van klikvlakken; hit-test op midden en randen van de link komt uit op die link. Werkt in beide weergavemodi en met cookiemelding open.
- **Bewijsbeeld:** [modules-overlap-430.png](audits/mobile-2026-10-29/modules-overlap-430.png).
- **Aanpak:** `$impeccable adapt`.

### M03. Prijskaarten en knoppen worden rechts afgesneden

- **Categorie:** responsive / reflow.
- **Locatie:** `src/pages/prijzen.astro`, lokale stijlregel voor `.pricing`, `article`, `h2` en de prijs/actie-rij.
- **Bewijs:** op 390 px is de documentinhoud lokaal circa 498 px en op productie circa 500 px breed; op 320 px circa 494 px. Kaarten, lange titels en CTA's steken rechts buiten het scherm.
- **Oorzaak:** de grid/flex-inhoud kan haar intrinsieke minimumbreedte behouden; lange productwoorden krijgen geen voldoende afbreekregel. `body { overflow-x:hidden }` lost dat niet op.
- **Impact:** prijzen vergelijken en ‘Bekijk profiel’ aantikken wordt onnodig moeilijk; delen van tekst en knoppen zijn onzichtbaar.
- **Fix:** mobiele gridtrack `minmax(0,1fr)`, passende `min-width:0` en woordafbreking, flexrijen laten herschikken, mobiele titelmaat en kaartpadding controleren.
- **Acceptatie:** documentbreedte ≤ viewportbreedte op 320–430 px; elke kaart, titel, prijs en volledige knop zichtbaar.
- **Bewijsbeeld:** [prijzen-390.png](audits/mobile-2026-10-29/prijzen-390.png).
- **Aanpak:** `$impeccable adapt`.

### M04. Lange vragenlijstnamen worden binnen hun kaart afgeknipt

- **Categorie:** responsive / inhoud.
- **Locatie:** `src/styles/catalog.css:1`, `.catalog-card { overflow:hidden }` en `.catalog-card h3`. De profielen hebben al specifiekere afbreekregels in `src/styles/profiles.css`; de overige cataloguskaarten missen die bescherming.
- **Bewijs op 320 px:** onder meer HiPIC, NEO-PI-3, SPM-2, BIP-6F-X en SDS. De linktekst van SPM-2 loopt tot circa x=368 terwijl de viewport slechts 320 px breed is. Het document zelf blijft 320 px breed doordat de kaart de tekst afknipt.
- **Impact:** een simpele controle op horizontale paginascroll mist deze fout; de bezoeker ziet een onvolledige productnaam.
- **Fix:** gebruik veilige woordafbreking voor alle catalogustitels en pas zo nodig titelmaat/padding mobiel aan. Controleer ook de lange themachips.
- **Acceptatie:** volledige namen zichtbaar op 320 en 360 px, ook na filteren; geen afkapping binnen kaarten.
- **Aanpak:** `$impeccable adapt`, `$impeccable typeset`.

### M05. Mobiel menu laat toetsenbordfocus achter de overlay verdwijnen

- **Categorie:** toegankelijkheid / navigatie.
- **Locatie:** `src/components/astro/Header.astro:51`–75.
- **Bewijs:** menu op 320 px geopend; na Tab door de menulinks bereikt focus de achtergrondlink ‘Vaste profielen’, terwijl `body.menu-open` nog actief is. De achtergrond wordt niet inert gemaakt; er is geen focusbegrenzing of volledig focusherstel.
- **Impact:** gebruikers met toetsenbord, switchbediening of ondersteunende technologie kunnen verborgen inhoud bedienen terwijl het scherm het menu toont.
- **Fix:** behandel dit schermvullende menu als een modal navigatieoppervlak: achtergrond inert, voorspelbare beginfocus en focuslus, Escape sluiten en focus terug op de menuknop. Ook sluiten bij een echte overgang naar desktop.
- **Acceptatie:** Tab/Shift+Tab blijft binnen het geopende menu plus de sluitbediening. Na sluiten staat focus op de menuknop. Geen verborgen achtergrondlinks in de bedieningsvolgorde.
- **Aanpak:** `$impeccable harden`.

## P2 — daarna herstellen

### M06. Voorwaardencheckbox in checkout staat los van de zin

- **Categorie:** formulierlayout / implementatie-integriteit.
- **Locatie:** `src/pages/bestellen.astro`, `.checkout-grid form>label` versus `.checkout-agreement`.
- **Bewijs op 390 px:** de agreement heeft `display:grid`; de checkbox heeft een gemeten box van circa 351×13 px, met het zichtbare vakje midden boven de tekst. ‘Ik ga akkoord met de’, ‘voorwaarden’ en de rest staan op afzonderlijke regels.
- **Oorzaak:** de specifiekere algemene labelregel overschrijft de bedoelde flex-layout van de agreement.
- **Impact:** de relatie tussen het vakje en de toestemmingstekst is visueel onduidelijk. Dit is een gedeelde CSS-fout, niet uitsluitend een mobiele fout.
- **Fix:** maak het agreement-label expliciet tweekoloms met een vast checkboxvlak en één tekstwrapper met inline voorwaardenlink. Leg de specificiteit eenduidig vast.
- **Acceptatie:** checkbox naast een samenhangende zin; volledige labeltekst klikbaar; geen uitgerekt checkboxvlak. Controleer ook de variant met digitale-leveringstoestemming.
- **Aanpak:** `$impeccable layout`, `$impeccable harden`.

### M07. Mobiele formuliervelden hebben erg kleine tekst

- **Categorie:** leesbaarheid / formulieren.
- **Locatie:** `src/styles/catalog.css`, `src/pages/contact.astro`, `src/pages/bestellen.astro`, `src/pages/account/aanmaken.astro`, `src/styles/account.css`.
- **Bewijs:** zoek-/filtervelden, contact en checkout circa 13,6 px; login 14,88 px; registratie 12,48 px. De invoer erft soms de kleine lettergrootte van het label.
- **Impact:** primaire taken worden uitgevoerd met tekst die merkbaar kleiner is dan de bodytekst. Gedrag met een echt iOS-toetsenbord en eventuele focuszoom is nog niet getest.
- **Fix:** expliciete mobiele invoertekst van 16 px, labels apart schalen; voorkom dat labeltypografie onbedoeld de invoer bepaalt. Controleer toetsenbordtype en autocomplete per veld.
- **Acceptatie:** zichtbare tekstinvoer/selects minimaal 16 px in de gekozen mobiele richtlijn; toetsenbord open laat label, veld, foutmelding en vervolgactie bruikbaar.
- **Aanpak:** `$impeccable typeset`, `$impeccable harden`.

### M08. Diverse mobiele bedieningsvlakken zijn te klein

- **Categorie:** touch / toegankelijkheid.
- **Locatie:** `Header.astro` (`.mobile-account`), `catalog.css` (`.catalog-chips`, `.catalog-action`), `homeExperience.css` (`.module-nav button`), `AnalyticsConsent.astro`.
- **Bewijs:** menulinks voor aankopen/modules/login circa 22 px hoog; catalogusfilterchips circa 35 px; modulekeuze 38 px hoog met 11 px tekst; cookietoestemmingsknoppen circa 37,6 px. De menuknop zelf is wel circa 46 px.
- **Impact:** de kleine links en compact geplaatste filters vragen nauwkeurig tikken. Minder dan 44 px is hier een ergonomische verbetergrens; het is niet automatisch een bewezen toegankelijkheidsnormschending, omdat ook onderlinge afstand en uitzonderingen meetellen.
- **Fix:** reserveer minimaal 44 px hoogte voor primaire mobiele bediening, zonder alle tekst groter te maken; vergroot het klikvlak en houd voldoende tussenruimte.
- **Acceptatie:** afzonderlijke tikdoelen passen bij duimbediening op 320–430 px; geen overlappende zones.
- **Aanpak:** `$impeccable adapt`.

### M09. Desktopnavigatie wordt te vroeg ingeschakeld op tablet

- **Categorie:** responsive / navigatie.
- **Locatie:** `src/components/astro/Header.astro`, breakpoint `min-width:860px`.
- **Bewijs productie op 860×800:** ‘Zelf aan de slag’ breekt over vier regels; ook andere labels en acties stapelen. De navigatie is circa 72 px hoog binnen een header van 80 px.
- **Impact:** op kleine tablets en tussenformaten wordt de rustige desktopheader een dicht opeengepakte tekststrook.
- **Fix:** houd het mobiele/tabletmenu actief tot alle desktopinhoud zonder ongewenste regelbreuk past. Kies het breakpoint op basis van inhoud en controleer de breedtes net erboven en eronder.
- **Acceptatie:** header blijft leesbaar op 768, 820, 860, 900, 1024 en grotere breedtes; goedgekeurde ruime desktopweergave blijft gelijk.
- **Bewijsbeeld:** [header-860.png](audits/mobile-2026-10-29/header-860.png).
- **Aanpak:** `$impeccable adapt`.

### M10. Mobiele paginaopbouw vraagt veel scrollen vóór en tussen taken

- **Categorie:** mobiele UX / layout; geen defecte functionaliteit.
- **Locatie:** homepagehoofdstukken, `src/pages/startpunt.astro`, catalogus-hero's en filtergroepen.
- **Bewijs:** homepage circa 12.694 px statisch op 390 px en circa 17.534 px enhanced op 430×932; de teamsectie alleen circa 2.297 px op 390 px. Vragenlijstoverzicht circa 14.236 px; samensteller circa 15.628 px vóór selectie. Bij de keuzehulp staat op het eerste scherm nog geen vraag: eerst hero, toelichting en extra informatiekaart.
- **Impact:** de gebruiker moet veel scrollen om te beginnen, aanbod te vergelijken of terug te keren. Lengte op zichzelf is geen fout; de verdeling tussen uitleg, media en actie verdient mobiele afstemming.
- **Fix:** maak een bewuste mobiele compositie met dezelfde identiteit en inhoud, minder schermvullende tussenruimte, compacte team-/modulepresentatie en filters die niet alle eerste resultaten wegdrukken. Plaats de eerste keuzehulpvraag veel eerder of bied een directe startactie.
- **Acceptatie:** primaire vervolgstap snel zichtbaar; geen verplicht lange animatiereis om aanbod te bereiken; teksten blijven volledig beschikbaar.
- **Aanpak:** `$impeccable layout`, `$impeccable distill`.

### M11. Checkout toont de gekozen inhoud pas na formulier en bestelknop

- **Categorie:** mobiele taakvolgorde.
- **Locatie:** `src/pages/bestellen.astro`, DOM-volgorde van formulier en `.checkout-summary`.
- **Bewijs:** onder 900 px wordt de layout één kolom. Het productoverzicht komt na de persoonlijke gegevens, akkoordverklaring en knop met betalingsverplichting. Het bedrag staat wel op de knop; de productinhoud staat eronder.
- **Impact:** de gebruiker vult eerst gegevens in voordat de gekozen producten op deze pagina gecontroleerd kunnen worden. Dat past slecht bij de introductie ‘Bekijk je keuze en het totaal’.
- **Fix:** mobiel eerst een compact product-/totaaloverzicht, daarna de gegevens en laatste controle. Behoud de ruime desktopzijbalk.
- **Acceptatie:** gekozen inhoud en totaal zijn vóór gegevensinvoer duidelijk te vinden; eindcontrole blijft vlak bij de bestelactie.
- **Aanpak:** `$impeccable layout`.

### M12. Mobiel ontvangt grote gedeelde beelden zonder passende beeldselectie

- **Categorie:** performance / assets.
- **Locatie:** `src/components/astro/HomeExperience.astro` en afbeeldingen in `public/images`.
- **Bewijs:** de mobiele portal heeft terecht een eigen `picture`-bron, maar andere grote beelden niet. Voorbeelden: praktijkfoto `mygrowise-74.jpg` circa 552 KiB, verhaalbeeld `mygrowise-17.jpg` circa 840 KiB, inzichtbeeld circa 504 KiB. De praktijkfoto krijgt hoge laadprioriteit terwijl zij verder in de mobiele compositie verschijnt. Meerdere beelden zijn eager geladen; het inzichtbeeld heeft geen lazy-loadingattribuut.
- **Impact:** vermijdbare download-/decodekosten op telefoons. Er is geen onderbouwde claim over daadwerkelijke LCP of dropped frames; daarvoor ontbreekt profiling.
- **Fix:** passende `srcset`/`sizes` of geoptimaliseerde mobiele varianten; alleen zichtbare openingsassets hoge prioriteit; laad latere beelden op een moment dat de animatie ze tijdig beschikbaar heeft. Profiel daarna op mobiele netwerk-/CPU-instellingen.
- **Acceptatie:** mobiele beeldselectie is aantoonbaar kleiner en scherp genoeg; geen leeg beeld bij snelle scroll; gemeten laadsnelheid en animatiegedrag vastleggen.
- **Aanpak:** `$impeccable optimize`.

## Wat aantoonbaar al werkt

- De meeste onderzochte publieke pagina's blijven binnen de viewport, ook op 320 px. De fouten zijn niet op elke pagina hetzelfde.
- Profiel- en vragenlijstdetailpagina's hebben al behoorlijk veel bescherming tegen lange inhoud en smallere layouts.
- De samensteller heeft na selectie een vaste balk met aantal, totaal en link naar het overzicht. Het overzicht staat wel ver onderaan, maar is dus niet alleen bereikbaar door alle producten langs te scrollen.
- Zoekfilter, toevoegen, combinatie-overzicht en doorgaan naar checkout functioneerden in de lokale proef.
- De keuzehulp doorliep drie vragen en toonde het juiste profielresultaat zonder horizontale overflow.
- Het mobiele menu opent/sluit en heeft een grote hoofdknop; het focusgedrag heeft herstel nodig.
- Er is een reduced-motionroute en een statische inhoudsweergave; het bestaan van die fallback is goed. Vooral de stabiliteit en compositie moeten beter.
- Een deel van de homepage houdt rekening met safe-area-insets en de cookiemelding.

## Herstelplan met desktop als vaste referentie

### Fase 1 — homepage deterministisch maken

1. Leg desktopreferenties vast op de werkelijk goedgekeurde breedte en aanvullend 1280/1440 px, inclusief intro, herkenning, inzicht, modules, team en afsluiting.
2. Herstel eerst M01 in de meet-/moduslogica. Kies één geometrische basis en maak herhaalde metingen idempotent. Vermijd moduswissels door alleen browserbalkhoogte.
3. Herstel M02: geef de mobiele weergavevoorkeur eigen ruimte en verifieer hit-testing van de modulelink.
4. Controleer de volledige mobiele reis in beide modi voordat meer CSS-overrides worden toegevoegd.

**Gereed wanneer:** viewporthoogtewijzigingen bewaren hoofdstuk/leespositie en alle module-acties zijn direct aantikbaar. Desktopreferenties tonen geen onbedoelde wijziging.

### Fase 2 — content en navigatie betrouwbaar maken

1. Los M03 en M04 op met correcte intrinsieke breedtes, afbreking en mobiele schaling.
2. Herstel menu-focus M05 en tabletbreakpoint M09.
3. Controleer zowel pagina-overflow als inhoud die binnen een `overflow:hidden`-kaart wordt afgeknipt.

**Gereed wanneer:** volledige titels, prijzen en CTA's zijn zichtbaar op 320–430 px; menu is volledig bedienbaar; tabletlabels stapelen niet onbedoeld.

### Fase 3 — formulieren en mobiele taakvolgorde

1. Herstel M06, M07 en M08: checkboxlayout, invoertypografie en tikvlakken.
2. Pas de mobiele volgorde van checkout aan voor M11.
3. Werk M10 uit binnen de bestaande stijl: eerder beginnen met kiezen, minder tussenruimte en compactere presentatie waar dat helpt. Geen inhoudelijke claims of productvoorwaarden wijzigen als onderdeel van deze layoutfix.

**Gereed wanneer:** keuzehulp, zoeken/selecteren, contactconcept en checkout goed bruikbaar zijn met een open mobiel toetsenbord. Formulieren testen zonder echte transacties of berichten te versturen.

### Fase 4 — assets en eindcontrole

1. M12: passende beeldvarianten, laadprioriteiten en mobiele profiling.
2. Test Chrome/Android en Safari/iOS op echte toestellen, inclusief adresbalk in/uit, draaien, toetsenbord, terugnavigatie, hashes, reduced motion en grotere tekst.
3. Controleer ingelogde agenda, account, vragenlijstafname en moduleplayer afzonderlijk met een geschikte testsessie.
4. Lokaal `npm run check` en relevante bestaande tests uitvoeren; gerichte regressiecontrole voor de homepage-meetcyclus is zinvol omdat dit een herhaald functioneel defect is.
5. Laatste visuele controle met `$impeccable polish`; daarna `$impeccable audit` herhalen. Vergelijk desktop opnieuw met fase 1.

Alle controles lokaal. Geen GitHub Actions, betaalde scheduler of abonnement toevoegen. Een eventuele deployment blijft via de bestaande Vercel-integratie binnen Free/Hobby.

## Aanbevolen uitvoervolgorde

1. `$impeccable adapt` — M01–M04 en M09.
2. `$impeccable harden` — M05–M07 en randgevallen bij viewport-/moduswissels.
3. `$impeccable typeset` en `$impeccable layout` — M06–M11 binnen de bestaande identiteit.
4. `$impeccable optimize` — M12, met echte metingen.
5. `$impeccable polish` — laatste mobiele afwerking en desktopvergelijking.

Deze onderdelen kunnen afzonderlijk of als één hersteltraject worden uitgevoerd. Na herstel de audit herhalen, met nadruk op de reproduceerbare acceptatiecriteria hierboven.
