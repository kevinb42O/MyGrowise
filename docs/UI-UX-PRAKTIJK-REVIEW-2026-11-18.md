# UX-review voor dagelijks gebruik door een psychologe

Datum: 18 november 2026. Doel: snel afspraken plannen, veilig verslagen schrijven en cliëntinformatie terugvinden zonder systeemkennis.

## Onderzocht

Live desktopcontrole van Vandaag, nieuwe afspraak (bestaande en nieuwe cliënt), cliëntendirectory, een bestaand testdossier en Mailopvolging. Schermbeelden en toegankelijkheidsboom zijn bekeken; de formulierafmetingen zijn in de browser gemeten. Aanvullend zijn de formulieren, foutafhandeling en gedeelde CSS gelezen. Er zijn geen formulieren opgeslagen, afspraken gewijzigd of mails verstuurd. Het oorspronkelijke browsertabblad is teruggezet op Mailopvolging.

Mobiele weergave, volledige toetsenbordbediening en echte opslagfouten zijn in deze review niet interactief getest. Bevindingen over foutafhandeling en registratie van annuleringen zijn gebaseerd op de code. Geen formeel gebruikersonderzoek of heuristische totaalscore: hieronder staan concrete waarnemingen en ontwerpvoorstellen.

## 1. Hoogste prioriteit: bescherm geschreven verslagen

**Waargenomen in code:** het formulier voor een nieuw verslag heeft geen markering voor bescherming tegen wegklikken. De bestaande `FormProtection` wordt alleen in AdminLayout geladen en bewaakt daar uitsluitend `data-unsaved-form`; het verslagformulier heeft dat attribuut niet. PracticeLayout laadt deze bescherming niet. Bij een serverfout verwijst de notitieroute terug naar een lege versie van het formulier, zonder de ingezonden titel en tekst terug te geven.

**Gevolg:** een psychologe kan tijdens of na een gesprek tekst verliezen. De interface biedt geen geruststellende opslagstatus. Concept en definitief staan naast elkaar, maar het onomkeerbare karakter van definitief opslaan wordt bij de nieuwe invoer slechts indirect uitgelegd.

**Voorstel:** behoud alle invoer bij opslagfouten, waarschuw bij weggaan met onopgeslagen wijzigingen en toon een zichtbare opslagstatus. Voeg daarna eventueel automatisch opslaan als concept toe in de beveiligde serveropslag. Maak van definitief opslaan een expliciete afsluiting met de uitleg: “Daarna kun je alleen een aanvulling toevoegen.” Vermijd opslag van verslaginhoud in algemene browseropslag.

Bronnen: `src/components/records/ClientRecord.astro`, `src/components/practice/FormProtection.astro`, `src/layouts/PracticeLayout.astro`, `src/pages/api/admin/clienten/[id]/notities.ts`.

## 2. Hoog: herstel de indeling van afspraakplanning

**Live gemeten:** op een desktop van 1440 × 757 pixels was het Therapeut-selectveld ongeveer 224 pixels hoog. Het naastgelegen cliëntzoekblok rekt de rij en het label uit. Afspraaktype en datum schuiven daardoor onder de schermrand. Met de nieuwe-cliëntvelden blijft hetzelfde uitrekprobleem bestaan. De cliëntzoeklijst staat bij binnenkomst al open.

**Voorstel:** maak één logisch leespad: Cliënt → Afspraakgegevens → Controle en opslaan. Geef het cliëntblok de volledige breedte, lijn de andere velden bovenaan uit en houd normale veldhoogtes. Toon bij één beschikbare therapeut haar naam als vaste informatie. Behoud de tweestapskeuze voor gebruikers die werkelijk meerdere therapeuten kunnen kiezen. Open zoekresultaten bij zoeken/focus en laat niet standaard een lange lijst het formulier domineren.

Bronnen: `src/components/practice/AppointmentDetail.astro`, `src/components/admin/AgendaClientPicker.tsx`, `src/styles/practice-management.css`. Het component gebruikt `is-wide`, terwijl de betreffende practice-grid-regel alleen `.wide` op volle breedte zet.

## 3. Hoog: maak annulering en afwezigheid een bewuste keuze

**Waargenomen in code:** onder “Intern registreren” staan Uitkomst, Bij annulering en Bij no-show tegelijk. Voor een gewone bevestigde afspraak staat de uitkomst standaard op Geannuleerd. De knop heet “Intern opslaan”, terwijl deze handeling de algemene afspraakstatus kan wijzigen.

**Gevolg:** het kan klinken als een interne notitie of administratieve aanvulling. Een klik op opslaan kan meer veranderen dan de gebruiker verwacht.

**Voorstel:** gebruik “Annulering of afwezigheid registreren”, begin met “Kies wat er is gebeurd” zonder vooraf gekozen uitkomst, en toon alleen de velden die bij die keuze horen. Benoem bij de knop concreet wat verandert en of de cliënt een mail krijgt. Houd facturatieregistratie alleen bij de passende keuze zichtbaar.

Bron: `src/components/practice/AppointmentDetail.astro`.

## 4. Hoog: laat de dossierhiërarchie het gesprek ondersteunen

**Live gezien:** direct na de hoofdacties staat een groot blok “Foutief dossier definitief verwijderen”, vóór Cliëntgegevens. Archiveren staat bovenaan bij Vervolgafspraak plannen. De eigenlijke cliëntgegevens zijn ingeklapt; vervolgens komen afsprakenfilters en toegangsbeheer, terwijl verslagen verder naar beneden staan.

**Voorstel:** toon bovenaan naam, leeftijd en de belangrijkste contact-/afspraakinformatie. Zet Verslag schrijven en Vervolgafspraak plannen centraal. Geef Overzicht, Verslagen, Afspraken en Gegevens een herkenbare vaste plek. Verplaats archiveren/verwijderen naar Dossierbeheer onderaan of een apart menu. Behoud dezelfde bevoegdheden en bevestigingen.

Bron: `src/components/records/ClientRecord.astro`.

## 5. Middel: één herkenbare manier om een cliënt toe te voegen

**Live gezien:** de directory combineert “Nieuw dossier”, “Bestaande klant kiezen” en “Cliënt toevoegen”. Verder komen klant, cliënt, klantaccount, dossier en toewijzing door elkaar voor. Voor een gebruiker met beheerdersrechten is de standaardtoewijzing “Nog niet toegewezen”, terwijl de begeleidende tekst zegt dat medewerkers automatisch aan hun eigen nieuwe cliënt worden toegewezen. De gevolgen voor een eigenaar zijn daarmee niet duidelijk.

**Voorstel:** gebruik één ingang “Cliënt toevoegen”. Zoek eerst of de persoon al bestaat; bied vervolgens bestaand dossier openen of een nieuwe cliënt aanmaken aan. Een bestaand online account is daarbij een mogelijke bron, geen begrip dat zij vooraf hoeft te kiezen. Houd identiteitscontrole en expliciete toestemming voor koppeling intact. Geef een concrete standaardkeuze voor de behandelaar en leg uit wie het dossier kan openen.

Bron: `src/components/records/ClientDirectory.astro`.

## 6. Middel: vervang systeemtaal door handelingen en gevolgen

Voorbeelden uit de huidige interface en bruikbare richting:

| Huidig | Duidelijker voor dagelijks gebruik |
| --- | --- |
| Toewijzingen | Wie kan dit dossier bekijken? |
| Klantaccount koppelen | Online account van deze cliënt verbinden |
| Boekingslinks | Link om een afspraak te maken |
| Verzendlogboek | E-mails over deze afspraak |
| Geaccepteerd door mailserver | Verstuurd naar de maildienst, met afleverinformatie onder Details |
| Definitief · v1 | Definitief opgeslagen; versienummer alleen onder Geschiedenis |
| Verslaginhoud wordt niet opgenomen in auditregels of meldingen | Alleen uitleg die nodig is om veilig te schrijven; technische details bij privacy-/beheerinformatie |

Formuleer mailstatussen zorgvuldig: verzending naar een maildienst bewijst niet dat de cliënt de mail heeft ontvangen. Houd dat onderscheid beschikbaar zonder de hoofdtaak te belasten.

Bronnen: `src/components/records/ClientRecord.astro`, `src/components/practice/AppointmentDetail.astro`, `src/layouts/PracticeLayout.astro`.

## 7. Middel: maak gezonde mailopvolging rustig

**Live gezien:** wanneer alle aantallen nul zijn, blijven herstelknoppen, een technische bevestiging over mailconfiguratie en uitgebreide uitleg over dagelijkse herstelrondes prominent staan.

**Voorstel:** begin met “Er zijn geen e-mails die je aandacht nodig hebben.” Toon bij problemen welke e-mail aandacht nodig heeft en welke gewone actie mogelijk is. Zet wachtrijtabellen, batchverwerking en configuratiecontrole onder Beheer/Technische details. Behoud de huidige verzendfrequentie en diensten; dit voorstel vraagt geen nieuwe scheduler of abonnement.

Bron: `src/pages/admin/mail.astro` en de live pagina Mailopvolging.

## Behouden

- Vandaag geeft al een bruikbaar vertrekpunt met afspraken en openstaande verslagen.
- De rustige basiskleuren, bestaande herkenbare zijbalk en tekstlabels kunnen blijven.
- Therapeut en afspraaktype zijn terecht gescheiden; de winst zit nu in de ruimtelijke indeling.
- Een bestaand dossier kunnen zoeken en een vervolgafspraak vanuit het dossier starten zijn goede uitgangspunten.

## Aanbevolen uitvoering

Eerst tekstverlies bij verslagen en onbedoelde statuswijzigingen voorkomen. Daarna de concrete planningsindeling herstellen en het dossier rond dagelijkse handelingen ordenen. Vervolgens de terminologie en zelden benodigde beheerinformatie vereenvoudigen. Controleer deze wijzigingen met een representatieve taak: cliënt vinden, afspraak plannen, verslag bewaren en vervolg plannen.

Deze review heeft geen applicatiecode, database of productieconfiguratie gewijzigd.
