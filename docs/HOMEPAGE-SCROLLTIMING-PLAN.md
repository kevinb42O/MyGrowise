# Homepage — scrollchoreografie en timingfix

Datum: 29 oktober 2026. Status: uitgevoerd en lokaal gecontroleerd; afstanden hieronder blijven het oorspronkelijke afstelvoorstel.

## Richting

De bestaande beeldwereld behouden: het hoofd als portaal, het landschap, de lelie, het beeld dat papier wordt, de modulebladen en de echte mensen. De timing moet aandacht regisseren: oriënteren → herkennen → begrijpen → kiezen → vertrouwen. Beweging krijgt een duidelijke aanleiding en een rustige aankomst. De bezoeker bepaalt de voortgang met native scroll.

Dit is een gerichte motionreview vanuit het perspectief van een eerste bezoeker, geen volledige toegankelijkheidsaudit of gebruikersonderzoek.

## Bekeken en gemeten

De lokale homepage op localhost:4321 is visueel bekeken, met gecontroleerde scrollposities door opening, herkenning, inzicht, modules, routes, oprichtersverhaal en video. De animatielogica en actieve CSS zijn daarnaast gelezen. Volledige choreografie bevestigd bij 1440 × 1000; bij 390 × 844 viel de pagina terug naar de gewone leesweergave. Bij de aanvankelijke 1280 × 720 was de hero wel geanimeerd, maar de volledige hoofdstukervaring niet actief.

Op 1440 × 1000 is de zichtbare stage circa 919 px hoog. De journey-track meet circa 10.898 px, met ongeveer 9.979 px sticky scrollafstand vóór het team. Het verhaal heeft een track van 2.700 px, dus ongeveer 1.781 px sticky scrollafstand. Trackhoogte omvat ook de zichtbare stage: die is geen extra animatieafstand.

Momentopname van de tijdens deze review bekeken implementatie. Er liepen gelijktijdig lokale wijzigingen aan onder meer een HomeLoading-component. Een aanvullende laptopcontrole op 1280 × 800 werd onderbroken door een tijdelijke SSR-importfout voor die component; die schermmaat is niet gevalideerd. Geen prestatiemeting, echte trackpadtest of test op fysieke mobiele hardware uitgevoerd.

## Diagnose per moment

| Moment | Ervaring voor de bezoeker | Oorzaak in de huidige partituur | Fixrichting |
|---|---|---|---|
| Portaal en openingszin | Sterke ruimtelijke entree; tekst verzamelen, vergroten, lelie tonen en verdwijnen concurreren om dezelfde blik. | Zoom over 0–66% van intro; verzamelen 1,5–26%; groeien 26–44%; titel verdwijnt 44–53%; ondersteunende tekst begint al op 46%. Overal dezelfde quintische smoothstep. | Eén hoofdaccent per fase. Openingszin laten landen; lelie ondersteunend houden; uitleg pas laten overnemen wanneer de hoofdzin vertrekt. |
| Uitleg, acties en Virginie | De daadwerkelijke propositie krijgt te weinig rust na alle introductiebeweging. | Introafstand 1,65 stage. Scrollcue is pas rond 86% volledig aanwezig; op 100% begint de hero-uitgang. Circa 0,23 stage volledig samengesteld beeld vóór vertrek. | Een eigen leesplateau van circa 0,65 stage na volledige aankomst. Knoppen blijven in dat hele interval zichtbaar, stil en bereikbaar. |
| Herkenning | Het eerste inzicht moet binnenkomen terwijl de compositie nog arriveert; daarna wisselen de zinnen voortdurend. De laatste zin blijft relatief lang staan. | Leesprogressie start al bij 65% van de korte hero/herkenning-overdracht. De drie zinnen worden continu langs een focuspunt bewogen, zonder aparte rustvensters. | Eerst kop/compositie laten landen. Daarna drie afzonderlijke gedachten, elk met een stabiel leesvenster en kortere wissel. Slotzin krijgt een afzonderlijke afronding. |
| Herkenning → Inzicht | Soms wachten, soms een ingehaalde entree: bij dezelfde positie kan het beeld nog veranderen. | Handoff speelt 1.300 ms op kloktijd na een scrolldrempel. Materiaaltransformatie rekent ondertussen onafhankelijk met absolute scrollpositie. | Eén omkeerbare scrolltijdlijn voor landschap, titel, leesrust en papier. Geen autonome 1,3-seconden-overgang die door verder scrollen wordt ingehaald. |
| Landschap → papier | Mooi inhoudelijk gebaar; de titel kan al gaan reizen voordat zijn entree is uitgewerkt. | Material start op timeline-offset −0,25 stage en eindigt op +0,45 stage; titelreveal hangt aan de aparte klok. | Titel eerst vol zichtbaar en gecentreerd; circa 0,30 stage rust. Daarna één duidelijke transformatie naar het papier, gevolgd door productleesrust. |
| Modulebladen | Het draaien van de reeks weegt zwaar tegenover de tijd om elk aanbod te begrijpen. Bij wisselen kan de uitleg vrijwel wegvallen. | Wissels duren elk 0,55 tijdlijneenheid; eerste en middelste stabiele venster circa 0,50. Rond paperPhase n+0,5 zijn beide tekstalpha’s nul, want de cutoff is 0,46. | Wissels korter dan de leesplateaus; tekstoverdracht rond het landen van het volgende blad regisseren, zonder leeg midden. Afzonderlijke aandacht voor beschikbaarheid en actie. |
| Laatste module | De derde module blijft langer hangen zonder dat er meer te begrijpen is. | Volledig derde blad vanaf x=7,75; route-entree begint op x=8,45. Venster 0,70 versus 0,50 voor de middelste: circa 40% langer. | Vergelijkbare leesbudgetten per module. Alleen meer afstand geven bij werkelijk langere inhoud. |
| Routekeuze | Twee duidelijke bestemmingen; dit verdient een bewust beslismoment na de productreeks. | Route-entree over x=8,45–9,30; semantisch actief vanaf x=8,95, terwijl de onthulling nog loopt. | Korte ruimtelijke opening, daarna beide acties volledig stil en bereikbaar. Vervolgens gewone doorloop naar de mensen. |
| Oprichtersverhaal → video | Na de lange eerste journey vraagt het verhaal opnieuw veel regie. De video krijgt juist nauwelijks een volledig geland moment. | Gordijn 3–42%; filmreveal 62–95%; nog maar 5% pinned afstand volledig open. Op gemeten desktop circa 89 px. | Gordijn compacter; quote eerst leesbaar; film sneller laten landen en een eigen zichtbaar/bedienbaar eindvenster geven. |
| Team, FAQ en einde | Vrij lezen werkt als noodzakelijke adempauze. | Deze delen staan grotendeels in documentflow. | Die afwisseling behouden. Geen extra pinning of losse revealanimaties toevoegen. |

## Nieuwe partituur: eerste afstelvoorstel

Eenheid **S = de gemeten zichtbare stagehoogte onder de navigatie**. Alle waarden hieronder zijn te testen scrollafstanden, geen verplichte seconden leestijd. Stilstaan blijft onbeperkt mogelijk; snel doorscrollen blijft toegestaan. Het leesplateau betekent dat de compositie tijdens verdere scroll even stabiel blijft.

| Fase | Afstand desktop | Regie |
|---|---:|---|
| Openingszin: verzamelen en landen | 0,30 S | Beeld reageert direct; titel heeft één duidelijke bestemming. |
| Door het portaal | 0,65 S | Camera is hoofdbeweging; diepteverschil tussen steen en landschap behouden. |
| Propositie en Virginie arriveren | 0,25 S | Uitleg neemt aandacht over; korte onderlinge vertraging, geen lange cascade. |
| Hero lezen / actie | 0,65 S | Uitleg en acties volledig stil. |
| Naar herkenning | 0,35 S | Kop en lelie landen vóór de gedachten wisselen. |
| Drie herkenningsgedachten | 3 × 0,45 S | Per gedachte circa 0,32 S lezen en 0,13 S wisselen; laatste wissel voert naar afronding. |
| Herkenning afronden | 0,30 S | Geruststelling en richting zichtbaar, zonder een vierde lange scène. |
| Naar inzichtlandschap | 0,40 S | Uitgang sneller dan aankomst; één doorlopende omkeerbare overdracht. |
| Inzichttitel lezen | 0,30 S | Volledig zichtbaar en gecentreerd. |
| Landschap wordt papier | 0,60 S | Beeld en titel verplaatsen samen; uitleg volgt tegen het einde. |
| Profiel begrijpen / actie | 0,80 S | Meer leesruimte vanwege inhoud, prijs en betekenis van het profiel. |
| Modules arriveren | 0,40 S | Eerste blad en bijbehorende uitleg landen als één compositie. |
| Drie modules lezen | 3 × 0,65 S | Vergelijkbaar basisbudget; alleen op gemeten inhoud verlengen. |
| Twee bladwissels | 2 × 0,30 S | Sneller dan de leesmomenten; geen leeg tekstvenster. |
| Routes openen | 0,45 S | Nieuwe keuzeruimte duidelijk onthullen. |
| Routes overwegen | 0,75 S | Beide opties volledig leesbaar; verder scrollen geeft team vrij. |

Totaal voorstel journey: circa **10,15 S**. Huidig gemeten: circa **10,86 S**. De winst zit vooral in de herverdeling: minder budget voor herhaalde introductiebeweging en bladwissels, meer voor propositie, herkenning en aanbod begrijpen. Niet de hele pagina blind versnellen.

Verhaal als aparte reeks: gordijn circa 0,35 S → quote circa 0,65 S → filmoverdracht circa 0,40 S → film circa 0,35 S, daarna documentflow. Dit is een eerste verhouding; de volledige quote moet al vóór het leesvenster zichtbaar zijn. Video blijft uitsluitend op verzoek afspelen.

Mobiel krijgt een eigen afstelling op basis van wat daadwerkelijk past. Eerst vaststellen waarom 390 × 844 terugvalt. De veilige leesweergave blijft bestaan. Bij voldoende ruimte kan een compactere verticale versie de hoofdgebaren behouden; geen extra scrollhoogte toekennen wanneer de betreffende animatie is uitgeschakeld. Voor mobiele herkenning met alle zinnen tegelijk is geen driemaal herhaald desktop-leesbudget nodig.

## Technische uitvoering

1. **Partituur centraliseren in `src/scripts/homeExperience.js`.** Benoemde fases met `enter`, `read`, `exit` en gemeten afstanden. Eén berekening levert de journey-scrollafstand én faseposities. Vervang de koppeling tussen `36`, `736`, `886`, `1.65`, `1.2` en de x=4–10-tijdlijn. Houd de wijziging lokaal aan de homepage.
2. **Kloktijd uit de hoofdstukoverdracht halen.** Vervang `handoffStarted`/`1300` en de bijbehorende drempels door scrollprogressie. Stilstaan houdt het beeld vast; terugscrollen volgt dezelfde compositie terug. Tijdgestuurde microfeedback op bediening mag blijven.
3. **Easing per betekenis.** Camera en grote ruimtelijke transformaties: continue, zachte aanloop/landing. Korte tekstuitgangen: compacter. Entree: duidelijke vertraging naar de eindstand. Niet elke fase hetzelfde sterke ease-in/ease-out geven, want dat herhaalt steeds remmen en optrekken. Geen nieuwe spring of animatiebibliotheek nodig.
4. **Smoothing begrenzen.** De huidige chapter-lag met een tijdconstante van 100 ms kritisch verkleinen of verwijderen; circa 95% naloop duurt bij een sprong ongeveer 300 ms. Geen extra vertraging bovenop easing. Beweging moet voorspelbaar omkeerbaar blijven.
5. **Leesvensters en interactie afstemmen.** Zichtbaarheid, `inert`, `aria-hidden` en klikbaarheid volgen dezelfde benoemde fases. Geen zichtbare actie die nog onbereikbaar is. Controleer ook het zichtbare eindbeeld van het verhaal wanneer de video de actieve laag wordt.
6. **Navigatie uit dezelfde partituur afleiden.** `points`, de moduleknoppen, skip, hashlinks, popstate en herstel verwijzen naar benoemde leesmomenten. Een deeplink mag geen lange entree alsnog moeten afspelen.
7. **CSS-hoogtes opruimen in `src/styles/homeExperience.css`.** Alleen de relevante trackregels consolideren; JS-afstanden en CSS-hoogtes uit één bron voeden via custom properties. Geen globale stylesheetherbouw. Resize en fonts opnieuw meten zonder heen-en-weer schakelen tussen layouts.
8. **Eerst opening → herkenning → inzicht afstellen.** Daarna modules/routes, dan verhaal. Pas na visuele beoordeling van het geheel de definitieve afstanden vastzetten.

## Acceptatie vóór afronding van de implementatie

- Langzame, normale en snelle scroll; kleine terugbewegingen; stoppen midden in een overdracht. Geen verplicht uitspelen, sprong of spontane scèneverandering na stop, afgezien van een zeer korte eventuele smoothing-settle.
- Elk tekstblok heeft een expliciet volledig leesbaar venster; de propositie krijgt na aankomst extra ruimte; geen vroeg vertrek van kop/actie.
- De eerste twee modules worden niet opgejaagd ten opzichte van de derde. Geen punt waar beide uitlegblokken volledig verdwijnen zonder bewuste compositiereden.
- Inzichttitel volledig geland vóór het papier beweegt. Op dezelfde scrollpositie is na stabilisatie dezelfde compositie zichtbaar, onafhankelijk van aanrijsnelheid.
- Film heeft vóór de sticky-release een volledig zichtbaar en klikbaar venster; geen actie die door semantische lagen wordt geblokkeerd.
- Controleren op 1440 × 1000, 1440 × 900, 1280 × 800, 1280 × 720, 390 × 844 en 360 × 800. Per maat de actieve enhanced/fallback-modus vastleggen. Ook resize, 200% zoom, reduced motion en zonder JavaScript.
- Hoofdstuklinks, modulekeuze, intro overslaan, herladen op hash en browser terug landen op leesbare momenten.
- Visuele controle op begin/25%/50%/75%/einde van de grote overdrachten, daarna de hele pagina op normaal bezoekerstempo bekijken.
- Na codewijzigingen lokaal `npm run check` en gerichte browsercontroles. Geen GitHub Actions, nieuwe dienst of betaalde scheduler. Deployment blijft via bestaande Vercel-integratie en valt buiten dit plan.

## Uitvoering — 29 oktober 2026

De homepage heeft nu één scrollpartituur in `src/scripts/homeExperience.js`. Trackhoogtes, hoofdstuklinks, moduleselectie en rendering gebruiken dezelfde faseposities. De klokgestuurde handoff van 1.300 ms en de chapter-smoothing zijn verwijderd. Stilstand houdt het beeld vast; terugscrollen reconstrueert dezelfde toestand. De introductie duurt 1,20 stage, gevolgd door 0,65 stage hero-leesrust. De drie modules krijgen elk 0,65 stage leesruimte en wissels van 0,30 stage. De inzichttitel heeft 0,30 stage rust vóór de transformatie naar papier. Het verhaal heeft 1,75 stage scrollafstand, met 0,35 stage volledig gelande video aan het eind.

Bij modulewissels blijft precies één complete uitleg zichtbaar: een bewuste tekstcut wanneer het nieuwe blad de voorgrond overneemt. Een geteste wipe is verworpen omdat die tussen twee verschillende koppen sneed. De bladen dragen de beweging; de tekst behoudt zijn samenhang. De mobiele herkenning presenteert nu één gedachte per moment, zodat niet alle drie tegelijk in het pinned scherm hoeven te passen.

Browsercontrole op 1440 × 1000, 1440 × 900, 1280 × 800, 1280 × 720, 390 × 844 en 360 × 800: geen horizontale overflow. Volledige scrollervaring op alle genoemde maten behalve 1280 × 720, waar de hero geanimeerd blijft en het aanbod in documentflow verschijnt. Hero, herkenning, inzicht, modules en video visueel bekeken; stoppen/terugscrollen vergeleken op dezelfde scrollpositie; hoofdstuklink en moduleknop gecontroleerd; reduced-motion geeft alle moduleteksten en herkenningsgedachten vrij. Zonder JavaScript blijven de drie modules zichtbaar en is de laadlaag verborgen. Dit is browseremulatie, geen fysieke trackpad- of mobiele-hardwaremeting.

De bestaande devserver op 4321 serveerde tijdens gelijktijdig werk aan HomeLoading verouderde CSS. Visuele verificatie uitgevoerd via een afzonderlijke verse lokale preview op 4324. Typecontrole/build lokaal geslaagd; mechanische Impeccable-scan van de homepage geeft geen bevindingen. Geen deployment uitgevoerd.
