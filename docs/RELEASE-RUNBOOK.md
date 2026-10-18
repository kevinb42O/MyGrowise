# Release en verkoopvrijgave op Vercel Free

**Stand: 18 oktober 2026.** Bronbasis `b2cfabd` plus de wijzigingsset van deze release. Kevin vraagt expliciet naar `main` te pushen zodra het technische werk gecontroleerd is en bevestigt Vercel Free als vaste keuze. Hij verwacht de ontbrekende klantgegevens op 19 oktober. Een push of deployment is niet automatisch toestemming om conceptvoorwaarden als definitief te behandelen.

## Gedrag van deze release

- De publieke site, bestaande aankopen, betaalcontrole en afspraken kunnen worden uitgerold. Nieuwe productorders zijn in productie standaard gepauzeerd. De checkout toont uitleg en contact/aankooptoegang; zowel de nieuwe catalogus-API als de oude Wise-aanmaakroute weigert nieuwe orders.
- `COMMERCE_SALES_ENABLED=true` geeft nieuwe verkoop vrij. Zonder expliciete waarde is productie gesloten; development blijft standaard bruikbaar voor geïsoleerde tests. Een expliciete `false` sluit ook development.
- De acht profielpagina's gebruiken volledige aangeleverde teksten en beheervelden in de bestaande catalogus. Leeftijdsfilters overlappen op basis van minimum/maximum, met 3 profielen voor 8–13, 2 voor 14–17 en 6 voor 18+. De ontwikkelteaser telt niet als negende leverbaar profiel.
- Vaste pakketprijzen blijven behouden. De website maakt duidelijk dat een pakket niet altijd goedkoper is dan losse vragenlijsten. Er wordt geen onbevestigde extra dienstverlening toegevoegd om een prijsverschil te rechtvaardigen.
- Mail probeert direct te verzenden bij relevante handelingen. Eén dagelijkse cron op `0 8 * * *` UTC verwerkt de vier wachtrijen in parallelle kleine batches van twee. Vercel Hobby kan die dagelijkse uitvoering binnen het uur verschuiven. Deze fallback geeft dus geen vijfminutengarantie en is geen onbeperkte batchverwerker.
- `/admin/mail` toont wachtende, lopende en mislukte taken. Alleen bevoegd integratiebeheer mag verwerken/herstarten. Controleer de oorzaak vóór definitief mislukte taken opnieuw worden klaargezet; SMTP kan bij een onderbreking na acceptatie een dubbele mail opleveren.
- Herinneringen en weekoverzichten blijven zichtbaar als niet beschikbaar; hun instellingen activeren geen verzending. Afspraakbevestiging, verplaatsing en annulering hebben wel een mailstroom.
- Testcapture wordt uitsluitend via de developmenttak geladen. Exacte lokale output-, test- en envbestanden worden uitgesloten van het Vercel-artifact. `check:artifact` controleert dit en controleert publieke assets op lokaal geconfigureerde geheimen.

## Database en inhoud

Alle oudere migraties waren op 18 oktober geregistreerd in de gekoppelde database. Nieuw toegepast na rollbackrepetitie:

- `20261018200657_profile_landings_and_release_readiness`: gevalideerde profielinhoud, atomair catalogusbeheer en import van de acht teksten.
- `20261018201657_profile_catalog_labels`: officiële aangeleverde titels en exacte leeftijdslabels; prijzen, productstatus, pakketonderdelen en bestaande aankoopsnapshots blijven behouden.

`node scripts/apply-profile-landings.mjs` repeteert en rolt terug; `--apply` registreert ontbrekende bovengenoemde migraties atomair en controleert behoud van orders/rechten/afnames/boekingen. Gebruik dit bewust tegen de bedoelde omgeving. Herhaal geen historische inhoudsimport over latere redactie. Dagelijkse wijzigingen gaan via beheer.

## Uitgevoerde verificatie

- TypeScript en productiebuild; dependency-audit zonder gemelde kwetsbaarheden; controle van het echte Vercel-artifact.
- 52 unit-/service-/routeregressietests, inclusief nieuwe productievrijgave, profielbrondekking, filters, formulierconversie en mailworker-foutisolatie.
- 306 databasecontroles verdeeld over catalogus (28), vragenlijstinhoud (38), modules (47), afspraken (56), commerce (63), profielen (22), MijnDiAd-sync (25) en on-demand-sync (27). Alle testmutaties zijn teruggedraaid.
- 78 commerce-HTTP-controles en 38 module-HTTP/Storage-controles met synthetische gegevens. MIME is lokaal opgevangen; geen echte klantmail of betaling.
- Aanvullende release-HTTP- en browsercontroles controleren profielroutes, de nieuwe beheerroute, CMS-rendering, robots/sitemap, redirects en de gesloten verkoopstand. Zie de tests voor de precieze scope.

GitHub Actions voert bij volgende pushes `npm ci`, unit tests, build, audit en artifactcontrole uit. De workflow gebruikt geen productiegeheimen. Database- en Storage-proeven blijven bewuste operatorchecks met lokale configuratie.

## Uitrol en vrijgave

1. Controleer de volledige commit en `git diff --check`. Push de geteste wijzigingsset naar `main`; controleer daarna remote SHA en Vercel-status. Gebruik geen force-push.
2. Controleer de productievariabelen: juiste Supabase URL/public key/server key, `PUBLIC_SITE_URL`, `CRON_SECRET`, SMTP en geverifieerde afzender. Behoud `COMMERCE_SALES_ENABLED=false` totdat stap 3–5 zijn afgerond. Er wordt geen betaald plan of externe scheduler aangemaakt.
3. Ontvang officiële naam, ondernemings-/btw-nummer, postadres en bevestiging van de verkoper/verwerkingsverantwoordelijke. Werk privacy en voorwaarden bij, inclusief concrete levering, fiscale aanduiding, annulering/terugbetaling en contact. Maak conceptstatus pas na inhoudelijke bevestiging definitief.
4. Test Auth-mail afzonderlijk, daarna echte SMTP-aflevering en links met een afgesproken ontvanger. Controleer bankbegunstigde/IBAN/QR. Loop met de eigenaar afname/rapport en afspraak/dossier/mail/wijziging door. Test een echte bankbetaling uitsluitend met een expliciet afgesproken bedrag en ontvanger.
5. Controleer rollen, monitoring, back-up/herstel, incidentverantwoordelijkheid en domeinredirects. Bevestig de uiteindelijke publieke oorsprong in `PUBLIC_SITE_URL` en canonicals. Laat de eigenaar de dagelijkse beheertaken uitvoeren.
6. Zet verkoop bewust aan en voer een nacontrole uit. Houd alle zes modules in ontwikkeling tot hun eigen materiaal en praktische informatie compleet zijn.

## SEO en herstel

De publieke Webnode-sitemap is gecontroleerd. Bekende equivalente routes worden in `src/lib/legacyRoutes.ts` met 301 doorgestuurd; zeven oude demoproducten geven 410. De nieuwe XML-sitemap leest actuele publicaties; juridische concepten en private routes ontbreken. Previewdeployments staan op noindex en hun robotsbestand sluit crawling uit.

De oude gratis-oefeningen-, tips-, locatie- en afzonderlijke artikelpagina's zijn niet automatisch naar inhoudelijk andere pagina's doorgestuurd. Hun definitieve migratie vraagt de behouden inhoud/URL-inventaris. Er is geen volledige SEO-migratie of Search Console-controle geclaimd.

Bij problemen: pauzeer nieuwe verkoop met de variabele, pauzeer een onvolledig product of rol applicatiecode terug op het additieve schema. Verwijder geen orders, dossiers of private materialen. Eerder afgegeven tijdelijke bestandslinks kunnen geldig blijven tot verval; gedownloade bestanden kunnen niet op afstand worden ingetrokken.
