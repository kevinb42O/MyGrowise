# Audit MyGrowise /admin — 18 november 2026

**Vervolg:** de zestien genummerde bevindingen zijn lokaal aangepakt. Zie [herstel en verificatie](./ADMIN-HERSTEL-2026-11-18.md). Onderstaand rapport beschrijft de oorspronkelijke auditstaat, niet de herstelde werkstaat.

## Oordeel en scope

**Productconsistentie: de basis slaagt; de volledige beheerervaring nog niet.** De rustige MyGrowise-vormgeving, dossiers en agenda vormen een herkenbaar product. Verschillende oudere beheerflows hebben echter andere afspraken voor opslaan, fouten, navigatie en mobiel. Daar zitten concrete fouten met meer impact dan de resterende visuele afwerking.

Audit van lokale broncode, gekoppelde admin-API's, autorisatie, gedeelde componenten en databasepaden. Visuele, alleen-lezen controle van de ingelogde productieomgeving: dashboard, cliëntendossiers, vragenlijsten, agenda, content, instellingen, afspraaktypeformulier en mailopvolging. Mobiele mailweergave gecontroleerd via Chrome-apparaatemulatie op 440 CSS-pixels; geen fysieke touchtest. Andere routes en foutpaden zijn op broncode beoordeeld, niet allemaal end-to-end uitgevoerd. Lokale wijzigingen en productie lopen gedeeltelijk uiteen, onder andere bij cliënt aanmaken en navigatie.

Geen accounts aangemaakt, mails verzonden, inhoud gepubliceerd of productiegegevens gewijzigd. Geen applicatiecode aangepast. Geen GitHub Actions gebruikt.

| Dimensie | Score /4 | Onderbouwing |
|---|---:|---|
| Toegankelijkheid | 2 | Goede labels, dialoog- en navigatieondersteuning; significant tekort aan tekstcontrast en erg kleine tekst/bediening. |
| Performance | 3 | Caching en gerichte laadmechanismen aanwezig; enkele lijsten halen alle records op. Voorlopige broncodebeoordeling, geen Lighthouse- of belastingbenchmark. |
| Theming | 2 | Sterke gedeelde adminbasis, maar lokale stijlen en kleurwaarden maken onderdelen inconsistent. Geen dark-mode-eis vastgesteld. |
| Responsive | 2 | Werkende mobiele shell en aangepaste agenda; mailtabel verliest betekenis, kleine doelen blijven. |
| Implementatie-integriteit | 2 | Meerdere bevestigde fouten en verschillende afspraken tussen beheerflows. |
| **Totaal** | **11/20** | **Aanvaardbare basis met aanzienlijk herstelwerk. Geen WCAG-certificering.** |

**16 bevindingen: 0 P0, 6 P1, 10 P2, 0 P3.** P1 betekent eerst aanpakken wegens gegevensverlies, onjuiste werking, onveilige standaard of contrast. P2 betekent volgende herstelronde; er is doorgaans een omweg. Geen algemene onbruikbaarheid of aangetoonde ongeautoriseerde toegang vastgesteld. Dit was geen volledige penetratietest.

## P1 — eerst herstellen

### F01 — Behandelgroep wijzigen kan de waarde van een keuze beschadigen

- **Bewijs:** `src/pages/admin/afspraaktypes.astro:25–38`. Zowel de groepsopties als het kleurveld dragen `data-color`. De globale selector `querySelector('[data-color]')` vindt de eerste groepsoptie, vóór het kleurveld.
- **Gevolg:** bij groepswijziging wordt de kleurhex geschreven naar de `value` van die optie. Het zichtbare kleurveld verandert niet. De eerste groep kan vervolgens een kleurcode als `group_id` insturen en opslaan laten mislukken.
- **Categorie / zekerheid:** implementatie; rechtstreeks uit DOM-volgorde en eventhandler afleidbaar. Productieformulier bekeken, geen productieformulier gewijzigd of ingestuurd.
- **Herstel:** uniek kleurhook of `input[data-color]`, binnen het formulier selecteren. Controleer wisselen tussen twee bestaande groepen en het werkelijk verstuurde groeps-ID.
- **Passende opdracht:** `$impeccable harden`.

### F02 — Content- en module-editors kunnen niet-opgeslagen werk verliezen

- **Bewijs:** `src/pages/api/admin/content/index.ts:12–19` en `[id].ts:13–21` redirecten bij validatie-/opslagfout zonder ingezonden velden te bewaren. `ContentForm.astro` gebruikt de bestaande bescherming voor gewijzigde formulieren niet. `src/components/modules/ModuleEditor.astro:21,38` herlaadt de pagina na acties en uploads; verschillende secties hebben afzonderlijke formulieren.
- **Gevolg:** een lange blogtekst kan na bijvoorbeeld een dubbele slug verdwijnen. Een module-upload of het opslaan van een andere sectie kan nog niet opgeslagen websitetekst weggooien.
- **Categorie / zekerheid:** implementatie; broncodepad bevestigd, geen opzettelijke productie-opslagfouten veroorzaakt.
- **Herstel:** inhoud bij fouten behouden; conceptopslag en wijzigingswaarschuwing; geen volledige reload zolang een andere sectie gewijzigd is. Maak duidelijk wat elke opslagactie bewaart. De dossierformulieren en product-flashvelden bieden bestaande patronen.
- **Passende opdracht:** `$impeccable harden`.

### F03 — Een module via ‘Nieuw product’ kan onbewerkbaar worden

- **Bewijs:** `ProductForm.astro` laat `module` en `guide` kiezen. `src/lib/adminProducts.ts` maakt in `createProduct` alleen een productrecord. `src/pages/admin/producten/[id].astro:9` stuurt deze typen naar de module-editor. `getModuleAdmin` in `src/lib/modules/server.ts` vereist daarnaast `module_details`; zonder details volgt terugsturen naar de lijst. De gecontroleerde migraties bevatten geen algemene producttrigger die dit oplost; de gespecialiseerde moduleflow initialiseert details wel.
- **Gevolg:** een product kan in de lijst bestaan maar bij bewerken steeds terug naar de lijst sturen. De generieke en gespecialiseerde aanmaakflow spreken elkaar tegen.
- **Categorie / zekerheid:** implementatie; volledige codeketen bevestigd, geen testproduct in productie aangemaakt.
- **Herstel:** module/guide in de generieke flow naar de gespecialiseerde creatie sturen, of de volledige creatie atomair uitvoeren. Bestaande producten zonder details opsporen en gecontroleerd herstellen.
- **Passende opdracht:** `$impeccable harden`.

### F04 — Oude mailactie omzeilt de nieuwe controle vóór opnieuw verzenden

- **Bewijs:** `/admin/mail` vraagt expliciete bevestiging vóór opnieuw klaarzetten van mislukte mails. Onderaan `/admin/vragenlijsten` bestaat nog een andere actie. `src/pages/api/admin/catalog/mail.ts:5` reset alle mislukte commerce-mailjobs en verwerkt een ronde, zonder die bevestiging of dezelfde auditregistratie.
- **Gevolg:** een beheerder kan onbedoeld opnieuw verzenden via een scherm dat andere veiligheidsafspraken hanteert. Bij een onzekere eerdere bezorging is dubbele mail mogelijk. Dit is een inconsistentie binnen bevoegd beheer, geen aangetoonde autorisatie-omzeiling door buitenstaanders.
- **Herstel:** één herstelpad, dezelfde bevestiging/audit, heldere scheiding tussen geplande mail verwerken en mislukte mail opnieuw proberen.
- **Categorie:** implementatie. **Passende opdracht:** `$impeccable harden`.

### F05 — Nieuw teamaccount staat standaard op Superadmin

- **Bewijs:** `src/lib/adminUsers.ts:5` zet `super_admin` als eerste rol; `src/pages/admin/gebruikers.astro` rendert de opties zonder placeholder of andere standaard.
- **Gevolg:** wie naam, e-mail en wachtwoord invult en de rol overslaat, geeft volledige organisatietoegang. De zwaarste rol vraagt nu de minste bewuste keuze.
- **Herstel:** expliciet kiezen verplicht maken of Medewerker als beperkte standaard; bij Superadmin duidelijk de gevolgen tonen.
- **Categorie:** implementatie/foutpreventie. **Passende opdracht:** `$impeccable harden`.

### F06 — Te lichte kleine tekst ondermijnt leesbaarheid

- **Bewijs:** `src/styles/admin.css:12` definieert `--admin-faint: #84918b`, gebruikt op onder meer tabelkoppen en metadata van 8–12px. Berekend contrast: **3,28:1 op wit**, **3,08:1 op #f7f8f6**. De cataloguskleur `#6d7e78` haalt circa **4,28:1 op wit** bij kleine tekst.
- **Gevolg:** juist belangrijke secundaire informatie is moeilijk leesbaar. Voor gewone kleine tekst ligt dit onder WCAG AA 1.4.3, 4,5:1. Niet elk gebruik van het token is tekst; de genoemde kleine teksttoepassingen zijn het probleem.
- **Herstel:** apart leesbaar secundair teksttoken; lettergroottes van 8–10px herzien. Controleer echte voor-/achtergrondparen inclusief badges, hover en focus.
- **Categorie:** toegankelijkheid/theming. **Passende opdracht:** `$impeccable typeset`.

## P2 — volgende herstelronde

| ID | Bevinding, bewijs en gevolg | Gericht herstel | Categorie / opdracht |
|---|---|---|---|
| F07 | **Mobiele mailcijfers verliezen hun labels.** Live gezien op 440px. `mail.astro:19` heeft cellen zonder `data-label`; `admin.css:1001–1007` verbergt de kop en verwacht juist dat attribuut. Losse nullen en aantallen vertellen niet meer of ze gepland, bezig of mislukt betekenen. | Alle cellen van labels voorzien of een expliciete mobiele samenvatting. Andere `.admin-table`-gebruikers op dezelfde afspraak controleren. | Responsive / `$impeccable adapt` |
| F08 | **Mislukte privacywijziging blijft onzichtbaar.** API `privacy/[id].ts:15` redirect naar `?error=update_failed`; `admin/privacy.astro` verwerkt alleen de succesmelding. De beheerder kan denken dat de wijziging is gelukt. | Fout tonen, context behouden, huidige status duidelijk houden en opnieuw proberen aanbieden. | Implementatie / `$impeccable harden` |
| F09 | **Lijstlimieten geven een onvolledig beeld zonder dat te zeggen.** `superAdmin.ts` berekent klanttotalen uit de laatste 500 bestellingen globaal; oudere aankopen kunnen daardoor ontbreken in uitgaven/aantallen. `adminUsers.ts:26` haalt slechts de eerste 100 Auth-gebruikers op en filtert daarna op team. Privacy stopt bij 100; taken standaard bij 12; klantdetail heeft verschillende limieten van 50/100. | Totalen server-side over de volledige set berekenen; cursor/paginatie; ‘x van y’ en vervolgactie. Privacy zo ordenen dat oude afgehandelde verzoeken nieuwe open verzoeken niet verdringen. | Implementatie/performance / `$impeccable optimize` |
| F10 | **Oude Professionals-pagina heeft een dood uitnodigknopje.** `admin/professionals/index.astro` toont een knop met `aria-disabled=true`, geen werkende handler en een mailproviderverklaring. De Therapeuten-flow heeft inmiddels wel een uitnodigpad. | Oude route doorsturen naar de actuele beheerplek, verwijzingen corrigeren. Als een actie niet kan, concrete reden en werkbare vervolgstap tonen. | Implementatie / `$impeccable clarify` |
| F11 | **Navigatie heeft overlappende ingangen.** ‘Profielen’ gaat naar dezelfde plek als ‘Vragenlijsten & profielen’; Producten en Modules overlappen; Professionals en Therapeuten zijn verschillende ervaringen. | Eén primaire plek per beheertaak, gespecialiseerde editors consequent daar openen. Labels vanuit de taak van de beheerder kiezen. | Implementatie/UX / `$impeccable distill` |
| F12 | **Dashboard vraagt extra zoekwerk en verspilt aandacht.** Productie toont een groot ‘Aandacht nodig’-vlak dat naar ‘Op te volgen’ erboven verwijst. Recente bestellingen/afspraken in `DashboardContent.astro` zijn geen directe detail-links. | Eén aandachtsoverzicht met aantallen en concrete acties; rustige compacte toestand zonder open punten. Maak activiteiten direct doorklikbaar naar het juiste detail. | Implementatie/UX / `$impeccable layout` |
| F13 | **Mailherstel vraagt een oorzaak te controleren die het scherm niet toont.** `/admin/mail` bevat alleen totalen per wachtrij, geen individuele fout, laatste poging, ouderdom of volgende poging. | Toon een geredigeerde joblijst met diagnose, relevante tijden en gericht herstel. Geen gevoelige mailinhoud of geheimen in technische fouten tonen. | Implementatie/UX / `$impeccable harden` |
| F14 | **Contentversiegeschiedenis is geen herstelgereedschap.** Content-editor toont nummers, datums en status; geen versie openen, vergelijken of herstellen. De opgeslagen snapshots helpen de beheerder daardoor niet zelfstandig. | Eerst oude versie kunnen bekijken; daarna gecontroleerd herstellen als nieuwe versie. Gebruik de module-releaseflow als voorbeeld. | Implementatie/UX / `$impeccable harden` |
| F15 | **Geen zoekresultaten kan een lege tabel opleveren.** `admin/afnames/index.astro` controleert de oorspronkelijke lijst op leegte, terwijl de getoonde lijst gefilterd is. Ook enkele catalogus-/modulelijsten missen gerichte nulresultaatfeedback. | ‘Geen resultaten voor deze filters’, actieve filters tonen en één actie om te wissen. Onderscheid lege databank, geen treffers en laadfout. | Implementatie/UX / `$impeccable clarify` |
| F16 | **Geslaagde teamwijzigingen zien eruit als fouten.** `gebruikers.astro` gebruikt alleen voor `created` successtijl. `role_changed`, `suspended` en `reactivated` krijgen foutstijl en waarschuwingsicoon. | Type van melding expliciet modelleren; geslaagd, waarschuwing en mislukt consistent tonen. | Implementatie/UX / `$impeccable clarify` |

## Wat al zeer sterk is

1. **Dossierveiligheid en schrijfzekerheid.** Toegewezen toegang, auditregistratie, concept-/herstelmechanismen, versie-/conflictcontrole en bescherming van gewijzigde formulieren zijn hier verder uitgewerkt dan in de commerciële editors. Dit verdient navolging in de rest van admin.
2. **Agenda met echte operationele details.** Europe/Brussels en zomer-/wintertijdvalidatie, revisiecontrole, afhandeling van verouderde verzoeken en behoud van de laatste bekende gegevens bij fouten. Er is een lijstalternatief; mobiel start met een bruikbaardere dagweergave. Fysieke touchinteractie niet getest.
3. **Server-side autorisatie.** Routes/API's gebruiken servercontroles; navigatie volgt rechten. Niet-herkende beheerpaden krijgen niet zomaar toegang. Privé/no-store/noindex-headers zijn aanwezig. Geen volledige claim over providerconfiguratie of alle rollen end-to-end.
4. **Sterke adminshell.** Rustige groene identiteit, overzichtelijke titels en terughoudende oppervlakken. De nieuwe navigatiecode ondersteunt Escape, focusherstel en mobiele focusafscherming. Niet alleen een mooi zijmenu, maar aandacht voor gebruik met toetsenbord.
5. **Modulepublicatie en bestanden.** Scheiding tussen concept en publicatie, versies/herstel, uploadvalidatie, hervatbare uploads en controles voordat materiaal verkocht kan worden. De grootste zwakte zit in de editorinteractie eromheen, niet in het idee van de publicatieflow.
6. **Eerlijke systeemstatus.** Instellingen gebruiken ook ‘onbekend’ en verouderde status in plaats van alles groen te tonen. Database/Auth en SMTP worden onderscheiden. Mailopvolging legt de dagelijkse retrybeperking uit; een gezonde keuze binnen Vercel Hobby.
7. **Commerce en analytics hebben zorgvuldige basisregels.** Bestel-/prijssnapshots, private rapportbestanden met formaat-/handtekeningcontrole, duurzame mailjobs; analytics filtert op toestemming, productie en publieke context en gebruikt caching.
8. **Betekenisvolle bestaande controles.** De lokale suite slaagde met 150/150 tests; TypeScript en Astro-productiebuild slaagden. Dat ondersteunt de technische basis, maar dekt de hierboven gevonden formulier-/DOM-/foutpadscenario's nog niet.

## Visuele en operationele observaties

- De basisvormgeving hoeft niet vervangen te worden. De grootste zichtbare winst komt van leesbare secundaire tekst, grotere bediening, consequente veldstijlen en minder dubbele hiërarchie. Een aantal iconische knoppen is circa 23px; op mobiel liever een ruimer raakvlak rond het icoon. 44px is hier een praktische ontwerprichtlijn, geen claim dat elk kleiner element automatisch dezelfde WCAG-regel schendt.
- Sommige lijsten halen alles op en filteren in de browser; de klantenlijst loopt ook de Auth-pagina's door. Dit wordt een schaalrisico, geen in deze audit gemeten vertraging. Meet met representatieve aantallen voordat je een brede performanceherbouw doet.
- In de bekeken productie-dossierlijst waren testachtige records en een dubbel ogend naam/e-mailpaar zichtbaar. Persoonsgegevens zijn bewust niet overgenomen. Dit vraagt een gecontroleerde datakwaliteitsronde; dezelfde e-mail kan bij gezinnen legitiem zijn. Niet automatisch samenvoegen of verwijderen. Een andere taak kan de testdata intussen al hebben opgeruimd.
- De live sessie had eigenaarsrechten. Andere rollen, verlopen sessies, fysieke touch, echte betaalmutaties, publicaties, herstelmails en foutinjectie zijn niet volledig live doorlopen. Er is geen aangetoonde datalekclaim en geen volledige beveiligings-/juridische audit.

## Aanbevolen volgorde

1. **P1 — `$impeccable harden`:** F01–F05 repareren. Gericht verifiëren: groeps-ID na wisselen, inhoud na dubbele slug/503, andere module-sectie opslaan met dirty tekst, generieke modulecreatie en consistente retrybevestiging, nieuwe accountrol.
2. **P1 — `$impeccable typeset`:** F06; secundaire tekst en kleine controles over de hele admin nalopen met berekende contrasten.
3. **P2 — `$impeccable adapt` en `$impeccable harden`:** mobiele tabelcontracten, privacyfouten en versieherstel (F07/F08/F13/F14).
4. **P2 — `$impeccable optimize`:** volledige totalen en zichtbare paginatie (F09), daarna pas extra optimaliseren op basis van metingen.
5. **P2 — `$impeccable distill`, `$impeccable clarify` en `$impeccable layout`:** één navigatiepad per taak, correcte feedback, gerichte lege toestanden en actiegericht dashboard (F10–F12/F15/F16).
6. **Laatste stap — `$impeccable polish`:** uniforme velden, bediening en visuele details nadat de werking klopt.

Deze opdrachten kunnen afzonderlijk, samen of in een gekozen volgorde worden uitgevoerd. Daarna `$impeccable audit` herhalen op dezelfde flows.

## Controlebewijs en detectornuance

- `npm test`: 150 geslaagd, 0 mislukt; uitvoer `/tmp/mygrowise-admin-audit-tests.log`.
- `npm run check`: TypeScript en Astro-build geslaagd; uitvoer `/tmp/mygrowise-admin-audit-check.log`.
- Impeccable-brondetector op `src/pages/admin` en `src/components/admin`: 19 advisories, uitvoer `/tmp/mygrowise-admin-detector.json`. De gevonden DESIGN.md-afspraken gelden alleen voor `/startpunt`. Afwijkingen daarvan tellen daarom **niet** als 19 bevestigde adminfouten. Contrast en inconsistenties hierboven zijn onafhankelijk beoordeeld.
- Er waren al veel lokale wijzigingen. Die zijn niet teruggedraaid; de audit is een momentopname tijdens actief werk. De checks gelden voor de geteste lokale staat, niet automatisch voor iedere latere wijziging.
