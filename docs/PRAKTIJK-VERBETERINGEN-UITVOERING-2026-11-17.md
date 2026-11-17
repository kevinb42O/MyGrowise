# Praktijkverbeteringen — uitvoering en uitrol

Datum: 17 november 2026. Geïmplementeerd en op uitdrukkelijk verzoek uitgerold op basis van het [verbeterplan](PRAKTIJK-VERBETERPLAN-2026-11-17.md). Migratie `20261117170000` is succesvol toegepast. Implementatiecommit `02ff86f` is naar `origin/main` gepusht en door de bestaande Vercel-integratie succesvol gedeployd. De scheduler is geactiveerd en de eerste automatische uitvoering is geslaagd. De databaserepetities gebruikten telkens één teruggedraaide transactie met synthetische gegevens; daarbij zijn geen mails verstuurd.

## Opgeleverd in de code

| Punt | Implementatie |
|---|---|
| 1 | Geverifieerde dossier-accountkoppeling werkt door naar bestaande afspraken zonder nieuwe bevestigingsmail. Conflicterende identiteiten worden geblokkeerd. De migratie herstelt ook bestaande ondubbelzinnige koppelingen. |
| 2 | Compacte werkdag 08.00–17.00, hoogte op basis van beschikbare ruimte, weergavevoorkeur per gebruiker en zichtbare actie voor afspraken buiten deze uren. |
| 3 | Gecombineerde cliëntzoeker met gedeeltelijke naam/e-mail, accentnormalisatie, toetsenbordselectie, fout/herstel en paginering. |
| 4 | Functionele tekst vergroot: 16 px voor inhoud, 14 px voor secundaire gegevens; dossiers, boekingen, details en statusinformatie. Boekingen hebben filters en paginering van 50 resultaten. |
| 5 | Superadmin kan lege, gearchiveerde en ongekoppelde foutieve dossiers verwijderen met reden, overtypen van naam en expliciete bevestiging. Afspraken, verslagen en zorggegevens blokkeren verwijdering. Accountverwijdering en dossiers met historie vereisen afzonderlijke beoordeling van bewaarplichten. |
| 6 | Nieuwe cliënt met naam, e-mail en geboortedatum in dezelfde planningsflow. Dossier en afspraak worden atomair en idempotent aangemaakt; bij een bezet tijdstip blijft geen los dossier achter. |
| 7 | Herinnering gepland op exact `starts_at - interval '72 hours'`, inclusief zomer-/wintertijd. Oude deadlines vervallen bij verplaatsen. Voorkeuren en status worden opnieuw gecontroleerd vóór verzending. Online mails bevatten de gevraagde Meet-zin. Kevin bevestigde dat de begeleider de link handmatig verstuurt. |
| 8 | Cliëntzoeker bovenaan admin en praktijk, maximaal vijf recente dossiers aan serverzijde, actuele toegangscontrole en links naar dossier, notities en afspraken. Het agendaveld heet nu ‘Zoek in deze agendaperiode’. |
| 9 | Tijdig/laattijdig geannuleerd en no-show gefactureerd/niet gefactureerd als interne registratie, met auditspoor en correcties. Geen automatische mail of cliëntmelding bij deze actie. Historiek blijft behouden. Gewone annulering met informeren is een afzonderlijke actie. |

‘No-show’ registreert de afwezigheid vanaf de starttijd. Het maakt geen factuur aan. De facturatiekeuze is uitsluitend een interne administratieve aanduiding. Achterhaalde bevestigingen en herinneringen worden onderdrukt na annuleren, no-show of afronden.

## Herinneringsverwerking

Vercels bestaande dagelijkse cron blijft ongewijzigd. Voor 72-uursverzending is aanvullend een Supabase Cron-controle per minuut voorbereid. De gekoppelde database heeft `pg_cron` en Vault al beschikbaar; `pg_net` wordt alleen bij expliciete activatie ingeschakeld. Dit gebruikt de bestaande infrastructuur, zonder betaalde scheduler of GitHub Actions.

De SQL-controle roept het beveiligde endpoint uitsluitend aan wanneer daadwerkelijk een herinnering vervallen is; geen keepalive. Het endpoint krijgt geen cliëntgegevens in de aanvraag en retourneert uitsluitend aantallen. URL en toegangssleutel staan in Vault; de sleutel gaat als Authorization-header mee. De installer controleert eerst via HEAD dat de juiste applicatie en sleutel live staan, zonder mail te sturen. Installatie is herhaalbaar en actualiseert dezelfde cronjob.

Het geplande tijdstip ligt exact 72 uur vooraf. De daadwerkelijke verzending volgt op de eerste minuutcontrole, met mogelijke transportvertraging. Herinneringen ouder dan 15 minuten worden niet alsnog verstuurd. SMTP of een gepauzeerd/onbereikbaar Supabase-project kan dus tot een gemiste herinnering leiden. Het mailoverzicht toont planning, verzending en fouten; er is geen belofte van exacte mailboxontvangst.

De worker verwerkt maximaal 100 mails per aanroep in groepen van vier met een tijdsbudget van 45 seconden. Bij meer werk volgen nieuwe minuutcontroles zolang actuele herinneringen wachten. Leases voorkomen gelijktijdige verwerking; providerfouten blijven in de wachtrij voor retry.

## Uitgevoerde controles

- `npm test`: 128 tests, inclusief mailinhoud, queuecapaciteit, onderdrukking van oude jobs, SMTP-fouten en authenticatie van het herinneringsendpoint.
- `npm run test:practice:db`: 46 controles binnen één rollbacktransactie. Accountkoppeling, rechten, zoeknormalisatie, herplanning, interne statussen zonder cliëntmelding, revisieconflicten, voorkeuren, geboortedatum, veilige verwijdering en exact 72 uur over de zomertijdgrens. De echte dispatch-SQL is getest met een netwerkstub; er zijn geen HTTP-aanvragen of mails verstuurd.
- `npm run check`: TypeScript en productiebuild geslaagd.
- `npm run check:artifact`, `git diff --check` en syntaxiscontrole van de schedulerinstaller geslaagd.
- Impeccable-detectie: alleen advisories voor afwijkingen van het Startpunt-ontwerp; geen niet-adviserende bevindingen. Praktijktypografie heeft bewust eigen functionele formaten.

Visuele browseracceptatie is nog open: de beschikbare browserconnector liep vast voordat de pagina kon worden geopend. Geen screenshots of geslaagde schermtests beschikbaar. Controleer vóór vrijgave dag/week op 1366×768 en 1440×900, mobiel, 200% zoom, lange namen/notities, cliëntaanmaak en toetsenbordbediening.

## Productiecontrole na activatie

- Vercel rapporteerde `success` voor implementatiecommit `02ff86f`; de nieuwe route is bereikbaar op `https://www.mygrowise.be`.
- Herinneringsendpoint: onbevoegde HEAD en GET geven 401; geautoriseerde HEAD geeft 204 zonder mailverwerking.
- Homepage geeft 200. Mijn begeleiding, adminagenda en praktijkagenda sturen een niet-aangemelde bezoeker naar de juiste login.
- Scheduler `mygrowise-booking-reminders`, job-ID 8, is actief met `* * * * *`. `pg_net` 0.20.4 is ingeschakeld; endpoint en token zijn in Vault opgeslagen. Het canonieke www-domein voorkomt verlies van de autorisatieheader bij een domeinredirect.
- Eerste automatische run: 17 november 2026 om **23.27 uur Europe/Brussels** (22.27 UTC), status `succeeded`.
- Na activatie stonden twee toekomstige herinneringen klaar, geen enkele met een verstreken deadline. De eerste cronrun hoefde daarom geen HTTP-aanroep of mail te versturen. Werkelijke SMTP-aflevering op een herinneringsdeadline is hiermee nog niet bewezen.
- De 46 databasecontroles zijn na toepassing van de migratie opnieuw geslaagd. Visuele browseracceptatie blijft open door de eerder vastgelopen connector; Kevin gaf expliciet opdracht om migratie, push, deployment en scheduleractivatie door te zetten.

## Uitrolvolgorde

1. Controleer de visuele acceptatie op een werkende preview.
2. Controleer en pas `supabase/migrations/20261117170000_practice_workflow_fixes.sql` toe via de bestaande migratieroute. De migratie staat na de reeds aanwezige migraties van dezelfde dag. Ze herstelt ondubbelzinnige accountkoppelingen en plant uitsluitend toekomstige herinneringsdeadlines; geen historische inhaalmails.
3. Publiceer de bijbehorende applicatie via de bestaande Vercel-integratie. Houd `CRON_SECRET` op Vercel gelijk aan de waarde die de installer gebruikt.
4. Voer vanuit de bestaande beveiligde omgeving `PUBLIC_SITE_URL=https://www.mygrowise.be npm run reminders:configure` uit. Dit activeert de minuutcontrole pas nadat het nieuwe endpoint en de migratie aanwezig zijn. Geen secrets in Git of terminaluitvoer plaatsen.
5. Controleer met een synthetische afspraak en testmailbox: Mijn begeleiding, online bevestiging, herinnering, voorkeur uit, verplaatsen en interne annulering/no-show. Controleer de feitelijke mailstatus en `cron.job_run_details`/HTTP-responsstatus; gebruik geen echte cliëntgegevens voor deze test.

Scheduler uitschakelen zonder gegevensverlies: `select cron.unschedule('mygrowise-booking-reminders');`. Dit stopt de aanvullende minuutcontrole. Reeds verzonden mails zijn niet terug te halen. Draai de schemawijzigingen niet blind terug na ingebruikname van de nieuwe classificaties.

Technische basis: [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart) en [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net). Deze documentatie beschrijft de geplande SQL- en HTTP-aanroepen; er is geen nieuwe externe scheduleraccount nodig.
