# Supabase: ontwikkeling en beheer

**Controle: 18 oktober 2026**, basis `b2cfabd` plus de releasewijzigingen. Alle lokale migraties, inclusief praktijk, websiteherstel, MijnDiAd en de twee nieuwe profielmigraties, zijn in de gekoppelde database geregistreerd. Dit bewijst geen volledige productieconfiguratie van Auth, mail of back-ups. Zie [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md).

## Systeemgrenzen

Supabase bevat Auth-identiteiten, profielen, professionals, beschikbaarheid, boekingen, producten, orders, rechten, support, cliëntdossiers en auditgegevens. Astro-serverroutes gebruiken voor vertrouwde acties `src/lib/supabase/server.ts` en de geheime sleutel. Browsercode mag die sleutel nooit ontvangen. Publieke sleutels en URL staan in `.env.example`; `SUPABASE_DB_URL` en `SUPABASE_ACCESS_TOKEN` zijn uitsluitend voor lokale CLI-taken. De laatste is nodig voor typegeneratie, niet voor de runtime.

`PUBLIC_SITE_URL`, Auth-redirects, support-SMTP en de getoonde Wise-rekeninggegevens verdienen een expliciete controle per doelomgeving. De Wise-code heeft publieke fallback-rekeninggegevens in `src/lib/wiseCheckout.ts`; ontbrekende `WISE_*`-variabelen schakelen betaalinstructies dus niet automatisch uit. Bevestig de begunstigde en IBAN vóór een bestelproef. Supabase Auth-mail en de eigen supportmail via Webnode SMTP zijn afzonderlijke configuraties.

## Lokale setup en migraties

Maak een lokale `.env` vanuit `.env.example` en beperk de bestandstoegang. `npm run supabase:push:dry-run` toont de migraties voor de database uit `SUPABASE_DB_URL`; controleer de doel-URL vóór `npm run supabase:push`. Maak voor elke schemawijziging een nieuwe migratie en werk daarna `src/lib/supabase/database.types.ts` bij met `npm run supabase:types`. `npm run check` voert TypeScript-controle en een Astro-productiebuild uit. Een build controleert geen live database.

De scripts `supabase:migrate-catalog`, `supabase:migrate-practice` en `supabase:migrate-identities` migreren oude lokale data. Hun aanwezigheid bewijst niet dat migratie is uitgevoerd. Het identiteiten-script leest een lokale SQLite-database, maakt zo nodig Supabase Auth-gebruikers met een willekeurig onbekend wachtwoord en verstuurt zelf geen mail. Voer zo'n migratie alleen uit op basis van een gecontroleerde bron, mapping en herstelplan; geïmporteerde personen hebben daarna de wachtwoordherstelstroom nodig.

## Beveiliging en rollen

De migraties schakelen RLS in op de applicatietabellen en geven specifieke leesrechten/policies. De basispolicy laat een ingelogde gebruiker het eigen profiel wijzigen; de oude claim dat browserclients nergens rechtstreeks mogen schrijven was dus te absoluut. De huidige boekingsaanvraag loopt via een serverroute en `book_customer_appointment`, waarvan de actuele migratie uitvoering voor `service_role` toestaat. Publieke leesrechten op gepubliceerde producten en actieve professionals zijn bedoeld; support, orders, dossierinhoud en audit vragen afzonderlijke rol- of eigendomschecks.

`src/middleware.ts` en `src/lib/adminPermissions.ts` vormen de applicatielaag bovenop Auth. Onbekende adminroutes worden geweigerd; dossierfuncties toetsen ook de cliënttoewijzing in `src/lib/clientRecords.ts`. Omdat serverroutes de service client gebruiken en daarmee RLS omzeilen, moet elke nieuwe route zijn actor, recht, objecttoegang en audit expliciet controleren. Auditmetadata mogen geen geheimen, berichtinhoud of klinische notities bevatten.

## Cron en retentie uit de migraties

- `20260925060000_analytics_country_retention.sql` plant verwijdering van analytics-events ouder dan 13 maanden via `pg_cron`.
- `20260925122000_support_data_retention.sql` plant dagelijkse opschoning van gasttokens, sessies, rate limits en supportgesprekken ouder dan twaalf maanden sinds `last_message_at`. Die tijdstempel wordt bijgewerkt door zichtbare berichten, niet door interne notities.
- `vercel.json` plant één dagelijkse geconsolideerde mailworker op `0 8 * * *` UTC, beveiligd met `CRON_SECRET`. Directe verzending en handmatig herstel blijven de primaire paden. Er is geen vijfminutencron op Vercel Free. MijnDiAd ververst bij gebruik; de oude achtergrondjob is gedeactiveerd.

Controleer in de doelomgeving of migraties en jobs daadwerkelijk bestaan en slagen. Verifieer de privacytekst tegen het werkelijke retentiegedrag en leg een uitzonderingsproces voor lopende AVG-verzoeken vast.

## Productiecontrole vóór gebruik met echte gegevens

1. Bevestig Supabase-project, toegepaste migraties en gegenereerde types. Test een registratie, bevestigingsmail, login en wachtwoordherstel met de echte domein- en redirectinstellingen.
2. Controleer dat de service key alleen server-side beschikbaar is. Test anonieme toegang, klantgrenzen, supportrollen, praktijkrollen en dossier-toewijzingen met afzonderlijke accounts.
3. Proef de aankoop, handmatige Wise-controle, entitlement en werkelijke levering. Vergelijk de getoonde rekeninggegevens met de bedoelde begunstigde.
4. Test een echte supportmail, reply, mislukking en retry; controleer `CRON_SECRET`, Vercel-cron en de Webnode-mailbox. Test Auth-mail afzonderlijk.
5. Controleer `pg_cron`-jobs, logs, monitoring, back-upinstellingen en een daadwerkelijke herstelproef. `/api/health` controleert slechts een Supabase-productquery en is geen volledige systeemcheck.

Interne teamcommunicatie gebruikt thread-deelnemers en meldingen; berichtinhoud hoort buiten commerciële analytics en audit. Boekingsbevestiging, verplaatsing en annulering hebben een geteste mailstroom. Herinneringen en weekoverzichten zijn nog niet actief. Productieaflevering en Auth-mail vragen elk een eigen proef.
