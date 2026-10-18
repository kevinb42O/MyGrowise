# Enkelvoudige vragenlijsten — implementatieplan

**Datum:** 18 oktober 2026.  
**Status:** lokaal geïmplementeerd en getest op 18 oktober 2026; additieve catalogusmigratie en import van alle 22 teksten toegepast op het gekoppelde Supabase-project. Websitecode vanuit deze taak nog niet naar Vercel gedeployed. Zie [beheer en verificatie](QUESTIONNAIRE-LANDINGS-RUNBOOK.md). De onderstaande uitwerking bewaart het oorspronkelijke plan.  
**Bron:** de 22 aangeleverde landingspaginateksten en algemene toelichting, integraal bewaard in [enkelvoudige-vragenlijsten-brontekst.txt](content/enkelvoudige-vragenlijsten-brontekst.txt).  
**Bewijsgrens:** tijdens uitvoering zijn de gekoppelde catalogus, migratiestatus en alle 22 geïmporteerde inhoudsobjecten gecontroleerd. De browsercontrole betreft de lokale website. Instrumentbeschrijvingen, leeftijden en prijzen volgen de aangeleverde bron; dit is geen nieuwe inhoudelijke beoordeling van de instrumenten.

## 1. Beoogd resultaat

Maak van het bestaande aanbod 22 volledige landingspagina’s met een herkenbare, gedeelde opbouw. Bezoekers vinden via `/vragenlijsten` een passende ingang en zien op iedere detailpagina wat de vragenlijst onderzoekt, voor wie deze bedoeld is, wie invult, wat zij ontvangen en wat de prijs is.

Gebruik de bestaande catalogus, product-ID’s, routes, samensteller, checkout en afnamelevering. De teksten beschrijven het aanbod; deze implementatie bouwt geen nieuwe vragenlijstafname, scoring of automatische rapportgeneratie. De bestaande professioneel beheerde afname en verslaglevering blijven de uitvoeringsbasis.

Sluit visueel aan op MyGrowise: crème, donkergroen, zachtroze, serifkoppen en rustige leesbare secties. Stem gedeelde componenten af op het afzonderlijke [profielenplan](PROFIELEN-LANDINGSPAGINA-PLAN.md), dat eveneens een voorstel is. De uitvoering daarvan is geen voorwaarde om deze 22 pagina’s te realiseren.

## 2. Wat al bestaat en wat moet veranderen

| Onderdeel | Aanwezig in lokale code | Benodigde verandering |
|---|---|---|
| Overzicht | `/vragenlijsten`, zoeken, thema- en doelgroepfilter | Kaartteksten aanscherpen, detailactie duidelijker maken, algemene brontekst toevoegen. |
| Detailroute | `src/pages/vragenlijsten/[slug].astro` | Bestaande route hergebruiken voor alle 22 records. |
| Detailweergave | `ProductDetail.astro`, gedeeld met profielen | Een vragenlijstweergave toevoegen met de volledige inhoudsstructuur. |
| Catalogusdata | `products`, `catalog_details`, `catalog_components` | Gestructureerde landingspagina-inhoud toevoegen; bestaande relaties behouden. |
| Beheer | `CatalogEditor.astro`, validator en `save_catalog_product` | Nieuwe inhoudsvelden bewerkbaar maken en atomair bewaren. |
| Bestellen | `/bestellen?vragenlijsten=<product-id>` | Vanuit de nieuwe pagina koppelen en werking controleren. |
| Combineren | `/samenstellen?voegtoe=<product-id>` | Behouden en controleren op alle nieuwe pagina’s. |
| Metadata | Titel, omschrijving, canonical en social tags in `MainLayout` | Per vragenlijst relevante titel en korte omschrijving invullen. |

De bestaande seed bevat 22 losse instrumenten. De huidige detailpagina toont voornamelijk `summary`, `description`, `includesText` en `deliveryText`; daarmee worden de inhoudelijke secties uit de nieuwe bron nog niet afzonderlijk weergegeven.

## 3. Inhoud en productmapping

Onderstaande slugs zijn de bestaande sleutels uit de seed. Match tijdens uitvoering eerst met de werkelijke doelcatalogus en leg vervolgens de product-ID’s vast. Als een beheerder een slug al wijzigde, moet dezelfde bestaande product-ID worden gebruikt.

| Instrument | Bestaande slug | Leeftijd/doelgroep uit nieuwe bron | Prijs |
|---|---|---|---:|
| HiPIC | `hipic` | 6–13 jaar | €79 |
| Piers-Harris 3 | `piers-harris-3` | 8–17 jaar | €59 |
| NEO-PI-3 | `neo-pi-3` | Vanaf 16 jaar | €99 |
| TSCYC | `tscyc` | 3–12 jaar | €69 |
| TSCC | `tscc` | 8–16 jaar | €69 |
| TSI-2 | `tsi-tsi-2` | Vanaf 18 jaar | €69 |
| FEEL-KJ | `feel-kj` | 8–18 jaar | €69 |
| FEEL-E | `feel-e` | Vanaf 18 jaar | €69 |
| Conners | `conners` | 6–18 jaar; afhankelijk van versie/invuller | €69 |
| BRIEF-2 | `brief-2` | 5–18 jaar; afhankelijk van versie/invuller | €69 |
| BRIEF-A | `brief-a` | 18–65 jaar | €69 |
| SRS-2 | `srs-2` | 2,5–18 jaar; afhankelijk van versie | €69 |
| SRS-A | `srs-a` | Vanaf 18 jaar | €69 |
| SPM-2 | `spm-2` | Kinderen, jongeren en volwassenen; versieafhankelijk | €69 |
| CERQ | `cerq` | Vanaf 18 jaar | €59 |
| CISS | `ciss` | Vanaf 18 jaar | €59 |
| RS-NL | `rs-nl` | Vanaf 18 jaar | €59 |
| OBOI | `oboi` | Werkende volwassenen vanaf 18 jaar | €59 |
| BIP-6F-X | `bip-6f-x` | Vanaf 18 jaar | €109 |
| SDS | `sds` | Vanaf 15 jaar | €69 |
| CDI-2 | `cdi-2` | 8–21 jaar | €59 |
| Mini-SCL | `mini-scl` | Vanaf 12 jaar | €49 |

### Verschillen expliciet verwerken

- **TSI-2:** de seed gebruikt nog de titel/versie “TSI / TSI-2”. De nieuwe pagina moet TSI-2 beschrijven. Controleer of de operationele afname daarmee overeenkomt. Behoud bij voorkeur de bestaande slug `tsi-tsi-2` en product-ID; een URL-wijziging is niet nodig om de juiste titel te tonen. De interne kostnotitie betreft mogelijk TSI en wordt niet automatisch herschreven.
- **SPM-2:** vervang de oude vaste leeftijdsweergave “2–80 jaar” door de versieafhankelijke formulering uit de bron. Leid geen exacte geschiktheid af uit een onbepaalde leeftijdsrange.
- **Doelgroepen:** NEO-PI-3, SDS en Mini-SCL omvatten minderjarigen én volwassenen; CDI-2 loopt tot 21 jaar. Controleer dat doelgroepfilters deze producten niet onbedoeld uitsluiten.
- **Invullers:** behoud onderscheid tussen ouder/informant, zelfrapportage en lijsten met meerdere mogelijke versies. De koper is niet automatisch degene over wie het verslag gaat.
- **Terminologie:** corrigeer alleen evidente taal- en spelfouten, zoals “Autismenspectrumgerelateerde”, zonder inhoudelijke betekenis te wijzigen. Behoud bron en redactionele wijziging apart.
- **Versiegebonden informatie:** behoud de voorwaarden bij onder meer Conners, BRIEF-2, SRS-2, SRS-A, SPM-2 en de seksuele zorgen in TSCC. Geen stelliger claims toevoegen.

## 4. Opbouw van de overzichtspagina

1. **Korte introductie:** H1 “Welke vragenlijst past bij jouw vraag?”, gevolgd door een beknopte uitleg over gericht inzicht voor jezelf of je kind.
2. **Informatierij:** “Online vragenlijst · Persoonlijk verslag · Eenmalige prijs”. Direct daarbij een korte afbakening: bedoeld voor zelfinzicht en, waar relevant, screening; geen diagnostisch onderzoek.
3. **Bestaande zoek- en filterfuncties:** gebruik herkenbare thema’s, bijvoorbeeld persoonlijkheid en zelfbeeld, ingrijpende ervaringen, emoties en coping, aandacht en executieve functies, sociale communicatie en prikkelverwerking, werk en loopbaan, stemming en welzijn. De themakeuze zegt niets over een diagnose.
4. **22 compacte kaarten:** instrument + beschrijvende titel, korte herkenbare omschrijving, doelgroep/leeftijd, prijs, “Bekijk vragenlijst” en de bestaande toevoegactie. Volledige teksten staan op de detailpagina.
5. **Algemene uitleg uit de bron:** drie leesbare blokken “Wetenschappelijk onderbouwde instrumenten”, “Geen diagnostisch onderzoek” en “Volledig online”.
6. **Hulp bij kiezen:** link naar `/contact`, met daarnaast de bestaande routes naar vaste profielen en zelf samenstellen.

De huidige doelgroepfilter zoekt woorden in `audience`. Vervang dat voor deze instrumenten door expliciete doelgroepcodes (`children`, `adolescents`, `adults`) op basis van de bron, met behoud van het leesbare leeftijdslabel. Laat die filter geen geschiktheidsadvies geven. Leg de indeling per instrument vast en controleer de grensgevallen hierboven.

Houd de bestaande afbeeldingen als uitgangspunt. Tweeëntwintig nieuwe afbeeldingen zijn geen afhankelijkheid voor deze inhoudsuitbreiding.

## 5. Gedeelde landingspagina

Gebruik één vragenlijsttemplate met deze volgorde:

1. **Introductie:** teruglink, volledige titel uit de bron, herkenningsvraag, doelgroep/leeftijd, invuller, online vorm, soort verslag, prijs en primaire bestelknop.
2. **Herkenbare situatie:** de inleidende alinea’s uit de aangeleverde tekst, met behoud van aanspreekvorm voor ouder of deelnemer.
3. **Wat brengt deze vragenlijst in kaart?** De volledige bronopsomming als echte HTML-lijst.
4. **Wat mag je verwachten?** De brontekst over afname, verslag en het doel van het inzicht.
5. **Belangrijk:** de volledige instrumentspecifieke disclaimer zichtbaar op de pagina. De algemene uitleg onderaan vervangt deze tekst niet.
6. **Na je bestelling:** de bestaande, feitelijke instructie over betalingsbevestiging, voorbereiding van de afname en levering via het account. Houd dit apart van de inhoudelijke verwachtingen.
7. **Afsluitende actie:** opnieuw prijs en “Kies deze vragenlijst”, “Voeg toe aan een combinatie” en een contactlink.

Toon geen invultijd, levertijd, consult, directe toegang of automatisch rapport als dat niet is vastgelegd in het aanbod. NEO-PI-3 krijgt expliciet “Uitgebreid persoonlijk verslag”; TSCYC “Online oudervragenlijst”.

Op mobiel volgt de leesvolgorde de inhoud. Gebruik geen vaste balk die tekst of disclaimer bedekt. Eén H1, logische H2-koppen, voldoende contrast en zichtbare toetsenbordfocus horen bij de uitwerking.

## 6. Technisch voorstel en beheer

### Catalogus als inhoudsbron

Voeg additief `landing_content jsonb` en `audience_groups text[]` toe aan `catalog_details`. Gebruik voor `landing_content` een expliciet getypeerde structuur:

```ts
type QuestionnaireLandingContent = {
  schemaVersion: 1;
  question: string;
  introduction: string[];
  measures: string[];
  expectations: string[];
  disclaimer: string;
  respondentLabel: string;
  formatLabel: string;
  reportLabel: string;
};
```

Behoud `products.title`, `summary`, `price_cents`, `catalog_details.age_label`, `version`, `delivery_text`, status en beschikbaarheid als bestaande velden. Sla de prijs niet nogmaals op in de landingspagina-inhoud. De drie algemene uitlegblokken kunnen als gedeelde sitecontent in `src/content` staan; een aparte CMS-module is hiervoor niet nodig.

Render gewone tekst en lijsten via Astro. Een HTML-editor of ongefilterde HTML is niet nodig. Valideer de structuur, toegestane doelgroepcodes, arraylengtes en tekstlengtes zowel bij beheerinvoer als in de opslagfunctie.

### Wijzigingen in code

| Bestand/onderdeel | Werk |
|---|---|
| Nieuwe additieve Supabase-migraties | Velden/constraints, opslagfunctie en gecontroleerde inhoudsimport toevoegen. Oude migraties niet herschrijven. |
| `src/lib/catalog/server.ts` | Nieuwe publieke velden selecteren en mappen; interne kosten en notities blijven buiten publieke props. |
| `src/lib/supabase/database.types.ts` | Gegenereerde types actualiseren als het schema wijzigt. |
| `src/lib/catalog/admin.ts` | Nieuwe inhoud en doelgroepcodes valideren. |
| `src/components/catalog/CatalogEditor.astro` | Benoemde invoervelden toevoegen; lijstpunten/alinea’s als bewerkbare regels, geen ruwe JSON. |
| `save_catalog_product` en save-endpoint | Nieuwe velden in dezelfde transactie opslaan met bestaande rechten en auditgedrag. Ontbrekende nieuwe velden uit oudere aanroepen mogen bestaande inhoud niet wissen. |
| Nieuw `QuestionnaireDetail.astro` | Volledige vragenlijsttemplate; hergebruik bestaande stijlen en bestelacties. |
| `src/pages/vragenlijsten/[slug].astro` | Nieuwe template aanroepen; bestaande aliasafhandeling behouden. |
| `CatalogPage.astro` / `CatalogExplorer.tsx` | Intro, kaartactie, algemene uitleg en gestructureerde doelgroepfilter. Nieuwe logica voor vragenlijsten afbakenen van de profielweergave. |
| Gedeelde catalogusstijlen | Leesbare inhoudssecties en responsive kaarten. |

De profielroutes blijven hun bestaande template gebruiken. Als tijdens uitvoering een gedeeld element wordt aangepast, controleer ook de profielpagina’s en samensteller. De oude inhoudsvelden blijven bruikbaar als terugval wanneer een product nog geen geldige nieuwe landingspagina-inhoud heeft.

### Gecontroleerde inhoudsimport

1. Lees de 22 bestaande records en vergelijk ID, slug, titel, leeftijd, versie, prijs en status met de bron. Leg afwijkingen vast vóór het importeren.
2. Maak één expliciete, controleerbare mapping van bronnummer naar bestaande product-ID. Stop bij ontbrekende of dubbele matches; maak geen duplicaten aan.
3. Bewaar de oude waarden voor herstel. Importeer alleen afgesproken publieke inhoud en doelgroepcodes; behoud interne kosten, productrelaties, beelden en sortering tenzij een concrete wijziging nodig is.
4. Vergelijk prijzen met de bron. Ze komen in de bestaande seed overeen, maar de doelcatalogus kan sindsdien aangepast zijn. Neem afwijkingen op in de importreview voordat een prijs wordt bijgewerkt.
5. Voer de import transactioneel uit, met controles op de verwachte oude waarden zodat recente beheerwijzigingen niet stil worden overschreven. Herhaald uitvoeren mag geen records of relaties dupliceren en geen latere redactie terugzetten.
6. Laat `updated_at` correct meelopen zodat een open checkout opnieuw kan worden gecontroleerd. Bestaande orderregels en aankoopsnapshots blijven historische gegevens.
7. Verander publicatie of beschikbaarheid niet automatisch door tekstimport. Beoordeel eventuele operationele versieverschillen per betrokken product.

Behoud de huidige toegangsrechten en RLS-opzet. Een uitbreiding met publieke marketinginhoud vraagt geen bredere toegang tot afnames, rapporten of interne kosten.

## 7. Uitvoeringsvolgorde

| Fase | Concreet resultaat | Afhankelijkheid |
|---|---|---|
| 1. Bron en mapping | Alle 22 teksten gestructureerd; verschillenlijst voor catalogus, versie en doelgroep | Read-only controle van de doelcatalogus. |
| 2. Datamodel en beheer | Additief schema, getypeerde velden, validatie, opslag en beheerformulier | Vastgestelde inhoudsstructuur uit fase 1. |
| 3. Proefpagina’s | HiPIC, NEO-PI-3 en SPM-2 in dezelfde nieuwe template | Fase 2; deze drie dekken ouderrapportage, uitgebreid verslag en versieafhankelijke doelgroep. |
| 4. Volledige inhoud en overzicht | Alle 22 pagina’s, complete disclaimers, filterverbetering en algemene toelichting | Proefpagina’s inhoudelijk en visueel gecontroleerd. |
| 5. Integratiecontrole | Bestellen, combineren, beheer en terugvalgedrag gecontroleerd | Fase 4 en testdatabase met de migraties. |
| 6. Publicatie en nacontrole | Gemigreerde doelomgeving, deployment en steekproef op gepubliceerde routes | Gecontroleerde preview en herstelmogelijkheid. |

**Werkinschatting:** ongeveer 3–5 werkdagen inclusief inhoudsverwerking, beheeruitbreiding, responsive uitwerking en controle, uitgaande van de bestaande afname- en betaalstroom. Nieuwe uitgeversintegraties, nieuw beeldmateriaal of inhoudelijke herziening van instrumentversies vallen buiten die inschatting.

## 8. Acceptatie en verificatie

- Alle 22 brononderdelen zijn terug te vinden op de juiste detailpagina: volledige titel, herkenningsvraag, doelgroep, introductie, alle meetdomeinen, verwachtingen, afbakening en prijs.
- Er zijn 22 bestaande producten verrijkt; product-ID’s en pakketrelaties zijn behouden. Gepauzeerd, concept en in ontwikkeling aanbod krijgen geen bestelbare actie.
- De specifieke beperkingen blijven zichtbaar: onder meer geen ADHD-diagnose bij Conners, geen PTSS-diagnose bij TSI-2, geen autismediagnose bij SRS en geen zelfstandige geschiktheidsbeslissing bij BIP-6F-X en SDS. De aanvullende tekst bij CDI-2 blijft behouden.
- Doelgroepfilters worden gecontroleerd op alle 22 instrumenten, met bijzondere aandacht voor NEO-PI-3, SDS, CDI-2, Mini-SCL en SPM-2. Een filteruitslag wordt niet gepresenteerd als individueel geschiktheidsadvies.
- De koopknop bestelt precies het bedoelde product. De combinatieactie voegt hetzelfde product maximaal één keer toe. De server blijft prijs en beschikbaarheid bepalen.
- Nieuwe beheerinhoud blijft na opslaan en herladen behouden. Niet-bevoegde gebruikers kunnen niet opslaan; publieke data bevatten geen interne kosten of reviewnotities.
- Een product zonder nieuwe landingspagina-inhoud blijft leesbaar via de bestaande velden. Profielpagina’s, profielprijzen en pakketinhoud blijven werken.
- Controleer mobiel (circa 375 px), tablet en desktop, inclusief de langste titels en lijsten, toetsenbordbediening, koppenstructuur en links zonder JavaScript op detailpagina’s.
- Controleer unieke titel/omschrijving, canonical en correcte interne links. Er is geen URL-wijziging nodig; bij een bewuste wijziging moet de bestaande 301-alias aantoonbaar werken.

Voer tijdens de implementatie `npm run check` en `npm run test:catalog` uit. Breid gerichte controles uit voor de nieuwe inhoudsvalidatie, beheeropslag en doelgroepfilter. Gebruik `npm run test:catalog:db` op een geschikte testomgeving voor de bestaande en nieuwe databasecontroles; het huidige script rolt zijn testtransactie terug. Voer bij schema- of rechtenwijzigingen ook de toepasselijke Supabase-controles uit.

Test de publiek zichtbare afnamebelofte tegen de bestaande accountflow: instructies na betalingsbevestiging, afnamelink en private rapportlevering. Lokale tests bewijzen geen aflevering of configuratie in productie.

## 9. Publicatie en herstel

Pas eerst het additieve schema en de opslagfunctie toe, daarna de compatibele applicatiecode, vervolgens de gecontroleerde inhoudsimport. Controleer vóór import de actuele migratiestatus en maak een herstelbare kopie van de getroffen records. Bewaar bestaande statussen; tekstverrijking hoeft geen herpublicatie van alle producten te veroorzaken.

Controleer na deployment de overzichtspagina, de drie proefinstrumenten, TSI-2 en de route naar bestellen/combineren. Als de weergave faalt kan de vorige applicatieversie terug, omdat de schemawijziging additief is. Als inhoud moet worden hersteld, zet alleen de getroffen publieke velden terug uit de bewaarde waarden en controleer op intussen aangebrachte beheerwijzigingen. Bestellingen, afnames en betaalgegevens worden daarbij niet teruggedraaid.

**Eerste uitvoeringsstap:** controleer de 22 productmatches in de doelcatalogus en maak de gestructureerde inhoudsmapping. Daarna volgen de beheeruitbreiding en de drie proefpagina’s.
