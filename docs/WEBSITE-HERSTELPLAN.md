# Herstelplan voor de website en kopen zonder account

**Datum:** 18 oktober 2026.  
**Status:** uitgevoerd op 18 oktober 2026 na Kevins “go for it”. Zie [uitvoering, migraties, tests en resterende inhoud](WEBSITE-HERSTEL-RUNBOOK.md). De onderstaande bevindingen beschrijven de uitgangssituatie vóór het herstel.  
**Opdrachtgever:** Kevin bevestigt dat een account niet verplicht mag zijn om iets te kopen en vraagt alle overige bevindingen uit de websitecontrole samen te plannen.  
**Bronbasis:** lokale werkboom op `b2cfabd`, inclusief bestaand ongecommit werk. GitHub `main` en lokale `HEAD` zijn op 18 oktober alleen-lezen vergeleken en wijzen beide naar `b2cfabdfd006790da40e0f757fa58cc19981fb76`. De werkboom bevat aanvullende module-, catalogus- en praktijkbouw; de commit alleen beschrijft dus niet de huidige applicatie.

Dit is de leidende herstelopdracht voor de volgende stap. Bij strijdigheid gaat deze opdracht vóór oudere teksten die accountplicht, de bestaande contactinbox of reeds beschikbare communitytoegang als gewenst eindgedrag beschrijven. Behoud het overige lopende werk en de al toegevoegde modulebeelden.

## 1. Vastgelegde productkeuzes

- Een gast kan een vast profiel, losse vragenlijst, module of beschikbare aanvullende digitale inhoud kopen zonder registratie of wachtwoord. Een bestaand account blijft bruikbaar; een nieuw account is een vrijwillige keuze achteraf.
- Geen verborgen Auth-account aanmaken om de bestaande verplichte accountkoppeling te omzeilen. Een bestelcontact en een geverifieerde toegangssessie zijn geen klantaccount.
- De zes modules kosten €89 per stuk en zijn zelfstandig te volgen. Alle zes blijven in ontwikkeling totdat het echte materiaal compleet en gecontroleerd is. Teksten en foto's betekenen niet dat de werkboeken en audio leverbaar zijn.
- Modules 1–3 worden als eerste voorbereid. Virginies verwachting “morgen of volgende week” wordt geen publieke leverdatum.
- De bevestigde staffel is één item 0%, twee of drie items 5%, vanaf vier items 10%. Modules en losse vragenlijsten kunnen samen tellen. Prijzen worden op de server berekend.
- Vaste profielpakketten behouden vooralsnog hun vaste prijs. Of zij ook in een gemengde bestelling meetellen en extra korting krijgen is nog niet expliciet uitgewerkt; maak hiervan geen nieuwe stille prijsbeslissing. Dit open punt blokkeert gastcheckout en de overige correcties niet.
- Een module kan optionele verdieping tonen: passende vragenlijsten, profielpakketten, miniwerkboeken of audio. Virginie moet koppelingen, teksten, volgorde en beschikbaarheid zelf kunnen beheren.
- Het publieke contactformulier bezorgt een praktische vraag aan `info@mygrowise.be`; Virginie kan met beantwoorden in haar mailprogramma rechtstreeks reageren.
- De community blijft een toekomstige voorziening. Geen toegang, materiaal of professionele opvolging als reeds inbegrepen beloven.
- Eerst de publieke website en de koop-/leverroute afronden. Het uitgebreide praktijkdashboard is geen nieuwe uitbreiding binnen deze herstelopdracht. Bestaande praktijkfunctionaliteit moet wel blijven werken.

## 2. Gecontroleerde stand

| Onderdeel | Bewijs op 18 oktober | Gevolg |
|---|---|---|
| Gastcheckout | `src/pages/bestellen.astro` toont zonder sessie alleen login/registratie; `src/pages/api/checkout/catalog-order.ts` weigert gasten met 401. | Zowel scherm als server moeten aangepast worden. |
| Database-eigendom | Alleen-lezen controle op de geconfigureerde database: `orders.customer_user_id`, `entitlements.customer_user_id` en `assessment_deliveries.customer_user_id` zijn alle drie NOT NULL. | Alleen de loginblokkade verwijderen is onvoldoende en zou levering breken. |
| Klantmail | `src/lib/catalog/mail.ts` zoekt iedere klantontvanger op via `auth.admin.getUserById`; bestel- en leverlinks verwijzen naar accountpagina's. | Gastcontact, toegangslinks en afhandeling van mailfouten meenemen. |
| Begeleiding | In de browser gaf `/begeleiding` een ontbrekende kolom `practitioners.image_url`. De schema-inspectie vond ook `online_instructions` niet. De geregistreerde migraties bevatten de modulemigratie, maar niet `20261018160435_practice_appointment_management`. | Bestaande praktijkcode en het doelschema zijn niet gelijk. Eerst gerichte migratiecontrole, geen los fictief veld plakken. |
| Modulebeelden | Zes originele beelden zijn uitgepakt, lokaal als WebP toegevoegd en op overzicht en alle zes detailpagina's geladen; typecheck geslaagd. | Afgerond; niet opnieuw genereren of vervangen. Originele PNG's staan onder `output/modules/document-images`. |
| Modulebeheer | Editor voor tekst, prijs, materiaalversies, PDF, MP3 en publicatie bestaat. | Uitbreiden met aanbevelingen; bestaande materiaalbeveiliging behouden. |
| Kortingsberekening | Publieke browsercontrole met 2, 3 en 4 vragenlijsten gaf juiste bedragen; het bedrag bleef juist op checkout. | Centrale staffel behouden en regressietesten met gastbestellingen. |
| Prijspagina | Huidige werkboom heeft inmiddels moduleprijzen en gemengde kortingsuitleg in `src/pages/prijzen.astro`. De eerdere browserbevinding was van vóór die wijziging. | Als aanwezig werk verifiëren en tekstrestanten herstellen; niet opnieuw bouwen. |
| Contact | `src/pages/api/contact.ts` maakt supportgesprekken; de pagina stuurt bezoekers naar een link voor het antwoord. | De publieke instroom krijgt eenvoudige mailafhandeling. |
| Startpagina en community | Zelfstandig starten verwijst primair naar profielen; de communitytekst belooft bestaande deelname. | Vindbaarheid en verwachtingen corrigeren. |

De Supabase-connector was niet verbonden. De genoemde databasefeiten zijn daarom rechtstreeks via de bestaande geconfigureerde PostgreSQL-verbinding binnen `BEGIN READ ONLY` gecontroleerd; er is niets gewijzigd. Werkelijke mailboxaflevering, de gedeployde website en een nieuwe loginproef zijn in deze planstap niet getest.

## 3. Uitvoeringsvolgorde in één samenhangende bouwstap

### A. Praktijkschema en de publieke begeleidingsroute herstellen

1. Vergelijk de volledige bestaande praktijkmigratie met het actuele schema en reeds aanwezige functies. Lees ook het praktijkrunbook; behoud bestaande therapeuten, boekingen, rechten en dossiers.
2. Verifieer de migratie eerst tegen een passende testdatabase. Neem de bestaande, nog niet toegepaste migratie gecontroleerd mee; maak bij benodigde correcties een nieuwe migratie via `supabase migration new`, zonder geregistreerde migratiehistorie te herschrijven.
3. Houd `src/lib/appointmentCatalog.ts`, `src/lib/appointmentDetail.ts`, publieke therapeutpagina's en schema gelijk. Gebruik bij een ontbrekende foto het bestaande redactionele beeld. Een tijdelijke opslag- of agendastoring mag geen ontwikkelstacktrace aan bezoekers tonen; geef een rustige foutmelding en contactmogelijkheid, zonder een geslaagde boeking te suggereren.
4. Controleer na migratie `/begeleiding`, alle actieve therapeutpagina's en de route naar afspraaktypes en vrije momenten. Controleer ook een lege agenda en een tijdelijke databasefout.
5. Herstel publieke tekstrestanten: ongeveer 50 minuten, correcte professionele beschrijvingen, definitieve bevestiging na geslaagde boeking. De prijspagina zegt nu nog dat een aanvraag nooit een definitieve afspraak is; dat past niet bij direct bevestigde boekingen.
6. Boekingsdeadline: geen boekingen voor dezelfde kalenderdag in `Europe/Brussels`, server en kalender gelijk. De bestaande `minimum_notice_hours` is een aanvullende beperking en niet automatisch hetzelfde als “uiterlijk de dag voordien”. Test middernacht en zomertijd. Verander de bestaande reserverings- en overlapbeveiliging niet.

### B. Een echte gastbestelling bouwen

**Bezoeker:** aanbod kiezen → overzicht en contactgegevens invullen → bestelling plaatsen → referentie en overschrijvingsgegevens → betaalbevestiging → gekochte inhoud openen. Geen verplichte registratie op enig punt van deze route.

1. Toon op `/bestellen` een gastformulier als normale route. Login is een kleine optionele mogelijkheid. Verzamel de al gevraagde bestelgegevens: e-mail, voornaam, achternaam, geboortedatum en geslacht. Houd koper en deelnemer uit elkaar bij aankoop voor een kind; plaats geen intakevraag of rijksregisternummer in de productcheckout.
2. Bewaar contactgegevens en de deelnemer bij de bestelling. Een ingevuld e-mailadres bewijst geen eigendom van eerdere aankopen. Toon of koppel geen bestaande bestellingen op basis van een onbevestigd adres.
3. Voeg een permanente aankoopidentiteit toe die zonder `auth.users` kan bestaan, bijvoorbeeld `commerce_buyers`. Backfill bestaande klanten en koppel orders, rechten en afnames hieraan. `customer_user_id` wordt optioneel voor gasten; elk record moet wel een geldige aankoopidentiteit en herleidbare orderregel houden. Laat bestaande accountqueries werken tijdens deze uitbreiding.
4. Maak een servergestuurde gastorderfunctie naast of achter de bestaande orderfunctie. Beide gebruiken dezelfde quote, prijscontrole, korting, orderregels en beschikbaarheidsregels. Pas ook betaaltriggers, unieke constraints, idempotentiesleutels en rechten op de betrokken tabellen aan; een nullable kolom alleen is geen voltooid ontwerp.
5. Een herhaalde submit met dezelfde gastcheckout-identiteit en submission key levert dezelfde order. Een gewijzigde quote vraagt een vernieuwd overzicht. Een vervalste korting, dubbel product of product in ontwikkeling wordt door de server geweigerd. Gebruik een onvoorspelbare checkout-identiteit, geen globale unieke sleutel op alleen e-mail.
6. Behoud handmatige overschrijving en menselijke verificatie. Geen knop “Ik heb betaald”, geen automatische markering als betaald bij het plaatsen van een order en geen nieuwe betaalprovider binnen deze opdracht.
7. Pas middleware en API-autorisatie gericht aan: de checkout mag een gast accepteren, beheer- en privéaccountpagina's blijven afgeschermd. Gebruik origincontrole, gedeelde rate-limits en een honeypot waar passend.

**Belangrijkste bestanden:** `src/pages/bestellen.astro`, `src/pages/api/checkout/catalog-order.ts`, `src/lib/catalog/server.ts`, `src/lib/catalog/mail.ts`, `src/middleware.ts`, `src/pages/admin/bestellingen`, `src/pages/admin/afnames`, betaalverificatie en de SQL-functies/triggers rond orders, entitlements en assessment deliveries.

### C. Toegang na aankoop zonder verplicht account

1. Bouw een aparte aankooptoegang via een e-maillink. Dit is een sessie voor gekochte inhoud, niet een verborgen Supabase Auth-registratie. Gebruik geen `signInWithOtp` met automatische registratie als shortcut.
2. Nieuwe checkoutbrowser mag zijn net aangemaakte betaalinstructies terugzien. Voor betaald materiaal, afnames en rapporten moet het e-mailadres worden bewezen via de toegangslink. Een order-ID of betaalreferentie alleen geeft geen toegang.
3. Gebruik willekeurige, alleen gehasht opgeslagen, eenmalige tokens met korte geldigheid (werkuitgangspunt 30 minuten), een expliciete POST-inwisseling en een beperkte HttpOnly-sessie (maximaal 7 dagen). GET mag een link niet verbruiken door een mailscanner. `Secure` op HTTPS, passende SameSite-instelling, `private, no-store`, `no-referrer` en geen tokens in analytics of logs.
4. Een sessie geeft alleen toegang tot de bewezen aankopen. Materialen en rapporten blijven in private opslag; ondertekende download-/audiolinks blijven tijdelijk. Gebruik dezelfde centrale eigendomscontrole voor gast en account, gebaseerd op actieve aankooprechten en orderstatus.
5. Introduceer publieke toegangsroutes, bijvoorbeeld `/aankopen/toegang` en `/aankopen`, voor herstel en het aankoopoverzicht. Geef bij een toegangsvraag altijd een neutrale reactie, ongeacht of het adres bekend is. Beperk pogingen en het versturen van nieuwe links.
6. Maak module-/audiotoegang onafhankelijk van verplichte accountlogin. Bestaande `/account/modules/[slug]/audio/[trackKey]`-links uit PDF's moeten voor een gast via aankoopverificatie weer bij dezelfde module en track uitkomen. Bewaar query/deep-link veilig; accepteer geen externe return-URL.
7. Bied na aankoop optioneel “Bewaar in mijn account”. Koppelen kan pas met een ingelogd, bevestigd klantaccount én bewezen aankooptoegang voor hetzelfde adres. Voer koppeling atomair en herhaalbaar uit; behoud orderhistorie, materiaalversies, afnames en bestaande aankooprechten. Maak geen account en voeg geen marketingtoestemming toe zonder expliciete keuze.
8. Laat bestaande accountklanten hun bibliotheek en transacties blijven gebruiken. Admins en therapeuten krijgen via een gastsessie geen extra bevoegdheden.

### D. Bestelmail en beheer op gasten laten werken

- Los de ontvanger op uit de opgeslagen bestelcontactgegevens; vereis geen `auth.admin.getUserById` voor een gast. Bewaar het adres dat bij de order is gebruikt.
- Bestelbevestiging: referentie, bedrag, overschrijvingsgegevens of een werkende aankooplink. Betaalbevestiging: bevestigde status en duidelijke vervolgstap. Een klantmail mag een gast niet alsnog naar verplichte registratie sturen.
- Teamnotificaties gaan naar de geconfigureerde inbox voor `info@mygrowise.be`, met bestelgegevens die nodig zijn voor opvolging. Houd medische inhoud en rapporten uit gewone mail.
- Pas adminlijsten, orderdetail, afnames en zoekfuncties aan op “gast” en optionele accountkoppeling. Geen kapotte link `/admin/klanten/null` en geen order die verdwijnt door een verplichte inner join naar profiles.
- Gebruik de bestaande duurzame mailwachtrij en retryafhandeling. Eén betaalbevestiging mag geen dubbele rechten, afnames of logische mailtaken opleveren. Behoud het gebruikelijke onderscheid tussen besteld, betaald, geleverd en terugbetaald.
- Test aflevering met een testmailtransport/mailbox. Geen testmails naar echte klanten; geen echte betalingen uitvoeren voor een technische proef.

### E. Contact terugbrengen tot een eenvoudig mailformulier

1. Maak de onderwerpen Bestelling, Module, Afspraak en Profiel. Naam, e-mail en praktische vraag blijven voldoende. Geen account of link naar een online gesprek nodig om antwoord te ontvangen.
2. `POST /api/contact` valideert en bewaart één verzendtaak. Mail de praktische vraag aan `info@mygrowise.be` met een vaste afzender uit het eigen domein en het gevalideerde bezoekersadres als `Reply-To`; gebruik gebruikersinvoer niet als vrije mailheaders.
3. Verstuur desgewenst een korte ontvangstbevestiging zonder beveiligde gesprekslink. Toon pas een correcte ontvangststatus nadat de aanvraag duurzaam is opgeslagen. Bij SMTP-fout blijft de taak beschikbaar voor retry en is een rechtstreekse mailuitwijkroute zichtbaar.
4. Laat ingelogde en niet-ingelogde bezoekers dezelfde eenvoudige contactroute gebruiken. Geen redirect naar `/account/ondersteuning` na dit publieke formulier.
5. Bestaande supportgesprekken, gastlinks en interne notities blijven intact. Stop alleen het aanmaken van nieuwe platformgesprekken vanuit de publieke contactroute. Verwijder geen supportdata en laat de oude supportmailworker bestaande taken afmaken.
6. Pas de bijbehorende tekst, bevestiging en privacybeschrijving aan de nieuwe mailroute aan. Bestaande bewaartermijnen niet stilzwijgend wijzigen of nieuwe juridische claims verzinnen.

**Bestanden:** `src/pages/contact.astro`, `src/pages/api/contact.ts`, een aparte helper/taaksoort voor contactmail, bestaande SMTP- en rate-limithelpers, de relevante cron/retry-afhandeling en contactdocumentatie.

### F. Modules en optionele verdieping afmaken

- Behoud de zes aangeleverde beelden en de juiste standaard-/beheerprioriteit. Zorg dat de standaardcover ook zichtbaar is in het modulebeheer; het publieke beeld en het bewaarde beheerpad mogen niet verwarrend uiteenlopen.
- Maak op de modulepagina een duidelijk hoofdproduct “Volledig werkboek” en een blok “Optionele verdieping”. Aanbevelingen zijn optioneel, geen impliciete onderdelen van de €89.
- Voeg beheerde relaties toe, bijvoorbeeld `module_recommendations(module_product_id, target_product_id, sort_order, visibility)`, met productforeignkeys en servervalidatie. Kies echte catalogusproducten; koppel geen losse URL's als verkapte betaalproducten. Een product mag bij meerdere modules terugkomen zonder kopieën.
- Bestaande losse vragenlijsten en profielpakketten kunnen direct worden gekoppeld. Voor miniwerkboeken en losse hypnose-audio: hergebruik het bestaande producttype `guide` met een expliciet formaat `pdf` of `audio`, in plaats van die producten als vragenlijst of zevende kernmodule te vermommen. Breid catalogus, materiaalbeheer, quote en levering gericht uit voor dit type.
- Bouw voor deze extra's dezelfde private levering en gast-/accountcontrole als voor andere digitale aankopen. Een PDF-extra vereist een gecontroleerde PDF; een audio-extra gecontroleerde audio. Het is geen reden om een volledig nieuw leersysteem te bouwen.
- Virginie kan aanbevelingen koppelen, rangschikken, verbergen en later producten aanvullen. Onvolledige extra's blijven concept of zichtbaar “In ontwikkeling”, zonder bestelknop en zonder onbevestigde prijs. Vul geen voorbeeldhypnose of miniwerkboek als verkoopklaar in.
- Neem beschikbare losse extra's mee in de centrale staffel; vaste profielpakketten blijven onder het afzonderlijk genoemde open kortingspunt vallen. Houd gekochte inhoud, aanbevolen extra's en afnameleveringen gescheiden.
- Zolang de aangekondigde koppellijst ontbreekt: het blok en beheer kunnen af zijn, maar de lijst blijft leeg of gebruikt alleen expliciet bevestigde koppelingen. Geen klinische geschiktheid of automatische aanbeveling verzinnen.

### G. Navigatie, teksten en overige samenhang herstellen

1. “Zelf aan de slag” krijgt een herkenbare ingang naar Profielen, Losse vragenlijsten en Modules. Behoud bestaande URL's; zorg ook op mobiel dat modules zonder zoektocht bereikbaar zijn. De startpagina mag een profiel adviseren, maar geen profiel als vereiste vóór een module suggereren.
2. Communitypagina en verwijzingen op de startpagina communiceren “In ontwikkeling”. Geen beloofde login, deelname, materiaal of opvolging na een huidige aankoop. Bestaande technisch aanwezige communitydata niet verwijderen.
3. Gebruik één staffelbron voor modules, samenstellen, vragenlijsten, prijzen, checkout en beheerhulpteksten. De nieuwe gemengde tekst op de prijspagina is al aanwezig; controleer in de browser en werk resterende “alleen vragenlijsten”-teksten bij.
4. Controleer productlabels en doelgroepen tegenover de briefing: onder meer prikkelverwerking vanaf 8 jaar met leeftijdspassende samenstelling, en de leeftijdsgrens van het jongerenprofiel. Maak geen medische of leeftijdsbeslissing op grond van een filterlabel; leg verschillen tussen aangeleverde tekst en catalogus vast en gebruik de expliciet aangeleverde variant.
5. Werk professionele beschrijvingen conform de aangeleverde briefing bij. Geen ongecontroleerde diploma's, certificaten of nieuwe titels uit een screenshot afleiden; eventuele aanvullende opleidingsdetails blijven bij de inhoudseigenaar.
6. Werk account-, bibliotheek-, PDF-, prijs-, mail- en FAQ-teksten bij zodat ze ook voor gastkopers kloppen. Repareer inlogfouten die bij verificatie reproduceerbaar blijken. Het eerder aangetroffen scherm met `temporarily_unavailable` is een waarneming, geen bewezen diagnose van alle loginproblemen.

## 4. Acceptatie voor de volgende bouwstap

| Proef | Vereist resultaat |
|---|---|
| Nieuw bezoek zonder cookies koopt een beschikbaar product | Bestelling en betaalinstructies zonder registratie; geen nieuwe Auth-gebruiker. |
| Bestaand e-mailadres bestelt als gast | Geen onthulling van eerdere aankopen en geen automatische accountkoppeling. |
| Gast verifieert toegang na betaling | Alleen eigen betaalde inhoud en afnames, zonder wachtwoord/accountplicht. |
| Onbetaalde, geannuleerde of terugbetaalde order | Geen ongeoorloofde materiaaltoegang volgens de actieve rechten/status. |
| Verlopen/gebruikte toegang, mailscanner, link opnieuw aanvragen | Herstelbaar, zonder tokenhergebruik, accountlek of onbedoelde consumptie bij GET. |
| Gast koppelt later vrijwillig aan geverifieerd account | Historie, rechten en afnames één keer beschikbaar; geen dubbele mails of levering. |
| Quote/prijs/status verandert of formulier wordt herhaald | Server herberekent, correcte feedback, geen dubbele order. |
| Twee modules + vragenlijst van €59 in geïsoleerde testcatalogus | €225,15 na 5%; twee modulerechten en één afname. |
| Twee modules + twee vragenlijsten van €59 in geïsoleerde testcatalogus | €266,40 na 10%; juiste regels en centverdeling. |
| Bestaand profiel en bestaande accountkoper | Vaste prijs en bestaande accountlevering blijven werken. |
| Publieke begeleiding en lege agenda | Geen 500/stacktrace; therapeuten of eerlijke leegmelding. |
| Afspraak via de bestaande boekroute, deadline/dubbel slot | Gedrag conform briefing; server verhindert dezelfde dag en dubbele reservering. Deze opdracht over gastaankopen introduceert geen afzonderlijk nieuw afsprakenidentiteitsmodel. |
| Contact als gast én account | Eén praktische mailtaak, antwoord via Reply-To, geen verplicht online gesprek. |
| Contact/commerce-mail tijdelijk stuk | Order/vraag bewaard, herstelbare taak en correcte gebruikersmelding. |
| Moduleaanbeveling beheren | Geselecteerde bestaande producten zichtbaar in juiste volgorde; concepten niet koopbaar. |
| PDF-extra en audio-extra | Alleen na betaling toegankelijk; geen afnamelevering voor een digitaal bestand. |
| Bestaande PDF-audiolink met gast en account | Na passende verificatie exact dezelfde oefening, ook na slug- of materiaalwijziging. |
| Community en navigatie | Toekomststatus eerlijk; modules duidelijk vindbaar; bedragen en teksten consistent. |
| 360 px, tablet, desktop en toetsenbord | Geen horizontale overflow; formulieren, foutmeldingen, labels en audio bruikbaar. |

Voer `npm run check` en de gerichte catalogus-, module- en afspraaktests uit. Voeg gedragstests toe voor gastbestelling, token/session-grenzen, accountkoppeling, contactmail en aanbevelingen. Controleer SQL/RLS/constraints en betalings-/levertriggers op de gekozen testdatabase, niet alleen frontendtests. Gebruik synthetische gegevens en testmailopvang; ruim eigen testrecords op. Controleer voor schemawerk actuele Supabase-documentatie en voer advisors uit waar beschikbaar.

Een geslaagde build bewijst geen echte mailboxaflevering, werkend productiemateriaal of geslaagde betaling. Leg na uitvoering exact vast welke migraties zijn toegepast, welke routes zijn getest en welke externe proeven nog ontbreken.

## 5. Nog aan te leveren, zonder de herstelbouw te blokkeren

- Definitieve PDF's en MP3's van modules 1–3; zonder die bestanden blijft verkoop uit.
- Virginies overzicht van vragenlijsten per module; zonder die lijst geen verzonnen koppelingen.
- Productgegevens en bestanden van toekomstige miniwerkboeken en hypnose-audio; beheer kan vooraf, verkoop niet.
- Expliciete uitleg over korting bij vaste profielpakketten en gemengde pakketaankopen.
- Moduleleeftijden, toegangsduur en inbegrepen ondersteuning voor zover nog niet ingevuld.

Start geen nieuwe providerintegratie, communitybouw of uitbreiding van het praktijkdashboard om deze afhankelijkheden op te lossen. Aanpassingen aan de bestaande praktijklaag blijven beperkt tot het herstellen en bewijzen van de publieke werking en bestaande afspraken.

## 6. Uitrol en herstel

Maak schemawijzigingen uitbreidend en compatibel met bestaande accountorders. Backfill en controleer aantallen/eigendom vóór nieuwe gastorders worden ingeschakeld. Test eerst in de gekozen testomgeving. Maak schema en applicatie in de juiste volgorde beschikbaar; voorkom opnieuw een pagina die velden verwacht vóór de migratie bestaat.

Bij problemen gastcheckout tijdelijk uitschakelen met een duidelijke boodschap; behoud bestaande orders, rechten, afnames en toegang voor bestaande kopers. Geen herstel door het verwijderen van klantdata of verkochte bestanden. Dit plan is inmiddels uitgevoerd; de feitelijk toegepaste schemawijzigingen en het ontbreken van een website-deployment staan in het uitvoeringsrunbook.

## 7. Bronnen en samenhang

- Gebruikersbevestiging in dit gesprek op 18 oktober: kopen zonder verplicht account; alle overige websitebevindingen voorbereiden voor de volgende stap.
- Virginies door Kevin uitgetypte antwoord: overzicht klopt, nog geen afgewerkte moduleproducten, staffel telt combinaties, koppellijst volgt.
- [Modulebouw en uitgevoerde controles](MODULES-RUNBOOK.md), [eerder modulebouwplan](MODULES-BOUWPLAN.md), [contactstroom die nu bestaat](CONTACT-BERICHTENPLAN.md), [technische overdracht](BUILD-HANDOFF.md) en [besluiten](DECISIONS.md).
- [Supabase e-mailtoegang](https://supabase.com/docs/guides/auth/auth-email-passwordless): Auth kan bij passwordless login standaard een gebruiker aanmaken. Een magic link is daarom niet automatisch gastcheckout zonder account. Dit plan kiest een afzonderlijke aankooptoegang.
- [Supabase changelog](https://supabase.com/changelog): geraadpleegd op 18 oktober. De recente aangekondigde TLS-cipherwijziging wijzigt deze productkeuze niet; gebruik de actuele documentatie opnieuw bij uitvoering.
