# Modules — concreet bouwplan

**Datum:** 18 oktober 2026.  
**Opdracht:** vervolg op Kevins “oké stel je plan verder op”.  
**Status:** geïmplementeerd in de lokale checkout op 18 oktober 2026; de modulemigratie is toegepast. Geen website-deployment uitgevoerd; alle zes modules blijven in ontwikkeling. Zie [beheer en verificatie](MODULES-RUNBOOK.md) voor de werkelijk uitgevoerde onderdelen, testresultaten en de nog aan te leveren inhoud. De rest van dit document bewaart de bouwspecificatie.  
**Lees samen met:** [betekenis van de briefing](MODULES-AANBOD-EN-LEVERING-PLAN.md), [moduleteksten](content/modules-brontekst.md), [profielenplan](PROFIELEN-LANDINGSPAGINA-PLAN.md) en [vragenlijstenplan](VRAGENLIJSTEN-LANDINGSPAGINA-PLAN.md).

## 1. Vast werkuitgangspunt

**Aanvulling 18 oktober:** voor de volgende uitvoering gaat het [websiteherstelplan](WEBSITE-HERSTELPLAN.md) vóór de oudere accountgebonden bestel- en leverkeuzes hieronder. Kopen én gekochte inhoud openen moet zonder verplicht account kunnen. De staffel voor modules en vragenlijsten is inmiddels door Virginie bevestigd; extra korting op vaste profielpakketten blijft een open detail. De zes documentbeelden zijn inmiddels uitgepakt en op het moduleoverzicht en alle detailpagina's gecontroleerd.

Bouw zes zelfstandige zelfstudiemodules van €89 per stuk. Een module bevat een PDF en bijbehorende MP3's. De eerste drie vormen de eerste beoogde lancering; modules 4–6 worden zichtbaar als in ontwikkeling. Een vorige module kopen of afronden is geen voorwaarde.

Voor dit bouwplan kiezen we dezelfde staffel voor verschillende modules en losse vragenlijsten samen: één product 0%, twee of drie 5%, vier of meer 10%. Ook twee modules samen vallen hieronder. Dit is de aanbevolen invulling van het doorgestuurde kortingsverzoek, voortbouwend op de bestaande vragenlijstenstaffel; geen nieuwe prijsinstelling is al uitgevoerd. Gebruik de centrale aanpasbare kortingsinstellingen, geen tweede afzonderlijke modulekorting.

De bestaande vaste profielpakketten behouden hun vaste prijs. De eerste versie gebruikt voor die pakketten de bestaande afzonderlijke bestelling. Een gemengde combinatie bestaat uit losse vragenlijsten en modules voor één deelnemer. Het bericht maakt niet duidelijk voor welke leeftijden de modules geschikt zijn; een prijscombinatie mag daarom geen uitspraak over individuele geschiktheid doen.

## 2. Eerste versie: precies wat we bouwen

| Werkgebied | Resultaat |
|---|---|
| Publiek aanbod | Eén moduleoverzicht en zes detailpagina's met de aangeleverde teksten. |
| Combineren | Eén winkelmand met modules en vragenlijsten; server berekent de actuele korting. |
| Bestellen | De bestaande overschrijvingsflow, orderregistratie en betaalbevestiging. |
| Bibliotheek | Eigen modulekaarten naast bestaande afnames; aankoop opent het materiaal. |
| Module openen | PDF openen/downloaden, genummerde audiolijst en eenvoudige audiospeler. |
| PDF-audiolinks | Stabiele websiteadressen die na inloggen dezelfde oefening openen. |
| Beheer | Moduletekst, cover, prijs, PDF, audiotracks, voorbeeldweergave en publiceren. |
| Bijwerken | Nieuwe materiaalversie voorbereiden en in één keer publiceren. |

Video, ingebouwde vragenlijsten, scoring, automatische rapportgeneratie, opdrachten insturen, leerprogressie en certificaten zijn geen onderdeel van deze briefing. De tekst spreekt over uitleg en oefeningen in de module, niet over begeleiding of beoordeling via de website. Reflectieantwoorden worden in deze versie dus niet op de website verzameld.

Audio wordt in de eerste versie online afgespeeld. De PDF is downloadbaar. Audio downloaden kan later als bewuste productkeuze worden toegevoegd. Dit is een afbakening van de leverwijze, geen garantie tegen kopiëren.

## 3. Publieke pagina's: indeling en knopgedrag

### `/modules`

| Volgorde | Inhoud | Functie |
|---|---|---|
| Intro | H1 “Ontdek jouw innerlijke landschap”; onderregel over zes modules; eerste landschapsalinea | Sfeer en samenhang. |
| Praktische uitleg | €89 per module; PDF met uitleg en oefeningen; audio; zelfstandig te volgen | Duidelijk maken wat men koopt. |
| Eerste modules | Het Meer, De Stromingen, De Mist | Beschikbaar aanbod herkennen; werkelijke status gebruiken. |
| Verder in het landschap | Het Evenwicht, De Bergen, Het Volledige Landschap | De rest van de reeks laten zien met status “In ontwikkeling”. |
| Zelfstandig volgen | “Jouw reis, jouw tempo”, met aangeleverde toelichting | Geen verplichte volgorde suggereren. |
| Combineren | Korte uitleg over de centrale staffel, link “Combineer modules en vragenlijsten” | Naar `/samenstellen?type=modules`. |
| Zo werkt het | Kiezen → betalen → bibliotheek → PDF en audio | Verwachtingen over levering. |
| Keuzehulp | Contactlink en vier praktische FAQ's | Vragen over starten, audio, toegang en combineren beantwoorden. |

Kaarten: foto → nummer en naam → inhoudelijke kop → samenvatting van hoogstens twee korte zinnen → maximaal drie kernonderwerpen → status en prijs → “Bekijk module”. Volledige kernlijst op de detailpagina. Desktop drie kolommen, tablet twee, mobiel één; gewone scroll in de volgorde 1–6.

Geen zoekveld nodig voor zes modules. Een direct zichtbare indeling in beschikbaar en in ontwikkeling is voldoende. Als een van de eerste drie nog niet leverbaar is, blijft die zichtbaar met de echte ontwikkelstatus. We vullen de eerste rij niet met een onjuiste beschikbaarheidsclaim.

### `/modules/[slug]`

De bestaande slugs eerst tegen de doelcatalogus controleren; voorgesteld: `het-meer`, `de-stromingen`, `de-mist`, `het-evenwicht`, `de-bergen`, `het-volledige-landschap`.

| Deel | Inhoud |
|---|---|
| Intro | Nummer, landschapsnaam als H1, concrete inhoudelijke kop, sfeerregel, beeld. |
| Herkenning | Beide aangeleverde beschrijvende alinea's, met normale alineaverdeling. |
| Wat je verkent | De aangeleverde kernonderwerpen in een leesbare lijst. |
| Wat je ontvangt | Eén PDF met uitleg en oefeningen, plus bijbehorende audio. Aantallen/duur alleen als ze werkelijk bekend zijn. |
| Jouw tempo | Zelfstandig te volgen; nummering is een aanbevolen opbouw. |
| Praktisch | Werkelijk vastgelegde doelgroep, toegangstermijn en ondersteuning. Geen onbekende waarden invullen. |
| Keuze | €89; hoofdactie “Kies deze module”, secundair “Voeg toe aan mijn combinatie”. |

“Kies deze module” opent een serverquote voor precies deze module, met 0% korting. De combineeractie voegt toe aan de centrale selectie en opent de samensteller. Een reeds geselecteerde module krijgt “Bekijk mijn combinatie”.

Bij in ontwikkeling: prijs mag als “Geplande prijs: €89” zichtbaar zijn, met “In ontwikkeling”; geen koop-/toevoegactie. Bij reeds gekocht: bied de actieve klant ook “Open mijn module” aan en voorkom een onbedoelde heraankoop voor dezelfde deelnemer.

## 4. Samensteller en bestelling

De samensteller blijft `/samenstellen`. Boven het aanbod komen filters **Alles / Modules / Vragenlijsten**, naast de bestaande passende zoek-/thema-/leeftijdsbediening. `type=modules` is alleen een beginfilter; het maakt geen aparte winkelmand.

De selectie bevat unieke product-ID's met eenheid één. PDF's, MP3's, hoofdstukken en eigen profielonderdelen zijn geen winkelmanditems. Sla alleen de geselecteerde ID's op en lees prijs/beschikbaarheid opnieuw uit de catalogus.

Vervang `mg-questionnaires` door een neutrale sessiesleutel, bijvoorbeeld `mg-selection-v1`. Lees bestaande vragenlijstselecties eenmaal in als de nieuwe sleutel nog ontbreekt. Laat ongeldige en onbeschikbare ID's weg met een begrijpelijke melding. Er blijven geen twee gelijktijdige selecties actief.

Winkelmand toont per regel type, titel, standaardprijs en verwijderen. Daaronder subtotaal, kortingspercentage, korting in euro's en totaal. Een filterwisseling verandert de selectie niet. Gebruik de huidige centverdeling zodat orderregels exact tot het afgeronde eindbedrag optellen.

Voor nieuwe gemengde links: `/bestellen?producten=<id,id>`; bestaand `?vragenlijsten=` en `?pakket=` blijven geldig. Accepteer geen gelijktijdige conflicterende selectievormen. `?pakket=` blijft één profielproduct in pakketmodus. De serverquote en orderaanmaak controleren opnieuw typen, publicatiestatus, beschikbaarheid, prijs, aantal, dubbelen en de actuele prijs-/inhoudsversie.

De server accepteert voor een eigen combinatie expliciet `questionnaire` en `module`. Een profiel, e-book of ander producttype toevoegen via een aangepaste URL geeft geen eigen-combinatiekorting en geen ongecontroleerde toegang. Bestaande limiet van 30 unieke producten behouden.

Bij een gewijzigde quote: keuze behouden, nieuwe bedragen tonen en opnieuw laten bestellen. Een module die intussen niet leverbaar is, kan niet alsnog betaald worden via een oude pagina. Producttoegang ontstaat na de bestaande handmatige betaalbevestiging, niet na klikken op “Bestelling plaatsen”.

Voor dezelfde deelnemer blokkeert de server een nieuwe moduleaankoop als al een geldig moduletoegangsrecht bestaat. Controleer dit bij quoten én orderaanmaak. Controleer ook of er al een passende openstaande bestelling bestaat; leid dan naar die bestelling. Dit verandert bestaande vragenlijstafnames die bewust opnieuw gekocht kunnen worden niet. Gelijktijdige bestellingen mogen geen dubbele aanspraak opleveren; een onverwachte dubbele betaling blijft een zichtbare beheersituatie.

## 5. Klantomgeving

### `/account/bibliotheek`

Eén bestaande bibliotheek met twee duidelijke delen: **Mijn modules** en **Mijn afnames**. Geen extra hoofdnavigatie-item nodig. Elke modulekaart bevat cover, naam en “Open module”. Toon alleen eigen geldige aankooprechten; match op product-ID, nooit op producttitel.

Betaalstatus hoort bij transacties: een nog onbetaalde order geeft geen actieve modulekaart. Na bevestiging verschijnt de module in de bibliotheek. Vraag-/profielregels uit dezelfde bestelling houden hun eigen afnamestatus en rapporten.

### `/account/modules/[slug]`

Leesbare modulepagina met teruglink naar de bibliotheek, naam en inhoudelijke kop. Bovenaan **Open werkboek** en **Download PDF**. Daaronder de audiolijst in vastgelegde volgorde, met titel en speelduur als bekend. Elke track heeft “Beluisteren”. Bij één track werkt dezelfde opbouw zonder overbodige filter of zoeker.

Gebruik een eenvoudige native audiospeler met afspelen, pauzeren, scrubben en tijd. Geen automatisch afspelen en geen databasevoortgang in deze versie. Het werkboek kan in een aparte browsertab openen; geef op mobiel altijd de PDF-download als duidelijke route als de ingebouwde weergave niet werkt.

### `/account/modules/[slug]/audio/[trackKey]`

Dit is de vaste bestemming voor links vanuit de PDF. Naam van module en audio, speler en “Alle audio van deze module”. Een nog niet ingelogde bezoeker keert na login naar deze exacte route terug. Zowel module als audiotrack worden servermatig op aankooprecht en onderlinge koppeling gecontroleerd.

De link bevat een stabiele trackcode, geen bestandsnaam of tijdelijk opslagtoken. Geef in beheer de volledige URL met de bevestigde publieke website-origin, plus een kopieerknop. Verander die origin niet op basis van een onbetrouwbare requestheader.

Bij slugs wijzigen: behoud oude moduleroutes voor zowel publieke als accountlinks via de bestaande aliassystematiek, uitgebreid voor `module`. De trackcode blijft gelijk. Zo blijven ook oudere gedownloade PDF's naar de goede module verwijzen.

### Lege of fouttoestanden

| Situatie | Zichtbare reactie |
|---|---|
| Niet ingelogd | Klantlogin met veilige interne terugkeer naar dezelfde pagina. |
| Geen aankooprecht | “Deze module staat nog niet in je bibliotheek”, met link naar het openbare aanbod. Geen opslaggegevens tonen. |
| Betaling wacht | Link naar eigen bestelling/transacties; nog geen materiaaltoegang. |
| Bestand tijdelijk onbereikbaar | “Het bestand kan nu niet worden geopend. Probeer opnieuw of neem contact op.” Bibliotheek blijft bruikbaar. |
| Audio ontbreekt of is vervangen | Stabiele route behouden; juiste vervanging of duidelijke uitleg en teruglink. |
| Verkoop gepauzeerd | Nieuwe aankoop uit; bestaande geldige klanttoegang blijft werken. |

## 6. Beheer: hoe zij een module klaarzet

Vervang de huidige blauwdruk op `/admin/modules` door een echte modulelijst en `/admin/modules/[id]` door de editor. Toon per module nummer, titel, prijs, verkoopstatus, materiaalstatus en actie “Bewerken”. Het bestaande product blijft de bron van de prijs; geen tweede prijs in een moduletekstveld.

De editor heeft vier secties:

1. **Website:** naam, beide ondertitels met duidelijke hiërarchie, beschrijving, kernonderwerpen, doelgroep zodra vastgesteld, cover en alt-tekst, preview.
2. **Werkboek:** PDF uploaden, huidige bestandsnaam/versie, openen als beheerder, vervangen in concept.
3. **Audio:** bestanden uploaden, titel en volgorde instellen, stabiele audiolink kopiëren, zelf afspelen, optionele pagina-/hoofdstukverwijzing.
4. **Prijs en publiceren:** €89 als startwaarde, bestaande statusvelden en materiaalcontrole. “Bewaar concept”, “Bekijk klantvoorbeeld” en “Publiceer”.

De werkvolgorde voor de auteur is belangrijk:

1. Moduleconcept openen en audiotracks aanmaken/uploaden; de vaste trackcodes worden direct gereserveerd.
2. De vaste audiolinks kopiëren en bij de juiste oefeningen in haar brondocument plaatsen.
3. De PDF exporteren en uploaden; de PDF zelf wordt niet automatisch door de site herschreven.
4. In voorbeeldweergave PDF en audio nalopen, inclusief ten minste elke gebruikte PDF-link.
5. De complete materiaalversie publiceren. Daarna kan de module beschikbaar worden voor verkoop.

Een concept bewaart wijzigingen zonder de huidige verkochte versie te overschrijven. Toon verschil tussen **website zichtbaar**, **verkoop beschikbaar** en **materiaal gepubliceerd**. Voorbeeldweergave is alleen voor bevoegde beheerders, met korte toegang voor die sessie.

De huidige catalogusmutaties zijn bovendien beperkt tot superadmin. Sluit modulebeheer in deze eerste versie daarop aan. Breid de route-/API-mapping expliciet uit: `/admin/modules/[id]` moet onder productbeheer vallen, in plaats van alleen de huidige exacte `/admin/modules`-vermelding bij contentrechten. Geen schrijfrecht voor iedere ingelogde klant. Eventuele redacteursrollen zijn later een afzonderlijke toekenningskeuze.

## 7. Bestandsupload zonder grote serverrequests

PDF en audio gaan naar een nieuwe private opslagruimte, bijvoorbeeld `module-materials`. Covers blijven normale openbare websitebeelden. Gebruik gescheiden paden per product, materiaalversie en asset-ID, zonder klantnaam of mailadres.

De applicatieserver autoriseert een specifieke upload naar een zelf gegenereerd pad. De browser uploadt de bytes rechtstreeks naar storage. Voor grote audio een hervatbare upload met voortgang, opnieuw proberen en een duidelijke mislukte toestand. Stuur MP3's niet als volledige multipart-body door een Vercel Function.

De huidige Vercel-documentatie noemt een request-/responsebodylimiet van 4,5 MB voor Functions. Supabase adviseert hervatbare uploads onder meer voor bestanden groter dan 6 MB en ondersteunt daarvoor ook ondertekende uploadtokens. Dit maakt directe storage-upload passend voor MP3's. Zie [Vercel-limieten](https://vercel.com/docs/functions/limitations#request-body-size) en [Supabase hervatbare uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

Na upload meldt de browser voltooiing. De server controleert het gereserveerde pad, module-/versierelatie, werkelijk aanwezige bytes, bestandstype en ingestelde groottegrens. Een bestand wordt pas daarna gekoppeld als bruikbaar materiaal. Een melding van de browser dat upload “gelukt” is, is onvoldoende.

Operationele startgrenzen als bouwvoorstel: PDF maximaal 25 MB, MP3 maximaal 150 MB per bestand; configureerbaar en vóór invoer toetsen aan werkelijke bestanden en storageplan. Controleer type ook op inhoud; een extensie of browser-MIME alleen volstaat niet. Audiolengte uit de browser is hoogstens voorlopige metadata tot controle/afspeelproef.

Nieuwe bestanden krijgen een nieuw pad; overschrijf een al gepubliceerd object niet. Onvoltooide uploads geven geen gepubliceerde content. Verwijder alleen aantoonbaar ongebruikte conceptobjecten, nooit automatisch eerdere gepubliceerde materiaalversies.

## 8. Voorstel voor het datamodel

Voeg toe aan de bestaande `products`, `catalog_details`, `orders`, `order_items` en `entitlements`; maak geen tweede commercieel productsysteem.

| Gegevensgroep | Voorgestelde inhoud | Regel |
|---|---|---|
| `module_details` | `product_id`, reeks, nummer, ondertitels, introductie, kernonderwerpen, covermetadata, actuele materiaalversie | Eén record per moduleproduct; nummer uniek binnen deze reeks. |
| `module_releases` | ID, product-ID, versienummer, concept/gepubliceerd, aanmaak-/publicatiedatum, controle-informatie | Publiceren verandert nooit een al gepubliceerd bestand; nieuwe inhoud wordt een nieuwe versie. |
| `module_tracks` | ID, product-ID, stabiele trackcode, basisnaam, aanmaakdatum | Identiteit van een oefening over materiaalversies heen; unieke code binnen één module. |
| `module_assets` | ID, release-ID, soort PDF/audio, track-ID voor audio, titel, volgorde, privéopslagpad, MIME, grootte, duur indien bekend, upload-/controlestatus | Precies één gereed werkboek per publiceerbare versie; maximaal één asset voor dezelfde track binnen een versie. |

Een audiosleutel identificeert dezelfde oefening over versies heen. Daarom staat de audio-identiteit apart in `module_tracks`; de bestanden per versie verwijzen ernaar. Een nieuwe oefening krijgt een nieuwe code. Een eerder uitgegeven code wordt niet hergebruikt voor een andere oefening. Dwing de relatie tussen release, module en track af met constraints, zodat een track niet naar een asset van een andere module kan wijzen.

Een volledige versie wordt atomair de actieve versie. De versie moet bij hetzelfde product horen; controleer dit met databaseconstraints en een transactie. Publiceer minimaal één PDF en alle voor die versie vereiste tracks, met complete metadata en afgeronde uploadcontrole. Leg de handmatige bevestiging van de PDF-linkcontrole vast; beloof geen automatische controle op alle inhoud van de PDF.

Geldige bestaande kopers krijgen de actuele materiaalversie. Oudere versies blijven bewaard voor herstel en oudere PDF-links. De resolver voor een oude audiocode vindt eerst de actuele overeenkomstige track; als die niet meer in de huidige versie staat, blijft het laatst gepubliceerde passende bestand bereikbaar voor dezelfde modulekoper, of verschijnt een expliciete vervangingsmelding. Geen stilzwijgende 404 na een normale update.

Gebruik het bestaande actieve aankooprecht voor toegang. Verkoop pauzeren, een product archiveren of een cover wijzigen trekt een reeds verleend recht niet automatisch in. Een expliciet ingetrokken aankooprecht blokkeert wel nieuwe materiaaltoegang. De openbare aanbodquery en de query voor gekocht materiaal hebben daarom verschillende voorwaarden.

Nieuwe tabellen en bucket blijven niet rechtstreeks openbaar. RLS inschakelen; gewone klantrollen krijgen geen algemene tabel-/objecttoegang. Serverroutes lezen alleen benodigde gegevens na gebruikers- en aankoopcontrole. Een serverclient met uitgebreide rechten vervangt deze controles niet. Publieke catalogusdata bevatten geen interne opslagpaden, uploadtokens, conceptmateriaal of getekende bestandslinks.

Een bestelregel bewaart productidentiteit, titel en prijs zoals gekocht, plus de op dat moment aangeboden materiaalversie als referentie. Het aankooprecht blijft op productniveau; het wordt niet afhankelijk van een veranderbare producttitel of enkel de actuele slug.

## 9. Routes en verantwoordelijkheden

Dit zijn voorgestelde interfaces, geen al bestaande endpoints. Exacte bestandsnamen volgen de bestaande Astro-routeconventies.

| Route / functie | Verantwoordelijkheid |
|---|---|
| `GET /modules` | Openbare gepubliceerde modulebeschrijvingen, met echte verkoopstatus. |
| `GET /modules/[slug]` | Openbare landingspagina; oude slug naar canonieke module doorsturen. |
| `GET /account/modules/[slug]` | Eigen geldige aankoop controleren; actuele PDF en audiolijst tonen. |
| `GET /account/modules/[slug]/audio/[trackKey]` | Eigen aankoop en trackrelatie controleren; vaste luisterpagina. |
| `GET /api/account/modules/[productId]/werkboek` | Aankoop controleren; actuele PDF inline of als download openen via tijdelijke storagetoegang. |
| `GET /api/account/modules/[productId]/audio/[trackKey]` | Aankoop en track controleren; tijdelijke audio-URL leveren. |
| `POST /api/admin/modules/[id]/save` | Website-/conceptmetadata bewaren; productrechten, origin en revisie controleren. |
| `POST /api/admin/modules/[id]/uploads/start` | Specifieke asset reserveren en beperkte uploadautorisatie teruggeven. |
| `POST /api/admin/modules/[id]/uploads/complete` | Echte upload controleren en aan het juiste concept koppelen. |
| `POST /api/admin/modules/[id]/publish` | Complete versie atomair publiceren; status en audit bijwerken. |
| Bestaande `catalog_quote` / orderaanmaak | Gemengde producttypen en actuele prijzen valideren. |

Gebruik private/no-store voor gepersonaliseerde pagina's en antwoorden met tijdelijke links. Log actie-ID's en statussen, geen tijdelijke downloadtokens of inhoud van oefeningen van klanten. Mutaties gebruiken dezelfde origincontrole als bestaande adminroutes; autorisatie wordt bij uploadvoltooiing en publicatie opnieuw uitgevoerd.

Voor audio: laat de grote bytes door storage leveren, niet door de applicatiefunctie. De luisterpagina vraagt pas bij starten tijdelijke toegang en moet ook na later hervatten een nieuwe URL kunnen krijgen zonder de gekozen tijdpositie te verliezen. Kies de geldigheid op basis van werkelijke audiolengte plus marge, binnen een vastgestelde bovengrens. Test ook opnieuw doorspoelen na het verlopen van een eerder token. Een reeds uitgegeven getekende URL blijft tot expiratie bruikbaar; toegangsintrekking is geen garantie dat die URL direct ophoudt te werken.

## 10. Bestanden en bestaande functies die mee veranderen

| Bestaand onderdeel | Werk |
|---|---|
| `src/pages/modules.astro` | Nieuwe reeksindeling; gegevens uit catalogus/modulecontent. |
| Nieuwe `src/pages/modules/[slug].astro` | Zes landingspagina's via één template. |
| `src/lib/catalog/server.ts` | Moduleproduct opnemen, publieke/projectie van privédata scheiden, slugaliasroutering uitbreiden. |
| `src/lib/catalog/admin.ts`, `CatalogEditor.astro`, `save_catalog_product` | Moduletype ondersteunen; gekoppelde beheergegevens bij één product houden. |
| Nieuwe modulebeheerpagina's en componenten | Upload, versie, audiolinks, voorbeeld en publicatie. |
| `src/components/catalog/CatalogExplorer.tsx` | Eén selectie, typefilter, moduleweergave en neutrale winkelmandteksten. |
| `src/pages/bestellen.astro`, checkout-API en quote-functie | Gemengde selectieparameter, modulebestelling en juiste foutterugkeer. |
| Betaalbevestiging en aankooprechten | Module eenmaal toekennen; afnamelevering alleen voor vragenlijsten/profielen laten lopen. |
| `src/pages/account/bibliotheek.astro`, nieuwe klantmodulepagina's | Eigen modules openen naar materiaal; titelvergelijking vervangen door productidentiteit waar geraakt. |
| `src/layouts/AccountLayout.astro` | Bibliotheek actief houden op `/account/modules/…`. |
| `src/lib/adminPermissions.ts`, `src/middleware.ts` | Modulebeheer/API expliciet mappen en veilige klantlogin-terugkeer controleren. |
| `src/lib/catalog/mail.ts` | Module-, vragenlijst- en gemengde orders correct omschrijven; geen afname beloven bij uitsluitend modules. |
| `src/pages/account/index.astro`, transacties en beheerorderdetails | Neutrale aankoop-/leveringsteksten en passende modulelinks waar relevant. |
| Catalogusschema/migraties en gegenereerde typen | Additief uitbreiden; bestaande product-ID's, orders en rechten behouden. |

Maak nieuwe migraties bij uitvoering via de CLI; verzin nu geen timestampbestanden en pas tijdens de planfase niets op de doelomgeving toe. Controleer het werkelijke schema en de huidige productrecords vóór het koppelen van de zes producten. Gebruik geen oude seed als vervanging van bestaande beheerwijzigingen.

Mail blijft via de bestaande wachtrij verlopen. Betaalbevestiging verwijst naar de bibliotheek: bij modules is materiaal beschikbaar, bij vragenlijsten worden afnames voorbereid; een gemengde order benoemt beide kort. Een PDF of MP3 wordt geen mailbijlage. Een mislukte mail mag een geldig aankooprecht niet ongedaan maken.

## 11. Bouwvolgorde met tastbaar resultaat per stap

| Stap | Resultaat | Controle vóór verdergaan |
|---|---|---|
| A. Catalogus en inhoud koppelen | Zes bekende productidentiteiten, tekstmapping, startprijs, ontwerpstatus | Geen dubbel product; slugs en bestaand aanbod geïnventariseerd. |
| B. Materiaalmodel en beheer | Concept aanmaken, bestanden uploaden, vaste audiolinks, preview en publiceren | Onvolledige release niet publiceerbaar; bestaande versie blijft bruikbaar. |
| C. Bibliotheek en afspelen | Eigen module openen, PDF, audio, login-terugkeer | Geen toegang buiten eigen rechten; voorbeeldbestand speelt op mobiel en desktop. |
| D. Gemengde verkoop | Eén selectie en serverquote, bestelregistratie en toegang na betaalbevestiging | Rekenvoorbeelden kloppen; module levert geen fictieve afname op. |
| E. Publieke modulepagina's | Nieuwe overzichts- en detailpagina's met juiste knoppen/status | Beschikbare producten zijn echt leverbaar; ontwikkelmodules niet bestelbaar. |
| F. Eerste drie inrichten | Definitieve covers, PDF's en MP3's van modules 1–3 gekoppeld | Elke PDF-audiolink, order en klantweergave gecontroleerd. |
| G. Lanceren | Eerste drie beschikbaar; 4–6 in ontwikkeling | Volledige proef in de doelomgeving geslaagd; bedrijfsinformatie klopt. |

De bestaande profiel- en vragenlijstlandingspagina's kunnen onafhankelijk worden uitgevoerd. Stem gedeelde cataloguscomponenten wel samen af; kopieer niet drie verschillende winkelmanden of prijsberekeningen. Werk bij start van de bouw met de actuele checkout, omdat er andere werkzaamheden in deze repository lopen.

## 12. Gerichte verificatie

| Scenario | Verwacht resultaat |
|---|---|
| Eén module van €89 | €89,00 en één geldig modulerecht na bevestiging. |
| Twee modules | €169,10 bij de beoogde 5%-staffel. |
| Twee modules + vragenlijst van €59 | €225,15; twee modules plus één echte afnamelevering. |
| Twee modules + twee verschillende vragenlijsten van €59 | €266,40; juiste 10%-staffel en centverdeling. |
| Bestaand vast profiel los kopen | Zelfde vaste prijs als vóór deze bouw. |
| Product dubbel / verkeerd type / in ontwikkeling via aangepaste URL | Server weigert ongeldige selectie; geen extra korting. |
| Prijs of materiaalstatus verandert tussen quote en bestellen | Vernieuwd overzicht; geen stille afwijking. |
| Betaalbevestiging herhaald | Geen dubbele rechten, afnames of bevestigingsmails. |
| Al gekochte module opnieuw bestellen | Link naar eigen module; geen onbedoelde tweede aankoop. |
| Inloggen vanaf PDF-audiolink | Exacte juiste module en track worden na login geopend. |
| Andere klant / andere module-/track-ID proberen | Geen toegang tot betaald materiaal buiten eigen rechten. |
| Grote MP3-upload onderbroken | Voortgang/herstel bruikbaar; incompleet bestand blijft ongepubliceerd. |
| Uploadtoken of opslagpad door gebruiker gewijzigd | Geen koppeling aan verkeerde module/release of publicatie van ongecontroleerde bytes. |
| Twee beheerders wijzigen hetzelfde concept | Revisieconflict zichtbaar; geen stille overschrijving van een nieuwere publicatie. |
| Nieuwe MP3, nieuwe materiaalversie, gewijzigde slug | Bestaande PDF-audiolinks blijven bruikbaar volgens de versieregels. |
| Verkoop pauzeren | Geen nieuwe order; eerder gerechtigde klant kan materiaal nog openen. |
| Tijdelijke audio-URL verloopt na pauze | Luisterpagina kan opnieuw autoriseren en hervatten; doorspoelen blijft werken. |
| Mail valt uit na betaalbevestiging | Bibliotheek blijft toegankelijk; mailwachtrij kan later opnieuw proberen. |
| 360, 768 en 1280 px, toetsenbord en mobiele browser | Leesbare kaarten, bruikbare PDF-route en audiobediening zonder horizontale overflow. |

Bij implementatie: bestaande `npm run check` en catalogustests; voeg gerichte tests voor gemengde typen, aankooprechten, publicatie en versie-resolutie toe. SQL-regels ook op de doeltestdatabase controleren, niet alleen in de frontend. Een geslaagde build bewijst geen werkende upload, audio of betaalde levering.

## 13. Wat vóór echte verkoop ingevuld moet zijn

| Nodig | Waarom | Voorbereiding kan al? |
|---|---|---|
| Definitieve PDF's en MP3's van modules 1–3 | Echte inhoud leveren en PDF-links testen. | Ja, structuur en conceptbeheer kunnen vooraf. |
| Zes bedoelde covers | Afgerond op 18 oktober: documentbeelden toegevoegd aan overzicht en alle zes detailpagina's. | Aanwezig; behoud vervanging via beheer. |
| Werkelijke doelgroep/leeftijd van modules | Correct informeren, zeker bij combineren met kind-/jongerenvragenlijsten. | Ja, geen leeftijd claimen zolang onbekend. |
| Toegangsduur en wat inbegrepen is aan ondersteuning | Geen levenslange toegang of persoonlijk gesprek suggereren zonder aanbodafspraak. | Ja, veld en tekstpositie reserveren. |
| Correcte fiscale prijsvermelding en voorwaarden voor digitale levering | Aansluiten bij vastgelegde bedrijfsinformatie. | Ja, €89 als aangeleverde basisprijs verwerken; geen fiscale conclusie uit dit bericht trekken. |
| Definitieve publieke origin | Vaste links in de definitieve PDF's moeten naar de juiste website gaan. | Ja, routepatronen en trackcodes voorbereiden. |

Dit zijn voorbereidings- en lanceringsafhankelijkheden. Ze blokkeren het uitwerken of bouwen van de generieke pagina's, beheer- en bestelstroom niet. De planfase verandert geen beschikbaarheid en vult ontbrekende commerciële of inhoudelijke feiten niet zelf in.

## 14. Operationeel terugzetten

Houd een publicatie van materiaal en het inschakelen van verkoop gescheiden. Bij een fout eerst nieuwe verkoop pauzeren; herstel zo nodig de vorige gepubliceerde materiaalversie voor bestaande kopers. Behoud orderregels, aankooprechten en bestaande module-/audiolinks. Verwijder geen verkochte producten of bestanden als herstelactie.

Leg na de daadwerkelijke bouw en doelomgevingstest de uitgevoerde migraties, gebruikte materiaalversies, rekenvoorbeelden en afleverproef vast in een kort modulerunbook. Dit bouwplan blijft tot die tijd een specificatie, geen bewijs van live werking.
