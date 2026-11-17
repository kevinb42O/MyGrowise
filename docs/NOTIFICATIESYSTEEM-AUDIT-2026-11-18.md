# Audit notificaties en aandachtssignalen

Datum: 18 november 2026, Europe/Brussels.

## Oordeel en status

Het bestaande systeem was niet af: de menuteller was hardgecodeerd, één melding openen markeerde alles gelezen en operationele open acties hadden geen gedeelde signalering. Deze problemen zijn lokaal hersteld voor organisatiebeheer, superadmin, medewerkers en de praktijkomgeving. De bestaande klantenmeldingen zijn aanvullend op code gecontroleerd; hun aparte accountinterface is niet herontworpen.

De wijzigingen zijn niet gepubliceerd. De migratie `20261118090000_staff_notification_integrity.sql` is geïsoleerd getest en moet bij de uitrol worden toegepast. De gekoppelde database is uitsluitend gelezen. Er zijn geen echte meldingen verstuurd, geen echte leesstatussen veranderd en geen productieaccounts aangemaakt.

## Bevindingen en herstel

| Prioriteit | Bevinding | Herstel | Belangrijkste bron |
| --- | --- | --- | --- |
| P1 | Berichten had een vaste badge `0`; andere open acties bleven zonder menu-indicator. | Gedeelde aandachtservice met tellingen per recht en rode bolletjes in beide menu’s en het mobiele menu. | `src/lib/adminAttention.ts`, beide beheerlayouts |
| P1 | Eén melding aanklikken markeerde alle meldingen gelezen. | De klik navigeert alleen; de geladen conversatie verwerkt haar eigen leesstatus. | `NotificationBell.astro`, `internalMessaging.ts`, `supportInbox.ts` |
| P1 | Ongeldige JSON, een leeg object of een lege selectie kon impliciet alles gelezen betekenen. | Expliciete `{all:true}` of gevalideerde `{ids:[...]}`; lege ids doen niets; verkeerde input geeft 400. | `/api/internal/notifications` |
| P1 | Teamnotificaties openden voor support- en dubbele rollen de klantentab. | Links bevatten expliciet `view=team` of `view=support`. | `notificationPresentation.ts` |
| P1 | Het supportdashboard haalde met de servicesleutel ook eigenaarstaken en afgeschermde statistieken op. | De geverifieerde sessie wordt aan het deferred dashboard doorgegeven; iedere gegevensbron controleert haar eigen recht. Onbevoegde links verdwijnen. | `DashboardIsland.astro`, `DashboardContent.astro`, `superAdmin.ts` |
| P1 | Een geldig klantonderwerp van 180 tekens plus notificatieprefix overschreed de titelconstraint; de trigger kon het hele bericht terugdraaien. | PostgreSQL-trigger begrenst de meldingstitel op 180 Unicode-tekens. | Nieuwe migratie |
| P2 | Eén medewerker met meerdere supportrollen kon dubbele notificaties krijgen. | `SELECT DISTINCT` per ontvanger; huidige rollenmatrix gebruikt `super_admin` en `support`. | Nieuwe migratie |
| P2 | De bel toonde maximaal 20 als totaal, ook bij meer ongelezen meldingen. | Exacte telling onafhankelijk van de preview van twintig; visuele teller maximaal `99+`. | `getUnreadNotifications`, `NotificationBell.astro` |
| P2 | Nieuwe meldingen tijdens een leesactie konden verdwijnen zonder gelezen te zijn. | Servermoment uit de opgehaalde snapshot begrenst alles-gelezen; conversaties gebruiken een tijdgrens vóór de berichtquery. Oudere parallelle reads mogen de leesgrens niet terugzetten. | Notificatie-API en beide conversatieservices |
| P2 | Lange gesprekken konden door de PostgREST-limiet gedeeltelijk worden geladen en vervolgens volledig gelezen gemarkeerd. | Stabiele pagina’s van 500 berichten; fouten stoppen de verwerking vóór het aanpassen van leesstatus. | `messagePagination.ts`, beide conversatieservices |
| P2 | Fouten bij interne leesstatusupdates werden genegeerd. | Beide database-uitkomsten worden gecontroleerd. | `getInternalThread` |
| P2 | Oude supportnotificaties konden na verlies van supportrechten nog een klantonderwerp tonen. | Zonder `support.read` haalt de bel uitsluitend teamnotificaties op. | Notificatie-API, `getUnreadNotifications` |
| P2 | Een eigen bericht kon als nieuw binnenkomend bericht tellen. | De inbox vergelijkt het recentste bericht van een andere afzender met de leesgrens. | `listInternalThreads` |
| P2 | Teamcontacten werden beperkt tot de eerste honderd Auth-gebruikers. | De Auth-lijst wordt gepagineerd. | `listMessageContacts` |
| P2 | Het dashboard kon “Alles bijgewerkt” melden terwijl andere bronnen open werk bevatten. | De stellige melding is vervangen; het gedeelde overzicht toont gecontroleerde bronnen en gedeeltelijke uitval. | `AttentionStatus.astro`, `DashboardContent.astro` |
| P2 | De bel had geen expliciete foutstatus, Escape/focusherstel of sluiting buiten het paneel. | Herstelbare foutteksten, Escape met focusherstel, buitenklik, ARIA-relatie, begrensde scroll en mobiele positionering onder de werkelijke topbalk. | `NotificationBell.astro`, `admin.css` |

## Wanneer een lichtje brandt

| Onderdeel | Betekenis |
| --- | --- |
| Berichten | Eigen ongelezen teammeldingen; met supportrechten ook eigen klantmeldingen en klantgesprekken met status `new`/`in_progress`. Support is een gedeelde werklijst. |
| Boekingen en agenda | `pending` aanvragen; in de praktijk alleen die van de aangemelde professional. |
| Bestellingen | Open handmatige Wise-overschrijvingen en betwiste bestellingen. Een nog niet gemelde overschrijving blijft bewust open werk. |
| Afnames & rapporten | Voorbereiding (`pending`) of ontvangen antwoorden (`received`) bij betaalde/geleverde bestellingen. `invited` wacht op de klant en activeert dit signaal niet. |
| Producten en content | Status `review`, alleen voor rollen die mogen beoordelen/publiceren. Concepten activeren geen lichtje. |
| Privacy & retentie | Verzoeken met status `received` of `in_progress`. Privacy heeft nu ook een eigen, op rechten gefilterd menu-item. |
| Instellingen | Open, lopende of geblokkeerde werkpunten; actieve kosten die binnen dertig kalenderdagen vervallen of achterstallig zijn; opgeslagen integratiestatus `degraded`/`failed`. |
| Mailopvolging | Ontbrekende lokale mailconfiguratie, mislukte jobs, wachtende jobs ouder dan 24 uur en verlopen verzendleases, over alle vier bestaande wachtrijen. De termijn respecteert de bestaande dagelijkse herstelronde. |
| Praktijk: cliëntendossiers | Eigen conceptverslagen en afgelopen bevestigde/uitgevoerde afspraken zonder verslag, binnen de bestaande actieve dossiertoewijzingen. De taakregels zijn gedeeld met het werkdagdashboard. |
| Dashboard en mobiele menuknop | Een samenvattend lichtje zodra minstens één toegankelijke bron open aandacht heeft. |

Een melding lezen is iets anders dan werk afronden. “Alles gelezen” verandert geen betaling, boeking, supportstatus, afname of werkpunt. Het lichtje voor zo’n bron blijft aan tot de onderliggende toestand wordt opgelost.

De bel ververst iedere 30 seconden; aandachtssignalen iedere 60 seconden en bij terugkeer naar het venster/tabblad. Achtergrondtabbladen slaan de controles over. Bij een gedeeltelijke storing blijven laatst bekende signalen zichtbaar. De kop vermeldt dat de controle onvolledig is. Bij een volledige storing wordt geen lege toestand gesuggereerd. Tellingen in het overzicht zijn brongebonden: één gesprek kan zowel open werk als een ongelezen melding opleveren; het overzicht presenteert dit als afzonderlijke categorieën.

## Verificatie

- `npm test`: de volledige lokale suite slaagt. De laatste volledige run telde 150 tests, inclusief de gelijktijdig aanwezige andere projectwijzigingen.
- `npm run check`: TypeScript en de productiebuild slagen.
- `tests/admin-notifications.test.mjs`: gerichte regressies voor rolgrenzen, 41 meldingen met preview van 20, invoervalidatie, ontvangerscope, lege selecties, nieuwe berichten tijdens lezen, paginering, afgeschermde klantonderwerpen, praktijktoewijzingen en supportdashboardquery’s.
- `tests/admin-notifications-isolated-db.mjs`: echte PostgreSQL-trigger uitgevoerd met PGlite; getest met 180 Unicode-tekens, meerdere rollen, gastberichten, toewijzing, interne notities en uitsluiting van de afzender.
- `tests/admin-notifications-browser.mjs`: twaalf Chromium-scenario’s: superadmin, support, medewerker en professional op 1440, 390 en 320 pixels. Werkelijke layouts/componenten met synthetische API-antwoorden. Gecontroleerd: lichtjes, exacte beltotalen, veilige tekstweergave, inboxlinks, geen horizontale overflow, Escape/focus, buitenklik, mislukte alles-gelezen, nieuwe meldingen, gedeeltelijke en volledige uitval. Dit zijn geëmuleerde schermmaten en muis/toetsenbordtests, geen fysieke touchscreencontrole. Externe Google Fonts zijn in de fixture geblokkeerd; de bestaande fallbackletters zijn gebruikt.
- Browserbeelden: `/tmp/mygrowise-notification-browser/`; representatieve desktop- en mobiele beelden zijn visueel bekeken.
- De tijdelijke browserfixture wordt na de test verwijderd en levert buiten development altijd 404.
- Mechanische Impeccable-controle uitgevoerd. Meldingen over het bestaande adminlettertype, bestaande CSS en afwijkingen ten opzichte van `DESIGN.md` zijn beoordeeld. `DESIGN.md` geldt expliciet voor `/startpunt`; die typografische vergelijking is geen geldige reden om het bestaande beheerdersontwerp te vervangen. Geen volledige WCAG-certificatie van alle beheerschermen geclaimd.
- Gekoppelde database alleen-lezen: nul ongelezen interne meldingen, open boekingsaanvragen, open klantvragen, open privacyverzoeken, open werkpunten en items in review op het controlemoment. Alle verwachte mailkolommen bestaan. De vier nieuwe mailfilters en het afnamefilter zijn daarnaast via de echte Supabase Data API succesvol gelezen; alle vijf gecontroleerde tellingen waren nul.
- De bestaande productietrigger mist zowel `DISTINCT` als titelbegrenzing. Dit bevestigt dat de nieuwe migratie nog nodig is.

Voor de optionele geïsoleerde tests zijn Playwright/PGlite buiten het project gebruikt; er zijn geen nieuwe projectdependencies toegevoegd. De browsertest kan met `MYGROWISE_AUDIT_ORIGIN` een al draaiende lokale ontwikkelserver gebruiken.

## Grenzen en resterende aandacht

1. **Uitrol:** de applicatiewijzigingen en de migratie zijn lokaal gereed. Productiegedrag is pas gewijzigd na de bestaande Vercel-uitrol en het toepassen van de migratie.
2. **Geen mailbezorggarantie:** configuratie en wachtrijstatus zijn controleerbaar; werkelijke externe SMTP-bezorging en Supabase Auth-mails zijn in deze audit niet door een proefmail getest. Bestaande integratierijen zijn opgeslagen signalen, geen voortdurend actieve infrastructuurmonitor.
3. **Schaalgrens buiten het herstelde berichtenpad:** de klantenaccount-notificatielijst, de lijst met interne threads/deelnemers en de bestaande ongepagineerde praktijkboekingslijst gebruiken nog enkele enkelvoudige databasequeries. Bij overschrijding van de ingestelde PostgREST-resultaatlimiet kunnen die lijsten onvolledig worden. De nieuwe exacte aandachtstellingen en de gepagineerde berichtenhistoriek hebben die beperking niet; de klantnotificatiegeschiedenis en brede werkdaglijst verdienen een aparte pagineringsronde bij groei. Dit is een geverifieerde codebeperking, geen waargenomen verlies van huidige productiegegevens.
4. **Zonder JavaScript:** de nieuwe lichtjes vragen hun status in de browser op. Tijdens laden staat “controleren” in het overzicht; zonder JavaScript zijn de nieuwe dynamische signalen niet beschikbaar. De bestaande servergerenderde pagina’s blijven de bron om werk te behandelen.
5. **Beperkte browserintegratie:** de interfacetests gebruiken synthetische meldingen. Er is geen echte productieconversatie aangemaakt om van afzender tot ontvanger een live melding te doorlopen. De trigger en de applicatieregels zijn afzonderlijk getest.

Er zijn geen GitHub Actions, betaalde schedulers of abonnementsvereisten toegevoegd. De bestaande Vercel Free/Hobby- en dagelijkse herstelopzet blijven de randvoorwaarden.

## Uitrolupdate 18 november 2026

Op uitdrukkelijk verzoek is migratie `20261118090000_staff_notification_integrity.sql` met de bestaande Supabase CLI-configuratie toegepast op de gekoppelde database. De dry-run bevatte uitsluitend deze migratie. Daarna zijn de migratiehistoriek en de werkelijk geïnstalleerde functie alleen-lezen gecontroleerd: ontvangers worden gededupliceerd en titels worden begrensd. Er zijn geen productieberichten aangemaakt of leesstatussen gewijzigd.

Vóór de commit en push zijn opnieuw alle 150 tests, `npm run check` en `npm run check:artifact` geslaagd. De eerdere opmerkingen over een nog niet toegepaste migratie beschrijven de auditfase; de databasecorrectie is inmiddels uitgevoerd. De applicatie-uitrol verloopt via de bestaande Vercel-integratie na de push naar `main`.
