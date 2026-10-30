# SEO-audit en herstelplan

Datum: 30 oktober 2026. Status: audit uitgevoerd; herstel gepland, nog niet geïmplementeerd.

**Definitief hoofddomein, bevestigd door Kevin: `https://www.mygrowise.com`.**

## Conclusie en afbakening

De SEO-basis is aanwezig, maar de website is nog niet volledig klaar voor de domeinmigratie. De grootste blokkade is dat canonicals en sitemap van de nieuwe website nog naar `https://mygrowise.be` wijzen. Dat domein serveert tijdens deze controle nog de oude Webnode-website. De nieuwe website staat bereikbaar op `https://mygrowise.vercel.app`.

Deze audit omvat broncode, de robotsbestanden en sitemaps van de bestaande publieke websites, alle 53 URL-paden uit de Vercel-sitemap op de Vercel-host, en aanvullende routeproeven. Geen wijzigingen aan DNS, hosting, database, productcode of Search Console uitgevoerd. Bestaande lokale wijzigingen blijven behouden. Geen build of tests met schrijvende databasefixtures uitgevoerd: dit is een audit en implementatieplan.

Niet vastgesteld: Search Console-status, geïndexeerde URL's, zoekverkeer, backlinks, echte Core Web Vitals, volledige inhoudelijke kwaliteit en domeineigendom. Een technische oplevering garandeert geen rankings of indexatie.

## Vastgesteld op de publieke websites

| Onderdeel | Bevinding | Betekenis |
| --- | --- | --- |
| `.be`-homepage | `https://mygrowise.be/` eindigt op `https://www.mygrowise.be/nl/`, met een canonical naar die oude URL. | Oude en nieuwe site zijn nog afzonderlijke versies. |
| `.be`-sitemap | Webnode-sitemap met oude routes, locatiepagina's en demoproducten. | De nieuwe sitemap is nog niet actief op dit domein. |
| Vercel-sitemap | 53 URL's; alle loc-elementen gebruiken `https://mygrowise.be`. | Verkeerd toekomstig hoofddomein; loc-elementen komen nu bovendien bij de oude site uit. |
| Nieuwe publieke pagina's | Alle 53 sitemap-paden antwoorden op Vercel met 200, zonder padredirect, met één H1 en zonder noindex. | De huidige routeselectie heeft een bruikbare basis; dit valideert niet dezelfde paden op `.be` of `.com`. |
| Canonicals | Nieuwe homepage en extra routeproeven verwijzen naar `.be`. | Moeten naar `https://www.mygrowise.com`. |
| Ontbrekende sitemapkeuze | `/startpunt`, `/community` en `/afspraak` zijn bereikbaar en indexeerbaar, maar ontbreken in de sitemap. | Per route expliciet bepalen of deze zoekverkeer moet ontvangen. |
| Niet-bestaande detailroutes | Onbekend profiel, artikel en module sturen door naar hun overzicht, dat 200 geeft. | Gebruik 404 voor onbekende inhoud; behoud echte 301-aliases. |
| Structured data | Geen JSON-LD gevonden op de 53 gecontroleerde sitemap-pagina's; ook niet in de relevante broncode. | Verbeterpunt voor entiteiten en paginabetekenis; geen algemene indexatievoorwaarde. |
| Nieuw domein | `mygrowise.com` en `www.mygrowise.com` konden in deze controle niet via DNS worden opgelost. | Domeinkoppeling, DNS en TLS nog aantoonbaar controleren; dit bewijst niet dat het domein ongeregistreerd is. |

## Vastgesteld in de code

- `astro.config.mjs` gebruikt `.be` als `site`; `src/pages/sitemap.xml.ts` en `src/pages/robots.txt.ts` bevatten hetzelfde domein hardcoded.
- `MainLayout.astro` bevat titels, beschrijvingen, taal, canonicals, Open Graph en Twitter-tags. Queryparameters worden uit canonicals weggelaten. Preview-noindex hangt af van `import.meta.env.VERCEL_ENV === 'preview'`.
- Robots sluit bestaande private gebieden grotendeels uit; meerdere private layouts hebben ook noindex. Dat zijn verschillende mechanismen: robots voorkomt crawling en is geen garantie tegen indexatie. Authenticatie blijft de bescherming voor private inhoud.
- De sitemap haalt gepubliceerde producten, actieve professionals en gepubliceerde CMS-inhoud op. XML-escaping, deduplicatie, korte caching en 503 bij databasefouten zijn aanwezig.
- De sitemap gebruikt eigen databasefilters. Publieke routes gebruiken deels andere voorwaarden, bijvoorbeeld `module_details` in `publicModules()`, de berekende beschikbaarheid in `publicCatalog()` en gereserveerde CMS-slugs in `getPublishedPage()`. Dit kan later sitemap-URL's opleveren die niet overeenkomen met de werkelijk renderbare inhoud.
- Er is geen `lastmod`. Dat maakt de sitemap niet ongeldig. Betrouwbare wijzigingsdatums zijn een verbetering; nooit de requestdatum invullen als fictieve inhoudswijziging.
- `legacyRoutes.ts` dekt veel oude Webnode-routes en zeven demo-410's, maar bevat niet alle oude sitemap-paden. Voorbeelden: `/gratis-oefeningen-stress-regulatie`, `/tips-voor-thuis`, `/l/stress-verminderen-ademhalingsoefening`, `/nl/locaties` en de oude stadspagina's.
- `tests/release-http.mjs` verwacht nog dat `/voorwaarden` niet in de sitemap staat, terwijl de route nu indexeerbaar is en wel wordt opgenomen. De release-runbook beschrijft eveneens een oudere juridische sitemapkeuze.
- `src/pages/aanbod/[slug].astro` kan een bestelpagina renderen met `MainLayout` zonder expliciete noindex. Neem de legacy-bestelroute mee in het indexatiebeleid.
- De oorsprong zit ook in `PUBLIC_SITE_URL`, origin-allowlists, mails en andere fallbacks. Alleen de sitemap vervangen volstaat dus niet voor een werkende domeinmigratie.

## Gepland werk, in uitvoeringsvolgorde

### 1. P0 — Domein en indexatiebeleid vastleggen

Gebruik `https://www.mygrowise.com` als enige primaire productie-oorsprong. Centraliseer de publieke oorsprong voor Astro, canonical, sitemap, robots en social metadata. Leg één padconventie vast, bij voorkeur de bestaande routes zonder afsluitende slash, met `/` als uitzondering.

Voorbereiden vóór migratie:

- DNS/TLS en Vercel-domeinkoppeling voor `.com` en `www.mygrowise.com` controleren.
- `PUBLIC_SITE_URL` en de toegestane formulierorigins/hosts aanpassen. Ook Supabase Auth-redirects en relevante externe callbackconfiguratie inventariseren, zodat aanmelden en bestellen op het nieuwe domein blijven werken.
- Oude `.be`-hosts, `.com` zonder www en de publieke Vercel-alias afhandelen. Publieke GET/HEAD-pagina's permanent naar de uiteindelijke `.com`-URL sturen. API-, webhook- en POST-verkeer afzonderlijk controleren voordat hostredirects worden aangezet.
- Previewdeployments via headers en HTML noindex geven; deploymentvariabelen in een echte preview verifiëren. Robots mag previewcrawling daarnaast blokkeren. De publieke Vercel-alias wordt na de migratie geen tweede indexeerbare website.

Aanbevolen routebeleid voor implementatie:

| Routegroep | Beleid |
| --- | --- |
| Homepage, aanbodoverzichten, relevante details, professionals, gepubliceerde CMS-inhoud, contact, over ons, prijzen | Indexeerbaar en in sitemap wanneer renderbaar. |
| `/startpunt` | Indexeerbaar en toevoegen aan sitemap; nuttige publieke instappagina. |
| `/community` | Noindex en buiten sitemap zolang dit alleen een aankondiging van een toekomstige voorziening is. |
| `/afspraak` en `/afspraak/*` | Noindex en buiten sitemap; vindbaarheid via `/begeleiding` en de professionalpagina's. |
| `/samenstellen` | Noindex en buiten sitemap als functionele samensteller; product- en overzichtspagina's dragen de zoekinhoud. |
| `/privacy`, `/voorwaarden` | Huidige indexeerbare status behouden en opnemen; oude testverwachting corrigeren. |
| Accounts, beheer, praktijkportaal, aankopen, bestellen, berichten, legacy-bestelpagina's | Buiten sitemap; consistente noindex waar pagina's worden gerenderd, naast bestaande toegangscontrole. |

Oplevercriterium: productiepagina, canonical, og:url, sitemap-loc en robots-sitemap gebruiken dezelfde definitieve oorsprong. Preview en functionele/private pagina's zijn aantoonbaar uitgesloten van indexatie volgens dit beleid.

### 2. P0 — Volledige migratiekaart voor oude URL's

Maak een inventaris uit de actuele Webnode-sitemap en, zodra beschikbaar, Search Console en belangrijke backlinks. Leg per oude URL een inhoudelijk passende eindbestemming of bewuste 404/410 vast. Behoud relevante oude artikelen en oefeningen door ze over te zetten waar dat nodig is. Bepaal voor locatiepagina's of relevante inhoud wordt behouden; stuur ze niet automatisch allemaal naar de homepage.

Breid `legacyRoutes.ts` en eventuele CMS-redirects uit. Voorkom ketens door host- en padmigratie waar mogelijk in één permanente redirect op te lossen. Redirects moeten ook met oude afsluitende slashes werken. Bewaar migratieredirects minimaal een jaar, bij voorkeur langer.

Oplevercriterium: elke geïnventariseerde oude URL heeft een gecontroleerde uitkomst; geen loops, gebroken doelen of ongerichte bulkredirects. Alle doelen zijn uiteindelijke `.com`-URL's.

### 3. P1 — Sitemap laten aansluiten op renderbare inhoud

Maak een gedeelde selectie voor publieke canonieke URL's, met dezelfde zichtbaarheid en benodigde relaties als de detailroutes. Houd publicatie en bestelbaarheid als aparte beslissingen: een tijdelijk niet bestelbaar product kan nog een nuttige, indexeerbare detailpagina hebben. Pas het afgesproken routebeleid toe, inclusief `/startpunt`.

Controleer gereserveerde CMS-slugs, oude aliases, concepten en vereiste moduledetails. Gebruik betrouwbare inhoudswijzigingsdatums voor optionele `lastmod`; een modulewijziging kan in een andere tabel zitten dan `products.updated_at`. Lees grotere datasets volledig uit of pagineer, zodat een API-rijlimiet geen stille onvolledigheid veroorzaakt. Behoud XML-escaping, unieke URL's, juiste content-type en 503 bij storingen.

Oplevercriterium: elke sitemap-URL is uniek, absoluut, indexeerbaar, canoniek en geeft direct 200 op het definitieve domein. Alle bedoelde indexeerbare pagina's zijn aanwezig; redirects, foutpagina's en noindex-pagina's ontbreken.

### 4. P1 — Statuscodes, metadata en interne links

Geef voor onbekende profiel-, vragenlijst-, module-, artikel- en professionalroutes een echte 404 met een bruikbare foutpagina. Bestaande slugaliases blijven 301. Tijdelijke backendstoringen blijven 503; geen succesvolle lege pagina of misleidende 404.

Crawl de nieuwe publieke inhoud op unieke, niet-lege titels en beschrijvingen, één duidelijke H1, consistente canonicals, geldige afbeeldingen en interne links zonder onnodige redirects. Controleer oude domeinverwijzingen gericht: contactadressen en historische juridische archieven niet blind vervangen. Geef artikelen passende social metadata en waar beschikbaar een inhoudsspecifieke afbeelding. Houd auteurschap, professionele kwalificaties, inhoudelijke controle en begrenzing van psychologische claims zichtbaar waar relevant.

Oplevercriterium: routeproeven bewijzen 200/301/404/410/503 waar van toepassing; de publieke crawl vindt geen interne kapotte links of conflicterende indexatiesignalen.

### 5. P2 — Structured data en prestaties

Voeg feitelijk onderbouwde JSON-LD toe: Organization/WebSite, BreadcrumbList op geschikte detailpagina's en Article voor echte artikelen met beschikbare auteur- en datuminformatie. Beoordeel Product/Offer per werkelijk aangeboden product op toepasbaarheid en actuele prijs/beschikbaarheid. Geen verzonnen ratings, reviews of medische kwalificaties.

Voer mobiele Lighthouse-metingen uit op homepage, overzicht, profiel, module, artikel en professionalpagina. Beoordeel onder meer LCP-media/video, beeldformaten, lettertypen, JavaScript en CLS. Gebruik later Search Console/CrUX voor echte gebruikersgegevens; een lokale score vervangt die niet.

Oplevercriterium: toegevoegde structured data valideert en correspondeert met zichtbare inhoud; concrete prestatieproblemen zijn gemeten en opgevolgd.

### 6. P1 — Lokale regressiecontrole en productieacceptatie

Voeg een read-only SEO-crawl toe die expliciet het te controleren origin krijgt. Controleer XML, sitemapdekking, statuscodes zonder automatisch redirects te verbergen, canonical, robots/noindex, metadata, interne links en migratiedoelen. Test daarnaast publicatie-/zichtbaarheidsselectie met geïsoleerde fixtures, zonder productiedata te veranderen. Corrigeer de verouderde `/voorwaarden`-assertie en werk de relevante releasedocumentatie bij.

Tijdens implementatie: `npm run check`, passende bestaande tests en de nieuwe gerichte SEO-controles lokaal uitvoeren. Databasefixturetests niet op productie draaien. Geen GitHub Actions toevoegen of gebruiken. Deployment via de bestaande Vercel-integratie binnen Free/Hobby; geen betaalde scheduler.

Na gereedzetten van de code volgt het afzonderlijke migratiemoment: domeinen koppelen, redirects activeren, productie opnieuw crawlen en de nieuwe sitemap in Google Search Console indienen. Verifieer oude en nieuwe domeinproperties en gebruik waar toepasselijk de adreswijzigingsfunctie. Monitor indexatie, geselecteerde canonicals, 404's en verkeer in de eerste weken. Search Console-toegang en DNS-/hostingbeheer zijn voor die laatste stappen nog te verifiëren.

## Bronnen en controlepunten

- Publieke controlepunten: <https://mygrowise.be/>, <https://mygrowise.be/robots.txt>, <https://mygrowise.be/sitemap.xml>, <https://mygrowise.vercel.app/>, <https://mygrowise.vercel.app/robots.txt>, <https://mygrowise.vercel.app/sitemap.xml>.
- Google over robots versus indexatie: <https://developers.google.com/search/docs/crawling-indexing/robots/intro>.
- Google over canonieke sitemap-URL's en betrouwbare wijzigingsdatums: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>.
- Google over migratiekaarten, redirects en monitoring: <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>.
