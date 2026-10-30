# Acceptatie afspraak- en dossierketen

Controle: 30 oktober 2026. Dit verslag vult de oudere praktijk- en releaseplannen aan. Testgegevens waren uitsluitend synthetisch; de gebruikte psycholoog had alleen de rol `practitioner`, zonder praktijkmanager- of superadminrechten.

## Gecontroleerde keten

De lokale Astro-app is met echte tijdelijke Supabase Auth-sessies en de gekoppelde database doorlopen via HTTP: online boeken, afspraakdetails openen, automatisch gekoppeld dossier bekijken, verslag als concept opslaan en definitief maken, vervolgafspraak plannen, dezelfde afspraak verplaatsen en annuleren. De test controleert ook de agenda en accountmeldingen. Dit is een echte server-/database-integratieproef, geen claim dat alle interacties in een browser handmatig zijn doorgeklikt.

`tests/customer-rescheduling-http.mjs` controleert bovendien:

- Twee verschillende cliënten boeken gelijktijdig hetzelfde moment: precies één boeking, geen achtergebleven dossier voor de verliezende aanvraag.
- Een andere psycholoog kan het dossier en het verslag niet openen of wijzigen. Een definitief verslag blijft ongewijzigd bij een overschrijfpoging.
- Gelijktijdige verplaatsingen en een herhaalde inzending leveren geen dubbele boeking, historie of mailtaak op.
- Een intussen bezet of geïmporteerd MijnDiAd-moment weigert een wijziging; de bestaande afspraak blijft behouden.
- Bij een onbereikbare externe bron worden zowel cliëntverplaatsingen als handmatig plannen/verplaatsen geweigerd. Annuleren blijft mogelijk.
- Een vervolgafspraak gebruikt hetzelfde cliëntendossier; cliënt- en psycholoogannulering werken.

Tijdelijke accounts, professionals, afspraken, verslagen en bronconfiguratie zijn na afloop verwijderd. Een aanvullende query bevestigde nul resterende `reschedule-test-*`-accounts en -professionals.

## Herstelde punten

De afspraakdetailpagina gebruikt nu dezelfde services voor plannen, verplaatsen en statuswijzigingen als de andere praktijkroutes. Daardoor wordt de externe agenda ook vooraf gecontroleerd, blijft fout-/backoffinformatie buiten de teruggedraaide boekingstransactie bewaard en krijgt de gebruiker een begrijpelijke melding. De bestaande databasetrigger beschermde schrijfacties al; die bescherming is behouden.

De praktijkstatusroute probeert afspraakmail nu onmiddellijk na een geslaagde statuswijziging te verzenden. Een mailfout maakt een geslaagde afspraakwijziging niet ongedaan; de duurzame wachtrij behoudt de opdracht.

De bestaande lokale uitbreiding voor zelf verplaatsen en lifecyclemeldingen is meegenomen in de afgebakende releasekopie. Overige lopende aankoop- en websitewijzigingen vallen daarbuiten.

## Uitgevoerde controles

| Controle | Resultaat |
| --- | --- |
| Unit-/regressietests | 87 geslaagd, inclusief drie tests voor directe mail en SMTP-falen |
| Afspraakdatabase, rollback-only | 78 geslaagd |
| Volledige lokale HTTP-keten | 53 geslaagd, inclusief drie SMTP-geaccepteerde testmails |
| Volledige HTTP-keten op productie | 50 geslaagd zonder mail; daarna 53 geslaagd met drie SMTP-geaccepteerde mails vanaf de deployment |
| MijnDiAd on-demand databaseproef | 27 geslaagd, inclusief echte bronverversing; alle testwijzigingen teruggedraaid |
| TypeScript en productiebuild | Geslaagd |
| Release-artifact | Afgebakende releasekopie: 1668 bestanden; geen lokale testdata/geheimen en dagelijks cronbeleid behouden |
| Ontvangst echte mail | Eigenaar bevestigde beide reeksen expliciet: alle drie ontvangen, ook de drie vanaf productie |

De SMTP-proef gebruikte uitsluitend het door de eigenaar opgegeven testadres. De drie normale mailsoorten — bevestiging, verplaatsing en annulering — zijn vanuit de eigen synthetische mailtaken via het afspraakverzendlogboek verstuurd. Andere testmails bleven onderdrukt. Dit bewijst de mailinhoud/verzendroute en daadwerkelijke ontvangst; een aparte regressietest bewijst de directe verzendpoging na een statuswijziging en behoud van de wijziging bij SMTP-falen. Er is geen Auth-uitnodigings- of wachtwoordherstelproef geclaimd.

## Database en uitrol

Op 30 oktober rechtstreeks in `supabase_migrations.schema_migrations` geverifieerd, project `bwkqkehumzpfodmcesab`:

- `20261030032054_customer_appointment_rescheduling`
- `20261030033003_customer_reschedule_conflict_response`
- `20261030033534_customer_booking_lifecycle_notifications`

Deze migraties waren vóór deze acceptatieronde al toegepast. In deze ronde is geen nieuwe permanente schemamigratie uitgevoerd.

Voor aanvang was de daadwerkelijke Vercel-productieversie `cb2fa3db2e6fac624fe8ddd47dcb79dbdf2fbfbc`, deployment `dpl_5pKYbVGbufwz2fskQr3DCQ5ZehL1`, status `READY`, gecontroleerd via de Vercel-API en CLI. De afgebakende applicatierelease is daarna via `main` en de bestaande Vercel-integratie uitgerold:

- Applicatiecode: `ba806152ad823df1f548a2f55aee920237e38935`.
- Gecontroleerde productie-deployment: `dpl_CnAgrv5XgPMnpYB2sCac6Gj99btj`, status `READY`.
- Deployment: https://mygrowise-mzxcz4ivc-lanternnetworks-projects.vercel.app.
- Geteste publieke alias: https://mygrowise.vercel.app.
- De Vercel-project-API bevestigde deze deployment als de actieve productietarget met dezelfde SHA.
- Beide volledige productieproeven zijn tegen deze versie uitgevoerd. De tweede proef verstuurde bevestiging, verplaatsing en annulering via de productie-mailconfiguratie; alle drie kregen `sent` na één poging. De eigenaar heeft ontvangst van alle drie de productiemails afzonderlijk bevestigd: “Alle drie opnieuw ontvangen”.
- Dit bewijsverslag wordt afzonderlijk vastgelegd; die latere documentatiecommit wijzigt de geteste applicatiecode niet.

Uitrol gaat uitsluitend via Git en de bestaande Vercel-integratie. Geen GitHub Actions, betaalde scheduler of wijziging aan de verkoopvrijgave.

Een afzonderlijke `npm audit --omit=dev` meldde in de bestaande lockfile zeven dependencybevindingen (zes high, één moderate). De afspraakwijziging verandert geen dependencies. Deze bevindingen zijn niet als opgelost aangemerkt en vragen een afzonderlijke compatibiliteitsreview; de eerdere auditclaim uit oktober is geen actuele vrijwaring.

## Opnieuw uitvoeren

Lokaal: `npx dotenv -e .env -- node tests/customer-rescheduling-http.mjs` met een draaiende app op poort 4321. Standaard wordt niets gemaild. Alleen met een expliciet afgesproken testadres kan de operator `APPOINTMENT_TEST_MAIL_RECIPIENT` instellen.

Voor een bewuste productieproef accepteert hetzelfde script uitsluitend `APPOINTMENT_TEST_ALLOW_DEPLOYED=true` samen met `APPOINTMENT_TEST_ORIGIN=https://mygrowise.vercel.app`. Ook dan blijven mails standaard onderdrukt. Het script maakt tijdelijk synthetische records in de gekoppelde database en verwijdert deze weer; voer databaseproeven achtereenvolgens uit.
