# Modules — betekenis van de briefing en uitvoeringsplan

**Datum:** 18 oktober 2026.  
**Status:** briefing uitgewerkt en modulefunctionaliteit geïmplementeerd in de lokale checkout op 18 oktober 2026. De gekoppelde database is uitgebreid; er is geen website-deployment uitgevoerd en alle modules blijven in ontwikkeling. Zie [beheer en verificatie](MODULES-RUNBOOK.md).  
**Bron:** het door Kevin doorgestuurde bericht van de inhoudelijke eigenaar, met zes modulebeschrijvingen. De publieksinhoud is bewaard in [modules-brontekst.md](content/modules-brontekst.md).  
**Onderzoek:** lokale modulepagina, catalogus, prijsberekening, checkout, bibliotheek en migratiebestanden gelezen. De live catalogus, uploads en productiestatus zijn niet opgevraagd.

**Vervolg:** op verzoek van Kevin verder uitgewerkt in [MODULES-BOUWPLAN.md](MODULES-BOUWPLAN.md), met schermindeling, beheerproces, datamodel, routes, bouwvolgorde en gerichte acceptatiescenario's. Het bouwplan is uitgevoerd met de bestaande centrale kortingsstaffel voor modules en vragenlijsten. De verkoop van modules is nog niet ingeschakeld.

## 1. Wat zij waarschijnlijk bedoelt

Zij wil zes afzonderlijk te kopen digitale zelfstudiemodules aanbieden, onder de gezamenlijke titel **Ontdek jouw innerlijke landschap**. Iedere module bestaat uit een PDF met uitleg en oefeningen, plus bijbehorende MP3-audio. De landschapsnamen zijn de zes moduletitels. De tekst eronder is geschikt als publieke aanbodomschrijving; de feitelijke lesinhoud en hoofdstukindeling van de PDF's zijn hiermee nog niet aangeleverd.

De reeks heeft een aanbevolen volgorde, maar modules zijn zelfstandig te volgen. Een klant hoeft eerdere modules niet te kopen, af te ronden of te kunnen openen voordat een andere module beschikbaar wordt.

De prijs is **€89 per module**. Haar voorbeeld “2 modules en 1 vragenlijst” betekent dat modules moeten kunnen meetellen in dezelfde combinatiekorting als losse vragenlijsten. Dit is een uitbreiding op het bestaande vragenlijstenaanbod.

Zij wil modules 1, 2 en 3 als eerste beschikbaar tonen, en werkt nog aan het materiaal. Dat is de gewenste lanceringsvolgorde, geen bewijs dat de bestanden al gereed, geüpload of getest zijn.

## 2. Duidelijke wensen, interpretaties en ontbrekende informatie

| Onderwerp | Wat het bericht vastlegt | Uitwerking / bewijsgrens |
|---|---|---|
| Aantal | Zes modules | Zes productpagina's, met een gezamenlijke overzichtspagina. |
| Prijs | €89 per module | Geen abonnementsprijs. Btw-aanduiding volgt de bevestigde verkoopinrichting; die staat niet in dit bericht. |
| Volgorde | Logisch opgebouwd, zelfstandig te volgen | Nummering als routeaanwijzing; geen verplichte cursusvolgorde. |
| Eerste beschikbaarheid | Modules 1, 2 en 3 | Klaarzetten voor eerste lancering; pas verkopen zodra het materiaal werkelijk leverbaar is. |
| Overige modules | Zes uitgewerkt als aanbod, zij maakt de inhoud nog | Voorstel: 4–6 zichtbaar met “In ontwikkeling”, zonder bestelknop of beloofde datum. |
| Inhoud | PDF en MP3, uitleg en oefeningen | Ondersteun meerdere audiobestanden per module. Aantal, namen en duur zijn nog onbekend. |
| Audiolink | Vanuit de PDF naar de audio | Vast websiteadres naar de juiste audio in de eigen moduleomgeving. |
| Korting | Combineren met vragenlijsten moet meetellen | Voorstel: bestaande 5%/10%-staffel uitbreiden; haar bericht noemt geen nieuwe percentages. |
| Alleen modules combineren | Niet letterlijk afzonderlijk uitgelegd | Logische uitbreiding: ook twee verschillende modules tellen samen. Dit blijft een voorgestelde productregel. |
| Foto's | Zij zegt dat ze erbij staan | In het doorgestuurde bericht staan lege tabellen, geen zichtbare beelden; de zes definitieve modulebeelden zijn niet aangetroffen in de huidige projectbeelden. |
| Toegangsduur/doelgroep | Niet vermeld | Geen levenslange toegang, einddatum, leeftijdsgeschiktheid of begeleiding beloven. Voor verkoop vastleggen wat daadwerkelijk geldt. |

## 3. De zes modules

| Nr. | Naam | Ondertitel / functie | Hoofdthema's | Gewenste startstatus |
|---|---|---|---|---|
| 01 | Het Meer | Waar je lichaam spreekt — Herken wat je lichaam je vertelt | Stress, fysiologische stressreacties, lichaamsbewustzijn, signalen, hulpbronnen | Eerste lancering |
| 02 | De Stromingen | De patronen onder het oppervlak — Ontdek hoe jij met stress omgaat | Copingstijlen, automatische stressreacties, gedrag, gedachten en gevoelens | Eerste lancering |
| 03 | De Mist | Wanneer onzekerheid het zicht vertroebelt — Omgaan met angst en piekeren | Angst, piekeren, onzekerheid, controlebehoefte, vermijding | Eerste lancering |
| 04 | Het Evenwicht | Leren bewegen met het water — Begrijp je zenuwstelsel en leer reguleren | Window of Tolerance, hyper-/hypoarousal, ademhaling, hartcoherentie, regulatie | In ontwikkeling |
| 05 | De Bergen | Ontdek hoe jouw landschap gevormd werd — Persoonlijkheid, beschermingsmechanismen en zelfzorg | Persoonlijkheid, nature/nurture, overtuigingen, bescherming, grenzen, zelfzorg | In ontwikkeling |
| 06 | Het Volledige Landschap | Alles krijgt een plaats — Integreren en vooruitkijken | Zelfinzicht, patronen, hulpbronnen, integratie, dagelijks toepassen | In ontwikkeling |

De bestaande modulepagina noemt bij module 1 ademhaling en hartcoherentie. In de nieuwe briefing horen die expliciet bij module 4. Bij het herschrijven de nieuwe inhoud volgen; oude beschrijvingen niet ongemerkt door de nieuwe tekst mengen.

## 4. Voorstel voor de openbare website

### Overzicht `/modules`

1. **Intro:** “Ontdek jouw innerlijke landschap”, met de zin “Zes modules. Zes ontdekkingen. Eén reis naar meer inzicht in jezelf.” en de aangeleverde landschapsintroductie.
2. **Praktische feiten:** €89 per module · PDF met uitleg en oefeningen · bijbehorende audio · zelfstandig te volgen. Vermeld eventuele combinatiestaffel zodra de productregel is vastgesteld en gebouwd.
3. **Eerste drie modules:** drie gelijkwaardige kaarten met beeld, nummer, landschapsnaam, herkenbare inhoudelijke kop, korte omschrijving, prijs en “Bekijk module”. Status “Beschikbaar” uitsluitend voor daadwerkelijk leverbare modules.
4. **Verder in het landschap:** modules 4–6, met dezelfde herkenbare structuur maar status “In ontwikkeling”. Geen mogelijkheid om ze aan een bestelling toe te voegen.
5. **Jouw reis, jouw tempo:** de aangeleverde uitleg over zelfstandig volgen en aanbevolen volgorde.
6. **Zo werkt het:** kiezen → bestellen en betalen → na betaalbevestiging openen in je bibliotheek → PDF lezen en audio beluisteren.

Laat de eerste uitleg over de prijs en inhoud boven het aanbod staan. Gebruik de metafoor voor sfeer en samenhang; de concrete ondertitel maakt duidelijk wat een bezoeker koopt. Een kaart met alleen “De Mist” vertelt daarvoor te weinig.

Dezelfde ritmiek en warme MyGrowise-stijl als in het [profielenplan](PROFIELEN-LANDINGSPAGINA-PLAN.md). Geen toegang tot een eerdere module als voorwaarde voor een latere module. De nummering is geen voortgangsverplichting.

### Detailpagina per module

Voorgestelde routes: `/modules/het-meer`, `/modules/de-stromingen`, `/modules/de-mist`, `/modules/het-evenwicht`, `/modules/de-bergen`, `/modules/het-volledige-landschap`. Controleer bij uitvoering bestaande product-ID's en slugs; maak geen dubbel product als er al een passend record bestaat.

Vaste opbouw: nummer en naam → inhoudelijke ondertitel → herkenning en landschapsintro → wat je verkent → wat je ontvangt (PDF en bijbehorende audio) → zelfstandig volgen → prijs en bestel-/combineeractie. Toon praktische aantallen en speelduur pas wanneer echte bestanden beschikbaar zijn.

Houd de twee aangeleverde ondertitels hiërarchisch: bijvoorbeeld “Het Meer” als naam, “Herken wat je lichaam je vertelt” als prominente uitleg, “Waar je lichaam spreekt” als sfeerregel. Niet drie gelijkwaardige grote koppen achter elkaar.

Verwijder lege exporttabellen en de opmaak waarbij vrijwel alle tekst vet én cursief is. De laatste regel over beeldmateriaal en “Kevin kan ...” is een interne redactionele notitie; die komt niet letterlijk op de website.

## 5. Korting: voorgestelde vertaling van haar voorbeeld

De bestaande, eerder vastgelegde vragenlijstenstaffel is: één item 0%, twee of drie 5%, vier of meer 10%. In de code zijn de instellingen aanpasbaar. Het nieuwe voorstel is dezelfde staffel toe te passen op **verschillende losse modules en vragenlijsten samen**.

Eén module is één item; losse MP3's, PDF's en hoofdstukken binnen een module tellen niet afzonderlijk. Hetzelfde product twee keer toevoegen verhoogt het aantal niet. Alleen gepubliceerde, beschikbare en geprijsde producten tellen mee. Modules 4–6 tellen pas mee wanneer ze echt beschikbaar zijn.

| Voorbeeld | Subtotaal | Voorgestelde korting | Totaal |
|---|---:|---:|---:|
| Eén module | €89,00 | 0% | €89,00 |
| Twee verschillende modules | €178,00 | 5% | €169,10 |
| Eén module + een vragenlijst van €59 | €148,00 | 5% | €140,60 |
| Twee modules + een vragenlijst van €59 | €237,00 | 5% | €225,15 |
| Twee modules + twee verschillende vragenlijsten van elk €59 | €296,00 | 10% | €266,40 |

De vragenlijstprijs van €59 is een rekenvoorbeeld, geen algemene vragenlijstprijs. Deze staffeluitbreiding is inmiddels geïmplementeerd; moduleverkoop blijft uit totdat het materiaal is ingericht. De expliciete wens is dat een gemengde combinatie meetelt; de toepassing op uitsluitend modules en het gebruik van de bestaande percentages zijn de aanbevolen interpretatie.

Vaste profielpakketten behouden hun eerder afgesproken vaste prijs en tellen in dit voorstel niet mee voor extra combinatiekorting. Er is geen nieuwe wens aangeleverd voor modules samen met een vast profielpakket. Voor de eerste versie blijft de bestaande afzonderlijke profielbestelling de route daarvoor.

Zet bij uitvoering in de samensteller “Modules en vragenlijsten” en “producten” waar nu uitsluitend “vragenlijsten” staat. Geef het aantal en type geselecteerde producten, subtotaal, percentage en eindtotaal weer. Een winkelmandje is een aankoopkeuze; het beveelt geen klinisch geschikte combinatie aan.

## 6. PDF en audio: de aanbevolen gebruikersroute

**Na bevestiging van de betaling:** bibliotheek → aangekochte module → PDF openen/downloaden + overzicht van bijbehorende audiotracks met afspeelknoppen.

In de PDF staat bij een oefening een gewone klikbare link, bijvoorbeeld met het zichtbare label **Beluister de audio bij deze oefening**. Die link gaat naar een vast adres in de moduleomgeving. Een eventuele QR-code en uitgeschreven kort adres helpen ook wie de PDF afdrukt.

Gebruik een stabiele route met een module- en audiosleutel, bijvoorbeeld `/account/modules/het-meer/audio/oefening-1` als patroon. Deze voorbeeldnaam zegt niets over de nog onbekende werkelijke oefeningen. Bij openen:

1. Inloggen als de klant nog niet is aangemeld; terugkeren naar precies dezelfde audiopagina.
2. Controleren of deze klant actieve toegang heeft tot de betreffende module.
3. Controleren of deze track bij die module hoort en gepubliceerd is.
4. De juiste MP3 in een eenvoudige speler openen, met afspelen, pauzeren, tijdpositie en zoeken binnen het bestand. Geen automatisch afspelen.

De permanente PDF-link bevat **geen tijdelijk opslagadres**. Een tijdelijke bestandslink in een gedownloade PDF verloopt en maakt de PDF later onbruikbaar. De website kan na elke toegangscontrole opnieuw tijdelijke bestandstoegang regelen. Supabase ondersteunt private bestanden en tijdelijk geldige links; de bestaande rapportdownload gebruikt al een vergelijkbaar patroon. Zie [Storage-documentatie](https://supabase.com/docs/guides/storage/serving/downloads) en [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Een audiolink opent een aparte luisterpagina; audio wordt niet in de PDF ingebouwd. De modulepagina biedt daarnaast altijd alle audiotracks aan, zodat de klant niet afhankelijk is van hyperlinks in een bepaalde PDF-lezer. Zonder internet werkt een link naar de luisterpagina niet; beloof daarom geen offline audio zolang audiobestanden niet ook downloadbaar worden aangeboden.

Stem bij uitvoering de geldigheid van tijdelijke links af op audiolengte en doorspoelen. Een klant mag niet halverwege een lange oefening vastlopen door verlopen toegang. Test afspelen, hervatten en byte-range/seekgedrag in de gekozen leverwijze. Houd toegang bij nieuwe aanvragen afhankelijk van de actuele aankooprechten; een al uitgegeven tijdelijke link blijft tot de vervaltijd bruikbaar.

## 7. Uploaden en beheren

Per module heeft het beheer nodig: product-ID, nummer, naam, ondertitels, publieksbeschrijving, kernonderwerpen, prijs, publicatiestatus, beschikbaarheid, omslagfoto, PDF en een geordende lijst met audio. Per track: stabiele sleutel, titel, bestand, volgorde en eventueel bijbehorend hoofdstuk/paginanummer. Duur kan na verwerking van het bestand worden vastgelegd.

Upload PDF en MP3 apart. Zij hoeft de MP3 niet in de PDF te stoppen en geen openbare opslaglink te bedenken. De site levert de vaste audiolinks, die zij in haar PDF kan opnemen. Bewaar modules en audio in private opslag, los van persoonlijke diagnostische rapporten. Marketingbeelden mogen als normale publieke websitebeelden worden geleverd.

Bij het vervangen van een MP3 blijft de audiosleutel en daarmee de PDF-link gelijk. Gebruik een nieuwe bestandsversie, zodat bestaande caches geen oud materiaal blijven aanbieden. Een gepubliceerde track verwijderen terwijl een verkochte PDF ernaar verwijst vraagt een bewuste vervanging of uitleg op de bestaande route.

Voorgestelde publicatieregel: “Beschikbaar” vereist minimaal een definitieve PDF, alle daarin genoemde werkende audiotracks en een gecontroleerde klantweergave. Een conceptupload of een betaalbare productprijs alleen maakt een module niet leverbaar.

## 8. Uitgangssituatie vóór de implementatie

| Onderdeel | Lokale bevinding | Benodigde uitbreiding |
|---|---|---|
| Modulepagina | `src/pages/modules.astro` is statisch; alles staat op “Binnenkort”. | Nieuwe zesdelige reeks en echte beschikbaarheid. |
| Producttype | `src/lib/adminProducts.ts` ondersteunt `module`. | Catalogusdetails, modulemateriaal en beheer aan dit bestaande type koppelen. |
| Openbare catalogus | `src/lib/catalog/server.ts` selecteert alleen `profile` en `questionnaire`. | Ook modules opnemen met passende openbare metadata. |
| Samensteller | `CatalogExplorer.tsx` selecteert uitsluitend losse vragenlijsten; opslag heet `mg-questionnaires`. | Eén selectie voor modules en vragenlijsten, inclusief bestaande selecties zorgvuldig overnemen. |
| Serverprijs | Laatste lokale `catalog_quote` accepteert in `custom` alleen `questionnaire`. | Toegestane typen expliciet uitbreiden; dezelfde staffel servermatig berekenen. |
| Beheer opslaan | `save_catalog_product` accepteert alleen profielen/vragenlijsten. | Modules veilig opslaan en uploadpublicatie ondersteunen. |
| Checkout | `/bestellen` gebruikt de bestaande catalogusquote; URL/teksten noemen vragenlijsten en afnames. | Gemengde aankoop ondersteunen en neutrale bestelling-/bibliotheektaal gebruiken. Bestaande links blijven werken. |
| Betaalbevestiging | Bestaande bevestigingsfunctie kan aankooprechten aan orderregels koppelen. | Controleren dat modules ook in gemengde orders correct en eenmaal toegang krijgen. |
| Afnamelevering | `assessment_deliveries` wordt alleen voor profiel-/vragenlijstregels gemaakt. | Modules eigen materiaaltoegang geven; geen fictieve vragenlijstafname aanmaken. |
| Bibliotheek | Huidige inhoud richt zich op afname-instructies en rapporten; overige productrechten leiden vooral naar een publieke productpagina. | Gekochte module opent naar PDF en audio; duidelijk verschil tussen “Mijn modules” en “Mijn afnames”. |
| Bestanden | Private rapportdownload met eigendomscontrole en tijdelijke link bestaat. | Afzonderlijke modulebestanden, audioafspelen en toegangscontrole per module/track. |

Het is dus meer dan landingspaginatekst vervangen. De presentatie kan worden voorbereid met de aangeleverde teksten; echte verkoop vraagt ook de uitbreiding van catalogus, gemengde checkout en modulelevering. Hergebruik de bestaande orders, betaalcontrole en aankooprechten, met aparte materiaalweergave voor modules.

## 9. Uitvoeringsvolgorde

1. **Inhoud structureren:** zes modules vastleggen met nieuwe tekst, definitieve beelden koppelen zodra beschikbaar. Geen onjuiste beschikbaarheidsclaim.
2. **Prijsregel afronden:** bestaande staffel uitbreiden zoals hierboven voorgesteld en de toepassing op uitsluitend modules vastleggen voordat die commercieel wordt aangeboden.
3. **Bestandsmodel en beheer:** PDF + audiolijst, stabiele sleutels, privéopslag en publicatiecontrole.
4. **Gemengde aankoop:** modules opnemen in catalogus, samensteller, serverquote en order; de vaste profielprijzen behouden.
5. **Klantlevering:** bibliotheek, modulepagina, PDF-download en audiopagina met aankoopcontrole en inlogterugkeer.
6. **Eerste drie lanceren:** pas nadat de echte inhoud is geplaatst en één volledige proef van aankoop tot PDF/audiolink slaagt. Modules 4–6 blijven in ontwikkeling tot hun eigen materiaal gereed is.

## 10. Acceptatiepunten voor de bouw

- Zes beschrijvingen volgen de aangeleverde tekst; alleen werkelijk leverbare modules hebben een bestelknop.
- Elke module kost los €89; module 2 of 3 kan zonder module 1 worden gekocht en geopend.
- Twee modules + één vragenlijst tellen als drie kortingsitems, volgens de vastgelegde staffel.
- Dubbelen, concepten, modules in ontwikkeling, bestandsonderdelen en vaste profielcomponenten verhogen de korting niet.
- Prijsweergave en serverquote komen op de cent overeen; tussentijdse prijs-/statuswijzigingen worden opnieuw gecontroleerd.
- Een gemengde betaalde bestelling levert moduletoegang én passende vragenlijstafnames; een onbetaalde bestelling geeft geen nieuw toegangsrecht voor een module.
- Rechtstreekse PDF-, module- en audioadressen zonder eigen aankoop geven geen toegang tot betaald materiaal.
- Toegang wordt aan product-ID en actieve aankooprechten gekoppeld; niet aan een overeenkomende titel.
- Een PDF-audiolink opent na een verse login exact de goede audio. Een andere track-ID gebruiken om buiten de aankoop te komen werkt niet.
- Dezelfde PDF-link werkt na vervanging van het audiobestand; een verwijderde/ongepubliceerde track geeft een begrijpelijke melding.
- Mobiel: PDF downloaden, MP3 afspelen/pauzeren en doorspoelen getest. Geen verlopen-linkfout tijdens de beoogde sessie.
- Huidige losse vragenlijsten, vaste profielen, prijsregels en bestaande klanttoegang blijven werken.
- Geen beloften over toegangstermijn, begeleiding, certificaten, behandelresultaten of geschiktheid die niet uit het werkelijk geleverde aanbod volgen.
