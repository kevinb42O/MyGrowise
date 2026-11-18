# Ontvangers in Mailopvolging

Datum: 18 november 2026. Status: implementatie en lokale controles geslaagd; uitrol wordt hieronder vastgelegd.

De eerdere visuele herinrichting verborg essentiële informatie. Op expliciet verzoek van Kevin staan cliëntnaam en e-mailadres nu direct in iedere rij, bij alle statussen. De categorie staat onder het mailtype. Bij teammails staat onder het mailtype over welke cliënt de mail gaat, terwijl de ontvangerkolom het echte teamadres toont. Ontbrekende gegevens worden herkenbaar gemeld.

## Herkomst

| Stroom | Bestemmingsadres en naam |
|---|---|
| Support | Gastgegevens of gekoppeld account; voor oudere taken actuele gegevens. |
| Bestellingen | Contactgegevens van de bestelling, met koper als terugval; teammails gaan naar info@mygrowise.be. |
| Afspraken | Reeds in de mailtaak opgeslagen ontvanger en naam. |
| Contactformulier | MyGrowise-team op info@mygrowise.be; de naam van de vraagsteller staat als cliëntcontext. |
| Aankooplinks | E-mailadres uit de oorspronkelijke mailtaak; naam uit bijbehorende bestelling of koper. |

Nieuwe succesvolle support-, bestel- en websitemails bewaren het werkelijk gebruikte adres en de bijbehorende naam in afzonderlijke snapshotvelden. Afspraken bewaren die gegevens al in hun taak. Bij oudere verzendingen zonder snapshot legt een detailtekst uit dat de naam en/of het adres uit de gekoppelde gegevens komen. Historische adressen worden niet als bewezen snapshots teruggevuld.

De migratie `20261118180000_admin_mail_recipients.sql` breidt de bestaande projectie uit. Alleen de serverrol kan haar lezen. Voor supportidentiteit bestaat een beperkte functie op basis van het gesprek; anonieme en ingelogde gebruikers krijgen geen uitvoerrecht en de serverrol krijgt geen algemene leestoegang tot auth.users. Mailinhoud en toegangstokens blijven buiten de projectie.

## Controle

- 196 lokale tests en TypeScriptcontrole geslaagd in een afzonderlijke checkout, zonder gelijktijdige wijzigingen aan andere beheerschermen.
- Browsercontrole met synthetische gegevens: ontvanger zichtbaar vóór uitklappen, filters en terugnavigatie, retrybeveiliging, zonder JavaScript, 320/390/768/1100 pixels en 200% zoom geslaagd.
- Geïsoleerde PostgreSQL-proef met echte migratie-SQL: alle vier stromen, klant- versus teamadres, blijvende snapshots, veilige projectie en serverrechten geslaagd.
- Repetitie tegen gekoppelde database teruggedraaid: alle 24 taken behouden; 18 verzonden, 3 gepland, 3 onbevestigd. Alle 24 hebben een naam en bestemmingsadres beschikbaar.
- Ontwerpdetector herhaalt de bekende afwijkingen van het publieke `/startpunt`-ontwerpsysteem: de bestaande adminlettertypen, kleuren en maten zijn bewust behouden. Desktop- en mobiele browserbeelden zijn beoordeeld.
- Productiebuild en release-artifactcontrole geslaagd. Geen echte mails verstuurd voor deze controles.

## Uitrol

Migratie toegepast en geregistreerd in de gekoppelde database: alle 24 taken en de bestaande statustellingen behouden; alle 24 hebben een naam en adres beschikbaar. Vercelcontrole volgt na push. Een SMTP-verzendbevestiging bewijst geen aflevering in de inbox.
