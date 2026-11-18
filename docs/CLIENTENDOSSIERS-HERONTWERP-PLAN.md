# Cliëntendossiers: herontwerp van de werkruimte

Datum: 18 november 2026
Status: lokaal geïmplementeerd en gecontroleerd; reviewer-dispositie ship na hercontrole van de concepteditor. Niet gedeployd.

## Doel en uitgangspunt

Een veelgebruikte werkruimte voor medewerkers die cliëntinformatie raadplegen, verslagen schrijven en afspraken opvolgen. De gebruiker moet steeds zien in welk dossier en welk onderdeel hij werkt. De huidige vier ankerknoppen en lange pagina maken plaats voor afzonderlijke dossieronderdelen met eigen URL en inhoud. Scrollen binnen een lang verslag blijft normaal; navigeren tussen onderdelen gebeurt zonder doorscrollen.

Gekozen uitgangspunt na akkoord om uit te voeren: verslagen lezen en schrijven is de primaire dagelijkse taak. Gewone dossierlinks openen Verslagen; taaklinks openen rechtstreeks het passende verslag of formulier.

## Bevindingen vóór het herontwerp

- `src/components/records/ClientRecord.astro` bevat cliëntgegevens, alle verslagen op de geladen pagina, een nieuw-verslagformulier, afspraken, accountkoppeling, toewijzingen en dossierbeheer samen.
- De vier werkknoppen verwijzen naar `#nieuw-verslag`, `#verslagen`, `#afspraken` en `#clientgegevens`.
- Verslagen en afspraken hebben al serverpaginering. Die blijft behouden.
- Concepten, definitieve verslagen, correcties, versiegeschiedenis, conflictdetectie en herstel na mislukte opslag bestaan al en moeten in de nieuwe flow behouden blijven.
- `/admin/clienten` en `/praktijk/clienten` delen de dossiercomponenten. Wijzigingen vereisen expliciete verificatie van beide werkruimtes en hun verschillende rechten.
- Toewijzingen laden nu namen uit `profiles`, zonder foto. De bestaande headshots staan in private opslag. `/api/profile/headshot` levert uitsluitend de foto van de ingelogde gebruiker; deze URL kan niet rechtstreeks voor toegewezen collega's worden hergebruikt.

## Vastgelegde informatiearchitectuur

De bestaande lijst blijft de ingang. Binnen een geopend dossier:

| Onderdeel | Inhoud en belangrijkste actie |
| --- | --- |
| Verslagen | Scanbare lijst met datum, titel, type, concept/definitief en auteur waar beschikbaar. Selectie opent één verslag. Primaire actie: Nieuw verslag. |
| Afspraken | Gekoppelde afspraken, bestaande status- en datumfilters, paginering, koppelen en sessiedata downloaden. Actie: Afspraak plannen, volgens bestaande rechten. |
| Cliëntgegevens | Rustige leesweergave met persoonsgegevens, contact en aanmelding. Expliciet wisselen naar bewerken. Online accountkoppeling hoort hier. |
| Toegang & beheer | Actieve teamleden met portret, toevoegen en toegang beëindigen. Historische toewijzingen afzonderlijk opvraagbaar. Archiveren, herstellen en verwijderen in een afzonderlijk beheergedeelte. |

Een compacte vaste dossierkop toont naam, dossierstatus en relevante identificatie/contactgegevens. Eén horizontale navigatiebalk schakelt de vier onderdelen. De huidige adminnavigatie blijft de navigatie van de gehele applicatie; er komt geen extra brede zijbalk voor dossieronderdelen.

Geen extra generieke overzichtspagina: die zou een extra klik tussen de medewerker en het werk plaatsen. Gewone dossierlinks openen voorlopig Verslagen; een link vanuit een afspraak of concept opent direct de passende context.

## Verslagen als primaire werkplek

- Desktop: compacte verslagenlijst links en lees- of schrijfgebied rechts, mits de werkelijk beschikbare breedte naast de adminnavigatie dit toelaat.
- Er staat maximaal één volledig verslag of één editor open. De lijst blijft bruikbaar voor terugzoeken.
- Nieuw verslag opent direct de editor, zonder sprong naar de onderkant van de pagina. Type, tijdstip en afspraakkoppeling vormen een compact metadatablok boven titel en tekst.
- Concept opslaan en Definitief opslaan blijven duidelijk verschillende acties met expliciete opslagstatus. Geen impliciete automatische definitieve opslag.
- Versiegeschiedenis en aanvulling/correctie openen bij het geselecteerde verslag, zonder de medewerker naar een ander deel van een lange pagina te sturen.
- Bij onvoldoende breedte: lijst → verslag/editor → terug naar lijst. Lijstpositie en context blijven behouden.
- Zoek- en filterfuncties alleen toevoegen met correcte serverondersteuning over alle verslagen; nooit een zoekveld dat ongemerkt alleen de huidige pagina doorzoekt.

## Headshots en toegang

Vervang het generieke medewerkericoon uit de aangeleverde screenshot door het portret dat hoort bij de daadwerkelijk toegewezen gebruikers-ID. Geen koppeling op alleen voornaam. Zonder foto, of bij een laadfout, verschijnen initialen met dezelfde afmetingen.

Actieve toegang krijgt een compacte rij: portret, naam, toegangsstatus en een begrijpelijke actie voor toegang beëindigen. De selector en toewijsknop vormen één samenhangende bediening, naast elkaar wanneer de breedte dat toelaat. Een native selector blijft geschikt; een eigen zoekbare kiezer is pas nodig bij aantoonbaar grotere teams.

De fotolevering vereist een aparte, servermatig geautoriseerde oplossing voor collega's. Controleer dossierinzage en de relatie met de toegewezen medewerker voordat een private foto wordt geleverd. Geen publieke opslagbucket, geen uitlekken van opslagpaden en geen onbegrensde authenticatie-opvragingen per dossierregel. Bestaande portretten alleen als fallback gebruiken bij een expliciet vastgelegde identiteitskoppeling.

## Navigatie en betrouwbaarheid

- Elk onderdeel en geselecteerd verslag heeft een deelbare URL. Terug/vooruit en verversen herstellen de juiste weergave.
- Oude ankerlinks en bestaande links uit afspraken, concepten, correcties en opslagredirects worden omgezet naar de juiste nieuwe weergave.
- POST-acties keren terug naar het onderdeel waarin de actie plaatsvond; fouten tonen het juiste formulier met behoud van invoer.
- Bij wisselen van onderdeel, cliënt of verslag gaat niet-opgeslagen tekst niet stilzwijgend verloren. Sluit aan op de bestaande formulierbescherming; claim geen autosave zonder die daadwerkelijk te bouwen.
- Bestaande permissies, auditlogging, versiecontrole en archiefbeperkingen blijven servermatig afgedwongen.
- Inactieve onderdelen worden niet uitsluitend met CSS verborgen. Render de benodigde inhoud en laad omvangrijke gegevens waar mogelijk per onderdeel, na controle van de bestaande gedeelde loader.

## Visuele richting

Behoud de herkenbare adminstijl met rustige groene accenten, leesbare functionele typografie en duidelijke actieve navigatie. Verhoog de kwaliteit door consistente uitlijning, compacte informatiedichtheid, voorspelbare acties en minder concurrerende kaders. Geen grote introductieblokken boven dagelijks werk. Portretten ondersteunen herkenning; status wordt ook in tekst aangegeven.

Op mobiel passen de vier compacte onderdelen in een overzichtelijke navigatie zonder horizontale paginascroll. Acties en formulieren stapelen waar nodig. De dossierkop blijft compact; een sticky kop mag op kleine schermen het schrijfgebied niet verdringen.

## Uitvoering in volgorde

1. Werkflows en links inventariseren; openingsweergave bepalen op basis van de dagelijkse hoofdtaak. Desktop- en mobielwireframe uitwerken met bestaande content en realistische lange namen/verslagen.
2. Dossierstructuur opdelen in een gedeelde kop, onderdeelnavigatie en afzonderlijke inhoudscomponenten. URL-selectie, oude links en redirects eerst sluitend maken.
3. Verslagenlijst, geselecteerd verslag en editor uitwerken. Opslag, correcties, historie en bescherming van invoer integreren.
4. Afspraken, cliëntgegevens en toegang/beheer overzetten; headshots via de echte medewerkeridentiteit toevoegen.
5. Lokale functionele controles en visuele controle op desktop, smalle laptop en mobiel. Daarna alleen via de bestaande Vercel-integratie; geen GitHub Actions of betaalde infrastructuur.

## Acceptatiecriteria

- Wisselen tussen dossieronderdelen veroorzaakt geen ankersprong en toont uitsluitend de gekozen werkcontext.
- Een nieuw verslag schrijven vereist geen zoeken of scrollen voorbij bestaande verslagen.
- Directe links, verversen, browser terug/vooruit en bestaande afspraakflows openen de juiste cliënt en context.
- Niet-opgeslagen invoer en herstel na een opslagfout werken ook bij de nieuwe navigatie.
- Definitieve verslagen blijven onveranderlijk; conceptrechten, correcties en versieconflicten blijven correct.
- Filters en paginering behouden het gekozen onderdeel en de relevante selectie.
- Actieve en beëindigde toegang zijn duidelijk onderscheiden; het juiste medewerkersportret verschijnt, met robuuste fallback.
- Onbevoegde gebruikers kunnen via dossier- of fotoverzoeken geen extra gegevens opvragen.
- Lege dossiers, veel verslagen, lange namen, ontbrekende foto's, alleen-lezen toegang en archivering hebben bruikbare weergaven.
- Toetsenbordbediening, focus, labels, contrast en mobiele acties zijn gecontroleerd. Geen horizontale paginascroll of vastgezette blokken die de editor onbruikbaar maken.
- Typecheck, build en relevante bestaande dossier-, formulier- en headshottests draaien lokaal. Browsercontrole omvat zowel `/admin` als `/praktijk`.


## Gerealiseerde werkruimte

De gedeelde `ClientRecord.astro` rendert uitsluitend het gekozen onderdeel voor `/admin/clienten/[id]` en `/praktijk/clienten/[id]`. `clientRecordWorkspace.ts` beheert `onderdeel=verslagen|afspraken|gegevens|toegang`; `verslag` selecteert één verslag of `nieuw`. Legacyfragmenten worden in de browser omgezet, en bestaande concept-, correctie-, geschiedenis-, afspraak- en opslaglinks behouden hun context. De standaard blijft Verslagen, zonder extra overzichtspagina.

- Verslagen hebben een aparte index, lezer en editor. Een concept wisselt via `bewerken=1` naar de editor; de leestekst wordt dan niet tegelijk getoond. ‘Terug naar verslag’ herstelt de lezer. Geschiedenis hoort bij de selectie en correcties starten een afzonderlijk aanvullend verslag.
- De werkruimte is maximaal 1480px breed. Bij voldoende ruimte staat een index van 290px naast de inhoud; onder 760px wisselen lijst en detail met ‘Alle verslagen’ en staan de vier onderdelen in een compact rooster. Functionele sans-serif, witte vlakken, fijne groene scheidingslijnen en donkergroene selectie sluiten aan op de bestaande adminwereld. Verslagtekst blijft beperkt tot 74ch; formulieren hebben zichtbare labels en expliciete concept-/definitieve opslagacties.
- Afspraken behouden serverfilters en paginering, koppelen, afspraakdetails en de download van uitgevoerde sessiedata. Cliëntgegevens hebben een leesweergave met expliciet uitklapbaar bewerken; accountkoppeling staat in dezelfde context. Toegang toont actieve teamleden en afzonderlijk opvraagbare eerdere toewijzingen, met dossierbeheer apart en volgens bestaande rechten.
- Teamfoto’s worden per toegewezen gebruikers-ID geladen via de nieuwe dossiergebonden `teamfoto`-route. Die controleert authenticatie, leesrecht, dossierinzage en actieve toewijzing vóór levering uit private opslag. Een bestaand praktijkportret is alleen fallback via `practitioners.user_id`; ontbrekende of mislukte foto’s laten initialen in hetzelfde 44px-vlak zien. Fotoantwoorden zijn `private, no-store`.
- Bestaande serverrechten, conflictcontrole, definitieve verslagen, archiefbeperkingen en bescherming van niet-opgeslagen invoer blijven de grens. Mislukte opslag behoudt de tekst in het formulier; als hervatten niet mag, verschijnt een kopieerbare herstelweergave. Geen browseropslag van klinische inhoud.

Deze lokale uitbreiding wijzigt geen globale merk- of designsysteemregels. `PRODUCT.md`, `DESIGN.md` en `.impeccable/design.json` blijven behouden: hun bestaande visuele documentatie beschrijft `/startpunt`. De dossierregels staan in `.impeccable/surfaces/clientendossiers.md`.

## Validatiestatus op 18 november 2026

- Definitieve lokale controles geslaagd: 197 unittests, TypeScript, productiebuild en `npm run check:artifact`. Tijdelijke browserfixtureroutes zijn vóór de productiebuild verwijderd.
- Browser-QA is geslaagd en gebruikt synthetische gegevens en de echte dossiercomponenten op 1440, 1024, 768, 390 en 320px. De matrix omvat admin en praktijk, legacy- en directe verslaglinks, historie/correcties, filters, waarschuwing bij niet-opgeslagen tekst, tekstbehoud na opslagfout, foto/fallback, alleen-lezen, archivering en lange namen. Bewijs staat in `.impeccable/review/clientendossiers`.
- De finish-reviewer inspecteerde 15 captures en vond één materieel punt: conceptbewerking kon lezer en editor tegelijk tonen. Na vervanging door URL-gestuurd bewerken bekeek de reviewer bron en desktop-, 1024px- en 390px-captures opnieuw: correctie opgelost, geen materiële regressie, dispositie **ship**. De laatste mobiele 16px-invoervelden zijn aanvullend door de bouwer met browserasserties en verse captures gecontroleerd; die typografische aanpassing is niet opnieuw onafhankelijk bekeken.
- Geen productiegegevens gebruikt en geen deployment uitgevoerd. Voor de dossierherstructurering en teamfoto’s is geen databasemigratie nodig. Controles blijven lokaal; een latere deployment verloopt via de bestaande Vercel-integratie binnen Free/Hobby, zonder GitHub Actions of betaalde infrastructuur.


## Uitgevoerd: compacte verslageditor

Op aanvullende vraag van Kevin is tekstopmaak geïmplementeerd voor nieuwe verslagen, aanvullingen en conceptbewerking. De werkbalk biedt vet, cursief, normale tekst, tussenkop, opsomming, genummerde lijst, ongedaan maken en opnieuw. Actieve knopstanden, sneltoetsen, toetsenbordnavigatie, selectiebehoud en groepering op mobiel horen bij de implementatie. De leesweergave en versiegeschiedenis tonen dezelfde ondersteunde opmaak.

De editor gebruikt lokale open-source Tiptap-pakketten. Een kleine, gevalideerde documentstructuur wordt naast de bestaande gewone tekst in dezelfde onveranderlijke versie opgeslagen. De renderer bouwt ontsnapte HTML uitsluitend uit toegestane elementen. Bestaande verslagen blijven leesbaar en bewerkbaar; geplakte links, beelden en afwijkende stijlen worden niet overgenomen. Geen klinische inhoud in browseropslag. Zonder JavaScript of na een editorlaadfout blijft gewone tekstinvoer beschikbaar.

De opslagflow bevriest de editor tijdens opslaan en herstelt de bediening bij fouten, met behoud van tekst en opmaak. Lege verslagen en overschrijding van limieten worden gecontroleerd. Bestaande conflictcontrole, conceptrechten, definitieve vergrendeling, aanvullingen en auditlogging blijven van kracht.

Aanvullende eindvalidatie: 216 tests geslaagd, TypeScript/productiebuild/artifactcontrole geslaagd. Browsercontrole gebruikt echte componenten en synthetische gegevens op 1440/1024/768/390/320px; commando’s, sneltoets, toetsenbordfocus, undo/redo, plakken, limieten, herstel na fout/conflict, opgemaakte historie en native fallback slagen. De echte migratie is in geïsoleerd PostgreSQL getest, inclusief bestaande rijen/aanroepen, onveranderlijke snapshots, rollback, toegang, conflicten en definitieve vergrendeling. Onafhankelijke finish-review van bron en tien captures: **ship**, geen materiële bevindingen. De documentatie is door de bouwer afgerond nadat de afzonderlijke documenter door een gebruikslimiet uitviel.

**Vóór livegang vereist:** `supabase/migrations/20261118193000_patient_note_formatting.sql` toepassen vóór deployment van deze applicatiecode. De eerdere dossierherstructurering en teamfoto’s hadden geen migratie nodig; deze editoruitbreiding voegt `body_document` en uitgebreide opslagfuncties toe. Migratie en applicatie zijn niet op productie uitgerold. Alle controles blijven lokaal en deployment verloopt via de bestaande Vercel Free/Hobby-integratie, zonder GitHub Actions of betaalde editorservice.


## Database-uitrol op 18 november 2026

Op expliciet verzoek van Kevin is migratie `20261118193000_patient_note_formatting.sql` op de geconfigureerde Supabase-database uitgevoerd en geregistreerd. Eerst is dezelfde wijziging binnen een transactie gerepeteerd en teruggedraaid. De uitvoercontrole verifieert de live opslagfuncties tegenover de oorspronkelijke routines en controleert dat bestaande verslagtekst, versies en dossieraantallen behouden blijven. De documentkolom, uitgebreide actuele-verslagview en uitsluitend service-role-uitvoerrechten zijn gecontroleerd. `scripts/apply-note-formatting.mjs` voert uitsluitend deze migratie uit; zonder `--apply` draait de transactie terug. Applicatiecode kan nu met de bestaande Vercel-integratie worden uitgerold. Eerdere opmerkingen over een nog niet uitgevoerde migratie beschrijven de status vóór dit uitrolmoment.
