# Mailopvolging — rustig en professioneel

Datum: 18 november 2026. Status: geïmplementeerd, lokaal gecontroleerd en via Vercel uitgerold; databasemigratie toegepast.

## Ontwerpbesluit

Maak van `/admin/mail` één heldere werkplek: compacte statusnavigatie, één categoriefilter en één leesbare lijst. De superadmin ziet eerst welke mails verzonden zijn en of iets aandacht vraagt. Details worden per mail uitgeklapt.

Apple-achtige afwerking door hiërarchie, zorgvuldige typografie, beheerste kleur, ruimte en directe feedback. Gebruik de bestaande MyGrowise-beheeromgeving als visuele basis. Dit is een gerichte herinrichting van Mailopvolging; de gedeelde zijbalk, navigatie en andere beheerschermen blijven buiten de opdracht.

## Waarom de huidige pagina druk aanvoelt

- De matrix met vier wachtrijen en vijf statussen toont twintig aantallen tegelijk; dezelfde keuzes komen daarna terug in filters.
- Een aparte statuskaart, samenvattingstabel, takenpaneel en verwerkingskaart concurreren om aandacht.
- Lange taak-ID's staan vooraan; categorie en betekenis van de mail zijn minder herkenbaar.
- Uitleg over mailservers, bewaartermijnen, pogingen en verwerking is steeds zichtbaar.
- Op mobiel worden de tabellen grote blokken die de eigenlijke historiek naar beneden duwen.

Bronnen: de huidige `mail.astro`, `AdminMailSummary.astro`, `AdminMailTasks.astro`, `adminMail.ts` en de bijbehorende lokaal gerenderde desktop- en mobiele beelden uit de vorige implementatieronde. De beelden gebruiken synthetische gegevens; aantallen daarin zijn geen actuele productiecijfers.

## Nieuwe opbouw

### 1. Compacte paginakop

Titel **Mailopvolging**, met één korte begeleidende zin: “Bekijk je verzendingen en volg problemen op.” Rechts een bescheiden knop **Beheeracties** voor handmatig verwerken en overige operationele acties.

Bij een gezonde toestand volstaat een kleine tekstregel **Geen mislukte verzendingen**; geen afzonderlijke succeskaart. Bij fouten verschijnt een compacte melding met het aantal en een rechtstreekse link **Bekijk mislukte mails**. Een configuratiefout blijft duidelijk zichtbaar en mag niet achter Beheeracties verdwijnen.

### 2. Eén werkvlak met statusnavigatie

Vervang de volledige samenvattingsmatrix en de dubbele statusselectie door een compacte keuzebalk:

- **Verzonden** · aantal
- **Gepland** · aantal
- **Mislukt** · aantal
- **Meer**: Bezig, Overgeslagen of onbevestigd

De geselecteerde keuze heeft één rustig gemarkeerd vlak en duidelijke tekst. Het aantal bij Mislukt krijgt alleen een waarschuwingsaccent wanneer het hoger dan nul is. Bij een status onder Meer blijft de actieve status ook in de gesloten bediening leesbaar.

Standaard open je **Verzonden**, over alle categorieën. Mislukte verzendingen blijven direct bereikbaar via de zichtbare melding en de vaste statuskeuze. Geen automatische wissel van tab bij nieuwe gegevens.

Onder de statusbalk staat één filter **Categorie**, standaard **Alle categorieën**. Korte labels: Support, Bestellingen, Afspraken, Contact en aankooplinks. Een categoriekeuze past de lijst én de aantallen in de statusbalk aan; alle zichtbare aantallen hebben dus dezelfde afbakening. Een lege selectie houdt de bediening zichtbaar.

Bij wijziging direct toepassen, met behoud van de andere selectie en terugkeer naar pagina 1. URL's blijven deelbaar en browser-terug herstelt de selectie. Het formulier blijft ook zonder JavaScript bruikbaar met een expliciete toepasactie.

### 3. Eén rustige lijst

Voor verzonden mails zijn de primaire gegevens:

| E-mail | Ontvanger | Verzonden op | Details |
|---|---|---|---|
| Afspraakbevestiging, met categorie eronder | Cliëntnaam en e-mailadres | 18 nov 2026, 11:00 | Uitklappen |

De voorbeeldrij beschrijft de indeling, geen actuele verzending. Toon herkenbare typen op basis van bestaande `kind`- en `event`-velden met een vaste, veilige labelmapping. Onbekende typen krijgen een algemeen categorielabel. Geen onderwerpregels uit mailinhoud reconstrueren.

Bij geplande mails vervangt het geplande verzendmoment de verzenddatum. Bij mislukte mails staat een korte, bruikbare foutomschrijving in de rij. Een lopende verwerking krijgt een tekststatus; een verlopen lease mag niet als gezonde actieve verzending worden voorgesteld. Overgeslagen/onbevestigde taken behouden hun eerlijke toelichting.

Een detailknop klapt direct onder dezelfde rij het volgende uit:

- volledige taakreferentie, aanmaakdatum en aantal pogingen;
- relevante planning, verwerkingsinformatie of veilige foutdiagnose;
- alleen bij mislukte taken: opnieuw proberen, met de bestaande controle en bevestiging.

Gebruik een benoemde knop met `aria-expanded`, een toegankelijke naam en een duidelijke focusstijl. Geen brede rij die onduidelijk klikbaar is. Houd de bestaande paginering van 25 resultaten; recentste verzonden mails blijven eerst staan. Een samengevoegde lijst gebruikt categorie plus taak-ID als unieke identiteit en als vaste sortering bij gelijke tijdstippen.

### 4. Uitleg en beheer op het juiste moment

Een kleine uitklapbare link **Over verzendstatussen** bevat de betekenis van Verzonden, de historische onzekerheid, bewaartermijnen en de aparte Supabase Auth-mailstroom. Bij onbevestigde taken blijft de noodzakelijke uitleg ook direct in die weergave staan.

**Beheeracties** bevat de bestaande beperkte verzendronde. De actie om alle mislukte taken opnieuw klaar te zetten verschijnt alleen als er mislukte taken zijn en houdt de bestaande bevestiging. Vermeld expliciet dat deze actie alle categorieën betreft, ook wanneer een categoriefilter actief is. Bied de actie per taak aan in de details van die taak. Acties tonen een bezigtoestand en een gerichte uitkomstmelding, zonder dubbele inzendingen.

## Visuele afwerking

- Zacht getinte achtergrond uit het bestaande beheerpalet, één wit werkvlak, fijne scheidingslijnen en beheerste afronding.
- Bestaande schreefloze beheerfont behouden; leesbare tekst, bescheiden titel en duidelijke typografische niveaus. Hoofdletters beperken tot waar ze functioneel zijn.
- Donkergroen draagt selectie en acties; rood/amber alleen voor echte problemen of onzekerheid. Status is altijd ook in woorden herkenbaar.
- Gelijke rijhoogten bij gesloten details, consistente uitlijning en genoeg witruimte om makkelijk te scannen.
- Directe feedback op interactie; korte, subtiele overgangen. Respecteer verminderde beweging. Filters blijven bedienbaar tijdens laden.

## Mobiel

De drie hoofdstatussen blijven zichtbaar met compacte aantallen; overige statussen blijven onder Meer bereikbaar. Bij weinig breedte komt Meer op een tweede regel. Het categoriefilter gebruikt de beschikbare breedte.

De historiek wordt een compacte lijst met per mail een herkenbare titel, categorie en relevant tijdstip. Details klappen in dezelfde lijst uit. De twintig-cellensamenvatting en de grote mobiele kaarten vervallen. Controleer 320px, 390px, tabletbreedte en 200% zoom; geen horizontale pagina-overloop en aanraakdoelen van minimaal 44px.

## Technische scope en volgorde

1. Herwerk `mail.astro`, `AdminMailSummary.astro` en `AdminMailTasks.astro` binnen de bestaande beheeromgeving. Stijlen blijven lokaal aan deze pagina gekoppeld.
2. Breid de leeslaag uit voor **Alle categorieën**, herkenbare typelabels en globale paginering. De huidige leesfunctie werkt per afzonderlijke wachtrij; simpelweg vier losse pagina's samenvoegen geeft geen correcte totaalvolgorde of paginering.
3. Maak voor dit gecombineerde overzicht een server-side databaseprojectie van de vier wachtrijen met een beperkt operationeel veldenset. Alleen de serverrol mag die lezen. Centraliseer daarin dezelfde succes-/onbevestigdindeling die de huidige tellingen en lijsten gebruiken; laat aantallen en lijst uit dezelfde selectie komen. Een eventuele migratie is additief en bewaart alle bestaande taken.
4. Behoud bestaande deep links met `queue`, `status` en `pagina`; normaliseer nieuwe categoriekeuzes en bestaande URL's naar dezelfde filters. Behoud `integrations.manage`, CSRF-/origincontrole en het retryendpoint.
5. Verzendworkers, planning, retrybeleid, bewaartermijnen en de recent ingevoerde registratie van succesvolle verzendingen blijven behouden. Naam en e-mailadres van de ontvanger staan rechtstreeks in de lijst; mailinhoud en persoonlijke links blijven buiten het overzicht. Zie [ontvangers](ADMIN-MAIL-ONTVANGERS-2026-11-18.md).

## Acceptatie

- Binnen enkele seconden is duidelijk wat verzonden is en of er problemen zijn.
- De eerste lijst is op desktop bereikbaar zonder voorbij een matrix, verklarende alinea's en beheerkaarten te scrollen.
- Statusselectie, aantallen en lijst komen steeds overeen, zowel voor één als alle categorieën.
- Overgeslagen/onbevestigde taken worden nooit als verzonden geteld; fouten verdwijnen niet achter technische details.
- Detail- en beheeracties zijn bereikbaar via toetsenbord, touch en zonder JavaScript; focus, foutmeldingen en laadfeedback zijn gecontroleerd.
- Lege historiek, mislukte verzending, actieve/verlopen verwerking, configuratiefout, lange referenties en meerdere pagina's zijn gecontroleerd.
- Lokale regressietests, TypeScript, build en visuele controles op desktop en mobiel slagen vóór uitrol. GitHub Actions blijft verboden; uitrol via de bestaande Vercel-integratie binnen Free/Hobby.

Dit ontwerp is uitgevoerd. De verificatie en uitrol worden hieronder vastgelegd.


## Uitvoering op 18 november 2026

- `AdminMailWorkspace.astro` groepeert kop, gezondheidsmelding, statusnavigatie, categoriefilter, lijst en uitleg. Lokale stijlen staan in `admin-mail.css`; de gedeelde beheeromgeving blijft behouden.
- Standaard alle categorieën en Verzonden; statusaantallen volgen het categoriefilter. Meer bewaart de actieve extra status. Bestaande categorie-/statuslinks en paginering blijven bruikbaar.
- Native uitklapbare details blijven zonder JavaScript werken. De JavaScript-verbetering voegt automatisch filteren, expliciete uitklapstatus, sluiten met Escape en dubbele-inzendingsbeveiliging toe. Browser-terug herstelt de categorie bij de getoonde lijst.
- Leesprojectie `admin_mail_overview` en tellingsfunctie `admin_mail_counts()` delen één statusclassificatie. Alleen de serverrol heeft lees-/uitvoerrechten. De projectie bevat expliciete ontvangergegevens, maar geen payload, persoonlijke link, lease-token of ongeschoonde providerfout. De aanvulling van 18 november staat in [ontvangers](ADMIN-MAIL-ONTVANGERS-2026-11-18.md).
- Globale paginering en sortering gebeuren in de database; categorie plus taak-ID bepaalt de vaste volgorde bij gelijke tijdstippen. Mailtypen komen uit een veilige labelmapping.
- De bestaande herstelautorisatie en bevestiging blijven behouden; een herstelactie keert terug naar de geselecteerde categorie en status. Groepsherstel vermeldt expliciet dat alle categorieën worden verwerkt.
- Alle 194 lokale tests en TypeScript slagen in een aparte checkout van de mailwijziging. De gedeelde werkmap bevat gelijktijdige cliëntendossierwijzigingen; die zijn buiten deze wijzigingsset gehouden.
- De nieuwe geïsoleerde PostgreSQL-proef voert de echte migratie-SQL uit en controleert historische uitkomsten, complete projectie, tellingen, privacy en serverrechten. De migratie is daarnaast tegen de gekoppelde database gerepeteerd en teruggedraaid, met behoud van alle 24 bestaande taken.
- De nieuwe browserproef controleert categorie/tellingen, globale paginering, browser-terug, toetsenborddetails, checkboxvalidatie, dubbele verzending, extra statussen, lege/fouttoestanden, 320/390/768/1100px, 200% zoom en bediening zonder JavaScript. Screenshots in `/tmp/mygrowise-mail-workspace/` zijn visueel beoordeeld.
- De mechanische ontwerpcontrole gaf adviezen over afwijkingen van het publieke `/startpunt`-ontwerp in `DESIGN.md`. Dat document begrenst zichzelf tot `/startpunt`. De mailpagina volgt bewust de bestaande admin-typografie en het admin-palet, met lokaal vastgelegde afwerking.
- Er zijn tijdens de browser- en servicetests geen echte e-mails verstuurd; browser-POSTs zijn onderschept en transporttests gebruiken mocks.
- De bestaande brede admin-browserproef slaagt na aanpassing aan de nieuwe mailcomponenten; ook de aangrenzende content-, product- en modulecontroles blijven groen.
- Productiebuild en artifactcontrole slagen in de geïsoleerde checkout. De build bevat geen tijdelijke browserfixtures.
- Migratie `20261118150000_admin_mail_overview.sql` toegepast en geregistreerd, met behoud van alle 24 bestaande taken. Anonieme en ingelogde publieke databaserollen hebben geen toegang tot de nieuwe projectie of tellingsfunctie.
- Live PostgREST-verificatie na migratie: alle vijf statuslijsten en hun tellingen komen overeen, zowel globaal als per categorie. Op dat moment 18 verzonden, 3 gepland, 3 onbevestigd en geen mislukte/lopende taken.
- Implementatiecommit `c2b494f` naar `origin/main` gepusht. De bestaande Vercel-integratie bevestigt **Deployment has completed**: [deployment](https://vercel.com/lanternnetworks-projects/mygrowise/5eqxHa6M8arxWacxdVzoEQ81CYyz).
- Productie-HTTP-controle bevestigt dat de standaardpagina en de onbevestigd-filterlink zonder sessie met 303 naar de adminlogin gaan, met behoud van de vervolg-URL. De ingelogde productiepagina is in deze ronde niet opnieuw visueel beoordeeld; de visuele acceptatie betreft de echte componenten met synthetische gegevens lokaal.
