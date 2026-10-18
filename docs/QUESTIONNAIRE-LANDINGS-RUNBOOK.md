# Enkelvoudige vragenlijsten — beheer en verificatie

**Datum:** 18 oktober 2026.  
**Status:** websitecode lokaal geïmplementeerd en getest. Migratie `20261018162030_questionnaire_landing_content` en de inhoudsimport van 22 bestaande producten zijn toegepast op het gekoppelde Supabase-project. Vanuit deze wijziging is geen Vercel-deployment uitgevoerd.

## Wat is toegevoegd?

- Eén gedeelde detailtemplate voor de 22 vragenlijsten, met volledige introductie, meetdomeinen, verwachtingen, invuller, verslagvorm en instrumentspecifieke afbakening.
- Een compactere introductie op `/vragenlijsten`, een expliciete detailactie op de kaarten en de drie algemene uitlegblokken uit de bron.
- Gestructureerde doelgroepcodes voor het overzicht en de samensteller. Kinderen betekent hier tot en met 11 jaar; jongeren 12–17; volwassenen vanaf 18. Een leeftijdsbereik kan meerdere groepen raken, ook als het instrument in de titel kinderen/jongeren noemt. De exacte leeftijd en eventuele versiebeperking blijven zichtbaar op de productpagina.
- Bewerkbare velden in **Verkoop → Vragenlijsten & profielen**, onder **Landingspagina voor een losse vragenlijst**. Deze zijn alleen actief voor losse vragenlijsten.
- Databasevalidatie voor volledige inhoud, toegestane doelgroepcodes en bestaande rollen. Een oudere beheeraanroep zonder nieuwe velden bewaart de nieuwe inhoud.

De oorspronkelijke [brontekst](content/enkelvoudige-vragenlijsten-brontekst.txt) is ongewijzigd bewaard. De [gestructureerde importbron](content/questionnaire-landings.json) bewaart de 22 teksten en hun expliciete catalogusmapping. De enige redactionele correctie binnen de inhoudelijke bronopsommingen is “Autismenspectrumgerelateerde” → “Autismespectrumgerelateerde” bij SRS-A.

## Dagelijks beheer

Open een losse vragenlijst in `/admin/vragenlijsten`. Naam, korte omschrijving, leeftijd, versie, prijs en beschikbaarheid blijven hun bestaande velden. De nieuwe sectie bevat de herkenningsvraag, invuller, afnamevorm, soort verslag, introductie, meetdomeinen, verwachtingen en afbakening.

Gebruik één alinea of meetdomein per regel in de meerregelige velden. Voor een volledige pagina moeten alle inhoudsvelden gevuld zijn en minstens één doelgroep gekozen zijn. De limieten zijn 12 introductiealinea’s, 24 meetdomeinen, 12 verwachtingsalinea’s en 2000 tekens per alinea/lijstpunt. De korte labels hebben een eigen kleinere limiet in het formulier.

Als alle nieuwe inhoudsvelden bewust worden leeggemaakt, valt de pagina terug op de bestaande detailweergave. Een gedeeltelijk ingevulde pagina wordt geweigerd. Profielen blijven hun bestaande detailtemplate gebruiken.

De prijzen komen uit de bestaande productrecords en worden server-side opnieuw berekend bij bestellen. De lange inhoud wordt niet meegestuurd in de props van de React-catalogus. Interne kosten en professionele reviewnotities blijven buiten publieke props.

## Afwijkingen die tijdens import zijn verwerkt

| Instrument | Vorige catalogus | Nieuwe weergave |
|---|---|---|
| Piers-Harris 3 | 8–18 jaar | 8–17 jaar volgens de nieuwe bron. |
| TSI-2 | TSI / TSI-2 | TSI-2; bestaande slug `tsi-tsi-2` behouden. |
| SPM-2 | 2–80 jaar | Leeftijd afhankelijk van de gebruikte versie. |
| CERQ en RS-NL | Volwassenen | Vanaf 18 jaar. |
| Conners, BRIEF-2 en SRS-2 | Leeftijd zonder versievoorbehoud in het label | Versievoorbehoud expliciet in het leeftijdslabel. |

Alle 22 prijzen kwamen overeen met de bron. Product-ID’s, slugs, publicatie, beschikbaarheid, interne kosten en pakketrelaties zijn door de import niet gewijzigd. Bestaande professionele controlepunten, onder meer rond de TSI/TSI-2-versie en kost, blijven gelden vóór een afname wordt uitgestuurd.

## Importeren naar een andere omgeving

Pas eerst de additieve migratie toe, daarna de bijbehorende applicatiecode. Gebruik de normale migratieprocedure en controleer welke andere migraties in de doelomgeving nog openstaan. De migratie voor deze functie is [questionnaire_landing_content.sql](../supabase/migrations/20261018162030_questionnaire_landing_content.sql).

Maak vervolgens een expliciete review met de databaseconfiguratie van de bedoelde omgeving:

```sh
npx dotenv -e .env -- node scripts/import-questionnaire-landings.mjs
```

De uitvoer noemt het nieuwe reviewbestand onder `output/questionnaires/`. Het script zoekt voor elke bronslug precies één bestaand product, ook via bestaande slugaliassen, en controleert de prijs. Ontbrekende, dubbele of afwijkende matches breken af. Het maakt geen nieuwe producten aan.

Controleer de mapping en wijzigingen in het reviewbestand. Test dezelfde import desgewenst zonder blijvende wijzigingen:

```sh
npx dotenv -e .env -- node scripts/import-questionnaire-landings.mjs --verify output/questionnaires/<reviewbestand>.json
```

Pas daarna datzelfde gecontroleerde bestand toe:

```sh
npx dotenv -e .env -- node scripts/import-questionnaire-landings.mjs --apply output/questionnaires/<reviewbestand>.json
```

Het script vergrendelt de betrokken records, vergelijkt de volledige publieke beginsituatie met de review en breekt af zodra de catalogus tussendoor is aangepast. De bronhash moet eveneens overeenkomen. Het schrijft vóór de mutatie een herstelkopie en voert alle wijzigingen in één transactie uit. Een reeds toegepaste oude review kan niet stil opnieuw importeren over latere wijzigingen.

De JSON-bron wordt niet bij iedere paginavraag ingelezen. Na import is de database de inhoudsbron; dagelijkse redactie gebeurt via beheer. Importeer de oorspronkelijke JSON dus niet opnieuw over latere redactie zonder de nieuwe review inhoudelijk te beoordelen.

## Uitgevoerde controles

- `npm run check`: TypeScript en Astro-productiebuild geslaagd.
  De laatste gezamenlijke typecontrole vroeg daarnaast drie kleine guards voor lege database-antwoorden in de gelijktijdig toegevoegde `src/lib/modules/server.ts`; die zijn aangebracht voordat de build opnieuw slaagde.
- `npm run test:catalog`: 9 tests geslaagd, waaronder volledige brondekking voor alle 22 teksten, doelgroepgrenzen, inhoudsvalidatie en formulierconversie.
- `npm run test:catalog:db`: 28 bestaande databasecontroles geslaagd; transactie teruggedraaid.
- `npm run test:questionnaires:db`: 38 controles geslaagd voor inhoud, opslaan/herladen, oudere aanroepen, ongeldige invoer, rechten en RLS; transactie teruggedraaid. Het nieuwe schema is bovendien vóór toepassing binnen zo’n teruggedraaide transactie getest.
- De complete import is eerst met `--verify` teruggedraaid en daarna transactioneel toegepast.
- Read-only nacontrole bevestigde dat alle 22 inhoudsobjecten en doelgroepcodes exact overeenkomen met de importbron en dat prijzen, product-ID’s en statussen behouden zijn.
- Browsercontrole van alle 22 detailpagina’s op 375 px: precies één H1, meetdomeinen, afbakening, juiste bestelactie en geen horizontale overloop.
- Visuele controle op mobiel, tablet en desktop, met extra aandacht voor lange titels. NEO-PI-3 toont het uitgebreide persoonlijke verslag. SPM-2 toont de versieafhankelijke leeftijd.
- De jongerenfilter bevat onder meer NEO-PI-3 en SDS. De combinatieactie van NEO-PI-3 leidde na herladen naar één regel van €99 in het besteloverzicht. Er is geen echte bestelling of betaling aangemaakt.
- Supabase security advisors voor en na de migratie: geen nieuwe bevindingen. De bestaande waarschuwing over `btree_gist` in `public` blijft buiten deze wijziging; zie de [Supabase-toelichting](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

Er was in deze checkout geen gegenereerd `src/lib/supabase/database.types.ts`. De CLI-schema-export leverde geen types op en de Supabase-connector was niet aangemeld. De nieuwe velden zijn expliciet getypeerd in `src/lib/catalog/landing.ts` en `CatalogProduct`; de bestaande serverclient gebruikte al geen gegenereerde databasetypes. Volledige schema-typegeneratie is daarmee geen onderdeel van de gerealiseerde wijziging.

## Herstel en publicatie

De herstelbron van de werkelijk toegepaste import staat lokaal in `output/questionnaires/before-import-2026-10-18T16-26-36-301Z.json`. Deze bevat uitsluitend de getroffen publieke product- en catalogusvelden. Controleer vóór een herstel altijd op nieuwe beheerwijzigingen. Zet alleen de gewijzigde tekstvelden/doelgroepcodes terug, met nieuwe `updated_at`-waarden; herstel geen oude bestellingen, kosten, statussen of pakketrelaties uit deze bron.

Bij een applicatieterugval kan de vorige versie blijven draaien op het additieve schema. Verwijder de nieuwe kolommen niet zolang de nieuwe applicatiecode nog draait. De import verrijkte ook de bestaande beschrijvingsvelden, zodat de oude detailtemplate bruikbare tekst houdt.

De lokale preview staat op `/vragenlijsten` en `/vragenlijsten/<bestaande-slug>`. Deze checkout bevat daarnaast lopende wijzigingen aan andere onderdelen. Deze taak heeft geen commit, push of Vercel-deployment uitgevoerd. Controleer bij een release de bedoelde wijzigingsset en daarna het productieoverzicht, HiPIC, NEO-PI-3, SPM-2, TSI-2 en de bestel-/combinatielinks.
