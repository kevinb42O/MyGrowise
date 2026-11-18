# Controle van gebouwd praktijkwerk — 18 november 2026

Kevin vroeg afwerking en werking te controleren en open werk te benoemen. Toegestaan testadres: `bourguignonphotography@gmail.com`. Lokale HEAD en remote `main`/HEAD bij de audit: `7bbc3ca`. De oorspronkelijke controleronde wijzigde geen applicatie of database. Op Kevins vervolgvraag is daarna de hieronder beschreven databasecorrectie toegepast. Geen GitHub Actions gebruikt.

## Vervolg: herstel en gratis verbruik

Kevin bevestigde ontvangst van de eerdere testmail. Daarna is migratie `20261118100000_preserve_future_booking_reminders.sql` op productie toegepast. Deze scheidt inhoudelijke geldigheid van verzendbaarheid: `booking_mail_is_relevant` behoudt geldige toekomstige herinneringen; `booking_mail_is_current` laat ze pas vanaf hun verzendtijd door. De claimfunctie ruimt alleen werkelijk achterhaalde taken op. Verzendvenster, rechten en bestaande leases blijven gelden.

De twee eerder vastgestelde toekomstige herinneringen staan na de migratie weer op `pending`. Herstel geldt uitsluitend voor nooit verstuurde, nooit gepoogde herinneringen met een exacte toekomstige 72-uursdeadline, een onveranderde bevestigde afspraak en ingeschakelde voorkeur. Onderdrukte, verstuurde, verlopen en verouderde verplaatsingsmails worden niet hersteld.

Daarnaast ruimt een dagelijkse Supabase-job om 03.45 UTC operationele logs van de minuutplanner en zichzelf na zeven dagen op. Geen nieuwe Vercel-cron, Edge Function of betaald abonnement. De databasecorrectie werkt met de al bestaande live applicatie; hiervoor was geen Vercel-applicatiedeployment nodig.

Verbruiksmeting bij controle: database 22 MB, cronlogtabel 104 kB; zestig minuutruns in het afgelopen uur gemiddeld 11,79 ms, maximaal 113,89 ms. De minuutjob doet een databasecontrole en roept Vercel uitsluitend aan bij werkelijk te verwerken herinneringen. Circa 43.200 controles per dertig dagen zijn dus geen 43.200 Vercel-uitvoeringen. Het totale maandverbruik van de Vercel-account is niet ingezien.

Actuele officiële bronnen gecontroleerd: [Supabase Cron](https://supabase.com/docs/guides/cron), [Supabase Free: 500 MB database, gedeelde compute](https://supabase.com/pricing), [Vercel Hobby-verbruik](https://vercel.com/docs/plans/hobby), [Vercel eigen cron: dagelijks op Hobby](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing). De herinneringsplanning gebruikt Supabase; eventuele Vercel-aanroepen vallen onder normaal functieverbruik. Gratis capaciteit is gedeeld met de rest van de applicatie en geen beschikbaarheidsgarantie.

De nieuwe volledige live ketenproef is geslaagd: bevestiging via de bestaande productieroute verzonden (`303`, taak `sent`, één poging), waarna de toekomstige herinnering `pending` bleef met nul pogingen. De echte minuutplanner heeft die herinnering vervolgens automatisch verstuurd, gepland `2026-11-18 00:25:16.437 UTC`, verzonden `00:26:02.672 UTC` (circa 46 seconden later), één poging, geen fout. Beide mails gingen uitsluitend naar het opgegeven testadres. Geen handmatige crontrigger. De tijdelijke productiefixtures en het tijdelijke script zijn verwijderd.

Definitieve validatie: **56 praktijkdatabasecontroles**, **150 gewone tests**, TypeScript, productiebuild, artifactcontrole en `git diff --check` geslaagd. De nieuwe checks dekken behoud na boekingsspecifieke en globale mailclaim, geen vroege claim, claim op deadline, actieve lease tegen dubbel ophalen, verlopen taak, herstelbeperkingen en rechten af. Databaseproeven zijn teruggerold en versturen zelf geen mail. De bevindingen hieronder beschrijven de oorspronkelijke fout en eerdere audit; de foutstatus is door bovenstaand herstel achterhaald.

## Belangrijkste bevinding: toekomstige herinneringen verdwijnen uit de wachtrij

**Prioriteit hoog, in productie aangetoond.** `claim_booking_mail` markeert wachtende taken als `superseded` wanneer `booking_mail_is_current` onwaar is. De nieuwe herinneringscontrole geeft ook vóór de geplande verzendtijd onwaar terug. Daardoor kan een normale bevestiging, die de mailverwerking voor dezelfde afspraak aanroept, haar toekomstige herinnering meteen ongeldig maken. Een globale verwerking kan ook andere toekomstige herinneringen raken.

Relevante implementatie:

- `supabase/migrations/20261117152000_agenda_booking_changes.sql`: `claim_booking_mail`, eerste update van de wachtrij.
- `supabase/migrations/20261117170000_practice_workflow_fixes.sql`: `booking_mail_is_current`, tijdvenster van de herinnering.

Productieproef: synthetische bevestigde afspraak met herinnering op starttijd minus exact 72 uur. Na het verzenden van de bevestiging stond de toekomstige herinnering op `superseded`, met nul verzendpogingen. De bevestiging zelf stond op `sent`, één poging. De actuele databasefunctiedefinitie bevat dezelfde foutieve claimvoorwaarde.

Alleen geaggregeerd gecontroleerd buiten de tijdelijke testtherapeut: **twee toekomstige herinneringen voor één dossier** staan in dezelfde toestand, zonder verzendpoging, terwijl afspraakstatus en oorspronkelijke starttijd nog overeenkomen. Dit is een momentopname en geen bewijs dat alle historische gemiste herinneringen zijn gevonden. Bestaande echte taken zijn niet aangepast.

Nodig:

1. Een toekomstige, inhoudelijk geldige herinnering behouden bij mailverwerking; nog niet verzendbaar onderscheiden van achterhaald.
2. Regressieproef: bevestiging versturen terwijl de herinnering nog niet aan de beurt is; daarna moet zij wachtend blijven.
3. Ook globale verwerking, verplaatsen, annuleren, uitgeschakelde voorkeuren, verstreken verzendvensters en dubbele verzending afdekken.
4. De twee bestaande taken na correctie opnieuw beoordelen en alleen herstellen als afspraak, voorkeur en verzendtijd nog geldig zijn.
5. Opnieuw een volledige bevestiging-plus-herinneringproef uitvoeren.

De minuutplanner zelf staat actief op `* * * * *`. Alle zestig runs in het uur vóór de controle waren geslaagd. Er waren bij aanvang geen wachtende herinneringen met een verzendtijd meer dan vijftien minuten in het verleden. Dat laatste vangt de bovenstaande fout niet: die taken staan immers niet meer op wachtend.

Een aparte tweede proef heeft de synthetische afspraak verplaatst en de bijbehorende verplaatsingsmail onderdrukt, zodat de nieuwe toekomstige herinnering behouden bleef. Zonder handmatige aanroep van de cronroute heeft de productiescheduler die herinnering automatisch verstuurd: gepland `2026-11-18 00:17:28.958 UTC`, mailtaak verzonden `00:18:02.935 UTC`, één poging, geen fout. Dat is ongeveer 34 seconden na de geplande tijd. De planner en het transport werken dus; de volledige normale bevestiging-plus-herinneringketen blijft defect totdat de claimlogica is hersteld. Inboxontvangst is niet aangetoond.

## Wat is gecontroleerd

| Onderdeel | Bewijs en resultaat |
|---|---|
| Algemene tests | `npm test`: 150 geslaagd, nul mislukt. |
| TypeScript en productiebuild | `npm run check`: geslaagd. |
| Praktijkdatabase | `npm run test:practice:db`: 43 checks geslaagd, migraties en testgegevens teruggerold. |
| Extra cliëntgegevens en naambehoud | Geïsoleerde PostgreSQL-proef: 30 checks geslaagd, geen externe mail. |
| Release-artifact | `npm run check:artifact`: 1772 bestanden gecontroleerd; geen verboden lokale mail-/omgevingdata of secrets aangetroffen. |
| Live cliënt aanmaken | Voornaam, familienaam en e-mail afzonderlijk opgeslagen en ingevuld in het dossierformulier. |
| Validatiefout bij aanmaak | Ingevoerde namen en ongeldig e-mailadres blijven in het formulier staan. |
| Alle aanheffen | Via het live dossierformulier elk van de zeven waarden opgeslagen en in de database gecontroleerd: heer, meneer, mevrouw, heer/mevrouw, ouder(s)/verzorger(s) van, echtpaar en geen aanhef. |
| Leeftijd | Geboortedatum 1 januari 1988 opgeslagen via live formulier; dossier toont 38 jaar. Rekenranden zijn daarnaast door de lokale tests afgedekt. |
| Afspraakkeuze | Live planner bevat afzonderlijke therapeut- en afspraaktypevelden. Cliëntvoorselectie blijft aanwezig. Een gemanipuleerde therapeutkeuze wordt geweigerd. Interactieve filtering en visuele sortering zijn in deze ronde niet opnieuw via een browser bewezen. |
| Accountkoppeling | Later geverifieerd koppelen van een synthetisch dossier vult een bestaande afspraak aan; die afspraak verschijnt op de ingelogde pagina Mijn begeleiding. |
| Rechten | Het synthetische cliëntaccount krijgt geen toegang tot het interne dossierformulier. |
| Bestaande accountkoppelingen | Productieaggregaat: nul afspraken met ontbrekende accountkoppeling waar het dossier al geverifieerd gekoppeld is; nul conflicten tussen dossier- en afspraakaccount. Dit bewijst niet dat ieder ongekoppeld dossier gekoppeld hoort te worden. |
| Bevestigingsmail | Live mailtransport accepteert verzending naar het opgegeven testadres; taakstatus `sent`, één poging. Ontvangst in de Gmail-inbox is niet geverifieerd. |
| Automatische herinneringsmail | Tweede, afzonderlijke proef via de echte minuutplanner: `sent`, één poging, circa 34 seconden na de geplande tijd. Geen handmatige crontrigger. Eerste normale keten faalt door de hierboven beschreven claimfout. |

De eerste tijdelijke formulierproef gebruikte een door JavaScript afgerond databasedatumtoken en liep daardoor terecht tegen wijzigingsbescherming aan. Met het exacte token uit het echte HTML-formulier slagen alle aanheffen en de leeftijd. Dit is geen productfout.

## Afwerking en resterende acceptatie

- Negen oudere dossiers missen nog minstens één afzonderlijk naamveld. Eenmalig handmatig controleren en aanvullen; samengestelde namen niet blind splitsen. Nieuwe aanmaak werkt wel.
- Volledige schermacceptatie van compacte agenda 08.00–17.00, grotere boekingstekst, naam-/datumleesbaarheid, toetsenbordbediening, mobiel en zoom blijft open. De schermbediening leverde deze ronde geen betrouwbaar bruikbaar browserbeeld op. HTTP-, code- en databasetests zijn geen visuele acceptatie.
- Het oorspronkelijke door Virginie gemelde account en haar concrete afspraak zijn niet persoonlijk geopend. De synthetische accountketen werkt; de productieaggregaten tonen geen overeenkomstige koppelingsconflicten.
- Definitief verwijderen is bewust beperkt tot lege, gearchiveerde, ongekoppelde dossiers en superadmin. Dubbele accounts of dossiers met afspraken/verslagen opruimen of samenvoegen is niet gebouwd. De blokkades zijn geen aangetoonde storing.
- Interne annulering/no-show en factureringskeuze zijn gebouwd en door de workflowtests afgedekt; geen nieuwe echte cliëntstatussen gewijzigd. “Gefactureerd” maakt geen factuur of betaalmail.
- Meet-link blijft handmatig verstuurd worden. De bestaande mailtekst belooft geen automatische Meet-aanmaak.

## Nog niet gebouwde praktijkverzoeken

1. Informatiemail naar overgezette patiënten.
2. Mailvenster vanuit dossier met bijlagen.
3. Betaalmail na sessie.
4. Betaalmail bij no-show.
5. Vervolgplannen met zicht op agenda en beschikbare momenten.
6. Uitgaande koppeling naar Google Agenda, inclusief verplaatsen/annuleren; MijnDiAd-keten nog te verifiëren.

De eerste vijf stonden in het eerdere familievoorstel voor €360 samen; Google Agenda was niet geprijsd. Deze controle wijzigt de offerte niet. Ebookwerk is hier buiten scope gehouden op Kevins eerdere instructie.

## Tijdelijke testgegevens

De live proeven gebruiken herkenbare synthetische cliënten, therapeut, accounts en afspraken. Alleen het expliciet toegestane adres wordt als mailontvanger gebruikt. De tijdelijke scripts, aanmeldgegevens en productiefixtures worden na de proef verwijderd. Geen echte dossierinhoud opgenomen in dit verslag.
