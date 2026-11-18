# Updates voor Virginie

Datum: 18 november 2026. Status: voorstel voor uitvoering; nog niet gebouwd.

## Doel en bevestigde scope

Virginie kan als superadmin verbeteringen aan MyGrowise lezen, van begin tot eind opvolgen en feedback geven. Er komt geen formele goedkeuringsstap. Succes betekent dat ze binnen enkele seconden begrijpt wat nieuw is, waar aan gewerkt wordt, wat dat voor haar verandert en wat er met haar opmerkingen gebeurt.

Dit breidt het bestaande superadmin uit binnen de huidige vormgeving. Het is een combinatie van een leesomgeving en een eenvoudige opvolgplek.

## Onderzochte basis

- MyGrowise gebruikt Astro, Supabase, een gedeelde adminlayout en expliciete routerechten. De navigatie staat in `src/layouts/AdminLayout.astro`; de rechtenmatrix in `src/lib/adminPermissions.ts`.
- Er bestaan operationele werkpunten in `admin_work_items`. Die zijn bedoeld voor dagelijkse opvolging zoals betalingen, support en privacy. Productverbeteringen krijgen eigen records, zodat beide lijsten hun betekenis behouden.
- LoTHUUS documenteert een rustige leeslijst van afgeronde verbeteringen, een compacte dashboardverwijzing en een Nieuw-label. Rare Art Books/FabriceBoekenKunst heeft een uitgebreidere historie en filtering. Beide gebruiken bewust geschreven Nederlandstalige berichten. Die principes nemen we mee.
- De referenties zijn lokaal onderzocht. Atelier Rembrandt is niet afzonderlijk gecontroleerd. Er is geen visuele vergelijking uitgevoerd; het voorstel baseert zich op documentatie en bestaande code.
- De huidige DESIGN.md beschrijft specifiek de publieke startpuntpagina. Voor Updates zijn de bestaande admincomponenten en adminstijlen leidend.

## Navigatie en overzicht

Een vast menu-item **Updates** komt onder Dashboard in de groep Overzicht, uitsluitend zichtbaar voor superadmins. Route: `/admin/updates`. Een subtiel Nieuw-label of aantal geeft ongelezen inhoudelijke wijzigingen aan, zonder alarmkleur.

Op het dashboard verschijnt een compacte verwijzing met de nieuwste ontwikkeling en de actie **Alle updates bekijken**. Dit blijft ondergeschikt aan de dagelijkse praktijkvoering.

De Updates-pagina opent met:

> **MyGrowise blijft groeien**  
> Hier volg je wat er verandert, waar we aan werken en wat al voor je klaarstaat.

Daaronder staan drie eenvoudige filters: **Alles**, **In ontwikkeling** en **Beschikbaar**. Een aanvullende schakelaar **Alleen nieuw** helpt bij terugkeer. Zoeken gebeurt op titel en begrijpelijke inhoud. Bij een lege zoekopdracht toont de pagina actieve onderwerpen eerst en daarna recente opleveringen; binnen elke groep telt de laatste inhoudelijke wijziging.

## Eén onderwerp van begin tot eind

Elke verbetering krijgt een vaste detailpagina op `/admin/updates/[slug]`. De overzichtskaart toont een concrete titel, één zin over het voordeel, de huidige status, de laatste wijzigingsdatum en eventuele nieuwe reacties. Geen technische versienummers als hoofdinformatie.

De detailpagina geeft achtereenvolgens:

1. **Wat verandert er voor jou?** Een korte uitleg met het praktische voordeel.
2. **Waar staan we nu?** Huidige status en de eerstvolgende stap.
3. **Zo ziet het eruit.** Alleen wanneer nuttig: een zorgvuldig gekozen afbeelding zonder persoonsgegevens, of een link naar de beschikbare functie.
4. **Van idee tot beschikbaar.** Een chronologische tijdlijn met concrete, gedateerde mijlpalen; begin bovenaan, nieuwste stap onderaan.
5. **Jouw feedback.** Een gesprek bij dit onderwerp, met zichtbare afzender en datum.

Voorgestelde statussen: **Gepland → In uitvoering → Wordt nagekeken → Beschikbaar**. Aanvullend **Uitgesteld** en **Vervallen**, met een korte reden. Geen automatische percentages of verzonnen deadlines. Een streefdatum wordt expliciet als verwachting aangeduid.

Feedback mag na oplevering doorgaan. Als daaruit nieuw werk volgt, komt er een aanvullende mijlpaal of een gekoppelde vervolgupdate; eerdere opleveringsinformatie blijft bewaard.

## Feedback en antwoorden

Virginie schrijft onder het onderwerp via **Vraag of opmerking?** en **Feedback versturen**. Platte tekst, maximaal 4.000 tekens, met behoud van invoer bij een verzendfout en bescherming tegen dubbele verzending. De eerste versie heeft geen bijlagen; toelichtende afbeeldingen kunnen door de beheerder bij een mijlpaal worden toegevoegd.

Een reactie krijgt de opvolging **Ontvangen**, **In behandeling** of **Beantwoord**. Beantwoord vereist een zichtbaar antwoord. **Verwerkt in deze update** verwijst naar de concrete mijlpaal. Feedbackstatus en ontwikkelstatus zijn aparte gegevens.

Antwoorden kunnen door Kevin worden geplaatst via een bevoegd superadminaccount. Controleer vóór implementatie of dat account bestaat; ken geen rechten toe op basis van een naam of e-mailadres in de interface. Als er geen passend account is, blijft de bestaande vertrouwde beheerroute nodig voor redactie en antwoorden.

Een nieuwe reactie of een antwoord verschijnt als nieuw binnen Updates. We voegen aanvankelijk geen e-mails, pushmeldingen of externe chatdienst toe.

## Nieuw en gelezen

Bewaar de laatst bekeken inhoudelijke revisie per gebruiker en onderwerp in Supabase. Dit werkt over toestellen heen. Alleen werkelijk getoonde detailinhoud wordt gelezen; het openen van de overzichtslijst markeert de overige onderwerpen niet automatisch als gelezen.

Nieuwe mijlpalen, relevante statuswijzigingen en antwoorden van de andere afzender maken een onderwerp opnieuw nieuw. Een eigen reactie en een kleine tekstcorrectie doen dat niet. Eigen reacties blijven wel zichtbaar als laatste activiteit.

## Vormgeving en gedrag

Een rustige overzichtslijst met royale witruimte, sterke titels, fijne scheidingslijnen en bestaande MyGrowise-adminaccenten. Statuslabels ondersteunen de tekst; kleur is nooit de enige betekenisdrager. Geen breed kanbanbord: Virginie moet kunnen lezen en volgen op telefoon en desktop.

Op desktop krijgt het detail een brede leeskolom en een smalle statuskolom. Op telefoon staan status, uitleg, tijdlijn en feedback onder elkaar. Filters blijven bereikbaar zonder horizontale tekstscroll. Lange teksten krijgen tussenkoppen en een leesbreedte rond 65 tekens.

Toetsenbordfocus, semantische koppen, gelabelde velden en begrijpelijke foutmeldingen horen bij de eerste oplevering. Beweging blijft subtiel en respecteert verminderde beweging. Een mislukte aanvraag blokkeert de andere adminfuncties niet.

Materiële toestanden: laden, geen updates, geen filterresultaten, ontbrekend onderwerp, niet bevoegd, laadfout met opnieuw proberen, feedback wordt verstuurd, feedback opgeslagen en verzendfout met bewaarde invoer. Voorzie paginering vanaf het begin voor overzicht, mijlpalen en reacties.

## Inhoud en redactie

Kevin schrijft en onderhoudt de berichten bewust. Gitgeschiedenis en projectdocumentatie zijn onderzoeksbronnen; commits worden nooit rechtstreeks als gebruikersbericht gepubliceerd.

Iedere update heeft een begrijpelijke titel, praktisch voordeel, actuele status, volgende stap en zichtbare mijlpalen. Bijvoorbeeld **Afspraken sneller terugvinden bij een cliënt**, in plaats van een technische bestandsnaam. Dit is een tekstvoorbeeld, geen claim dat die verbetering beschikbaar is.

Start met een gecontroleerde terugblik vanaf het begin van het project: bundel technische wijzigingen tot herkenbare verbeteringen. Vermeld alleen aantoonbare datums; label oudere reconstructies waar nodig met alleen maand of periode. Scheid concepten van gepubliceerde inhoud. Publiceer Beschikbaar pas na controle in productie, niet uitsluitend na een geslaagde lokale build of Git-push.

Een korte redactieroute in de sectie zelf laat een bevoegde superadmin onderwerpen, mijlpalen en antwoorden beheren en bewust publiceren. Virginie hoeft die bediening niet te gebruiken om te lezen of feedback te geven. Een database alleen vormt geen bruikbaar redactieproces.

## Technische richting

- Hergebruik AdminLayout, adminiconen, knoppen, sessies en bestaande servervalidatie.
- Voeg expliciete rechten toe voor lezen, feedback en redactie; wijs ze in de eerste versie alleen aan super_admin toe. Registreer alle pagina- en API-routes in de bestaande rechtenmatrix. Zowel serverroutes als databasebeleid bewaken toegang.
- Voorgestelde aparte tabellen: `platform_updates`, `platform_update_events`, `platform_update_comments` en `platform_update_reads`. Onderwerpen dragen publicatiestatus en actuele ontwikkelstatus; events bewaren de zichtbare historie; reacties bewaren feedback en antwoorden; reads bewaren revisies per gebruiker. Concepten zijn uitsluitend via redactie toegankelijk.
- Houd publiceerbare tekst en interne onderzoeksgegevens gescheiden. Geen cliëntgegevens, dossiers, sessie-inhoud, sleutels of technische logs in deze sectie. Geen vrije HTML in reacties; toegestane interne actie-links en veilige weergave van redactionele tekst.
- Mutaties gebruiken de bestaande sessie- en verzoekbeveiliging, servervalidatie, lengtelimieten, bevoegdheidscontrole en auditregistratie. Overgangen en bijbehorende mijlpalen worden samen opgeslagen om tegenstrijdige historie te voorkomen.
- Laad bij openen en na een eigen actie; geen voortdurende polling of scheduler. Beveiligde inhoud gebruikt private/no-store en komt niet in publieke browserbundels terecht.
- Lokale controles; geen GitHub Actions. Uitrol rechtstreeks via de bestaande Vercel-integratie, binnen Free/Hobby, zonder nieuwe betaalde diensten.

## Uitvoering en acceptatie

1. Werk de overzichts- en detailcompositie uit met echte conceptteksten, een lang onderwerp en een feedbackgesprek. Beoordeel desktop en telefoon vóór volledige bouw.
2. Bouw datamodel, rechten, beveiligde leesroutes, menu en dashboardverwijzing.
3. Bouw overzicht, details, tijdlijn en gesynchroniseerde Nieuw-status.
4. Bouw feedback, antwoorden, opvolgstatus en minimale redactie inclusief concept/publiceren.
5. Onderzoek en schrijf de initiële projecthistorie; verifieer beschikbaarheidsclaims. Controleer de bijbehorende updates bij toekomstige opleveringen.
6. Test lokaal toegangsgrenzen, conceptafscherming, feedbackopslag, dubbele verzending, revisies/gelezen-status en statusovergangen. Voer typecheck, relevante tests en productiebuild uit, gevolgd door visuele controle op desktop/telefoon en toetsenbordcontrole.

Klaar wanneer Virginie een nieuwe verbetering vanuit het menu vindt, het volledige verloop begrijpt, feedback kan opslaan, het antwoord terugvindt en op een ander toestel dezelfde gelezen-status ziet. De redactie moet ondertussen een onderwerp zonder codewijziging kunnen bijwerken.

## Nog vast te leggen tijdens de ontwerpfase

De precieze schermcompositie en eerste historische berichten zijn nog niet goedgekeurd. De functionele scope lezen, opvolgen en feedback geven is door Kevin bevestigd. Dit document beschrijft het voorgestelde bouwplan; er is geen productcode aangepast of gepubliceerd.

## Uitvoering gestart op 18 november 2026

De lokale implementatie en het redactieproces zijn gebouwd. Zie [SUPERADMIN-UPDATES-UITVOERING.md](SUPERADMIN-UPDATES-UITVOERING.md) voor de schermen, tests en uitrolvolgorde. De eerste inhoud omvat tien onderwerpen en een expliciet gelabelde terugblik. De drie productiemigraties zijn na rollbackrepetitie toegepast. De applicatie-uitrol is nog niet uitgevoerd.

## Aanvullend bevestigd door Kevin

Nieuwe feedback wordt automatisch naar bourguignonphotography@gmail.com gemaild, inclusief begrijpelijke context. Website- en dashboardupdates krijgen een apart, combineerbaar filter en een expliciete redactionele indeling. Zie het uitvoeringsdocument voor de transactionele wachtrij, geslaagde SMTP-test en gecontroleerd toegepaste migraties. De eerdere afbakening zonder e-mail is hiermee vervangen.
