# MyGrowise — homepage als doorlopende visuele ervaring

29 oktober 2026 · De volledige testversie is door Kevin goedgekeurd en lokaal geïntegreerd, met Virginies oorspronkelijke foto in de hero. Nog niet gedeployd.

## Huidige implementatie en controle

- `src/pages/index.astro` gebruikt nu `HomeExperience.astro`, met de goedgekeurde hoofdstukken en overgangen. `homeExperience.js` stuurt de gedeelde scrollpartituur; `homeExperience.css` is afgebakend tot de homepage.
- Na aanvullende feedback heeft de opening een eigen korte stage. De herkenningssectie staat in normale documentflow: alle vier punten zijn tegelijk leesbaar, zonder vastzetten of opeenvolgende highlights. Inzicht, modules en routekeuze delen de volgende stage; het persoonlijke verhaal heeft een eigen stage. Team en FAQ hebben vrije leesruimte.
- De brandingvideo staat op desktop compacter naast de introductietekst en op mobiel eronder. Poster en speler behouden hun volledige 16:9-verhouding, met een maximale breedte van 960 px en zonder hoogteclamp, cover-uitsnede of hoverzoom. Deze verfijning is ook in de afzonderlijke testversie op poort 5198 verwerkt.
- De titel “Inzicht dat ergens naartoe leidt” is vanaf het beeldvullende landschap zichtbaar. Dezelfde titel verplaatst en schaalt naar de uiteindelijke tekstkolom; uitleg en productinformatie komen daarna binnen. Het kleurverschil tussen foto en papier volgt de beeldrand, met één toegankelijke titel en een decoratieve tekstlaag. In de rustige weergave en zonder JavaScript blijft de normale statische titel staan. Ook de testversie bevat deze overdracht.
- Deze inzichtscène gebruikt het eigen bestaande beeld `het-volledige-landschap.webp`, met een hoger uitzicht over het meer en warm wolkenlicht. Het hero-landschap blijft `innerlijke-landschap-hero-v1.webp`; de inzichtscène herhaalt dat beeld niet.
- Virginies oorspronkelijke praktijkfoto (`mygrowise-74.jpg`) staat als afzonderlijk portret boven het landschap in de hero, ook op mobiel, en wijkt mee terug tijdens de overgang naar herkenning.
- Profielinformatie, moduleteksten, prijzen, beelden en beschikbaarheid komen uit de bestaande publieke producthelpers. Ontbrekende modulegegevens leveren een verzorgde verwijzing naar het moduleoverzicht. Er wordt geen fictief rapportvoorbeeld als productbewijs getoond.
- De bestaande navigatie, analytics-toestemming en juridische footer blijven gebruikt. Alleen op de homepage vervalt de dubbele footerintro, omdat de nieuwe afsluiting dezelfde hoofdactie al bevat. Productlinks navigeren binnen de echte website; previewbalk, testlinks en preview-opslag zijn niet overgenomen.
- Een rustige weergave, verminderde beweging en een volledige documentversie zonder JavaScript blijven beschikbaar. De scènes controleren werkelijke teksthoogtes en vallen terug naar vrije documentflow als de inhoud niet past.
- Lokaal gecontroleerd: typecontrole en productiebuild; browserproeven op 1440 × 1000, 390 × 844, 360 × 740, 430 × 932, 820 × 1180, 1440 × 640 en 720 × 500. Scrollen in beide richtingen, hoofdstuklinks, modulekeuze, FAQ, mobiel menu, privacykeuze, directe `#modules`-navigatie, verminderde beweging en de inhoud zonder JavaScript zijn getest. Geen JavaScriptfouten of ontbrekende lokale bestanden waargenomen.
- Deze controles bewijzen geen prestaties op fysieke mobiele hardware, externe videoafspeelbaarheid of een deployment. Brede definitieve hero-assets en een goedgekeurd rapportvoorbeeld kunnen later worden toegevoegd.

## Correctie van de eerste uitwerking

De eerste lokale opening (`HomeOpening.astro`) vergrootte een portret en veranderde een boogvorm tijdens het scrollen. Dat was een beperkte verfijning van de bestaande hero en voldeed niet aan de gevraagde ambitie. Kevin heeft expliciet gevraagd om veel verder te plannen, met hoogwaardige transities op het niveau van Webaanzee. Die eerste opening is inmiddels vervangen door de goedgekeurde volledige ervaring.

Onderstaande ontwerprichting vervangt het eerdere plan met drie losse, korte effecten. De aandacht gaat naar de overgangen én de composities die ze verbinden. De bovenstaande implementatiestatus beschrijft wat daarvan nu daadwerkelijk in de lokale website staat.

## Wat er nu werkelijk is onderzocht

Webaanzee is opnieuw lokaal bekeken op 1440 × 1000, op achttien scrollposities van 0 tot 29.100 px, met screenshots van begin-, tussen- en eindstanden. De bijbehorende broncode is gelezen, inclusief `CoastalPortal`, `PortalHeroCopy`, `StickyProjectGrid`, `DepthShowcase`, `ServiceWorkbench`, `Quality`, `Offer`, `About` en `utils/homeChoreography.ts`.

| Mechanisme in Webaanzee | Wat er werkelijk gebeurt | Les voor MyGrowise |
|---|---|---|
| Een fysieke voorgrond met opening | De alpha-voorgrond schaalt sterk voorbij het scherm; het achterliggende kustbeeld blijft staan. | Maak een echte verandering van ruimte. Alleen een foto vergroten is geen ruimtelijke scène. |
| Geregisseerde tekstwisseling | De eerste kop verdwijnt vóór de volgende boodschap verschijnt; een aparte laag bewaakt de leesbaarheid. | Geef elke compositie één leesmoment, zonder twee koppen door elkaar. |
| Projectenwand met tegengestelde beweging | Kolommen komen afwisselend van boven en onder; de hele wand zoomt naar 2,05×, zijkanten wijken uit en het midden wordt vrijgemaakt. | Een compositie mag tijdens het scrollen van functie en schaal veranderen. |
| Wand naar dieptegalerij | De voorste scène verlaat het beeld en onthult de galerij die erachter al gereed staat. | Bereid de volgende scène onder de huidige voor; voorkom losse animaties na een lege grens. |
| Portfolio naar diensten | De galerij wijkt terug naar 0,86× en verplaatst iets naar links/beneden; een nieuw vlak komt van onder, daarna landen beeld en tekst. | Gebruik terugwijken, afdekking en aankomst als één overdracht. |
| Diensten met detailbeelden | Beeldmaskers, beperkte rotatie en losse detailkaders bewegen op verschillende snelheden; tekst heeft een eigen rustfase. | Laat materiaal en hoofdbeeld bewegen terwijl de uitleg leesbaar blijft. |
| Kwaliteit als visuele onderbreking | Een donker vlak opent vanuit het midden; titel en uitleg verschijnen in volgorde; uitleg maakt daarna plaats voor een slotzin. | Een groot kleur- en schaalverschil kan een inhoudelijke wending markeren. |
| Prijsbladen | Het volgende blad schuift van onder over het vorige, dat terugwijkt en licht kantelt. | Gebruik tastbare overlap om een reeks als samenhangend geheel te tonen. |
| Kust naar persoonlijk verhaal | Het kustbeeld schuift opzij en onthult portret en achtergrondkleur die al klaarstaan. | Een mens kan letterlijk achter de beeldwereld tevoorschijn komen. |

Desktop heeft technisch twee sticky trajecten met zeven grote hoofdstukken; dat zijn meer overgangsmomenten en subfasen dan die telling suggereert. Het hoofdtraject was lokaal 26.650 px hoog. Mobiel gebruikt een eigen opbouw. De conclusie is geen verplicht aantal pins, maar een veel hoger niveau van compositie, overdracht en beeldmateriaal.

## Centrale ontwerpgedachte

**Je komt binnen in een wereld die je herkent. Je ontdekt hoe MyGrowise die helpt begrijpen. Je eindigt bij een concrete volgende stap en de mensen achter die stap.**

Het innerlijke landschap wordt een beeldtaal voor de homepage, in samenhang met de bestaande modules. Het mag niet de indruk wekken dat elke bezoeker eerst een module of profiel nodig heeft. De hoofdboodschap blijft direct concreet: psychologisch inzicht en online begeleiding, zelfstandig of samen.

De wereld krijgt twee registers die elkaar afwisselen:

- **Beeld en ruimte:** landschap, water, licht, echte mensen, grote fotografie en diepe composities.
- **Helderheid en materiaal:** warme lichte vlakken, sterke typografie, echte werkboek-/rapportdetails, overzichtelijke keuzes en directe acties.

Het kleurverloop van de pagina is bewust: warm licht → diep groen → landschap → warm papier → zacht roze → echte huidtinten/praktijk → diep groen → licht. Dit is een voorstel, geen nieuw vastgelegd merksysteem. De lelie en bestaande merknaam blijven herkenbaar. Roze draagt één betekenisvol accent per compositie, niet elke tweede tekstregel.

## Acht hoofdstukken en hun volledige transities

### 1. Binnenkomen — een beeld dat de hele pagina opent

**Beginbeeld:** een beeldvullende compositie, geen tekstkolom naast een afgerond portret. Voorstel: het innerlijke landschap als grote achtergrond, een echte fotografische voorgrond die diepte geeft, de bestaande kernboodschap en direct zichtbare routes. “Psychologisch inzicht en online begeleiding” staat als heldere uitleg bij de kop, zodat de pagina niet alleen als natuur- of wellnesssite leest.

**Beweging:** over de eerste 100–140svh extra scroll beweegt de voorgrond sneller dan het landschap. De bezoeker lijkt de compositie binnen te gaan. De kop blijft eerst rustig staan en verdwijnt daarna via een zachte tekstmaskering. De navigatie gaat van beeldvariant naar een rustige vaste variant; “Vind je startpunt” blijft bereikbaar. De volgende tekst is al achter de eerste compositie aanwezig.

**Eindbeeld:** het landschap vult het scherm, de camerabeweging komt tot rust en er is ruimte voor één heldere uitspraak. Een knop naar begeleiding blijft beschikbaar zonder het hele verhaal te doorlopen.

**Wat nodig is:** een echte brede compositie met voorgrond/achtergrond en aparte mobiele uitsnede. De huidige 1120 × 1400 landschapafbeelding is bruikbaar als conceptreferentie, niet als definitieve ultrabrede hero. Alleen bij een echte alpha-laag spreken we van een voorgrond; geen losse CSS-vormen als vervanging van een natuurlijke contour.

### 2. Herkenning — woorden krijgen ruimte

**Beginbeeld:** de volledige compositie wordt donkerder groen; het landschap blijft nog als rustige onderlaag aanwezig. De bestaande vier herkenningszinnen zijn beschikbaar in de documentstructuur.

**Beweging:** één zin per leesmoment krijgt nadruk. De andere regels verplaatsen beperkt buiten de leeszone en verliezen nadruk; geen letter-voor-letterkaraoke. Een lichte beelddoorgang opent vervolgens vanuit het midden. De groene vlakken wijken boven en onder, waardoor het volgende beeld zichtbaar wordt.

**Eindbeeld:** één grote zin blijft even staan: “Eerst begrijpen. Dan kiezen wat bij je past.” Daarna draagt het beeld de bezoeker over aan concreet inzicht. De tekst is een bestaande boodschap, geen behandelbelofte.

**Waarom dit meer doet:** typografie wordt een echte schermcompositie. Er is een duidelijke wisseling van schaal en ruimte tegenover de opening.

### 3. Inzicht — de beeldwereld wordt een concreet product

**Beginbeeld:** het landschap staat nog beeldvullend.

**Beweging:** het beeld wijkt terug en wordt met een doorlopende uitsnede een beeldvlak binnen een redactionele compositie. Tegelijk komt een warm papieroppervlak van onder binnen. Daarop krijgt een werkelijk werkboek- of rapportdetail de hoofdrol. Geen nieuw plaatje na een fade: dezelfde beeldinhoud verandert zichtbaar van context.

Een groot detail komt tijdelijk naar voren. De bezoeker ziet vervolgens de samenhang met het hele document. Korte uitleg blijft op een vaste leespositie terwijl het materiaal beweegt. De drie inhoudelijke momenten zijn: patronen herkennen, uitleg begrijpen, aanknopingspunten vinden.

**Eindbeeld:** een helder productoverzicht met actuele titel, beschikbaarheid en prijs, plus “Bekijk wat je ontvangt”.

**Afhankelijkheid:** voor een profielrapport is een goedgekeurd, veilig voorbeeld nodig. Zonder dat materiaal bouwen we deze scène met bestaand, goedgekeurd modulemateriaal of houden we de productbewijslaag expliciet open. Geen fictieve scoregrafieken, diagnose, verzonnen dashboard of klinische uitkomst als bewijs.

### 4. Verdieping — modules als ruimtelijke reeks

**Beginbeeld:** een rustig liggend werkboekvlak, met één dominante modulecompositie.

**Beweging:** drie grote bladen vormen een ondiepe stapel. Het voorste blad wijkt circa 4–6% terug, kantelt hooguit 2–3 graden en wordt gedeeltelijk afgedekt door het volgende blad. Het nieuwe beeldvlak en bijbehorende uitleg komen samen aan; de uitleg van het vorige hoofdstuk is dan al weg. De achtergrond neemt een verwante kleur uit het nieuwe beeld over.

De reeks toont bijvoorbeeld Het meer, De stromingen en De mist als drie materiaalwerelden, met hun werkelijke status. De andere modules blijven via het overzicht bereikbaar. Het is geen verplichte galerij door alle zes producten.

**Eindbeeld:** de stapel legt zich neer als overzicht, met een directe link naar modules. Een module wordt nooit als verplichte stap ná een profiel gepresenteerd.

**Verschil met Webaanzee:** we gebruiken het tastbare gedrag van de prijsbladen, maar geven het een eigen materiaal en inhoud. Geen kopie van de portfolio-tunnel.

### 5. Kiezen — twee volwaardige routes in hetzelfde scherm

**Beginbeeld:** de modulecompositie wijkt naar links terug. Aan de rechterkant verschijnt een echt praktijkbeeld achter een verticale rand.

**Beweging:** die rand reist naar het midden. Links blijft de zelfstandige wereld zichtbaar; rechts opent de menselijke wereld. De beelden hebben een kleine tegengestelde verplaatsing, zodat de overgang diepte heeft. De twee routetitels landen pas wanneer de compositie leesbaar is.

**Eindbeeld:** twee gelijkwaardige grote vlakken: zelfstandig inzicht en persoonlijke begeleiding. Beide tonen één korte uitleg en een eigen actie. Hover mag een lichte verschuiving geven, maar kliktargets veranderen niet van plek en geen keuze verdwijnt.

**Interactie:** scrollen selecteert geen route voor de bezoeker. Beide bestemmingen zijn onafhankelijk aanklikbaar; geen diagnose of selectie op grond van welke scène het langst in beeld is.

### 6. Mensen — van keuzevlak naar echte gezichten

**Beginbeeld:** de rechterfotografie uit de routekeuze blijft visueel bestaan en wordt het anker voor het team.

**Beweging:** het kader trekt terug naar een portretformaat terwijl de lichte ondergrond opent. De andere twee portretten komen met een kleine vertraging op hun definitieve plek. De foto-inhoud blijft stabiel; geen vervorming van gezichten of draaiende portretkaarten. Namen en rollen komen op vaste basislijnen aan.

**Eindbeeld:** Virginie, Margot en Amy als ruime redactionele portretten met de bestaande rollen, focus en directe profielacties. Geen decoratieve nummers of hoverlaag die nodig is om de actie te vinden.

**Leesgedrag:** na de overdracht krijgt dit deel gewone scrollruimte; de bezoeker mag hier rustig kiezen en doorklikken.

### 7. Het verhaal — van portret naar praktijk en film

**Beginbeeld:** één groter beeld van Virginie/praktijk, met de bestaande oprichtersquote.

**Beweging:** een praktijkbeeld schuift zijwaarts over de achtergrond terwijl het portret op zijn plaats blijft. Daarna groeit de bestaande videoposter naar een brede filmcompositie. De quote wijkt uit de beeldzone en de afspeelactie krijgt een heldere plek. De video speelt alleen op verzoek.

**Eindbeeld:** één samenhangend verhaalblok met video, quote en korte oprichtersuitleg. De vroegere losse brandingvideo en founder-sectie worden hier inhoudelijk samengebracht.

**Assetgrens:** de bestaande foto's zijn losse camerastandpunten. Een exacte visuele match tussen twee foto's wordt eerst getest; anders gebruiken we bewuste afdekking. Geen goedkope morph tussen verschillende gezichten of scènes.

### 8. Landen — alle ruimte voor de volgende stap

**Beginbeeld:** de FAQ staat in gewone documentflow, zonder vastzetten van lange antwoorden.

**Beweging naar de afsluiting:** een diep groen afsluitvlak komt van onder over de laatste lichte ondergrond. De volgende kop is al aanwezig en wordt door die beweging onthuld. Eén roze accent landt als laatste; geen rij zwevende badges.

**Eindbeeld:** een grote heldere hoofdactie, begeleiding als directe tweede route, en een korte geruststellende bestaande boodschap. Een landschapsdetail uit de opening keert klein terug. De pagina heeft een herkenbaar begin en einde.

## Scrollpartituur: drie trajecten in plaats van acht losse effecten

Eerste afstanden om in een prototype te testen; niet beschouwen als vastgestelde paginalengte.

| Traject | Hoofdstukken | Totale sectiehoogte desktop | Wat de bezoeker ervaart |
|---|---|---|---|
| A. Binnenkomen en herkennen | 1–2 | circa 420–480svh | Eén ruimtelijke opening, tekstregie en een grote overdracht naar inzicht. |
| B. Begrijpen en kiezen | 3–5 | circa 550–650svh | Beeld wordt materiaal; materiaal wordt reeks; de reeks opent twee routes. |
| C. Persoonlijk verhaal | overdracht naar 6, daarna 7 | circa 250–320svh, met vrije leesruimte voor team | Het menselijke beeld blijft tussen composities bestaan; praktijk en film vormen een geheel. |
| Vrije leesdelen en afsluiting | team, FAQ, footer | afhankelijk van werkelijke inhoud | Afwisseling, directe bediening en ruimte voor langere tekst. |

Dit is ambitieuzer en langer dan de vorige opening. De lengte wordt verdiend met inhoud en wezenlijk andere composities. Een overgang zonder informatie of ruimtelijke verandering wordt geschrapt. Geen lange hold waarin alle elementen volledig stilstaan en de bezoeker niets nieuws bereikt.

Binnen elke overdracht krijgt de beweging vier fasen: **leesrust → vertrek → gedeeld tussenbeeld → aankomst en leesrust**. Het gedeelde tussenbeeld wordt expliciet ontworpen. De volgende scène staat klaar voordat de vorige wordt weggehaald.

## Bewegingsgrammatica en kwaliteitslat

- **Eén hoofdbeweging per overdracht.** Bijvoorbeeld het papier dat omhoogkomt. Het terugwijken van het vorige beeld ondersteunt dat; vijf losse richtingen vechten niet om aandacht.
- **Ongelijke snelheden geven diepte.** Voorgrond, materiaal, achtergrond en tekst delen niet dezelfde translate/scale. Tekst blijft tijdens lezen rustig.
- **Continuïteit boven versiering.** Hetzelfde landschap, beeldvlak of portret blijft bestaan tijdens de overdracht. Een crossfade alleen telt niet als ontworpen overgang.
- **Nauwkeurige snijpunten.** Het materiaalvlak moet precies landen op het eindkader. Uitsnede, verhouding en horizontale lijn mogen onderweg niet springen.
- **Leesbare typografie.** Koppen verlaten eerst hun leeszone. Geen tekstdoorloop, over elkaar heen bewegende alinea's of kleurverandering die de letters tijdelijk onleesbaar maakt.
- **Zachte aankomst.** Snelheid en versnelling lopen naar nul aan de randen van het bewegingsvenster. Geen generieke spring op elke scrollwaarde; beelden moeten de vinger/wielpositie voorspelbaar volgen.
- **Beperkte 3D.** Documenten mogen ruimtelijk bewegen. Gezichten blijven fotografisch stabiel. Een WebGL-watereffect is optionele latere verfijning, geen voorwaarde voor de kerncomposities.
- **Gehele kleurvelden.** Achtergronden veranderen als een nieuwe scène aankomt, met bewust gekozen contrast. Geen onafgebroken kleurverloop zonder compositiewissel.
- **Ondersteunende details.** Onderstreping, voortgang en knopfeedback zijn consequent en stil. Geen magnetische tekst, cursortrail of decoratieve deeltjes als vervanging van een sterke scène.

## Mobiel krijgt dezelfde ambitie, een andere choreografie

Het vorige plan schakelde mobiel te snel terug naar gewone blokken. Dit voorstel behoudt ook op mobiel de belangrijkste overdrachten:

1. Een eigen verticale opening met voorgrond/achtergrond en dezelfde directe propositie; kleinere cameraverplaatsing en kortere scrollafstand.
2. De overdracht van beeld naar materiaal blijft bestaan, maar wordt één leesbaar documentdetail per scherm in plaats van een brede desktopcompositie.
3. De bladstapel beweegt verticaal, met status en actie permanent binnen de leeszone. Tekstoverflow krijgt echte extra scrollruimte.
4. De twee routes openen boven elkaar. Eén beeld neemt het andere over; er is geen horizontale galerij die de normale swipe tegenwerkt.
5. De overdracht naar het team houdt één portret als anker. De rest van het team leest als gewone verticale reeks.

De definitieve lengtes worden gemeten op 360/390 px en korte schermen. Een scène die niet past, krijgt een aangepaste compositie; bij grote tekst of verminderde beweging wordt de inhoud volledig vrijgegeven. Toegankelijkheid betekent dat de bezoeker dezelfde informatie en keuzes bereikt, niet dat de hele mobiele vormgeving als eerste wordt geschrapt.

## Wat er vóór productie nodig is

| Materiaal | Al aanwezig | Nodig voor deze richting |
|---|---|---|
| Landschap en modules | De reeks in `public/images/modules`. De hoofdreferentie is verticaal; verschillende covers zijn maar 512 px breed. | Brede hero en mobiele uitsnede op geschikte resolutie; eventuele echte dieptelagen. Geen bestaande lage resolutie uitrekken tot eindasset. |
| Mensen en praktijk | Virginie/praktijkfoto's en drie echte professionalportretten. | Selectie op uitsnede, huidtint, licht en aansluiting tussen scènes; zo nodig bredere originele bronfoto's. |
| Rapport/werkboek | Bestaande inhoud en productstructuur; nog geen hier goedgekeurde rapportpreview. | Veilig, correct voorbeeld voor de productbewijslaag. Selecteer concrete pagina's en leg vast wat illustratief is. |
| Video | Bestaande poster en brandingvideo. | Betere posteruitsnede indien nodig; geen nieuwe video verplicht voor het plan. |
| Productstatus | Bestaande centrale productbron. | Die status zichtbaar houden, ook als een module nog in ontwikkeling is. Geen fraaie maar onjuiste bestelactie. |

In een concept mogen bestaande beelden de compositie aantonen. Dat is geen bewijs dat alle benodigde definitieve beelden al beschikbaar of geschikt zijn.

## Architectuur voor de bouw

Eén centrale scrollpartituur beschrijft de hoofdstukken en handovers. Elk traject heeft een eigen stage, zodat terugnavigatie, vrije leesdelen en layoutaanpassingen beheersbaar blijven. De animatie rekent met gemeten afstanden, geen verzameling willekeurige losse scrolllisteners.

Maak onderscheid tussen de semantische inhoud en decoratieve bewegingslagen. Links en tekst blijven in logische documentvolgorde; verborgen lagen krijgen geen focus. Directe navigatie naar een hoofdstuk landt op een leesbaar moment. Snel scrollen en terugscrollen moeten elke fase reproduceerbaar maken. De navigatie mag niet in dezelfde z-laag vastlopen als het decor.

Kies de bewegingsengine na de eerste representatieve proef, binnen de bestaande Astro-basis. Het project heeft al Framer Motion; extra GSAP of WebGL is geen automatische keuze omdat Webaanzee die gebruikt. Voor dit ontwerp is CSS sticky met een gedeelde tijdlijn vaak voldoende; alleen echte renderbehoeften rechtvaardigen extra techniek.

Beweging kan buiten beeld pauzeren, volgende beelden worden tijdig gedecodeerd en er loopt geen zware permanente renderlus voor een statisch beeld. Controleer compositing en repaintgedrag op echte mobiele hardware voordat grote fotomaskers als goedkoop worden beschouwd. Scroll wordt niet geblokkeerd of vervangen door wielonderschepping.

Vercel Free/Hobby blijft vast. Controles lokaal; deployment via de bestaande Vercel-integratie. Geen GitHub Actions, betaalde scheduler of nieuwe dienst voor deze vormgeving.

## Concrete volgende bouwvolgorde

1. **Motion storyboard:** de grote overdrachten bedienbaar maken met begin-, midden- en eindstand. Dat beoordeelt de ruimtelijke richting; het is geen definitieve homepage of productpreview.
2. **Eerste representatieve proef:** opening → herkenning → beeld wordt materiaal als één werkend desktop- én mobieltraject. Hier moeten de uitsnedes, kleurvelden, tekstwisseling, leesrust en directe acties al op het eindniveau zitten.
3. **Materiaal en routekeuze:** de bladstapel en overgang naar twee routes aan dezelfde partituur toevoegen. Productbewijs pas tonen met goedgekeurd materiaal.
4. **Menselijke overdracht en verhaal:** portretten, praktijk en video als samenhangend laatste traject; daarna FAQ en afsluiting.
5. **Afwerking:** navigatievarianten, terugnavigatie, hover/focus, consent, beeldlading en prestatiewerk.

## Acceptatie: wanneer noemen we dit werkelijk af?

- Elke hoofdtransitie is bekeken op 0%, 25%, 50%, 75% en 100%, op desktop én mobiel. De tussenbeelden zijn bewust gecomponeerd, niet slechts technisch foutloos.
- De beeld→materiaal-overdracht gebruikt dezelfde uitsnede en landt zonder sprong. Een simpel fadepaar is geen vervanging.
- De opening wijkt wezenlijk af van de huidige twee kolommen met boogportret. Er is een echte beeldvullende wereld en een begrijpelijke propositie.
- Hoofdstukken verschillen in schaal, kleur, dichtheid en bewegingsrichting. Geen pagina van acht gelijksoortige reveal-secties.
- De gebruiker kan meteen begeleiding, zelfstandig aanbod en het startpunt bereiken. Geen verplichte volledige rondleiding.
- Leesrust is aantoonbaar in elk hoofdstuk. Koppen overlappen niet; lange inhoud raakt niet afgesneden; consent bedekt geen noodzakelijke actie.
- Snelle scroll, omgekeerde scroll, hoofdstuklinks, herladen op scrollpositie, menu openen/sluiten, 200% zoom, verminderde beweging en zonder JavaScript zijn gecontroleerd.
- Werkelijke productstatus, professionele rollen, prijzen en klinische grenzen blijven correct. Community is niet als beschikbare aankooproute gepresenteerd.
- Lokale typecontrole/build en een gerichte browsercontrole slagen. Laadtijd en vloeiendheid worden vergeleken onder dezelfde omstandigheden; nog geen prestatieclaim op basis van alleen het plan.

## Bewijsgrens

De goedgekeurde volledige homepageproef is geïntegreerd in de lokale website, inclusief de gevraagde foto van Virginie. Het eerdere bedienbare storyboard blijft een conceptdocument. Er is geen echt rapportvoorbeeld toegevoegd en er is geen deployment uitgevoerd. De bovenstaande lokale controles zijn de bewijsgrens voor deze implementatie.
