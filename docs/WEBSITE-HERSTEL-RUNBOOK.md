# Websiteherstel en aankopen zonder account

**Stand: 18 oktober 2026.** Het [herstelplan](WEBSITE-HERSTELPLAN.md) is uitgevoerd in de bestaande lokale werkboom op `b2cfabd`, met behoud van het al aanwezige ongecommitte werk. De schemawijzigingen zijn toegepast op de database uit de lokale configuratie. De website is niet gedeployd en er is geen commit of push gemaakt.

## Wat nu werkt

- `/bestellen` laat een gast bestellen. Contactadres en deelnemer worden bij de order vastgelegd; een aankoop voor een kind is expliciet te kiezen. Geen verborgen Auth-gebruiker, registratie of wachtwoord.
- `commerce_buyers` koppelt orders, rechten en afnames aan een aankoopidentiteit. Bestaande accountorders blijven op hun klant-ID werken. Betaling blijft een handmatige overschrijving die het team verifieert.
- De checkoutbrowser kan alleen zijn eigen betaalinstructies heropenen. Betaald materiaal, instructies en rapporten vragen een bevestigd account of afzonderlijk bewezen aankooptoegang.
- `/aankopen/toegang` wisselt een eenmalige e-maillink via een expliciete POST in. Tokens zijn willekeurig, alleen gehasht opgeslagen en 30 minuten geldig; een HttpOnly-aankoopsessie duurt maximaal zeven dagen. GET verbruikt niets. De token staat in het URL-fragment en wordt na het uitlezen uit de browser-URL gehaald; hij gaat niet mee in de GET, Referer of analytics. Een nieuwe link aanvragen geeft voor bekende en onbekende adressen dezelfde reactie.
- `/aankopen` toont bestellingen, werkboeken/audio, afnames en rapporten. Nieuwe orders worden voor een geverifieerd gastadres gevonden via het onveranderlijke bestelcontact, zodat een andere koperidentiteit geen nieuwe orders kan onthullen. Oude orders zonder contactsnapshot gebruiken de gebackfillde koper. Een ingevuld e-mailadres of alleen een order-ID bewijst geen eigendom.
- Een koper kan aankopen vrijwillig aan een bestaand, bevestigd klantaccount met hetzelfde adres koppelen. Koppelen is atomair en herhaalbaar. Dubbele actieve rechten worden samengevoegd; historie en afzonderlijke afnames blijven behouden. Een aankooplinksessie kan expliciet worden afgesloten.
- Bestel-, betaal- en afnamemail werkt voor gasten. De duurzame wachtrijen behouden mislukte taken met beperkte pogingen en een lease. Directe verzendpogingen en één dagelijkse geconsolideerde worker verwerken boekings-, website-, commerce- en supportmail; handmatig herstel staat onder `/admin/mail`. Vercel Free is vast.
- `/contact` maakt één eenvoudige mailtaak met een vaste afzender en het gevalideerde bezoekersadres als Reply-To, gericht aan `info@mygrowise.be`. Onderwerpen: Bestelling, Module, Afspraak en Profiel. Bestaande supportgesprekken, gastlinks en interne notities zijn behouden.
- De zes modules behouden de aangeleverde covers en €89 als geplande prijs. Ze blijven in ontwikkeling. Het volledige werkboek staat centraal; aanvullende producten zijn optioneel en tellen afzonderlijk mee wanneer ze beschikbaar zijn.
- Superadmin kan aanbevelingen koppelen, sorteren en verwijderen. Alleen bestaande vragenlijsten, profielen en extra digitale producten zijn te koppelen. Er zijn geen klinische koppelingen verzonnen.
- `/admin/modules/nieuw` maakt een PDF-werkboek of audio-extra als ongeprijsd concept (`guide`). Het bestaande versie-, upload- en publicatiebeheer wordt hergebruikt. PDF-extra's vereisen een gecontroleerde PDF, audio-extra's gecontroleerde audio; kernmodules vereisen beide. Publicatie en verkoop blijven afzonderlijke stappen. Publieke extra's staan op `/verdieping/[slug]`.
- `/zelf-aan-de-slag` biedt profielen, vragenlijsten en modules naast elkaar. Mijn aankopen en modules zijn ook via het mobiele menu bereikbaar. Community is toekomstig aanbod.
- De begeleidingspagina en therapeutpagina's werken met het actuele praktijkschema. Standaardsessies zijn 50 minuten; afwijkende duur blijft beheerbaar per afspraaktype. Historische boekingen zijn niet herschreven. De kalender en server sluiten dezelfde dag in Europe/Brussels uit; minimum_notice_hours is een aanvullende grens. Bij een agendastoring tonen de publieke routes een herstelbare fout zonder ontwikkelstacktrace.
- De prikkelprofieltekst is vanaf 8 jaar. Een nieuwe bestelling bewaart op basis van de ingevulde geboortedatum SPM-2 + FEEL-KJ voor 8–17 of SPM-2 + FEEL-E voor 18+. Een deelnemer onder 8 wordt geweigerd. Bestaande betaalde snapshots zijn behouden. Het welzijnsprofiel voor jongeren toont 8–17 jaar.

## Toegepaste migraties

| Versie | Wijziging |
|---|---|
| `20261018160435_practice_appointment_management` | Eerder aanwezige maar ontbrekende praktijkmigratie, eerst in een rollbacktransactie beproefd. |
| `20261018173304_commerce_guest_and_website_repair` | Kopers, backfill, gastorders, toegang, koppelen, mailwachtrij, aanbevelingen, extra's, leeftijdsvariant en boekingsgrens. |
| `20261018175636_website_profile_copy` | Professionele beschrijvingen uit de briefing, met behoud van afwijkende beheerinhoud. |
| `20261018180042_website_booking_duration` | Standaardduur 50 minuten, inclusief compatibele oudere instellingenconstraint en bestaande standaardoverrides. |

`node scripts/apply-website-repair.mjs` voert standaard alleen een rollbackrepetitie uit. `--apply` past ontbrekende genoemde migraties toe en registreert ze atomair in de migratiehistorie. De controle vergelijkt aantallen en eigendom vóór commit. Bij uitvoering bleven de zes orders, twee rechten, twee afnames, zes boekingen, drie professionals en vijf dossiers behouden. Testfixtures zijn daarna weer verwijderd. Historisch toegepaste migraties zijn niet herschreven.

## Verificatie

- `npm run check`: TypeScript en productiebuild geslaagd.
- Catalogus-, module- en afspraakgedrag: 19 tests geslaagd.
- Databank: catalogus 28, modules 47, afspraken 56 en commerce 63 controles. Rechten/RLS, idempotentie, gemengde prijzen, betaling, versies, extra's, eigendom, accountkoppeling, leeftijdsvarianten, leases, middernacht en zomertijd zijn gericht getest. Alle transactietests rollen terug.
- `npm run test:commerce:http`: 78 HTTP-controles met synthetische kopers, waaronder de echte accountlogin, gastcheckout, betaalinstructies, tokenverbruik/hergebruik/verval, privé-PDF en audio Range, rapportbytes, terugbetaling, adresisolatie, vrijwillig koppelen, afsluiten en contactmail.
- `MODULE_TEST_ORIGIN=http://localhost:4322 npm run test:modules:http`: 38 HTTP/Storage-controles met tijdelijk materiaal, onder meer nieuw ongeprijsd extra-concept, opslaan, aanbeveling, beheerrechten, resumable upload, inhoudscontrole, publicatie en bestaande accountaudiolinks.
- `node tests/public-fallback-http.mjs`: vijf publieke routes getest met opzettelijk onbereikbare opslag/API via een afzonderlijke lokale instantie op poort 4323. Dit is een storingsproef, geen wijziging aan de echte verbinding.
- Browser: begeleiding en Virginies afspraaktypes, zelfstandig starten, vragenlijst→checkout, aankooplinkknop en verlopen-linkherstel; checkout zonder horizontale overloop op 360, 768 en 1024 pixels. Mobiel menu werkt met Enter en Escape. De tijdelijke viewport is hersteld. Schermafbeeldingen: `output/website-repair/checkout-360.png` en `checkout-desktop.png`.

HTTP-tests gebruiken een afzonderlijke devserver: `WEBSITE_MAIL_MODE=capture PUBLIC_SITE_URL=http://localhost:4322 npm run dev -- --port 4322 --ignore-lock`. Capture is uitsluitend in development actief en schrijft MIME naar de genegeerde lokale map `output/mail-test/`. De tests controleerden ontvanger, Reply-To, bevestigingsinhoud en toegangskoppelingen; er zijn geen echte mails verstuurd. Gebruik de gewone lokale instantie op 4321 voor de website. De testinstanties worden na de proeven gestopt.

## Operationele grenzen en resterende inhoud

1. Definitieve module-PDF's/MP3's, doelgroep, toegangsduur en ondersteuning moeten nog aangeleverd of ingevuld worden. Zonder materiaal en controle blijft verkoop uit. De aangekondigde lijst met vragenlijsten per module ontbreekt; aanbevelingen zijn daarom leeg.
2. Werkboeken en hypnose-audio kunnen nu worden voorbereid in beheer. Er zijn geen fictieve verkooppakketten toegevoegd.
3. Vaste profielpakketten behouden hun vaste prijs. Extra korting op gemengde pakketaankopen is nog niet bevestigd. Modules, losse vragenlijsten en beschikbare extra's gebruiken de centrale staffel: 2–3 items 5%, vanaf 4 items 10%.
4. Lokale mailconfiguratie is aanwezig en als geverifieerd ingesteld. Werkelijke inbox-/spamaflevering, DNS en de gedeployde cron zijn in deze bouwstap niet bewezen. Controleer PUBLIC_SITE_URL, CRON_SECRET en mailconfiguratie in de deploymentomgeving vóór publicatie. De standaard bankgegevens zijn niet gewijzigd; er is geen echte betaling uitgevoerd.
5. De voorwaardenpagina blijft een expliciet concept; de onjuiste claim dat checkout technisch uitgeschakeld is, is verwijderd. Definitieve voorwaarden vereisen nog de inhoudseigenaar/juridische controle.
6. De Supabase-connector/advisors waren niet verbonden. Gerichte schema-, RLS- en rechtencontroles liepen via de bestaande PostgreSQL-verbinding. De optionele CLI-typegeneratie kon zonder Management API-token niet worden uitgevoerd; de bestaande serverclient gebruikt geen gegenereerd typesbestand. De geslaagde typecheck is geen bewijs van gegenereerde schema-typen.
7. Na terugbetaling worden geen nieuwe materiaal- of rapportlinks afgegeven. Eerder afgegeven ondertekende links blijven geldig tot hun vervaldatum (PDF 5 minuten, rapport 1 minuut, audio afgestemd op speellengte). Gedownloade bestanden zijn niet op afstand in te trekken.

Voor herstel: behoud orders, rechten, afnames en private bestanden. Zet een onvolledig product op concept/in ontwikkeling of pauzeer verkoop; verwijder geen klantdata als noodoplossing. Bevestigde accounttoegang en bestaande support blijven afzonderlijk bruikbaar.

De openbare voorbeeldmomenten bij professionals gebruiken dezelfde afspraaktype-slots als de boekingspagina, met alleen de eerste drie resultaten. De boekingspagina haalt voor een bezoeker zonder boekbaar cliëntaccount geen verborgen volledige agenda op. Dit voorkomt zowel verschillende tijdroosters als onnodige paginalaadtijd.

Een website-mailtaak met status `failed` wordt na de zesde poging niet automatisch opnieuw verstuurd. Controleer de oorzaak en ontvanger vóór een beheerder de betreffende taak opnieuw op pending zet; behoud de oorspronkelijke submission key. SMTP accepteert een mail en het bijwerken van de taakstatus zijn geen enkele transactie: bij een onderbreking daartussen kan een retry dezelfde mail nogmaals bezorgen. Bestellingen, rechten en afnames blijven wel idempotent.
