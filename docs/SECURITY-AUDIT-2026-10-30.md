# Beveiligingsaudit MyGrowise — 30 oktober 2026

Onderzochte code: commit `5f1abdb`, met een schone werkboom bij aanvang. Deze audit voegt alleen dit rapport toe. Applicatiecode, productiegegevens, rollen, instellingen en deployments zijn niet gewijzigd.

## Beoordeling

De basis bevat goede maatregelen, maar het project is nog niet voldoende afgeschermd voor een omgeving met cliëntgegevens. De belangrijkste concrete bevinding is dat twee beheerfuncties in de gekoppelde Supabase-database ook door `anon` en `authenticated` kunnen worden uitgevoerd en daarbij een door de aanroeper opgegeven beheerdersidentiteit vertrouwen. Daarnaast ontbreken verplichte MFA en een betrouwbare, gedeelde begrenzing van inlogpogingen. De functie voor afmelden van alle apparaten gebruikt de Supabase-API verkeerd.

Er is **geen bewijs van een inbraak gevonden**, maar de beschikbare logging is onvoldoende om een inbraak of aanval uit te sluiten. Een score of garantie van volledige waterdichtheid zou daarom misleidend zijn.

| ID | Prioriteit | Bevinding | Bewijsniveau |
| --- | --- | --- | --- |
| SEC-01 | Hoog — eerst oplossen | Anonieme uitvoering van oude beheerfuncties; identiteit wordt als invoer vertrouwd | Live privileges, live functiedefinities en controle in alleen-lezen transactie |
| SEC-02 | Hoog | Limiet van vijf inlogpogingen is niet betrouwbaar op Vercel; resetlimiet telt alleen fouten | Code |
| SEC-03 | Hoog | Geen verplichte MFA voor medewerkers en beheer | Code en geaggregeerde live accountcontrole |
| SEC-04 | Hoog | Alle apparaten afmelden gebruikt een gebruikers-ID waar een JWT nodig is; geen eigen onmiddellijke intrekking | Code en geïnstalleerde SDK |
| SEC-05 | Middel | Mislukte logins en blokkeringen zijn niet duurzaam zichtbaar | Code en live logtotalen |
| SEC-06 | Middel | Browserheaders tegen framing en aanvullende injectierisico’s ontbreken | Live HTTP en code |
| SEC-07 | Middel | Publieke endpoints kunnen onnodig database- en servercapaciteit verbruiken | Code; geen belastingtest |

De prioriteiten wegen toegang tot cliëntgegevens, accountovername, misbruik en herstelbaarheid. Niet elk risico is een bewezen volledige exploit.

## Onderzoek en grenzen

Uitgevoerd:

- Codecontrole van middleware, rollen, authenticatie, accountbeheer, gasttoegang, aankopen, boekingen, rapporttoegang, uploads, logging en configuratie.
- Live databasecontrole binnen `BEGIN READ ONLY`, met korte querytimeouts en afsluitende rollback. Geselecteerde controles zijn ook uitgevoerd met `SET LOCAL ROLE anon` en lege JWT-claims.
- Alleen geaggregeerde account- en loggegevens gerapporteerd. Geen wachtwoorden, sleutels, cliëntinhoud, tokens of individuele account-ID’s opgenomen.
- Enkele publieke HTTP-verzoeken naar beide bekende websites, zonder aanmelding of schrijfacties.
- Lokale tests, typecheck, build, dependency-audit, controle van het releaseartifact en vergelijking van vijf actuele geheime configuratiewaarden met de gevolgde bestanden.

Niet uitgevoerd: brute force, wachtwoordtests op echte accounts, belastingtests, wijzigingen aan echte records, volledig geauthenticeerde browsertests voor elke rol, een historische secretscan van alle Git-objecten, volledige infrastructuurpentest of controle van provideraccounts. Vercel-verkeerslogs en de afzonderlijke Supabase Auth-logdienst waren niet beschikbaar via de gebruikte toegang. Back-ups, herstelbaarheid, beheeraccount-MFA en live Auth-rate-limitinstellingen zijn niet volledig vastgesteld.

### Twee verschillende websites

Op het controlemoment:

- `https://mygrowise.be/` retourneert een redirect naar `/nl/` met server `webnode`. De onderzochte account- en API-paden geven daar 404.
- `https://mygrowise.vercel.app/` serveert de nieuwe applicatie. De loginpagina’s geven 200; `/api/admin/users`, `/api/praktijk/agenda` en de cron zonder geheim geven 401.

De HTTP-bevindingen over de nieuwe applicatie betreffen dus het Vercel-domein. De databasebevindingen betreffen de database gekoppeld via de lokale projectconfiguratie. De publieke Auth-instellingen daarvan bevestigen dat e-mailaanmelding aanstaat en e-mailbevestiging vereist is. De lokale `supabase/config.toml` is geen bewijs van alle live Auth-instellingen.

## SEC-01 — Oude databasefuncties zijn onvoldoende afgeschermd

**Bewijs.** `has_function_privilege` bevestigt dat zowel `anon` als `authenticated` uitvoerrechten hebben op:

1. `public.update_admin_recurring_cost(uuid,uuid,text,integer,smallint,date,uuid,text)`;
2. `public.mark_admin_recurring_cost_paid(uuid,uuid,uuid,text,text)`;
3. `public.create_wise_checkout_order(uuid,text)`.

Deze functies zijn `SECURITY DEFINER`. Bij de twee kostenfuncties controleert de functie of **de meegestuurde** `p_actor_user_id` de rol `super_admin` heeft. Er is geen binding aan de daadwerkelijke aanroeper. Zie `supabase/migrations/20260924201000_admin_recurring_costs.sql:68` en `:125`.

De migraties trekken rechten in van `PUBLIC`, maar niet van de afzonderlijke rollen `anon` en `authenticated`. Live `pg_default_acl` toont dat die rollen directe standaardrechten krijgen op nieuwe functies. Die rechten blijven bestaan na alleen `REVOKE ... FROM public`. RLS op de onderliggende tabellen voorkomt dit niet, doordat de functies met de rechten van hun eigenaar werken. Dit onderscheid staat ook in de [Supabase-documentatie over functieprivileges](https://supabase.com/docs/guides/database/functions).

**Veilige bevestiging.** Binnen een alleen-lezen transactie, als `anon` zonder JWT:

- Een niet-bestaande actor resulteerde in `42501: Not allowed`.
- Een bestaande superadmin als invoer passeerde die controle. Beide kostenfuncties liepen vervolgens tegen `25006: cannot execute SELECT FOR UPDATE in a read-only transaction` aan.
- Er zijn geen kosten bijgewerkt of betalingen geregistreerd. De transactie stond geen schrijfacties toe.

Een superadmin-ID is te koppelen via bestaande publieke gegevens: actieve `practitioners.user_id` en/of gepubliceerde `products.updated_by`. De koppeling is alleen als boolean gecontroleerd en wordt niet in dit rapport gepubliceerd.

**Impact en grens.** Dit is een bevestigde autorisatiefout. Voor een gerichte wijziging aan een bestaand kostenrecord is daarnaast diens UUID nodig; een publiek uitlekpad voor die kosten-ID is niet aangetoond. Bij kennis daarvan kan de functie een wijziging onder een vervalste actor registreren. Dit betreft administratieve kostenregistratie, geen aangetoonde mogelijkheid om bankoverschrijvingen uit te voeren of cliëntdossiers te lezen. De oude Wise-functie vertrouwt eveneens een meegestuurde klant-ID. Momenteel zijn er nul gepubliceerde producten met alle vereiste oude Wise-velden, waardoor die route op dit moment geen kwalificerend product heeft.

**Herstel.** Trek de rechten van alle drie de rollen expliciet in. Onderstaand voorstel is **niet uitgevoerd**:

```sql
begin;
revoke all on function public.update_admin_recurring_cost(uuid,uuid,text,integer,smallint,date,uuid,text)
  from public, anon, authenticated;
revoke all on function public.mark_admin_recurring_cost_paid(uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.create_wise_checkout_order(uuid,text)
  from public, anon, authenticated;
grant execute on function public.update_admin_recurring_cost(uuid,uuid,text,integer,smallint,date,uuid,text),
  public.mark_admin_recurring_cost_paid(uuid,uuid,uuid,text,text),
  public.create_wise_checkout_order(uuid,text) to service_role;
commit;
```

Verwijder daarna ongebruikte legacyfuncties als hun afhankelijkheden dat toelaten. Voeg aan functies die uitsluitend voor servergebruik bedoeld zijn ook een betrouwbare controle op de aanroepende databaserol toe; de inhoud van actorparameters is geen authenticatie.

Verander de standaardprivileges voor de rol die migraties uitvoert. Voor `postgres` moet de intrekking van het globale `PUBLIC`-uitvoerrecht zonder `IN SCHEMA` gebeuren; de directe schema-grants aan `anon` en `authenticated` moeten afzonderlijk worden ingetrokken. Controleer ook platforminstellingen voor automatische blootstelling van nieuwe objecten. Behoud de expliciet benodigde rechten voor RLS-hulpfuncties en servergebruik. Voer geen blinde intrekking van alle bestaande functierechten uit zonder die afhankelijkheden te testen. Zie [Supabase: API beveiligen](https://supabase.com/docs/guides/api/securing-your-api).

**Acceptatie.** De drie functies zijn voor `anon` en `authenticated` niet uitvoerbaar. Nieuwe serverfuncties zijn standaard niet publiek uitvoerbaar. Een geautomatiseerde lokale privilegescan controleert dit na elke migratie, met een kleine expliciete lijst van publieke hulpfuncties. Het serverpad voor kostenbeheer blijft werken.

## SEC-02 — Pogingenbegrenzing is onbetrouwbaar

**Bewijs.** `src/pages/api/admin/login.ts:7` en `src/pages/api/account/login.ts:4` bewaren tellers in een modulebrede `Map`. De sleutel combineert IP en e-mail. Na vijf geregistreerde mislukte pogingen blokkeert hetzelfde proces dezelfde combinatie gedurende het venster van vijftien minuten.

Op Vercel is dat geen gedeelde, duurzame teller. Een andere instantie of nieuw proces heeft een andere teller. Parallelle verzoeken kunnen bovendien de controle passeren voordat eerdere verzoeken hun mislukking registreren. Een aanvaller die veel accounts probeert, krijgt voor elke combinatie een nieuwe teller. Er is geen afzonderlijk accountbreed of IP-breed budget in deze handlers.

`src/pages/api/account/password-reset.ts:13` wist de teller na een geslaagde resetaanvraag. De bedoelde vijfpogingenlimiet beperkt dus vooral fouten, niet het aantal succesvol geaccepteerde mailaanvragen. Registratie en bevestigingsmail opnieuw verzenden hebben geen eigen duurzame applicatielimiet.

Supabase heeft aanvullende providerlimieten; het werkelijke aantal mogelijke pogingen is daarom niet onbeperkt, maar evenmin betrouwbaar “vijf per vijftien minuten”. De live providerlimieten zijn niet vastgesteld. De server gebruikt een publieke Auth-client zonder doorgifte van het eindgebruikers-IP. Providerlimieten kunnen daardoor ook verschillende bezoekers achter serveradressen samenvoegen. Zie [Supabase Auth-rate-limits en IP-forwarding](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/rate-limits.mdx).

**Herstel.** Gebruik een atomaire databasefunctie voor een gedeelde begrenzing; het bestaande patroon `support_rate_limit` is een bruikbaar vertrekpunt. Tel vóór de kostbare Auth-aanroep, beperk zowel IP als gehashte accountidentiteit en voorkom langdurige accountblokkering waarmee derden een account kunnen gijzelen. Neem login, registratie, reset, resend en verificatie van het huidige wachtwoord mee. Voeg bij verdachte activiteit een botcontrole toe. Configureer bescherming ook op Supabase Auth zelf, omdat dat rechtstreeks bereikbaar is met de publieke sleutel. Gebruik alleen een door het hostingplatform betrouwbaar vastgesteld client-IP.

**Acceptatie.** Twee onafhankelijke serverprocessen delen dezelfde teller; parallelle verzoeken overschrijden het budget niet. Geslaagde resetmailaanvragen verbruiken eveneens budget. Uitval van de begrenzer omzeilt de beveiliging niet. Antwoorden blijven neutraal over het bestaan van accounts.

## SEC-03 — MFA ontbreekt op bevoorrechte accounts

**Bewijs.** Er zijn zeven Auth-gebruikers, waaronder drie unieke gebruikers met een rol voor medewerkers, therapeuten, support of superadmin. Geen van de zeven heeft een geverifieerde MFA-factor. De applicatie controleert geen `aal2` bij toegang tot beheer of praktijk. De lokale TOTP-configuratie staat uit; die lokale waarde is geen bewijs van de live instelling.

**Impact.** Een gestolen of hergebruikt wachtwoord biedt geen verplichte tweede hindernis voordat een aanvaller de bijbehorende bevoegdheden kan gebruiken.

**Herstel.** Verplicht TOTP voor alle accounts met toegang tot beheer, praktijk en dossiers. Controleer de geverifieerde assurance level server-side en, waar rechtstreeks databanktoegang blijft bestaan, ook in de relevante policies. Alleen een QR-code aanbieden is onvoldoende. Richt een gecontroleerd herstelproces en noodtoegang in. TOTP is volgens de [Supabase TOTP-documentatie](https://supabase.com/docs/guides/auth/auth-mfa/totp) gratis beschikbaar; hiervoor is geen betaald Vercel-abonnement nodig. Controleer daarnaast MFA op de afzonderlijke Vercel-, Supabase-, GitHub-, domein- en e-mailbeheeraccounts.

**Acceptatie.** Een correct wachtwoord zonder tweede factor opent geen bevoorrechte pagina, API of gegevensroute. Ook rechtstreekse API-aanroepen en herstelroutes omzeilen MFA niet.

## SEC-04 — Sessies intrekken werkt niet zoals de interface belooft

**Bewijs.** `src/lib/supabase/accounts.ts:174` roept `auth.admin.signOut(userId, 'global')` aan. De geïnstalleerde SDK verwacht als eerste parameter een geldig gebruikers-JWT, niet een UUID; zie `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts:142`. De verkeerde waarde is een codefout, zonder echte gebruikers af te melden bevestigd.

Het praktijkpad voor wachtwoordwijziging slaat eerst het nieuwe wachtwoord op en roept vervolgens deze helper aan. De operatie kan daardoor gedeeltelijk slagen terwijl de foutafhandeling meldt dat het wachtwoord niet voldoet. De normale logout-routes verwijderen alleen de browsercookie. Dat maakt een eerder gekopieerd token niet ongeldig.

De middleware controleert de tokenvervaldatum en vraagt de gebruiker op, maar controleert niet zelf een ingetrokken sessie-ID of een gebruikersbrede intrekkingstijd. Supabase beschrijft expliciet dat voor onmiddellijke afwijzing na logout aanvullende controle nodig kan zijn; zie [sessies en intrekking](https://supabase.com/docs/guides/auth/sessions).

**Herstel.** Geef de juiste JWT aan de afmeld-API door. Ontwerp en test onmiddellijke intrekking voor gevoelige routes, bijvoorbeeld met een server-side sessieregistratie of een gebruikersbrede intrekkingstijd die met de geverifieerde tokenclaims wordt vergeleken. Laat alleen na bevestigde intrekking een succesmelding zien. Behandel gedeeltelijk geslaagde wachtwoordwijzigingen correct. Controleer ook reeds uitgegeven gast- en aankooptoegang bij een accountincident.

**Acceptatie.** Met twee browsers en een vooraf gekopieerd token: na “alle apparaten afmelden” kan geen van beide oude sessies nog gevoelige routes gebruiken. Hetzelfde geldt na wachtwoordherstel en een beveiligingsblokkering. Een fout bij intrekking wordt niet als een zwak wachtwoord getoond.

## SEC-05 — Aanvalspogingen zijn onvoldoende zichtbaar

**Vastgestelde aantallen op het controlemoment:**

| Meting | Resultaat | Betekenis |
| --- | --- | --- |
| Alle applicatie-auditevents | 158 | Sinds 24 augustus 2026 |
| `account.login` | 68 | Geslaagde authenticaties die de app heeft geregistreerd |
| `account.login`, afgelopen 30 dagen | 18 | Geen telling van unieke personen of apparaten |
| Events met failure/denied/rate-limit in de actienaam | 0 | De app schrijft die gebeurtenissen niet structureel weg |
| Rijen in `auth.audit_log_entries` | 0 | Dit bewijst niet dat de afzonderlijke Auth-logdienst leeg is |

`authenticateSupabaseUser` keert bij ongeldige credentials terug vóór het loggen. Alleen een geslaagde authenticatie krijgt `account.login`; dat event kan ook bestaan als een daaropvolgende rolcontrole toegang tot de gekozen omgeving weigert. Het accountloginpad geeft bovendien geen request-ID door. Ondersteuningstellers zijn tijdelijke buckets en geen historisch overzicht van aanvallen.

**Conclusie over het aantal hackpogingen: onbekend.** Nul geregistreerde fouten mag niet worden gelezen als nul aanvallen. Er is op basis van deze gegevens ook geen uitspraak mogelijk over scans op het Webnode-domein.

**Herstel.** Registreer minimaal `auth.login_failed`, `auth.login_succeeded`, `auth.rate_limited`, `auth.mfa_failed`, `auth.password_reset_requested`, `auth.session_revoked` en `access.denied`, met tijd, request-ID, omgeving, resultaat en beperkt bewaarde/gehashte herkomst. Gebruik een sleutelgebonden hash voor identiteiten die niet als platte tekst nodig zijn. Log geen wachtwoorden, bearer-tokens, herstel-URL’s of dossierinhoud. Bewaak ook logvolume en fouten bij het wegschrijven; een ongecontroleerde logstroom mag zelf geen capaciteitsaanval worden.

Maak een beheeroverzicht voor de laatste 24 uur en 7/30 dagen. Laat betekenisvolle drempeloverschrijdingen en verdachte accountwijzigingen opvallen. Toon bij het tellen de omgeving en beschikbare bewaartermijn. Stem bewaring en inzage af op het privacybeleid.

**Acceptatie.** Gecontroleerde mislukte aanmeldingen, een blokkering en een geweigerde bevoegdheid verschijnen met herleidbare request-ID in het overzicht, zonder gevoelige payloads.

## SEC-06 — Browserheaders aanvullen

**Bewijs.** De onderzochte Vercel-responses bevatten HSTS. Op de homepage en loginpagina’s ontbreken `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` en `Permissions-Policy`. De accountlogin heeft `Referrer-Policy: no-referrer` en `Cache-Control: private, no-store`; de adminlogin en vroege API-weigeringen hebben geen even strikte centrale headerlaag.

**Impact.** Er is geen algemene anti-framingmaatregel aangetroffen, en aanvullende browserbescherming tegen injectie en MIME-verwarring ontbreekt. Dit is geen bewezen XSS of cachelek. Bestaande sessiecookies hebben wel `HttpOnly`, productie-`Secure` en `SameSite=Strict`, wat een aantal scenario’s beperkt.

**Herstel.** Voeg centraal `X-Content-Type-Options: nosniff`, anti-framing via `frame-ancestors 'none'` en passende `X-Frame-Options`, een beperkte Permissions Policy en consistente referrerregels toe. Ontwerp een CSP passend bij Astro-scripts, React, Supabase, afbeeldingen en media; begin desgewenst met report-only en handhaaf na controle. Vermijd een beleid dat alleen werkt door overal `unsafe-inline` of `unsafe-eval` toe te staan. Zet gevoelige pagina’s en API-antwoorden inclusief vroege fouten op `private, no-store`.

**Acceptatie.** Controleer headers op succesvolle responses, redirects, 401/403 en fouten. Beheer- en praktijkpagina’s kunnen niet in een externe iframe worden geladen. Audio, uploads, herstel en bestaande interacties blijven functioneren onder de uiteindelijke CSP.

## SEC-07 — Misbruik van capaciteit verder begrenzen

**Bewijs.** `/api/analytics` gebruikt een procesgebonden `Map` op een door de bezoeker beïnvloedbare cookie-ID en schrijft met serverrechten naar de database. Een nieuwe cookie-ID geeft een nieuw budget. `/api/health` voert bij elk verzoek een exacte producttelling uit. Publieke beschikbaarheidsroutes kunnen meerdere database- en agendaoperaties uitvoeren zonder centrale begrenzing. Er zijn geen belastingtests uitgevoerd.

Sommige handlers controleren alleen `Content-Length` voordat ze de hele body inlezen; dat is geen volledige begrenzing wanneer die header ontbreekt. Hostinglimieten bieden een bovengrens, maar vervangen geen kleine applicatielimieten waar die nuttig zijn.

**Herstel.** Gebruik gedeelde limieten voor kostbare publieke routes, valideer en begrens bodies vóór uitgebreid verwerken, ruim tellers op en voorkom onbegrensde geheugenmappen. Gebruik voor health waar mogelijk een goedkopere query en zeer korte cache. Cache niet-persoonlijke beschikbaarheidsinformatie alleen waar dat geen verouderde boekingsbeslissingen oplevert; behoud controle op het moment van boeken. Scheid toegestane browser-events strikt van betalings- en leverevents. Bepaal een klein database- en mailbudget voor misbruikscenario’s.

**Acceptatie.** Test met kleine, gecontroleerde budgetten lokaal of in een testomgeving. Roteren van een analytische cookie omzeilt het totale budget niet. Overmatige input wordt vroeg afgewezen en maakt de database niet onnodig druk.

## Wat al goed staat

- Alle 61 tabellen in `public` hebben live RLS ingeschakeld. Dat is waardevol, maar het beveiligt niet automatisch alle functies met eigenaarsrechten.
- Cliënttabellen, dossiernotities en aankoop-/gasttokens hebben geen directe lees- of schrijfrechten voor `anon` en `authenticated` waar de server de toegang hoort te verzorgen. De vijf onderzochte interne views zijn voor die rollen niet direct leesbaar.
- De drie storagebuckets zijn privé, met beperkingen op omvang en MIME-types. Rapporten krijgen kort geldige downloadlinks. Uploads worden op type/signatuur gecontroleerd.
- Gast- en aankooptokens gebruiken cryptografische willekeur en hashes. Toegang tot aankopen en rapporten wordt op eigenaar gecontroleerd in de onderzochte helpers.
- Beheerroutes hebben een rollenmatrix en onbekende beheerpaden worden standaard geweigerd. Dossierhelpers beperken medewerkers tot toegewezen cliënten.
- E-mailbevestiging is volgens de live publieke Auth-instellingen verplicht. Registratie vraagt minimaal twaalf tekens; volledige live wachtwoordbeleidsinstellingen zijn niet vastgesteld.
- De cron vereist een geconfigureerd bearer-geheim en weigert zonder dat geheim. De niet-actieve betaalwebhook bevestigt geen betalingen.
- De bestaande contact-, aankoop- en gasttoegangsroutes gebruiken op meerdere plaatsen al gedeelde databaselimieten. Dat patroon kan worden uitgebreid naar authenticatie.
- De lokale `.env` en `.env.local` zijn niet gevolgd in Git. De vijf gecontroleerde actuele geheimen zijn niet gevonden in 651 gevolgde bestanden of in de gecontroleerde publieke buildbestanden. Dit is geen volledige historische secretscan.

## Huidige poginglimieten

Deze tabel beschrijft de implementatie, niet het aantal aanvallen dat werkelijk heeft plaatsgevonden. Providerlimieten kunnen aanvullende beperkingen opleggen.

| Route / handeling | Limiet in de applicatie | Beperking |
| --- | --- | --- |
| Admin-/praktijklogin | 5 geregistreerde fouten per 15 minuten, per IP + e-mail | Alleen per serverproces; parallelle verzoeken kunnen erdoorheen |
| Klantlogin | 5 geregistreerde fouten per 15 minuten, per IP + e-mail | Alleen per serverproces |
| Wachtwoord vergeten | 5 fouten per 15 minuten, per IP | Een geaccepteerde aanvraag wist de teller |
| Registratie / bevestigingsmail opnieuw | Geen eigen duurzame app-limiet | Afhankelijk van providerbeveiliging |
| Contactformulier | 8 per uur per IP; 4 per uur per e-mail | Gedeelde DB-teller |
| Catalogusbestelling | 15 per uur per IP; 8 per uur per e-mail | Gedeelde DB-teller; verkoopvrijgave wordt apart gecontroleerd |
| Aankooplink aanvragen | 10 per uur per IP; 4 per uur per e-mail | Gedeelde DB-teller |
| Gastondersteuning antwoorden | 12 per uur per gesprek | Gedeelde DB-teller |
| Analytics | 60 per cookie-ID in het procesgeheugen | Nieuwe cookie-ID of instantie heeft een ander budget |

## Herstelvolgorde en operationele borging

1. **Eerst:** sluit de drie oude RPC’s af en controleer standaardprivileges. Beperk publieke kolommen van `practitioners` en `products` tot werkelijk openbare informatie; interne account-ID’s en toekomstige online-sessiegegevens horen niet automatisch mee te komen in een volledige tabelselectie.
2. **Daarna:** voer gedeelde poginglimieten in voor alle Auth-ingangen, herstel de resetlimiet en controleer de directe Supabase-route. Herstel sessie-intrekking en test gekopieerde tokens.
3. **Vervolgens:** verplicht MFA voor de drie bevoorrechte gebruikers en alle nieuwe medewerkers. Borg herstel en noodtoegang zonder een algemene MFA-bypass.
4. **Daarop aansluitend:** bouw veiligheidslogging en een overzicht van pogingen, voeg headers toe en begrens kostbare publieke routes.
5. **Voor ingebruikname met echte cliëntgegevens:** lever bewijs van een herstelproef van database én storage, bewaartermijnen, geheimrotatie, de definitieve domeinconfiguratie en een incidentprocedure met eigenaar. De bestaande runbooks noemen deze punten, maar de audit heeft hun uitvoering niet bevestigd.

Test de belangrijkste grenzen met verschillende rollen en verschillende eigenaars: klant A tegenover klant B, therapeut A tegenover therapeut B, support tegenover dossiergegevens, gast tegenover account, betaald tegenover onbetaald, ingetrokken tegenover actieve sessie en `aal1` tegenover `aal2`. Beperk regressietests niet tot HTTP-statuscodes; controleer ook dat geen gegevens gelezen, aangepast of verstuurd worden.

Deze aanpak kan werken met lokale controles, de bestaande Vercel-integratie en Vercel Free/Hobby. Er zijn geen GitHub Actions, extra cronjobs, betaalde schedulers of abonnementen toegevoegd of vereist door dit rapport. Onderzoek de concrete back-upmogelijkheden binnen de huidige diensten voordat een herstelprocedure wordt gekozen.

## Uitgevoerde lokale controles

| Controle | Resultaat |
| --- | --- |
| `npm test` | 102 geslaagd, 0 mislukt |
| `npm run check` | Typecheck en productiebuild geslaagd |
| `npm audit --json` | 0 gemelde kwetsbaarheden, inclusief dev-dependencies |
| `npm run check:artifact` | Geslaagd; 1691 buildbestanden gecontroleerd |
| Exacte vergelijking actuele geheimen met gevolgde bestanden | 0 overeenkomsten voor de vijf gecontroleerde geheimen |
| Migratieregistratie gekoppelde DB | 61 migraties; laatste `20261030033534` |

Deze positieve controles veranderen de zeven bovenstaande bevindingen niet: de bestaande tests verifiëren de hier gevonden beveiligingsgrenzen nog niet volledig. Een schone dependency-audit zegt niets over autorisatiefouten in eigen code of databasefuncties.
