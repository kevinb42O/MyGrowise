# Cliëntendossiers en direct bevestigde afspraken — implementatie

18 oktober 2026. De praktijkcode is gebouwd en de migratie is na rollbackrepetitie toegepast en geregistreerd in de gekoppelde database tijdens het websiteherstel. De actuele release-inrichting staat in [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md); echte mailaflevering blijft apart te bewijzen.

## Aanwezige implementatie

- Dossieroverzicht met alle gevraagde gegevens, gegroepeerd adres, afzonderlijke voor-/achternaam, geslacht/aanhef en intakedatum. Bewerken heeft servervalidatie, een versiecontrole tegen gelijktijdig overschrijven en een waarschuwing bij niet-opgeslagen invoer.
- Volledige afsprakenhistoriek met paginering, status-/periodefilters en export van uitsluitend uitgevoerde sessiedata. Een dossier met meer dan 100 afspraken is niet meer tot de nieuwste 100 beperkt.
- `/admin/afspraaktypes`: behandelgroepen, groepskleur, intake/vervolg/overig, uitvoeringsvorm, locatie, standaardduur, deactivering en aanbod per therapeut met afwijkende duur en afzonderlijke boekbaarheid.
- Initiële configuratie: 12 unieke types en 14 therapeut/type-combinaties voor Virginie, Amy en Margot. De migratie hergebruikt de bestaande therapeutduur, zonder tarieven of duren uit de foto's te gokken.
- `/admin/therapeuten`: toevoegen, bewerken, publicatie, bestaande medewerker koppelen, uitnodigen en wekelijkse beschikbaarheid met maximaal vier perioden per dag. Gekoppelde accounts worden hier niet stilzwijgend vervangen. `/praktijk/activeren` verwerkt de uitnodigingslink en laat de therapeut een wachtwoord instellen.
- `/admin/boekingslinks`: afhankelijke therapeut-/typekeuze, stabiele aanbod-ID, kopieeractie en voorbeeld. `/afspraak` biedt de algemene planner. `/afspraak/[offer]` opent de specifieke combinatie. Oude `/begeleiding/[slug]`-profielen tonen het actuele database-aanbod, ook voor nieuwe therapeuten.
- De publieke planner behoudt de accountplicht. Therapeut/type blijven tijdens inloggen en registratie behouden. Voornaam, achternaam, geboortedatum en mobiel nummer zijn verplicht; overige dossiergegevens worden gevraagd maar zijn optioneel. Een bestaande betrouwbare accountkoppeling bepaalt welk dossier wordt gebruikt.
- `book_customer_appointment`: controleert aanbod, duur, beschikbaarheid, overlap en herhaalde inzendingen; maakt/hergebruikt het dossier en slaat de afspraak direct als bevestigd op. De accountkoppeling is uniek. Onzekere historische matches en gearchiveerde dossiers vereisen controle door de praktijk. Reden van aanmelding wordt per boeking bewaard en overschrijft niet automatisch een bestaande dossierreden.
- De agenda gebruikt de behandelkleur en toont typegegevens. Handmatig plannen gebruikt hetzelfde type-/duurmodel. Verplaatsen bewaart de oorspronkelijke afspraakduur en wijzigingshistoriek. Intake wordt bij uitvoering gekoppeld aan de vroegste uitgevoerde intakedatum.
- Afspraakdetails vanuit agenda/dossier: status, verplaatsen, annuleren, uitgevoerd/niet verschenen, planningshistoriek en verzendlogboek.
- Bevestigings-, verplaatsings- en annuleringsmails met opgeslagen afspraakgegevens. Mailopdrachten zijn persistent, hebben leases en herhaalpogingen en kunnen bewust worden herverzonden. De bestaande e-mailvoorkeur van de cliënt wordt gerespecteerd en een uitgeschakelde verzending wordt zichtbaar gelogd. SMTP-falen draait een bevestigde afspraak niet terug. Geen dossierreden, rijksregisternummer of verslagtekst in deze mails.

Een gebruikt type kan niet van behandeling, intake/vervolg of uitvoeringsvorm veranderen: maak voor zo'n inhoudelijke wijziging een nieuw type. Naam en duur kunnen voor toekomstige afspraken wijzigen; bestaande afspraken bewaren hun momentopname.

## Rechten en datagrenzen

`practice.manage` wordt verleend aan superadmins en aan gebruikers in de nieuwe afgeschermde tabel `practice_managers`. De bestaande gekoppelde Virginie wordt bij migratie toegevoegd. Beheerrechten voor aanbod geven geen automatische toegang tot behandelnotities: bestaande dossierrollen en toewijzingen blijven gelden.

De nieuwe tabellen hebben RLS en uitsluitend service-role grants. De Astro-middleware controleert beheerpagina's; muterende databasefuncties controleren opnieuw de actor. Auth-identiteiten worden via twee beperkte, niet publiek blootgestelde functies in `practice_private` geraadpleegd. Rechtstreekse tabelrechten op `auth.users` zijn niet uitgebreid. Browsercode krijgt uitsluitend de bestaande publishable key.

Nieuwe boekingen en dossierwijzigingen komen in een transactie tot stand. De bestaande uitsluitingsconstraint en agenda-locks blijven de overlapbeveiliging. Gevoelige veldinhoud wordt niet aan auditmetadata toegevoegd.

## Verificatie

- `npm run test:appointments`: vijf geautomatiseerde tests voor normalisatie/validatie, mailinhoud, tijdzone en routerechten.
- `npm run test:appointments:db`: migratie plus 56 databasecontroles binnen één rollback-transactie. Controleert onder meer directe bevestiging, dossierhergebruik, correcte duur, overlappende afspraken/blokkades, idempotentie, rollback bij foutieve persoonsgegevens, therapeutrechten, managerbeheer, uitnodigingskoppeling, snapshotbehoud, mailleases, RLS en geweigerde publieke toegang. Geen SMTP-aanroepen.
- `npm run check`: TypeScript en Astro-productiebuild.
- Elf routes zijn met fictieve, geïsoleerde Supabase-antwoorden als HTTP 200 gerenderd, waaronder nieuw/bewerken, dossier, afspraakdetails en publieke planner. In de browser zijn login-terugkeer, afhankelijke linkselectie en interactieve dag-/tijdselectie gecontroleerd. Deze schermcontrole bevestigt rendering en interactie, geen productie-integratie.
- Screenshots met uitsluitend fictieve dossiergegevens staan in `output/practice-dashboard/`.

De Supabase MCP-connector voor advisors was niet verbonden. RLS en functiegrants zijn daarom in de rollbackproef rechtstreeks in Postgres gecontroleerd; de reguliere platform-advisors moeten bij uitrol alsnog worden uitgevoerd. Gelijktijdig boeken via twee aparte HTTP-sessies en daadwerkelijke SMTP-/uitnodigingsaflevering blijven acceptatieproeven voor de doelomgeving.

## Migratie en uitrol

Migratie: `supabase/migrations/20261018160435_practice_appointment_management.sql`.

1. Controleer de doelomgeving en bestaande databaseback-up. Bestaande lokale wijzigingen en andere migraties in dezelfde checkout zijn geen onderdeel van deze releasebeschrijving.
2. Repetitie zonder blijvende wijziging: `npm run test:appointments:db`. Het script voert de migratie zelf uit en draait alles terug. Na een echte uitrol hoort deze migratierepetitie tegen een database van vóór de migratie of een geïsoleerde testomgeving te draaien.
3. Controleer de migratielijst en dry-run. Pas de beoordeelde migratie eerst toe, gevolgd door de bijbehorende applicatie-uitrol. Nieuwe code vereist de nieuwe tabellen/kolommen. Oudere service-only boekings-RPCs blijven voor deze overgang beschikbaar; de nieuwe applicatie roept ze niet meer aan. Publieke uitvoering blijft geweigerd.
4. Controleer de 14 initiële aanbodkoppelingen, behandelkleuren, actuele duren en de managerkoppeling van Virginie. Bestaande afspraken krijgen geen geraden behandeling; ze tonen ‘Afspraaktype nog te bepalen’. Oude open aanvragen blijven expliciet zichtbaar en worden niet massaal bevestigd.
5. Stel `PUBLIC_SITE_URL` in op de echte publieke oorsprong. Controleer de Supabase Auth redirect-allowlist voor `/praktijk/activeren` en de bestaande accountbevestigings-/herstelroutes. Test één echte therapeutuitnodiging met een afgesproken ontvanger.
6. Controleer bestaande SMTP-variabelen en `SUPPORT_SMTP_VERIFIED`. De eerste verzendpoging volgt direct na de boeking. `CRON_SECRET` beveiligt de cronroute. `/api/cron/booking-mail` verwerkt achterstallige afspraakmails; het bestaande dagelijkse support-cronpad verwerkt deze wachtrij eveneens.
7. Vercel Free is op 18 oktober door Kevin als vaste randvoorwaarde bevestigd. De vijfminutencron is vervangen door directe pogingen, één dagelijkse geconsolideerde mailworker en expliciet herstel via `/admin/mail`. Er is geen betaald abonnement of externe scheduler nodig. Zie het actuele releaserunbook.
8. Voer de volledige acceptatieflow uit met testcliënten: boeking, dossier, agenda, mail, handmatig plannen, verplaatsen, annuleren en export. Test ook twee gelijktijdige boekingen en mailherstel. Pas daarna publiek beschikbaar maken.

## Expliciete scopekeuzes

Tariefweergave en online betalen zijn niet toegevoegd: er zijn geen definitieve MyGrowise-tarieven aangeleverd. Automatische herinneringen, Google Meet-aanmaak, iCal/Google/Outlook-synchronisatie, widgets, verzekeringsbeheer, facturatie en trajectpakketten blijven de beschreven vervolgfase. Het dossier bevat de aanmeldings- en identificatievelden uit de oorspronkelijke vraag.
