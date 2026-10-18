# MijnDiAd in Virginies eigen agenda

**Actuele status, 18 oktober 2026:** de koppeling werkt op gebruik, met **Supabase Free als vaste randvoorwaarde**. De oude `pg_cron`-job `mygrowise-mijndiad-sync` is gedeactiveerd. Er is geen nieuwe achtergrondtaak, Edge Function of keepalive toegevoegd. Zonder gebruik van agenda of beschikbaarheid wordt MijnDiAd niet opgehaald. De privélink blijft versleuteld in Supabase Vault en is nooit beschikbaar in browsercode of publieke RPC-uitvoer.

## Verversen bij gebruik

- De eigen agenda en publieke beschikbaarheid delen een cache van maximaal **300 seconden**. Openen, terugkeer naar een zichtbaar tabblad en elke vijf minuten zolang de agenda zichtbaar is controleren de actualiteit. Meerdere bezoekers en serverinstanties delen dezelfde databaseconfiguratie en importlock.
- Vóór een nieuwe, bevestigde of verplaatste toekomstige boeking geldt maximaal **60 seconden** oude broncontrole. Een databasetrigger beschermt alle schrijfpaden, inclusief oudere RPC's en directe serverwrites. Annuleren en afwerken blijven bij een storing mogelijk; historische administratieve wijzigingen vragen geen bronfetch.
- De webservices voeren de controle vóór de boeking in een aparte RPC uit. Daardoor blijven foutstatus en retry-backoff bewaard als de daaropvolgende boeking wordt geweigerd. De database vormt een extra controle voor bestaande gedeployde boekingspaden.
- `get_offer_slots` en `get_bookable_slots` controleren ook zelf hun broncache vóór de bestaande, ongewijzigde slotberekening. Hun publieke RPC-signaturen blijven behouden. Browserrollen kunnen deze RPC's niet rechtstreeks aanroepen; publieke boekingspagina's gebruiken de bestaande serverroutes.
- Bij bronfouten worden geen nieuwe beschikbare tijden of boekingen op onzekere informatie aangeboden. De eigen agenda blijft de opgeslagen afspraken tonen, zonder groene boekbare achtergrond. Een waarschuwing toont de fout of onbekende status.
- De gedeelde minimale broninterval is één minuut. Bij herhaalde fouten groeit de wachttijd van één naar twee, vier, acht en maximaal vijftien minuten. Ook handmatig verversen respecteert dit. Een concurrerende import blokkeert boekingen zo nodig tijdelijk in plaats van een dubbele bronfetch of lock-deadlock te veroorzaken.
- Alleen de laatste status en de bestaande afspraakrecords worden bijgewerkt. Er wordt geen groeiende logtabel per bezoeker of controle toegevoegd. De gedeactiveerde cronjob maakt geen nieuwe uitvoeringslogs.

## Nauwkeurigheid en grenzen

- De serverparser is voor alle 262 bronafspraken veld voor veld gelijk aan de gecontroleerde Node-importer, inclusief UID, tijdzone, titel, locatie, status, kleur en bronlink.
- Nieuwe afspraken, wijzigingen op dezelfde UID en expliciete annuleringen worden bij de volgende geslaagde controle verwerkt. De hele snapshot wordt eerst gevalideerd en vervolgens atomair opgeslagen. Bestaande MyGrowise-boekingen en lokale momenten worden niet gewijzigd.
- Verdwenen **toekomstige** afspraken worden pas na twee opeenvolgende geldige snapshots gedeactiveerd, en alleen binnen de geobserveerde dekking. Een verdacht grote krimp wordt afgewezen. Buiten de nieuwe dekkingsgrens blijven ontbrekende momenten behouden met een controlesignaal. Zonder gebruik komt er geen tweede controle; zo wordt bezetting niet onterecht vrijgegeven.
- Bij netwerkproblemen, een ongeldige/lege feed, niet-ondersteunde herhalingen of ambigue/ongeldige lokale tijden blijft de vorige versie intact. Foutstatus en laatste geslaagde controle worden apart bijgehouden.
- Dit is een alleen-lezen iCal-koppeling. MijnDiAd moet wijzigingen eerst publiceren; realtime actualiteit of uitsluiting van iedere gelijktijdige boeking tussen twee onafhankelijke systemen is niet te garanderen. Cliëntnamen ontbreken in de feed en worden niet afgeleid.
- Supabase Free kan bij weinig activiteit over zeven dagen pauzeren. Deze implementatie probeert dat niet met kunstmatige activiteit te omzeilen. Er is geen betaald abonnement ingesteld. Vercel-abonnement en de afzonderlijke boekingsmailcron zijn niet gewijzigd in deze opdracht.
- De werkbalk toont de laatste geslaagde controletijd; fouten, ouderdom boven 15 minuten en onzekere ontbrekende momenten geven een waarschuwing. De compacte werkbalk heeft details onder de statusknop, **Weergave** en **+ Nieuw**.

Provisioneren of herstellen, met de bestaande genegeerde `.env`:

```sh
node scripts/setup-mijndiad-sync.mjs
node scripts/setup-mijndiad-sync.mjs --apply
node tests/mijndiad-sync-database.mjs
node tests/mijndiad-on-demand-database.mjs
```

Het setupscript beproeft standaard en rolt terug. Met `--apply` registreert het de basis- en on-demand-migraties, vult Vault/configuratie, controleert de echte database-HTTP-fetch of recent geslaagde cache, en houdt de oude job gedeactiveerd. Herhalen schakelt de cronjob dus niet opnieuw in. Alle status- en verversings-RPC's zijn uitsluitend voor `service_role`; de agendaroute controleert Virginies eigen praktijkidentiteit en bij handmatig verversen een vertrouwde origin.

**Toegepast in de remote database:** migratie `20261018194645_mijndiad_on_demand_sync.sql`, broncontrole geslaagd met 262 momenten, geen fout of onzekere ontbrekende momenten, oude job niet actief. Databaseverversing en boekingsbescherming werken ook via de bestaande RPC-signaturen. De gewijzigde webcode staat lokaal; er is vanuit deze opdracht geen frontenddeployment uitgevoerd.

Validatie van de huidige inrichting: 27 specifieke on-demand-databasecontroles, 25 bestaande synchronisatiecontroles en 56 boekingsregressiecontroles geslaagd; alle testmutaties zijn teruggedraaid en er is geen testmail verstuurd. Daarnaast slaagden 26 parser-, agenda-, route- en servicetests, TypeScript en productiebuild. Een echte `service_role`-REST-aanroep bevestigde bronverversing, hergebruik van dezelfde cache zonder tweede fetch, werkende beschikbaarheid en een inactieve cronjob. De security-advisor toont uitsluitend de bestaande `btree_gist`-melding; de reeds bestaande RLS-performanceadviezen zijn ongewijzigd. De browsersessie was verlopen, dus de aangepaste statustekst is deze ronde niet opnieuw in een aangemelde browser gecontroleerd.

De eerdere vijfminutenjob was op 18 oktober om 21:40 Europe/Brussels autonoom geverifieerd. Dat was de vorige inrichting en is vervangen door de bovenstaande verversing bij gebruik.

**Oorspronkelijke import op 18 oktober 2026:** alle 262 afspraken uit de aangeleverde MijnDiAd-feed zijn opgeslagen onder Virginies gekoppelde practitioneridentiteit, in `calendar_scope = 'itransform'`. De feed bevat momenteel afspraken van 18 september 2026 tot en met 28 juni 2027. Deze import vormde de basis voor de huidige verversing bij gebruik; het is geen volledige export van MijnDiAd.

**Aanvulling op dezelfde dag:** op verzoek van de gebruiker zijn de blokken verrijkt met alle bruikbare gegevens uit dezelfde feed: 28 verschillende titels/afspraaktypes, 209 ingevulde locaties en 262 gecontroleerde afspraaklinks. De bestaande 262 records zijn bijgewerkt op hun bronidentiteit; er zijn geen dubbels aangemaakt. De gebruiker heeft geen MijnDiAd-toegang beschikbaar en vraagt expliciet uitsluitend de beschikbare gegevens te gebruiken. Cliëntnamen ontbreken in de feed; er worden geen namen afgeleid of verzonnen.

## Gedrag

- Items tonen het gepubliceerde afspraaktype, zonder het overbodige voorvoegsel `Bezet -`, en blokkeren Virginies boekbare tijden. Online consulten zijn blauw, praktijkconsulten roze en privé/overige momenten grijs.
- De eigen praktijkagenda toont ze bij Itransform. De algemene MyGrowise-adminagenda sluit die scope uit.
- Het bijgewerkte agendaservicepad maakt de items niet-bewerkbaar. Een databasetrigger weigert wijzigen of verwijderen door de applicatierol, ook wanneer oudere frontendcode nog een bewerkknop toont.
- De import bewaart tijdstippen, status, titel/afspraaktype, locatie, een gehashte bronidentiteit en de gecontroleerde MijnDiAd-afspraaklink. Beschrijvingen worden niet geïmporteerd. De iCal-feed bevat geen cliëntnamen.
- De kalenderkaarten tonen type en locatie. Het detailvenster toont datum, duur, locatie, herkomst en de bronlink, plus bij consulten de ontbrekende cliëntnaam. De link vereist MijnDiAd-toegang. Een filter verbergt privé/overige momenten uitsluitend in de weergave; hun boekingsblokkade blijft gelden. De urenweergave loopt tot 23:00 zodat afspraken tot 21:30 niet worden afgesneden.
- De praktijkweek toont standaard maandag–vrijdag met bredere kolommen. Weekendmomenten krijgen een teller en een melding met een knop om het weekend te tonen. Dag-, maand- en lijstweergave behouden alle dagen. Op schermen tot 900 px start de agenda in dagweergave.
- De tijdvakken zijn hoger, met ruimte tussen opeenvolgende afspraken. Lichte achtergronden en een gekleurde rand vervangen de volle importkleur. Korte afspraken tonen tijd en titel; locatie en verdere gegevens blijven in het detailvenster beschikbaar. De kalender scrolt afzonderlijk zodat dagkoppen en kalenderbediening in beeld blijven.
- Bestaande lokale momenten en boekingen blijven behouden. De import constateerde één historische overlap met een boeking op 25 september 2026; geen toekomstige boekingsoverlap.
- De wijzigingen aan de webcode zijn lokaal gecontroleerd, niet vanuit deze opdracht gedeployd. De import, databasebescherming en verversing bij gebruik zijn wel toegepast; de oude serverjob is gedeactiveerd. Een frontenddeployment is niet nodig om de bijgewerkte blokken via de bestaande agendaqueries op te halen; de nieuwe werkbalk/statusweergave is aanwezig in de lokale versie.

## Opnieuw importeren

De privélink staat uitsluitend in de genegeerde lokale `.env`, als `MIJNDIAD_ICAL_URL`. De operator gebruikt daarnaast `SUPABASE_DB_URL`; geen van beide hoort in Git of browsercode.

```sh
node scripts/import-mijndiad-agenda.mjs
node scripts/import-mijndiad-agenda.mjs --apply
```

De oorspronkelijke snapshot-importer hierboven beproeft zonder `--apply` en rolt terug. Met `--apply` worden migratie en snapshot opgeslagen. Herhalen maakt geen dubbels. Deze losse importer plant zelf geen job en behandelt afwezigheid niet als annulering. Gebruik voor de huidige automatische koppeling het setupscript en de statusbediening bovenaan dit document; die bevatten ook de bevestigingscontrole voor verdwenen toekomstige afspraken.

De parser verwerkt de aangetroffen concrete afspraken met tijdzone of UTC. Niet-uitgewerkte herhalingen, hele dagen, ongeldige of dubbelzinnige zomertijdstippen en onvolledige feeds breken de gehele import af. Ondersteuning daarvoor moet expliciet worden toegevoegd als MijnDiAd het formaat verandert.

## Verificatie

- Migraties: `20261018190320_mijndiad_agenda_import.sql` en `20261018191149_mijndiad_agenda_details.sql`, geregistreerd met de import/verrijking.
- Proefimport en definitieve import: 262/262 overeenkomende blokken; één bestaand lokaal moment behouden.
- Zowel `get_bookable_slots` als `get_offer_slots` leveren geen slots op die geïmporteerde bezetting overlappen. Ook een conflicterende nieuwe lokale afspraak wordt door de database geweigerd.
- Wijzigen en verwijderen als `service_role` worden geweigerd, zelfs met een vervalste importinstelling.
- Parser-, agendaservice- en weergavetests: 19 geslaagd; TypeScript-controle en productiebuild geslaagd. De eigen agenda en het detailvenster zijn tevens gecontroleerd in Virginies bestaande lokale browsersessie.
- Security-advisor: bestaande waarschuwing over `btree_gist` in `public`; geen nieuwe tabel of brede toegangsrechten toegevoegd. Zie [Supabase-uitleg](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
