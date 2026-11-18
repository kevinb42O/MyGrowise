# Uitvoeringsplan cliëntgegevens en afspraakkeuze

Datum: 17 november 2026. Scope: de vier door Kevin bevestigde gratis verbeteringen. Gebaseerd op inspectie van de lokale code. Dit document plant de uitvoering; het markeert geen functionaliteit als gebouwd, getest of uitgerold.

## Doel en grenzen

Medewerkers voeren cliëntgegevens één keer in, kunnen alle gevraagde aanheffen gebruiken, zien de actuele leeftijd en kiezen eerst een therapeut en daarna diens afspraaktype. De bestaande functionele vormgeving van admin en praktijk blijft leidend. De Startpunt-vormgeving uit DESIGN.md is geen ontwerp voor deze formulieren.

Geen betaalmails, mailvenster, facturatiemodule of nieuwe vervolgplanner in deze wijziging. Geen GitHub Actions of nieuwe betaalde diensten. Controles lokaal; deployment via de bestaande Vercel-integratie binnen de vastgelegde Free/Hobby-randvoorwaarde.

## Uitvoeringsvolgorde

1. Baseline vastleggen en aanmaakroutes nalopen.
2. Gegevensovername herstellen en migratie voorbereiden.
3. Aanheffen in opslag, formulieren, dossier en mails consistent maken.
4. Leeftijd toevoegen aan dossier en bewerkformulier.
5. Therapeut en afspraaktype scheiden in de interne planningsflows.
6. Gedrag, database en schermen controleren; daarna uitrollen en acceptatie vastleggen.

## 1 Cliëntgegevens automatisch overnemen

### Huidige situatie

`ClientDirectory.astro` vraagt één `full_name`; `createPatient()` gebruikt `create_patient_record`. Het dossier leest daarnaast afzonderlijke `first_name` en `last_name`. De bestaande aanmaakroutes vanuit agenda, boeking en klantaccount moeten samen worden gecontroleerd: alleen het zichtbare dossierformulier voorinvullen lost opslag en vervolgflows niet volledig op.

### Uitvoering

- Gebruik bij nieuwe handmatige cliënten aparte velden Voornaam en Achternaam. Leid de volledige weergavenaam hiervan af; bewaar beide onderdelen en e-mail meteen bij aanmaak.
- Pas ook de nieuwe-cliëntflow in de agenda aan waar die nog één naam vraagt. Behoud geboortedatum, gekozen tijd, cliëntselectie en overige bestaande invoer bij validatiefouten.
- Sla aanmaak en detailgegevens atomair op via een bevoegde server-/databaseroute. Geen los aangemaakt dossier wanneer de vervolgstap mislukt. Behoud bestaande rechten, toewijzing, audit en bescherming tegen dubbele aanmaak.
- Bij aanmaak vanuit account/boeking: hergebruik aanwezige afzonderlijke naamvelden als die aantoonbaar bij dezelfde identiteit horen. Een naam of gelijk e-mailadres is op zichzelf geen toestemming tot accountkoppeling.
- Bij oudere dossiers met alleen een volledige naam: behoud die exact en toon de bestaande naam in de bewerkflow. Vul ontbrekende naamonderdelen eenmaal aan als de bron ze niet afzonderlijk bevat. Niet automatisch de eerste/laatste spatie als grens gebruiken: samengestelde voornamen en familienamen maken dat onbetrouwbaar.
- Maak een herhaalbare herstelmigratie voor aantoonbaar ontbrekende gegevens uit betrouwbare bestaande bronnen. Overschrijf geen ingevulde velden. Rapporteer onduidelijke gevallen zonder persoonsgegevens in algemene logs.
- Na opslaan moeten dossierkop, zoekresultaten en detailformulier dezelfde naam en e-mail tonen. Bestaande boekingssnapshots worden niet stilzwijgend herschreven.

### Acceptatie

Nieuwe cliënt met samengestelde voornaam en familienaam verschijnt direct met correcte gegevens in het dossierformulier. E-mail is overgenomen. Bestaande detailgegevens blijven behouden. Aanmaak via directory, agenda, boeking en account is gecontroleerd. Een validatiefout verliest geen invoer en laat geen half dossier achter.

## 2 Extra aanheffen

### Huidige situatie

`patientDetails.ts`, `PatientFields.astro` en de databaseconstraint laten alleen leeg, mevrouw, meneer en heer toe. Het veld heeft in de applicatie een maximale lengte van 20 tekens. De langere ouder/verzorgertekst past daar niet in. `bookingMailContent.ts` plakt momenteel de opgeslagen aanhef rechtstreeks achter Geachte.

### Uitvoering

- Definieer één gedeelde lijst van waarden en Nederlandse labels: heer, meneer, mevrouw, heer/mevrouw, ouder(s)/verzorger(s) van, echtpaar en Geen aanhef.
- Gebruik korte stabiele opslagwaarden voor nieuwe lange labels; behoud bestaande waarden. Koppel de labels expliciet aan dossierweergave, formulier en mailopmaak. Toon geen technische opslagwaarde aan de gebruiker.
- Breid de databaseconstraint uit met een nieuwe migratie; herschrijf geen al uitgevoerde migratie. Houd applicatievalidatie en database in overeenstemming.
- Maak een gedeelde formatter voor de begroeting. Geen aanhef blijft een natuurlijke neutrale begroeting. De ouder/verzorgeroptie adresseert de ouders/verzorgers van de genoemde cliënt. Echtpaar en heer/mevrouw leveren leesbare tekst op, zonder dubbele titel of ontbrekende naam.
- Verwerk dit in HTML én platte tekst van bevestiging, verplaatsing, annulering en herinnering, voor zover deze dezelfde mailopmaak gebruiken. Houd rekening met bestaande wachtrijpayloads met oude waarden. Verander de ontvanger niet door de aanhefkeuze.

### Acceptatie

Elke optie kan worden gekozen, opgeslagen, herladen en correct weergegeven. Ongeldige waarden worden servermatig geweigerd. Oude dossiers en wachtende mails blijven leesbaar. Mailvoorbeelden bewijzen alle opties, inclusief escaping van bijzondere tekens. Geen echte cliëntmail versturen tijdens tests.

## 3 Actuele leeftijd tonen

### Uitvoering

- Voeg een gedeelde datumfunctie toe die leeftijd berekent uit een geldige kalenderdatum en de huidige kalenderdag in Europe/Brussels.
- Bereken jaren op basis van jaar, maand en dag; niet door milliseconden te delen door 365 dagen. Bewaar geen leeftijd in de database.
- Toon in het dossier bijvoorbeeld 1 januari 1988 (38 jaar). Toon in het bewerkformulier de leeftijd naast de geboortedatum en werk die bij als de datum verandert.
- Laat de leeftijd weg bij ontbrekende, ongeldige of toekomstige geboortedatum. Bestaande datumvalidatie blijft actief. Voor 29 februari wordt de leeftijd in een niet-schrikkeljaar volgens maand/dagvergelijking vanaf 1 maart verhoogd; leg dit expliciet vast in de tests.

### Acceptatie

Controleer dag vóór, op en na de verjaardag; jaarwisseling; 29 februari; pasgeborene; lege en ongeldige datum. Gebruik een injecteerbare referentiedatum in tests zodat de uitkomst niet van de uitvoerdag afhangt. Het formulier werkt bij zonder de pagina te herladen.

## 4 Eerst therapeut en daarna afspraaktype

### Huidige situatie

`AppointmentDetail.astro` toont therapeut en type samen. `UnifiedAgenda.tsx` heeft een eigen afspraaktypekiezer; de praktijkflow kan al tot één therapeut beperkt zijn. `boekingslinks.astro` heeft al twee selecties en kan als gedragreferentie dienen. De server blijft de toegestane therapeut/typecombinatie bepalen.

### Uitvoering

- Inventariseer alle interne ingangen voor een nieuwe cliëntafspraak in admin en praktijk, inclusief nieuwe-afspraakpagina en agendadialoog. Verander publieke boekingsstappen niet onnodig.
- Toon twee gelabelde selecties: Therapeut en Afspraaktype. Bij één toegestane therapeut wordt die vooraf gekozen; een onbevoegde medewerker krijgt geen bredere therapeutenlijst.
- Toon alleen actieve en toegestane types voor de gekozen therapeut. Sorteer op typebenaming met Nederlandse collatie, met duur/uitvoeringsvorm als herkenningsinformatie bij gelijke namen.
- Zonder therapeut is Afspraaktype uitgeschakeld met Kies eerst een therapeut. Bij wisselen wordt een niet meer geldige typekeuze gewist; cliënt en starttijd blijven behouden. Kies niet stilzwijgend het eerste afspraaktype.
- Behoud expliciete geldige voorselecties uit een link en ingezonden geldige keuzes na een fout. Toon herkenbare laad-, fout-, geen-therapeuten- en geen-typesstatussen. Bij asynchrone selectie mag een oud antwoord de nieuwere keuze niet overschrijven.
- Houd de bestaande servercontrole op toegangsrechten, actief aanbod, duur en overlap leidend. Aanpassen van een verborgen veld of request mag geen afspraak bij een onbevoegde therapeut mogelijk maken.

### Acceptatie

Controleer beheerder met meerdere therapeuten en medewerker met één therapeut; 20 therapeuten; alfabetische sortering; dezelfde typenaam bij verschillende therapeuten; inactief aanbod; wisselen; teruggaan; validatiefout en behoud van cliënt/tijd. Controleer toetsenbord, labels en mobiel. Een bestaande afspraak verplaatsen behoudt zijn oorspronkelijke duur en type.

## Verificatie en oplevering

- Leg eerst `git status`, relevante bestaande tests en migratievolgorde vast. Bestaande afgeronde praktijkverbeteringen blijven intact.
- Gerichte gedragstests voor gegevensovername, naambehoud, aanhefopmaak, leeftijd en therapeut/typekeuze. Geen tests die uitsluitend controleren of broncode een bepaalde tekst bevat.
- Databaseproeven op een geïsoleerde testdatabase voor aanmaak, terugdraaien bij fouten, herhaalbaar gegevensherstel, nieuwe aanhefwaarden en rechten. Controleer vóór uitvoering of daarvoor een bruikbare lokale testomgeving beschikbaar is.
- Na de wijzigingen lokaal `npm test` en `npm run check`. Na UI-afwerking één mechanische Impeccable-controle over gewijzigde UI-bestanden.
- Visuele en functionele controle van directory, dossierformulier, dossieroverzicht, nieuwe-afspraakpagina en agendadialoog op desktop en mobiel met synthetische cliënten. Controleer invoerbehoud, focus en toetsenbordbediening.
- Database-uitbreiding eerst, daarna applicatie via de bestaande Vercel-integratie. Voer gerichte productieacceptatie uit zonder echte cliëntmails of proefafspraken bij echte cliënten.
- Rapporteer per onderdeel afzonderlijk: gebouwd, lokaal getest, database toegepast, uitgerold en in productie gecontroleerd. Een geslaagde build bewijst niet dat de productiedatabase of live flow is bijgewerkt.

## Eerste concrete werkstap

Werk de gegevensovername uit met aparte naamvelden in de directory en agenda, plus een veilige atomaire opslagroute. Combineer de noodzakelijke databasewijzigingen met de aanhefuitbreiding in één nieuwe migratie. Bouw daarna leeftijd en de tweestapskeuze bovenop deze gedeelde basis.
