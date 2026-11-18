# Cliëntendossiers

Primary target: src/components/records/ClientRecord.astro
Related targets: src/components/records/RecordNoteView.astro, src/components/records/RecordNoteCreate.astro, src/components/records/RecordNotes.astro, src/components/records/RecordDetails.astro, src/components/records/RecordBookings.astro, src/components/records/RecordAccess.astro, src/styles/client-record-workspace.css
Mode: Operate. Dagelijks gebruikte vertrouwelijke werkruimte voor medewerkers en professionals.

## Direction contract

THESIS: Vier echte dossieronderdelen vervangen de lange pagina met ankerknoppen. Eén geselecteerd verslag of editor krijgt de aandacht.

OWN-WORLD: Bestaande MyGrowise-adminidentiteit, witte werkvlakken, subtiel groen getinte neutrale ondergrond, donkergroene selectie en bestaande sans-serif. Compacte functionele koppen, fijne scheidingslijnen en herkenbare formulierbediening.

STORY: Cliënt herkennen, onderdeel kiezen, inhoud raadplegen of vastleggen; gegevens en toegang beheren in hun eigen context. Opslag blijft expliciet.

FIRST VIEWPORT: Teruglink, cliëntinitialen/naam/status/contact, vier horizontale onderdelen. Verslagen: smalle lijst links, breed lees-/schrijfgebied rechts. Mobiel: lijst of detail met teruglink; onderdelen in een compact rooster. Toegang: echte medewerkersportretten, actieve toegang en apart dossierbeheer.

FORM: Lokale herstructurering binnen de bestaande adminwereld, op basis van het door Kevin geaccordeerde plan; geen nieuwe merkwereld. URLs dragen selectie; oude links blijven bruikbaar. seed: none (existing-world extension).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Grenzen

Behoud serverrechten, definitieve verslagen, correcties, historie, conflictcontrole en bescherming van niet-opgeslagen tekst. Geen browseropslag van klinische inhoud. Beide werkruimtes controleren. Geen GitHub Actions, betaalde infrastructuur of productiegegevens gebruiken voor QA.


## Gerealiseerde UI-regels

- Render één dossieronderdeel, gekozen via `onderdeel`; selecteer een verslag met `verslag` of de nieuwe editor met `verslag=nieuw`. Gewone dossierlinks openen Verslagen. Bewaar oude fragment-, concept-, correctie- en geschiedenislinks via de gedeelde URL-resolutie.
- Behoud de compacte cliëntkop met naam, tekstuele dossierstatus en contactgegevens; lange waarden mogen afbreken. De actieve onderdeellink heeft `aria-current` en een groene markering. Geen extra overzicht of brede dossierzijbalk.
- Gebruik bij voldoende breedte een verslagenindex naast één lezer of editor. Onder 760px wisselen lijst en detail via ‘Alle verslagen’; de onderdelen staan in een rooster van twee kolommen. Voeg geen vaste mobiele kop toe die het schrijven verdringt.
- Conceptbewerking gebruikt `bewerken=1` en ‘Terug naar verslag’. Toon tijdens bewerken geen tweede kopie van de actuele leestekst. Definitieve verslagen krijgen een afzonderlijke aanvulling/correctie; historie blijft bij het gekozen verslag.
- Houd verslagtekst leesbaar met maximaal 74ch en ruime regelafstand; de lezer erft de 16px-admintekst, de desktopeditor gebruikt 14px en telefoonvelden minimaal 16px om focuszoom te voorkomen. Behoud de functionele sans-serif, witte werkvlakken, subtiele groene ondergrond, fijne randen en donkergroene primaire acties uit de adminwereld. Invoervelden hebben normale tekstgewichten, zichtbare labels en een zichtbare focusrand; verminderde beweging schakelt lokale transities uit.
- Opslaan is expliciet: concept en definitief zijn verschillende acties. Onderdeel-, verslag- en teruglinks vallen onder de bestaande waarschuwing bij gewijzigde formulieren. Toon opslagfouten bij het formulier en behoud tekst, zo nodig in een kopieerbare herstelweergave wanneer hervatten niet meer mag.
- Cliëntgegevens blijven leesbaar vóór expliciet uitklapbaar bewerken. Accountkoppeling staat bij gegevens; teamtoegang en dossierbeheer hebben hun eigen context. Verberg niet-toegestane acties volgens de bestaande serverrechten en archiefstatus.
- Portretten zijn 44px en horen bij de actieve toewijzing op gebruikers-ID. De dossiergebonden private fotoroute controleert inzage en relatie; een praktijkportret vereist een expliciete accountrelatie. Initialen blijven zichtbaar bij ontbreken of laden met fout. Eerdere toewijzingen staan apart; status wordt ook in tekst gegeven.

## Documentatie en validatie

Dit is een uitbreiding van de bestaande adminwereld. `PRODUCT.md`, `DESIGN.md` en `.impeccable/design.json` zijn behouden; de `/startpunt`-regels worden niet uitgebreid tot dossierregels. Geen nieuwe rasterbeelden gemaakt: de UI gebruikt bestaande gebruikersheadshots en expliciet gekoppelde praktijkportretten, met initialen als fallback.

Definitieve controles geslaagd: 197 unittests, TypeScript, productiebuild en `npm run check:artifact`; geen tijdelijke browserfixtureroutes in de release. Browser-QA met synthetische data en echte componenten bestrijkt 1440/1024/768/390/320px, admin en praktijk, directe/legacy-links, historie/correcties, filters, waarschuwing bij gewijzigde invoer en tekstbehoud na opslagfout, foto/fallback, alleen-lezen, archivering en lange namen. Captures: `.impeccable/review/clientendossiers`.

Finish-status: **ship**. De eerste review inspecteerde 15 captures en vond één materiële correctie voor gelijktijdige lezer/editor. De reviewer heeft de gecorrigeerde bron en desktop-, 1024px- en 390px-concepteditor opnieuw bekeken: deze correctie is opgelost zonder materiële visuele regressie. De daaropvolgende 16px-mobiele velden zijn door de bouwer met verse captures en browserasserties gecontroleerd; deze laatste typografische aanpassing is niet nogmaals onafhankelijk bekeken.

Geen productiegegevens of deployment. Voor de oorspronkelijke dossierherstructurering en teamfoto’s was geen databasemigratie nodig; de onderstaande editoruitbreiding heeft wel een migratie. Controles lokaal, latere deployment alleen via de bestaande Vercel Free/Hobby-integratie; geen GitHub Actions of betaalde infrastructuur.


## Uitbreiding: tekstopmaak in verslagen

De compacte lokale Tiptap-editor vervangt het schrijfveld voor nieuwe verslagen, aanvullingen en bewerkbare concepten. Acht SVG-knoppen zijn gegroepeerd als nadruk (vet/cursief), tekststijl (normaal/tussenkop), lijsten (opsomming/genummerd) en geschiedenis (ongedaan maken/opnieuw). Actieve standen hebben een groene selectie; niet-beschikbare geschiedenisacties zijn uitgeschakeld. De werkbalk ondersteunt sneltoetsen en pijltjestoetsen tussen knoppen. Op kleine schermen breken complete groepen om, met 16px-schrijftekst en grotere knoppen bij een grove aanwijzer.

Het witte schrijfvlak heeft een fijne groene rand (9px-hoeken), een zacht getinte werkbalk en een footer met vertrouwelijkheid en tekenteller. Desktoptekst is 14px met regelafstand 1,85; mobiel 16px. De editor en leesweergave delen alinea-, tussenkop-, nadruk- en lijsttypografie. Opslaan blijft expliciet. De editor wordt tijdelijk alleen-lezen tijdens opslag; na fouten blijven tekst en opmaak beschikbaar. Zonder JavaScript of na een laadfout blijft het native tekstveld bruikbaar, met uitleg over ontbrekende tekstopmaak.

`noteDocument.ts` accepteert uitsluitend een begrensde documentstructuur: alinea, tussenkop op niveau 2, vet/cursief, harde regeleinde en lijsten. Geen ingediende HTML, links, beelden, lettertypes of kleuren worden uitgevoerd of gerenderd. De server vergelijkt de gewone tekst met de documentinhoud; leesweergaven ontsnappen alle tekst en renderen uitsluitend toegestane elementen. Bestaande gewone tekst houdt ook enkele en opeenvolgende regeleinden. Limieten: 20.000 tekens, 200.000 bytes canoniek JSON, 3.000 knopen en diepte 12. De database laat 250.000 bytes JSONB toe om ruimte te houden voor serialisatieoverhead.

Opmaak staat als optionele `body_document` naast de bestaande `body` in dezelfde onveranderlijke verslagversie. Huidige weergave, conceptbewerking en historie nemen beide mee. Versieconflicten, toegang, definitieve vergrendeling en afzonderlijke correcties behouden de bestaande controles. Klinische tekst wordt niet in browseropslag bewaard.

### Oplevering en verificatie

- Lokale eindcontrole: **216 tests geslaagd**, TypeScript, productiebuild en artifactcontrole geslaagd. De suite omvat ook gelijktijdige wijzigingen elders in het project; dit aantal is de gecontroleerde workspace op oplevering.
- Browser-QA met synthetische data controleert werkbalkcommando’s, cursiefsneltoets, selectie/actieve standen, pijltjestoetsbediening, undo/redo, opgeschoonde plakinhoud, lege/te grote invoer, behoud na opslagfout en conflict, opgemaakte lezer/historie en native fallback. De bestaande dossiermatrix blijft slagen op 1440/1024/768/390/320px, inclusief admin/praktijk.
- `tests/note-formatting-isolated-db.mjs` voert de echte migratie in een geïsoleerde PostgreSQL-runtime uit: bestaande rijen en oude aanroepen, nieuwe snapshots, onveranderlijkheid, conflicten, onbevoegde toegang, rollback bij foute documentvorm, definitieve vergrendeling en functieprivileges slagen. Geen verbinding met productie.
- Onafhankelijke finish-review: **ship**, geen materiële bevindingen na broncontrole en tien editor-/lees-captures. Detector: 145 adviezen over tokens tegenover het aparte `/startpunt`-systeem, nul niet-adviserende bevindingen. Captures gebruiken de gedocumenteerde systeemfontfallback.
- Documentatiepass door de bouwer uitgevoerd volgens de documenter-instructies nadat de afzonderlijke documenter door een gebruikslimiet uitviel. `PRODUCT.md`, `DESIGN.md` en `.impeccable/design.json` zijn behouden. Geen nieuwe merkregels, verzonnen tokens of rasterassets toegevoegd.

**Releasevoorwaarde:** pas `supabase/migrations/20261118193000_patient_note_formatting.sql` toe vóór deployment van de nieuwe applicatiecode. De migratie is voorbereid en geïsoleerd getest, maar niet op productie uitgevoerd. Geen deployment gedaan. Alleen bestaande Vercel Free/Hobby-integratie; geen GitHub Actions of betaalde editorservice.


## Database-uitrol op 18 november 2026

Op expliciet verzoek van Kevin is migratie `20261118193000_patient_note_formatting.sql` op de geconfigureerde Supabase-database uitgevoerd en geregistreerd. Eerst is dezelfde wijziging binnen een transactie gerepeteerd en teruggedraaid. De uitvoercontrole verifieert de live opslagfuncties tegenover de oorspronkelijke routines en controleert dat bestaande verslagtekst, versies en dossieraantallen behouden blijven. De documentkolom, uitgebreide actuele-verslagview en uitsluitend service-role-uitvoerrechten zijn gecontroleerd. `scripts/apply-note-formatting.mjs` voert uitsluitend deze migratie uit; zonder `--apply` draait de transactie terug. Applicatiecode kan nu met de bestaande Vercel-integratie worden uitgerold. Eerdere opmerkingen over een nog niet uitgevoerde migratie beschrijven de status vóór dit uitrolmoment.
