# UI/UX praktijk — uitvoering 18 november 2026

Uitgangspunt: een psychologe moet cliënten, afspraken en verslagen kunnen opvolgen zonder kennis van de technische inrichting. Dit voert de praktische verbeteringen uit de [review](UI-UX-PRAKTIJK-REVIEW-2026-11-18.md) door.

- Nieuwe verslagen en conceptbewerkingen gebruiken dezelfde beveiligde opslaglogica met een formulier op de dossierpagina. Bij een validatie- of opslagfout blijft de tekst staan. De gewone formulierroute bewaart ingediende velden eveneens bij fouten, ook bij concepten op oudere pagina's. Niet meer bewerkbare concepten krijgen een tekstvak om de niet-opgeslagen tekst te behouden.
- Het formulier vermeldt niet-opgeslagen wijzigingen, toont de opslagstatus en vraagt bevestiging voordat een verslag definitief wordt. Verlaten van een gewijzigd formulier geeft een browserwaarschuwing, ook in de praktijkomgeving. Tijdens opslaan staan de velden tijdelijk vast. Verslagtekst wordt niet in browseropslag gezet; concepten worden bewust met de opslagknop bewaard.
- De afspraakplanner heeft drie opeenvolgende groepen: cliënt, afspraakgegevens en controleren/opslaan. Eén beschikbare therapeut wordt als naam getoond. Cliëntresultaten laden pas bij het openen van de zoekfunctie. De eindtijd blijft zichtbaar na de keuze van het afspraaktype.
- Een bevestigde of uitgevoerde afspraak heeft geen vooraf gekozen annulering. De gebruiker kiest zelf annulering of afwezigheid; alleen passende vervolgvelden verschijnen. De knop benoemt de actie en dat er geen e-mail wordt gestuurd.
- Het dossier toont geboortedatum/leeftijd en telefoon in een korte samenvatting. Verslagen staan vóór afspraken. Archiveren, herstellen en verwijderen staan onder Dossierbeheer, onderaan. Rechten, bevestigingen en verwijderblokkades blijven gehandhaafd.
- Eén ingang Cliënt toevoegen bundelt handmatige invoer en de optie om een bestaand online account te kiezen. Een bevoegde gebruiker wordt standaard aan het eigen nieuwe dossier toegewezen, met behoud van een expliciete andere of lege keuze.
- Labels gebruiken gewone taal, onder andere Afspraaklinks, E-mails over deze afspraak en Wie kan dit dossier bekijken. Een gezonde mailpagina toont geen prominente herstelacties. Geplande herinneringen tellen niet als een fout.

## Controle

Lokale typecontrole, productiebuild, artifactcontrole en tests. Vier nieuwe gedragstests voor concept/definitief opslaan, blokkeren van een concept uit een ander dossier, versieconflicten en tekstbehoud in de gewone formulierroute. Browsercontrole met synthetische gegevens op desktop en mobiel (390 px, geen horizontale overflow), dynamische registratievelden en een opzettelijk geweigerde verslagopslag. Daar bleven titel en inhoud staan en werd opnieuw opslaan beschikbaar. De browser blokkeerde het verlaten van het gewijzigde verslagformulier.

Geen echte cliëntgegevens of e-mailverzending gebruikt voor de schrijftests. Een onbekend netwerkresultaat vraagt eerst controle in een tweede tabblad; zonder ontvangstbevestiging kan de server een verslag al opgeslagen hebben. Automatisch opslaan en een nieuw opslag/idempotentiemodel maken geen deel uit van deze wijziging.

Geen databasewijziging, GitHub Actions, betaalde scheduler of abonnement toegevoegd.
