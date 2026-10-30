# Lanceringsaudit MyGrowise — 30 oktober 2026

## Oordeel en afbakening

De publieke site is bereikbaar via Vercel op `https://www.mygrowise.be`. Er zijn concrete migratieproblemen gevonden in de domeinidentiteit, social sharing, oude URL's en mailconfiguratie. Het herstel in deze release pakt die punten aan. Dit is geen vrijgave van de verkoop of verklaring dat de omgeving met cliëntgegevens volledig veilig is: de afzonderlijke beveiligingsaudit bevat nog urgente bevindingen.

Onderzocht: 55 publieke pagina's, hun onderlinge publieke links en 61 unieke direct verwezen assets op productie; metadata, sitemap, robots, vier sociale crawler-user-agents, oude URL's, onbekende URL's, drie beschermde endpoints, Vercel-configuratie, DNS, mail-URL's, lokale tests en het productieartifact. De controle schrijft geen cliëntgegevens, verstuurt geen mails en boekt of bestelt niets.

Browsersteekproef: homepage, mobiele navigatie en privacykeuze; daarnaast negen routes op een geëmuleerde breedte van 390px: startpunt, profielen, vragenlijsten, modules, begeleiding, contact, prijzen, accountlogin en bestellen. Geen horizontale overflow of ongelabelde invoervelden gevonden. De navigatie opent en sluit, ook met Escape. Desktopweergave van Startpunt gecontroleerd. Dit is geen fysieke iOS/Android-test of volledige WCAG-audit.

## Hersteld

### [P1] Oude links geven op productie een foutieve 404

`/nl/onlinebegeleiding/` en `/nl/stress-en-emotieprofiel/` gaven een **404 met een Location-header**, in plaats van 301. `/p/fraaie-fles/` gaf 404 in plaats van de bedoelde 410. Dezelfde requests werkten lokaal correct.

Oorzaak: de gegenereerde Vercel-routering eindigde voor onbekende paden met een `_render`-route met een geforceerde `status: 404`. Die status overschreef de respons van de Astro-middleware. Een expliciet SSR-vangnet in `src/pages/[...path].ts` houdt deze paden binnen normale routering. De bestaande middleware blijft de oude URL's en afgeschafte producten afhandelen. Andere onbekende paden blijven echte 404's.

Een nieuwe controle in `scripts/check-release-artifact.mjs` faalde aantoonbaar op het oude buildartifact. De controle moet na het herstel slagen en voorkomt herhaling bij latere adapterwijzigingen.

### [P2] Social sharing en canonical verwijzen naar een ander hostadres

Alle 55 pagina's verwezen met canonical en `og:url` naar `https://mygrowise.be`, terwijl dat adres met 308 doorstuurt naar `https://www.mygrowise.be`. Ook de gedeelde afbeelding en alle 53 bestaande sitemap-URL's gebruikten de doorsturende host.

De afbeelding ontbrak niet: het oorspronkelijke JPEG-bestand is 1200 × 630 pixels, 219.090 bytes en wordt op www aangeboden met `Content-Type: image/jpeg`. Requests met de user-agents van Facebook, X/Twitter, LinkedIn en WhatsApp ontvingen op www een 200 met Open Graph-metadata. Er is dus geen aangetoonde algemene crawlerblokkade. Een redirect alleen bewijst evenmin waarom een individueel deelplatform geen kaart toonde. Oude pagina- of afbeeldingscache na de Webnode-migratie blijft een aannemelijke aanvullende verklaring; de cache van die platformen is hier niet uitleesbaar.

Herstel:

- Eén gedeelde publieke origin in `src/lib/site.ts`: `https://www.mygrowise.be`.
- Astro-site, canonical, Open Graph, Twitter en sitemap gebruiken dezelfde host.
- De bestaande afbeelding heeft een nieuwe, stabiele URL: `/images/social/mygrowise-social-share-v2.jpg`. De beeldinhoud is ongewijzigd; de nieuwe URL laat een afbeeldingscache opnieuw ophalen zodra de pagina opnieuw wordt gescrapet.
- Metadata staat op de homepage vóór het opstartscript.
- Afbeeldingstype, afmetingen, beschrijving en `summary_large_image` blijven aanwezig in de server-HTML.

De website kan geen reeds opgeslagen berichtkaarten bij externe platformen herschrijven. Indien nodig: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fwww.mygrowise.be%2F), of [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/), met de definitieve www-URL. Een daadwerkelijke kaart in deze platformen is niet binnen een aangemeld account getest.

### [P2] Maillinks gebruiken nog het tijdelijke Vercel-adres

De productievariabele `PUBLIC_SITE_URL` is rechtstreeks in Vercel gecontroleerd en stond op `https://mygrowise.vercel.app`. Die is gewijzigd naar `https://www.mygrowise.be`. De wijziging wordt gebruikt bij een nieuwe productiebuild. Een eerdere CLI-proef bleek lokale `.env`-waarden mee te nemen; die uitvoer is niet als productiebewijs gebruikt. De definitieve controle las de productieconfiguratie afzonderlijk in een tijdelijk bestand, dat daarna verwijderd werd.

Ook de fallbacks voor afspraak-, aankoop- en supportmail en het logo/footeradres van het gedeelde mailtemplate verwijzen nu naar www. Bestaande expliciet meegegeven testorigins blijven werken. Een regressietest controleert dat afspraakmail bij ontbrekende of onveilige configuratie het publieke domein gebruikt. Er zijn geen echte mails verstuurd.

### [P2] Browserbeveiligingsheaders ontbreken

De publieke homepage had HSTS, maar geen `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` of CSP voor framing. `vercel.json` voegt voor alle routes toe:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `X-Frame-Options: SAMEORIGIN`;
- `Content-Security-Policy: frame-ancestors 'self'`.

Deze CSP beperkt framing van MyGrowise door andere sites. Het is geen volledige bescherming tegen scriptinjectie. Scripts, fonts en uitgaande video-embeds krijgen geen nieuwe bronbeperkingen. De bestaande dagelijkse Hobby-cron blijft de enige scheduler; er zijn geen GitHub Actions of betaalde diensten toegevoegd.

### [P2] Twee publieke pagina's ontbreken in de sitemap

`/startpunt` en `/community` staan nu ook in de sitemap. De sitemap blijft alleen gepubliceerde catalogus- en contentrecords en actieve professionals toevoegen. Private pagina's staan er niet in. Robots verwijst naar de sitemap op www. Previewdeployments houden hun bestaande noindex/blokkering.

## Nog te doen, op prioriteit

1. **[P1] Herstel de beveiligingsbevindingen voor beheer en cliëntgegevens.** Zie [SECURITY-AUDIT-2026-10-30.md](SECURITY-AUDIT-2026-10-30.md): te ruime uitvoerrechten van oude databasefuncties, onbetrouwbare begrenzing van inlogpogingen, ontbrekende verplichte MFA en de functie voor alle sessies afmelden. De huidige opdracht wijzigt geen databaserollen, bestaande accounts of sessies. Het eerdere rapport bevat eigen live bewijs; de databaseprivileges zijn in deze lanceringsaudit niet opnieuw onderzocht. Het toenmalige onderscheid tussen Webnode en Vercel is inmiddels achterhaald: het publieke www-domein serveert nu Vercel.
2. **[P1 indien verkoop verwacht wordt] Rond verkoopvrijgave bewust af.** `COMMERCE_SALES_ENABLED` is niet ingesteld in productie en de live bestelpagina toont dat nieuwe bestellingen nog niet beschikbaar zijn. Dit is een bestaande beveiliging, geen storing die hier is opengezet. Controleer definitieve productlevering, verkoopinformatie en de volledige bestelling/betaling/aflevering vóór vrijgave. Modules worden publiek nog als in ontwikkeling aangeboden.
3. **[P2] Controleer Search Console na de migratie.** De DNS-TXT-verificatie is aanwezig; toegang tot de bijbehorende Search Console-property is niet vastgesteld. Dien de www-sitemap in, inspecteer de homepage en belangrijkste aanbodpagina's, en volg indexering en oude 404's. Dit is een verhuizing van infrastructuur/paden binnen hetzelfde domein; er is geen nieuwe domeinnaam aangekocht. Google hoeft oude zoekresultaten niet onmiddellijk te verversen.
4. **[P2] Controleer Supabase Auth voor het definitieve domein.** Bevestig de live Auth Site URL, toegestane callback-URL's en een complete bevestigings-/wachtwoordherstelproef op www. De applicatievariabele in Vercel is bijgewerkt; dat bewijst niet dat de afzonderlijke Supabase-dashboardinstellingen al aangepast zijn. Er zijn geen herstelmails naar echte gebruikers gestuurd.
5. **[P2] Bevestig operationeel herstel en aflevering.** Verifieer back-upherstel, foutmeldingen/alerts en echte inbox-/spamaflevering van contact-, afspraak- en aankoopmails. Het MX-record verwijst nog naar Webnode; het wijzigen van de websitehosting heeft dat record niet vervangen. Een MX-record of SMTP-configuratie bewijst op zichzelf geen bezorging. Geen nieuwe betaalde monitoring of scheduler toegevoegd.
6. **[P2] Optimaliseer fotografie waar metingen dat nodig maken.** De grootste direct verwezen JPEG is circa 857 kB; andere foto's zijn circa 0,35–0,56 MB. De SSR-aanvraag voor begeleiding duurde in de eerste crawl circa 1,8 seconden. Dit zijn momentopnamen, geen veldmeting van Core Web Vitals. De begeleiding berekent beschikbaarheid aan de serverkant; meet eerst mobiele LCP en productiepercentielen voordat je caching van boekbare tijden verandert.
7. **[P3] Maak afbeeldingsafmetingen consistenter.** `src/components/catalog/CatalogExplorer.tsx:28`, `src/components/catalog/ProductDetail.astro:12` en `src/pages/begeleiding/index.astro:25` en `:32` bevatten afbeeldingen zonder expliciete width/height. Er zijn 13 van die elementen op drie publieke pagina's gevonden. Bestaande vaste afbeeldingscontainers beperken het risico; een zichtbare layoutverschuiving is niet aangetoond. Gebruik echte dimensies of een passende vaste beeldverhouding bij een volgende performancepass.
8. **[P3] Eventueel structured data toevoegen.** De gecontroleerde publieke pagina's hebben geen JSON-LD. Dit verhindert Open Graph of indexering niet. Organisatie-/websitegegevens en artikelmetadata zijn een mogelijke latere verbetering; voeg geen onjuiste reviews, medische claims of productbeschikbaarheid toe.

## UI-steekproef

De bestaande visuele identiteit is coherent; er is geen reden gevonden voor een herontwerp als onderdeel van dit herstel. Voorlopige technische UI-beoordeling, uitsluitend voor de genoemde steekproef:

| Dimensie | Score / 4 | Bewijs en grens |
| --- | --- | --- |
| Toegankelijkheid | 3 | Eén h1 per publieke pagina, alt-attributen aanwezig, labels en werkende mobiele navigatie; geen volledige contrast- of screenreaderaudit |
| Performance | 3 | SSR, lazy loading en responsive assets aanwezig; enkele grote foto's en serverwerk voor beschikbaarheid |
| Theming | 3 | Bestaande groen/crème/roze identiteit en gedeelde tokens; plaatselijk letterlijke kleuren |
| Responsive | 3 | Geen horizontale overflow op negen routes bij 390px; desktopsteekproef, geen fysieke toestellen |
| Implementatie-integriteit | 3 | Samenhangende productinterface; ontbrekende afbeeldingsdimensies en enkele styleschulden |
| **Totaal UI-steekproef** | **15 / 20** | **Geen veiligheids- of verkoopvrijgave** |

De statische Impeccable-detector rapporteerde 14 primaire stijlsignalen en veel advisories. Font-/paletvergelijkingen met DESIGN.md zijn grotendeels niet toepasselijk: dat bestand beschrijft expliciet alleen Startpunt. De andere signalen gaan vooral over bestaande gekleurde randen en fonts in interne omgevingen, zonder aangetoonde lanceringsblokkade. Deze zijn niet als 14 functionele fouten opgevoerd. Geen bestaande vormgeving verwijderd op basis van die detector alleen. De Web Interface Guidelines zijn bij de beoordeling geraadpleegd.

## Herhaalbare controles en bewijs

```sh
npm test
npm run check
npm run security:audit
npm run check:artifact
npm run audit:public -- https://www.mygrowise.be output/launch-audit.json
```

De publieke auditscript voert alleen leesverzoeken uit, gebruikt maximaal drie parallelle verzoeken en probeert één transportfout opnieuw. Hij bezoekt geen private links uit de pagina's, submit geen formulieren en verwerkt geen mailwachtrij. De afzonderlijke negatieve probes vragen alleen niet-aangemelde GET-responses op.

- [Productie vóór herstel](audits/launch-2026-10-30/before.json).
- [Lokale nacontrole](audits/launch-2026-10-30/local.json).
- [Productie na herstel](audits/launch-2026-10-30/production.json).
- [Alle oude URL's, daadwerkelijke JPEG-downloads en private pagina's](audits/launch-2026-10-30/production-detail.json).

## Gecontroleerde productie-uitrol

Applicatiecommit: `8729fcb70501af7c1bd1aa7632c886ef431187f5`, gepusht naar `main` via de bestaande Git/Vercel-integratie. Vercel-deployment `dpl_VXPRean1pkHPJZLCZ3CbEBnc3aDb`, `mygrowise-pj4zrj15j-lanternnetworks-projects.vercel.app`, meldde `READY` voor productie. De controles hieronder zijn daarna uitgevoerd op het echte www-domein, niet alleen op de deployment-URL.

- **55/55 publieke pagina's en 61/61 direct verwezen assets bereikbaar.** Canonical, Open Graph en Twitter gebruiken consequent www; geen ontbrekende deelmetadata, onverwachte noindex, ontbrekende alt-attributen of h1-afwijkingen.
- **55 sitemap-URL's op de juiste host.** Geen doorsturende host meer in de sitemap.
- **35/35 oude URL's correct:** alle 28 bekende equivalenten geven 301 naar hun bedoelde bestemming; alle zeven afgeschafte demo's geven 410. Een onbekende pagina geeft nog steeds 404.
- **Vier crawler-user-agents succesvol:** Facebook, X/Twitter, LinkedIn en WhatsApp krijgen op de pagina een 200 en kunnen de nieuwe JPEG direct met 200 ophalen, zonder redirect. De daadwerkelijk gedownloade bestanden zijn 1200 × 630 pixels, 219.090 bytes en hebben dezelfde SHA-256 als het gecommitte bestand. Dit bewijst bereikbaarheid met die user-agents; het bewijst niet dat externe platformcaches al vernieuwd zijn.
- **Beveiligingsheaders actief** op de live homepage. Accountlogin, bestellen en aankopen behouden `private, no-store`, noindex en `no-referrer`.
- **Negatieve autorisatieprobes slagen:** admin-API, praktijkagenda en cron zonder geheim geven 401. `/api/health` geeft 200 met `ok: true`.
- **103 lokale tests geslaagd**, typecheck en productiebuild geslaagd, productie-dependency-audit nul bekende kwetsbaarheden, releaseartifactcontrole geslaagd inclusief de nieuwe routeringsregressiecontrole.
- **TLS geldig en vertrouwd:** TLS 1.3, Let's Encrypt-certificaat geldig tot 28 januari 2027 op het controlemoment.
- De nieuwe metadata en de reeds aanwezige privacycomponentwijziging zijn ook in de live browser teruggezien. De verkoopblokkade blijft actief.

Platformgrenzen: geen aangemelde Facebook-/LinkedIn-kaart, geen geauthenticeerde cliëntsessies, geen nieuwe betaling, geen destructieve beveiligingstest, geen historische secretscan en geen bewezen back-uprestore. Een nieuw gedeeld bericht kan pas de nieuwe metadata gebruiken nadat het deelplatform de pagina opnieuw heeft opgehaald.

Bronnen: [Open Graph-protocol](https://ogp.me/), [Google: siteverhuizingen](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes), [Astro-middleware en foutpagina's](https://docs.astro.build/en/guides/middleware/), [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
