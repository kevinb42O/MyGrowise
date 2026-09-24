# MyGrowise Admin — geverifieerde nulmeting en uitvoeringsplan

**Versie:** 2.0
**Bijgewerkt:** 24 september 2026
**Doel:** een betrouwbare, veilige en hoogwaardige beheeromgeving uitbouwen op de bestaande Astro- en Supabase-codebasis.
**Bron van de nulmeting:** repositorycode en gecommitte migraties. Productieconfiguratie, live database-inhoud en externe accounts zijn hiermee niet gecontroleerd.

---

## 1. Hoe dit plan gelezen moet worden

Dit document scheidt drie soorten uitspraken:

- **Aanwezig in code:** bevestigd door een route, serverfunctie, API-handler, component of migratie.
- **Ontbreekt of is beperkt:** de huidige implementatie biedt de genoemde mogelijkheid niet, of de zichtbare flow stopt eerder.
- **Te bouwen / te beslissen:** voorgestelde vervolgactie. Een open keuze wordt niet als productbesluit voorgesteld.

Een pagina die data toont, is daarmee nog geen complete werkstroom. Een status, knop of tabel telt pas als werkende functie wanneer de toegestane gebruiker de volledige actie veilig kan uitvoeren, de server de wijziging valideert, de uitkomst betrouwbaar terugkomt en fouten herstelbaar zijn.

## 2. Productdoel

De admin wordt de dagelijkse werkplek voor organisatiebeheer van MyGrowise. Een medewerker moet er met passende rechten:

1. zien welke concrete acties aandacht vragen en hoe betrouwbaar de getoonde cijfers zijn;
2. het aanbod, de website en redactionele publicatie beheren;
3. klanten, bestellingen, toegang en begeleiding operationeel opvolgen;
4. berichten, gebruikers en privacyverzoeken afhandelen;
5. belangrijke wijzigingen kunnen herleiden en herstellen waar dat veilig kan.

De admin is geen klinisch dossier. Vragenlijst-antwoorden, gezondheidsscores, diagnoses, intake-inhoud en sessienotities horen niet in commerciële dashboards, algemene support, auditmetadata of analytics.

## 3. Geverifieerde huidige staat

### 3.1 Adminroutes en dataflows

| Onderdeel | Bevestigd in code | Grenzen die nu zichtbaar zijn |
|---|---|---|
| Dashboard `/admin` | Leest orders, boekingen, integratiestatus, werkitems, producten, auditgebeurtenissen en consented events via `getSuperadminOverview`. | De omzettrend is altijd een lege vaste toestand; de koptekst bevat een vaste persoonsnaam; statische onboarding-statussen; recente activiteit labelt iedere actor als “Superadmin” hoewel actor niet uit de query komt. Omzetkaart heet netto-omzet, maar berekening telt alleen totaalbedragen van maximaal 500 orders met status `paid` of `fulfilled`; er is geen refundbedrag of periodefilter in die berekening. |
| Analytics `/admin/analytics` | Periodekeuze, consented first-party eventtrend, checkoutstarts, booking clicks en routefunnelweergave uit Supabase. | De code noemt unieke analytics-cookiewaarden “sessies”; de cookie kan 180 dagen blijven bestaan, dus dit is geen aangetoonde sessiemeting. Funnelstappen zijn eventaantallen naast unieke identifiers en zijn niet als cohort geconstrueerd. Betaling geslaagd en boeking bevestigd zijn vaste `—`; geen content/acquisitierapporten of eventreconciliatie. Query’s hebben geen expliciete paginering. |
| Bestellingen `/admin/bestellingen` | Leest bestellingen en toont statusbedragen/tellingen; handmatige Wise-overschrijvingen kunnen worden gemeld door de klant en door een superadmin worden bevestigd. De bevestiging activeert entitlements en schrijft een auditgebeurtenis. | Maximaal 100 orders in deze pagina; geen apart orderdetail/tijdlijn, refund, levering retry of export. Automatische betaalproviderbevestiging is niet actief; de oude Mollie-webhook geeft 410. |
| Klanten `/admin/klanten` | Lijst/detail gebruiken profiles en orders; detail haalt Auth-e-mail, orders, entitlements, boekingen en AVG-verzoeken op. | `listAdminCustomers` selecteert profiles zonder customer-rolefilter (eerste 200), de ordertotalen zijn gebaseerd op maximaal 500 orders en hardcoded EUR; detailquery’s zijn elk begrensd. Geen klantmutaties, export, communicatievoorkeuren of uitvoering van verwijdering/anonimisering gevonden. |
| Producten `/admin/producten` | Aanmaken, lezen en wijzigen van titel, slug, type (`profile`, `module`, `ebook`), status, EUR-prijs, samenvatting en Wise-betaallink; validatie, rechtencontrole en audit zijn aanwezig. Gepubliceerd product met Wise-link is beschikbaar op dynamische `/aanbod/[slug]`-checkoutdetailpagina. | Geen delete-actie (archiveren is wel een status); geen mediaflow, btw-velden, geplande publicatie, productversies of echte reviewtransitie/reviewer. Status `review` is handmatig kiesbaar; geen reviewtransitie/reviewer of afzonderlijke `products.review`-controle aangetroffen. Producttabel heeft `metadata`, maar adminformulier beheert die niet. De openbare profiel-/modulecatalogi zijn aparte statische content; productbeheer vult die catalogi niet aan. DB-enum bevat ook oudere `guide`, `session`, `bundle`-typen; huidige adminlabels ondersteunen ze niet. |
| Content `/admin/content` | Artikel/pagina maken, lezen en wijzigen; filters, SEO-titel/beschrijving, interne preview en automatische databaseversiehistorie. Bij wijziging van slug van eerder gepubliceerde content wordt redirectrecord gemaakt; publieke artikelroute resolveert redirects. | Geen zichtbare media-bibliotheek, publicatieschema, versieherstel/compare of workflow met toegewezen reviewer en expliciete reviewtransitie. Versiehistoriepagina toont maximaal 20 versies en haalt geen versiebody op. `kind=page` kan in admin worden gepubliceerd, maar er is geen generieke Astro-publicatieroute gevonden die dit type uit `content_items` rendert; page-redirect wordt evenmin door gevonden public route opgelost. Body is een tekstveld en artikelrenderer zet tekst om in paragrafen. SEO-velden en beperkte artikelredirect bestaan al. |
| Boekingen `/admin/boekingen` | Lijst; toegestane statusovergangen lopen via serverroute en auditlog. | Query beperkt tot 200 (de pagina telt alleen die geladen records); geen aparte detailpagina of zichtbare e-mailnotificatie. Bestaande publieke MyGrowise-aanvraag en practitionerflow staan elders; externe bookingproviderbevestiging is niet aangetoond. |
| Agenda `/admin/agenda` | FullCalendar combineert niet-bewerkbare `pending`/`confirmed` boekingen als bron `mygrowise` met CRUD-bewerkbare kalenderblokken als bron `itransform`; datumbereik wordt server-side begrensd. | Geen externe kalenderintegratie aangetroffen. Het bewerken van `itransform` kalenderitems wijzigt geen bookingrecords; de agenda is dus geen synchronisatiepaneel. De editor noemt Praktijk Itransform. |
| Professionals `/admin/professionals` | Leest practitionerprofielen, actiefstatus, instellingen, beschikbaarheidsregels en open boekingsaantallen. | Lijst is read-only; uitnodigingsknop is uitgeschakeld; geen adminformulier voor profiel-/fee-/boekingslinkbeheer. |
| Profielen `/admin/profielen` | Route bestaat en is geregistreerd met contentleesrecht. | De pagina is expliciet een “Functionele blauwdruk”; de acties slaan niets op. |
| Modules `/admin/modules` | Route bestaat en is geregistreerd met contentleesrecht. | De pagina is expliciet een “Functionele blauwdruk”; de acties slaan niets op. |
| Berichten `/admin/berichten` | Klant-supportinbox en afzonderlijke interne berichten; status, prioriteit, toewijzing, reply/notitie, deelnemerstoegang en notificaties zijn geïmplementeerd. | Externe transactionele e-mail en SLA/retentiebeleid zijn hiermee niet aangetoond. Interne berichten zijn volgens documentatie niet voor cliëntgegevens bedoeld. |
| Instellingen `/admin/instellingen` | Doet een live publieke Supabase Auth-instellingencheck, toont SMTP als niet rechtstreeks uitleesbaar, Wise als handmatige betaalstroom en opgeslagen analytics-/boekings-/opslagstatus met bron en controledatum. Beheert de terugkerende backendkost “Hosting en gegevensbanken (backend)” (€240/jaar, volgende betaaldatum 21 september 2027), met afteller, bewerken, betaalregistratie, betaalgeschiedenis en audit. Operationele werkitems kunnen worden aangemaakt, toegewezen, gestart en afgerond. | SMTP-providerinstellingen blijven buiten de app en moeten in Supabase worden gecontroleerd. Opgeslagen integratiestatussen zijn alleen actueel bij een recente controledatum; dit is geen probe van alle providers. Werkitems kunnen niet worden heropend of bewerkt nadat ze zijn aangemaakt. |
| Gebruikers `/admin/gebruikers` | Supabase Auth-gebruikers tonen; teamaccount maken, rol wisselen en toegang schorsen/herstellen via serverfuncties/audit. Laatste superadmin is voor rolwijziging/schorsing beschermd. | Lijst haalt alleen eerste 100 Auth-gebruikers op; accountaanmaak verstuurt geen uitnodiging/e-mail. Inloggen gebruikt password flow en in-memory rate limiter. MFA/TOTP-enrollment/challenge niet aangetroffen in applicatiecode. |
| Privacy `/admin/privacy` | AVG-verzoek aanmaken vanaf klantdetail; status aanpassen; deadline en basisvelden tonen, mutaties geaudit. | Register is begrensd tot 100. Status kan direct naar elke toegestane enumwaarde, zonder transitielogica. Geen uitvoering van inzage/correctie/overdracht/verwijdering, verificatiebewijs of retentiejob. “30 d.” is een vaste UI-waarde en geen bewaargarantie. |

De expliciete blauwdrukmelding staat in de generieke route [`src/pages/admin/[section].astro`](../src/pages/admin/%5Bsection%5D.astro). De echte pagina’s met dezelfde namen als enkele definities in die routetabel zijn aparte pagina’s; beoordeel hun gedrag via hun eigen routes, niet via de inhoud van de generieke tabel.

### 3.2 Cross-cutting codebevindingen

- **Betaling gebruikt handmatige Wise-reconciliatie, niet een automatische callback.** De klant meldt een handmatige overschrijving; de superadmin controleert de ontvangst en bevestigt die. De database zet dan de order op betaald, activeert entitlements en schrijft audit. De oude hosted-Wise-route en Mollie-webhook zijn uitgeschakeld; de publieke `/profielen`- en `/modules`-catalogi blijven afzonderlijke statische content.
- **Ordergeld kan niet betrouwbaar als netto worden gerapporteerd.** Dashboardberekening telt ruwe ordertotalen van statussen `paid` en `fulfilled`, op maximaal 500 opgehaalde orders. Er is geen refund-ledger of refundbedrag gevonden; `partially_refunded` wordt niet in de som meegenomen. De som is niet op periode gefilterd en houdt geen rekening met valuta in de formattering.
- **“Sessies” zijn nu unieke identifiers.** Analytics-cookie duurt 180 dagen; berekening telt unieke `anonymous_id`-waarden binnen de geselecteerde periode. Er is geen sessie-id of sessie-timeout. Eventtotalen en unieke identifiers worden daarnaast samen in funnelstappen getoond zonder cohortkoppeling.
- **Eventbron is gedeeltelijk.** Publieke `/api/analytics` accepteert alleen `page_view`, `route_selected`, `product_viewed`, `checkout_started`, `professional_viewed` en `booking_clicked`; checkout schrijft zelf `checkout_started`. Geen van die paden schrijft `payment_succeeded`, `payment_refunded`, `entitlement_delivered` of `booking_confirmed`. Het dashboard gebruikt `payment_succeeded` voor conversie maar de applicatiecode produceert dat event niet. Query’s in de adminservice doen geen expliciete paginering.
- **Klantenlijst is niet op klantrol begrensd.** `listAdminCustomers` laadt `profiles` zonder koppeling/filter op `user_roles`; een profiel is op basis van deze query niet per definitie klant. Dezelfde lijst toont bedragen in EUR terwijl het orderschema een valutaveld per order heeft.
- **Mutatie en audit zijn losse databaseoperaties.** Verschillende services schrijven eerst het businessrecord en daarna audit. Er is geen transactie over die stappen; als de auditinsert faalt, kan de businessmutatie al zijn opgeslagen terwijl de route een fout teruggeeft. `writeSecurityAudit` neemt actor-e-mail op in metadata. Dat is interne persoonsgegevensverwerking en vereist dataminimalisatie/toegangs- en bewaarbeleid.
- **Beperkte eerste pagina’s.** Expliciete limieten zijn o.a. orders 100 (dashboard 500), boekingen 200, klantenprofielen 200, orders per klant 100, privacyverzoeken 100, content 250, supportconversaties 100, work items 12 en Supabase Auth-gebruikers 100. Er is geen algemene paginering in de genoemde adminlijsten; weergegeven totalen kunnen dus de volledige dataset niet aantonen.
- **Rechtenlijst is groter dan de routebezetting.** De actieve applicatierollen voor organisatiebeheer zijn alleen `super_admin` en `support`; `employee` krijgt geen reguliere `/admin`-rechten en heeft apart interne berichten/praktijktoegang. De permissieconstanten bevatten onder meer `orders.refund`, `customers.export`, `professionals.write` en `audit.read` zonder volledige bijbehorende workflow. `integrations.manage` beschermt nu het bewerken en als betaald registreren van terugkerende kosten, maar geeft geen toegang tot SMTP- of andere providercredentials. Er is geen auditlog-adminpagina gevonden.
- **Audit-/status-UI bevat vaste presentatie.** Zijbalk toont vaste `0`-badges voor orders en berichten; analytics markeert consent en route-events statisch “Actief”; dashboard zet alle recente activiteit op “Superadmin”. Deze labels zijn niet afgeleid van een live controle of juiste actorquery.
- **Loginbegrenzing is proceslokaal.** De admin-loginrate-limiter staat in een module-level `Map`; de implementatie deelt die teller niet aantoonbaar tussen serverless instances of deployments.
- **Support-toewijzing gebruikt een andere rolselectie dan teambeheer.** `listSupportAssignees` zoekt naar `super_admin`, legacy `admin` en `support`; de huidige beheerde `employee`-rol staat niet in die query. De uitnodigings-/teamroster- en support-ownerdoelen moeten worden afgestemd.
- De Wise-checkoutpagina toont statisch “Inclusief btw”, maar het productformulier beheert alleen een prijs en er is geen btw-configuratie/belastingberekening aangetroffen. De tekst bewijst geen berekende of gevalideerde belasting.

### 3.3 Beveiliging en platform

In code/migraties aanwezig:

- Astro middleware controleert sessie en deny-by-default routepermissies voor `/admin` en `/api/admin/*`.
- Serverhandlers controleren voor gevoelige acties daarnaast waar nodig specifieke rechten en trusted form origin.
- Supabase-tabellen zijn via migraties aangemaakt met RLS; service-role toegang hoort server-side te blijven.
- De applicatiematrix definieert rechten voor adminrollen; de code gebruikt rollen `super_admin`, `support`, `employee`, `practitioner` en `customer`.
- `super_admin` heeft in de applicatiematrix alle gedeclareerde rechten; `support` heeft een beperkte expliciete set. `employee` heeft geen organisatie-adminrol, maar kan via aparte middleware interne berichten gebruiken; `practitioner` valt onder `/praktijk`-scoping. Navigatiefiltering is aanvullende UX bovenop middleware, geen autorisatiegrens.
- Beveiligingsaudit en request-ID-context zijn aanwezig voor meerdere mutaties.
- Databaseobjecten omvatten onder meer producten, orders, orderregels, entitlements, boekingen, practitioners, audit, analytics, werkitems, integratiestatus, privacyverzoeken, support en interne communicatie.
- De migraties voorzien een private `product-assets`-bucket.

Nog niet vastgesteld of aangetroffen in applicatiecode:

- Werkende MFA/TOTP-enrollment- en challengeflow. Dat Supabase-configuratieopties bestaan is hiervoor geen bewijs.
- Volledige matrixdekking tussen rol, scherm en iedere API-mutatie. Rechten bestaan, maar orders-refunds, klant-export, professional-write en integrations-manage zijn bijvoorbeeld niet gelijk aan een aanwezige bijbehorende workflow. De Supabase `is_admin()`-RLS-functie geeft alleen `super_admin` als admin aan; routes die service-role gebruiken zijn daarom afhankelijk van juiste Astro-autorisatie.
- Live status van productievariabelen, Supabase, SMTP, betaling, deploy, back-ups, monitoring of integratieaccounts.
- Uitgevoerde hersteltest, securitytestmatrix of geautomatiseerde end-to-end dekking. Dit plan doet geen uitspraak over niet uitgevoerde controles.
- Of automatische migratieversies, data-imports en historische producttypen consistent zijn in de gekoppelde database. De productmigraties hebben DB-enums die ook `guide`, `session` en `bundle` bevatten, terwijl de huidige adminform alleen `profile`, `module` en `ebook` accepteert en labels toont.

## 4. Richting voor een high-end resultaat

“High-end” betekent hier een consistente werkervaring en betrouwbare bedrijfsuitkomst, niet alleen een visuele restyling. Elke module gebruikt hetzelfde patroon:

1. **Overzicht:** betekenisvolle samenvatting, zoeken/filteren en lege toestand.
2. **Detail:** volledige context voor één object, met status en geschiedenis.
3. **Actie:** heldere bevoegdheid, validatie, bevestiging waar nodig en server-side uitvoering.
4. **Terugkoppeling:** succes, fout, gedeeltelijke fout en herstelpad zijn herkenbaar.
5. **Controle:** actor, tijd, object en veilige voor/na-samenvatting zijn te auditen.

Elke pagina moet op mobiel en desktop bruikbaar zijn, toetsenbordfocus behouden, semantische status weergeven en laad-, leeg-, fout-, vertraagde en rechtenstaten hebben. Gevaarlijke acties zijn niet alleen visueel afgeschermd: API-autorisatie, invoervalidatie en audit zijn leidend.

## 5. Uitvoeringsvolgorde

Werk in verticale slices. Iedere slice levert een complete, reviewbare gebruikershandeling van scherm tot opslag en terugkoppeling. Begin een slice pas wanneer de genoemde invoer bekend of door bestaande code aantoonbaar geleverd is.

### Fase 0 — Werkkaart en uitvoeringsbasis

**Doel:** iedere volgende bijdrage laten starten vanuit dezelfde betrouwbare kaart.

- Houd route-/permission-/API-overzicht synchroon met `src/pages/admin`, `src/pages/api/admin`, `src/lib/adminPermissions.ts` en migraties.
- Behandel oudere overdrachts- en productplannen als context, niet als implementatiebewijs; registreer tegenstrijdigheden met actuele routecode en werk de bron bij zodra scope bevestigd is.
- Beschrijf per module bron-tabellen, statusovergangen, rechten, side effects, foutgedrag en auditactie.
- Maak onbekende provider-, klinische, financiële en juridische keuzes zichtbaar als beslispunten.
- Definieer ontwikkel-, test- en productieconfiguratie zonder secrets in code of browserbundel.

**Klaar wanneer:** een ontwikkelaar voor iedere adminactie kan aanwijzen welke pagina, API-handler, permissie, datalaag, migratie en fout-/auditgedrag erbij horen.

### Fase 1 — Autorisatie, audit en operationele betrouwbaarheid

**Doel:** een veilige, consistente basis voor risicovolle workflows.

- Maak een uitvoerbare permission matrix voor iedere route en elke GET/POST/PATCH/DELETE-actie; controleer ook API-mutaties expliciet op het benodigde recht.
- Controleer verschillen tussen applicatierollen, databaserollen en geregistreerde routes; sluit ongewenste toegang af op de server.
- Controleer verweesde permissies, routealiases en API-methodes; verifieer service-role mutaties los van de Supabase `is_admin()`-RLS-grens.
- Controleer niet-atomische businessactie/audit, auditfailure-terugkoppeling en actor-e-mail in metadata; maak vastgelegde wijziging en auditresultaat operationeel ondubbelzinnig.
- Vervang proceslokale loginrate limiting door een geschikte gedeelde limiet nadat deployment/runtime bekend is; valideer dat forwarded headers niet ongecontroleerd de enige limietsleutel bepalen.
- Stel vast of en welke MFA voor welke rollen verplicht is; implementeer pas na keuze en verificatie van ondersteunde Auth-flow.
- Normaliseer foutafhandeling, request-correlation, auditmetadata en idempotentie voor gevoelige mutaties.
- Voeg operationele observability toe: echte dependency checks, foutregistratie en incident-/herstelprocedure.
- Verifieer back-up- en restoreprocedure in de gekozen omgeving; de migratiehistorie alleen is geen herstelbewijs.

**Klaar wanneer:** positieve en negatieve autorisatietests aantonen dat iedere rol alleen de bedoelde pagina’s en acties kan gebruiken, en dat een mislukte provider-/databaseactie geen vals succes oplevert.

### Fase 2 — Product- en contentwerkplek afronden

**Doel:** het aanbod veilig zelfstandig onderhouden en publiceren.

- Behoud bestaande product create/read/update en contentversies als basis; inventariseer eerst werkelijk gebruikte producttypes en `metadata`-vormen.
- Leg vast welke bron leidend wordt voor de openbare aanbodcatalogus: databaseproducten of bestaande statische cataloguscontent. Vergelijk eerst de werkelijk gebruikte types, slugs en inhoud.
- Bepaal met de eigenaar welke velden voor de eerste verkoopbare producten nodig zijn; voeg alleen benodigde velden/schema toe.
- Maak een statusworkflow met bevoegdheden en expliciete transities. Onderscheid redactie, review en publicatie alleen waar de organisatie dit nodig heeft.
- Bepaal de revieweigenaar voor klinisch gevoelige inhoud; code mag de inhoudelijke norm niet verzinnen.
- Onderzoek private asset-bucket en implementeer upload, preview, rechtenmetadata en veilige levering alleen binnen afgesproken scope.
- Rond contentpreview, versieherstel, SEO-velden, geplande publicatie en redirectbeheer af op basis van redactionele behoefte.
- Maak CMS-`page` daadwerkelijk publiek renderbaar met slug-/statische-routeconflictcontrole en redirectafhandeling, of beperk de adminstatussen/types tot wat publiek kan worden weergegeven.
- Bouw **Profielen** als een versieerbare productworkflow met afzonderlijke versies van vragenlijst, logica en rapport. Resultaten blijven buiten algemene admin/analytics.
- Bouw **Modules** als product/lesstructuur met versiebeheer en toegang. Leg geen leertracking of voortgangsdetails vast voordat privacydoel en noodzaak bepaald zijn.

**Klaar wanneer:** bevoegde medewerker concept kan maken, laten beoordelen, previewen, publiceren en terugzetten; oude orders/productversies blijven interpreteerbaar. Profielen en modules slaan hun eigen domeinobjecten daadwerkelijk op.

### Fase 3 — End-to-end commerce

**Doel:** betaalde aankoop correct laten eindigen in toegang, met een herstelbaar spoor.

- Beslis expliciet of de bestaande vaste Wise QR-link wordt gecombineerd met gecontroleerde handmatige reconciliatie, of dat een provider met geautomatiseerde bevestiging wordt gekozen. Huidige Wise-code bewijst checkout-overdracht; geen van beide werkwijzen is hiermee als live aangetoond.
- Definieer vóór migraties de bron van waarheid voor order, betaalpoging, verificatiebewijs, refund en entitlement. Er zijn geen afzonderlijke payment/refund-ledger- of webhook-receipt-tabellen aangetroffen; voeg die alleen toe als het gekozen proces ze vereist.
- Verbind checkout, providerreferentie, orderstatus, geverifieerde betaalbevestiging, idempotente verwerking en audit. Een browserreturn of QR-linkopening kan de status niet afronden.
- Bouw orderdetail met statusgeschiedenis, orderregels, betaal-/refundstatus en leveringspogingen.
- Implementeer entitlementverstrekking exact één keer, veilige toegang en handmatige retry met audit.
- Voeg refundflow pas toe na zakelijke bevoegdheden, redenregistratie en providercontract te hebben vastgesteld.
- Koppel transactionele e-mail aan echte statusovergangen, afleverstatus en retrybeleid; verstuur geen mail vanuit een onbevestigde browserredirect.
- Reconcileer providertransacties met interne orders; behandel late, herhaalde en tegenstrijdige events.

**Klaar wanneer:** een gecontroleerde testorder van checkout via webhook tot entitlement en notificatie end-to-end slaagt; duplicate/late webhook en leveringsfout zijn veilig herstelbaar; bedragen sluiten aan op de providerbron.

### Fase 4 — Operationele verkoop- en klantafhandeling

**Doel:** schermen met gegevens uitbreiden tot veilige dagelijkse workflows.

- Voeg zoeken, filters, paginering en orderdetail toe met expliciete querylimieten.
- Beheer klanten op least-privilege basis; besluit welke contact-/factuurgegevens nodig zijn.
- Ontwerp export als aparte bevoegdheid, met reden, scope, waarschuwing en audit; bouw pas na goedkeuring van dataminimalisatie.
- Verbind supportgesprekken met klant/ordercontext zonder gezondheidsinhoud naar algemene notities of audit te kopiëren.
- Filter de klantenlijst op de vastgestelde klantidentiteit en toon bedragen in verschillende valuta niet als één EUR-totaal; implementeer paginering voor begrensde lijsten.
- Bouw privacyverzoeken uit tot procedurele taken met verantwoordelijke, verificatiestap, bewijs van uitvoering en goedgekeurde retentiejob.

**Klaar wanneer:** medewerker van signaal naar detail en toegestane actie kan gaan zonder data buiten het afgesproken doel te zien; privacyverzoek is traceerbaar van ontvangst tot gecontroleerde afhandeling.

### Fase 5 — Professionals, boekingen en agenda

**Doel:** duidelijke scheiding houden tussen aantoonbare referrals, aanvragen en bevestigde afspraken.

- Bepaal of admin-profielbeheer nodig is en welke velden professionals zelf mogen beheren.
- Bepaal bookingprovider, bevestigingsbron en eventuele fee-afspraak; geen externe synchronisatie veronderstellen.
- Maak per bookingactie een lifecycle met toegestane transities, notificaties en conflictgedrag.
- Verduidelijk agenda-bronnen en bewerkbaarheid: kalenderblokken, boekingen en eventuele externe agenda’s moeten ieder hun eigen bronstatus hebben.
- Toon klik, aanvraag en providerbevestiging als verschillende meetniveaus.

**Klaar wanneer:** dubbele boekingen en ongeldige transities worden server-side geweigerd; herkomst en bevestigingsniveau zijn zichtbaar; een bewerking in één bron wordt niet als synchronisatie van een andere bron gepresenteerd.

### Fase 6 — Dashboard en analytics betrouwbaar maken

**Doel:** beslissingen baseren op reproduceerbare cijfers.

- Definieer per metric formule, eventbron, periodegrenzen, consentvoorwaarde, uitsluitingen en “geen data”-gedrag.
- Reconcileer betaalde omzet uitsluitend met de overeengekomen interne/providerbron, inclusief refunds en valuta.
- Bouw de dashboardtrend vanuit dezelfde metricbron als de kaart; verwijder de vaste lege grafiek zodra echte data gevalideerd beschikbaar is.
- Definieer of een metric bezoeker, browser, bezoek/sessie of event telt. Voeg sessionisering alleen met afgesproken timeout, consent en deduplicatieregels toe; noem de huidige cookie-ID-telling niet stilzwijgend “sessies”.
- Scheid eventaantallen, unieke bezoekers/sessies en conversiestappen; bouw funnelcohorten met dezelfde identifiers en periode, of label stappen expliciet als losse eventvolumes.
- Voeg event-id/idempotentie, betrouwbare betaal-/leveringsbronnen en expliciete paginering/aggregatie toe voordat rapportage bedrijfsbesluiten ondersteunt.
- Maak ontbrekende bronnen en vertraagde data zichtbaar; toon geen hardcoded successtatus als echte check.
- Voeg datakwaliteit toe nadat event- en webhookstatus werkelijk meetbaar zijn.
- Houd identificeerbare/klinische informatie buiten rapportage en logs.

**Klaar wanneer:** metricdefinities vastliggen, rekenregels reproduceerbaar zijn, vergelijkingen op één tijdzone/cohort berusten en elke kaart status/bron/leeftijd van data toont.

### Fase 7 — Afwerking, toegankelijkheid en beheerbaarheid

**Doel:** consistente kwaliteit over de volledige admin.

- Maak design tokens, formulieren, tabellen, statusbadges, dialogs, notificaties en lege/foutstaten herbruikbaar.
- Valideer responsieve lay-out, keyboard-only flows, screenreaderlabels, focus, contrast en reduced motion.
- Beperk onverwachte full-page state loss; filters en relevante views moeten herstelbaar zijn via URL.
- Verwijder statische badges, vaste persoonsnamen en actieknoppen die niet tot een echte actie leiden.
- Documenteer releaseprocedure, migratierollback waar haalbaar, supporttriage en eigenaarschap.

**Klaar wanneer:** alle modules hetzelfde gedrag tonen voor laden, leeg, fout, rechten, succes en herstel; kritieke flows zijn bruikbaar met toetsenbord en op mobiel.

## 6. Moduleacceptatiekaart

Een module wordt pas als operationeel afgerond aangeduid als onderstaande punten aantoonbaar gelden:

- [ ] doel en gebruikers zijn vastgesteld;
- [ ] alle list-, detail- en mutatieroutes zijn opgesomd;
- [ ] elk scherm en iedere API-mutatie heeft expliciete serverautorisatie;
- [ ] invoervalidatie gebeurt server-side en foutmeldingen zijn bruikbaar;
- [ ] databron en migraties zijn versioned en omgevingsovergangen zijn bekend;
- [ ] statusovergangen en externe side effects zijn beschreven;
- [ ] succes, lege data, gedeeltelijke data, fout, rechten en retry zijn behandeld;
- [ ] audit bevat actor, actie, object en veilige context voor relevante mutaties;
- [ ] PII- en gezondheidsdatagrenzen zijn beschreven en nageleefd;
- [ ] kritieke paden zijn geverifieerd met passende geautomatiseerde en handmatige checks;
- [ ] eigenaar heeft workflow en scherm op echte taakinhoud beoordeeld;
- [ ] operationele runbook-/supportinformatie is bijgewerkt.

## 7. Werkvolgorde voor de eerstvolgende slices

1. Maak een machineleesbare of compacte handmatige route-permission-action matrix; los de rechten-/rolverschillen op en dek alle deny/allow-paden af.
2. Corrigeer eerst aantoonbaar misleidende data: dashboard netto-omzet, currency aggregation, analytics-sessielabel/conversie en klantrolfilter.
3. Verwijder of verbind statische UI-signalen: vaste adminnaam, vaste nulbadges, statische integratie-/consentstaten, lege omzetgrafiek, periodekeuze die cijfers niet filtert en knoppen zonder actie.
4. Bevestig bronmodel voor aanbod/content; sluit de CMS-page publicatieroute en catalogus-/productkoppeling op de gekozen scope.
5. Rond content-/productrollen en statusovergangen af op basis van concrete bedrijfsbehoefte.
6. Ontwerp en implementeer één echte producttype-slice end-to-end voor verkoopbare toegang, nadat betaal- en leveringsprocedure bekend zijn.
7. Gebruik die slice om orderdetail, betaalreconciliatie, idempotente statusverwerking, levering, supportactie en analytics-eventcontract te bouwen.
8. Bouw Profielen en Modules op de bewezen product-/toegangsgrondlaag.
9. Werk dashboard, analytics, klantoperaties, professionals en privacyafhandeling verder uit op echte brondata en goedgekeurde procedures.

Dit is een afhankelijkheidsvolgorde, geen schatting van kalenderduur. Externe providerkeuzes, juridische beoordeling en inhoudelijke review blijven expliciete beslispunten.

## 8. Eerst te bevestigen beslissingen

Beslis niet stilzwijgend tijdens implementatie:

1. Welke eerste producten worden daadwerkelijk verkocht en welke levering moeten ze krijgen?
2. Is Wise-only met gecontroleerde handmatige betalingstoewijzing voldoende, of is geautomatiseerde providerbevestiging vereist? Welke accountmogelijkheden, transactiebewijzen, refunds en tests zijn aantoonbaar beschikbaar?
3. Wie mag content/product reviewen en publiceren; is klinische goedkeuring vereist voor welke typen?
4. Welke gegevens en exportmogelijkheden zijn noodzakelijk voor support en administratie?
5. Welke bookingprovider is gezaghebbend voor aanvraag versus bevestigde afspraak?
6. Welke organisatiegebruiker heeft welke rol; moet MFA verplicht zijn en op welke wijze?
7. Welke bewaartermijnen en AVG-procedures zijn door de verantwoordelijke organisatie/jurist vastgesteld?
8. Welke e-mailprovider en operationele afzender zijn goedgekeurd?

Tot bevestiging daarvan bouwt een slice geen fictieve integratiestatus, financiële regel, medisch/klinisch beleid of retentiebeleid in.

## 9. Repositorykaart voor vervolgwerk

- Admin routes en shell: `src/pages/admin/`, `src/layouts/AdminLayout.astro`
- Admin endpoint handlers: `src/pages/api/admin/`
- Route- en rechtenmatrix: `src/lib/adminPermissions.ts`, enforcement in `src/middleware.ts`
- Product/content/data services: `src/lib/adminProducts.ts`, `src/lib/adminContent.ts`, `src/lib/superAdmin.ts`
- Analytics: `src/lib/adminAnalytics.ts`, `src/pages/api/analytics.ts`, `src/pages/admin/analytics.astro`
- Agenda/boekingen: `src/lib/adminAgenda.ts`, `src/pages/api/admin/agenda.ts`, `src/pages/api/admin/bookings/[id].ts`
- Berichten: `src/lib/supportInbox.ts`, `src/lib/internalMessaging.ts`, `src/pages/api/admin/support/[id].ts`, `src/pages/api/internal/messages/`
- Audit/auth/Supabase: `src/lib/securityAudit.ts`, `src/lib/adminAuth.ts`, `src/lib/supabase/`, `supabase/migrations/`
- Providerreferenties: `src/lib/wiseCheckout.ts`, `src/pages/api/checkout.ts`, `src/pages/api/webhooks/mollie.ts`
- Product- en technische eerdere context: `docs/MASTERPLAN.md`, `docs/BUILD-HANDOFF.md`, `docs/PRACTICE-PORTAL.md`, `docs/SUPABASE-OPERATIONS.md`

### Documentatieconflicten om bij te werken

- `docs/BUILD-HANDOFF.md` zegt dat de checkout-endpoints `503` retourneren en dat de site geen React-runtime gebruikt. De huidige code bevat een Wise-order/redirectflow in `/api/checkout` (terwijl `/api/payment-status` 503 en de Mollie-webhook 410 retourneert) en `UnifiedAgenda.tsx` gebruikt React/FullCalendar.
- Dezelfde handoff beschrijft contentbeheer als uitsluitend tijdelijke `src/content/site.ts`-data; er is nu ook een Supabase-backed admin voor producten en CMS-artikelen/pagina’s. Openbare aanbodcatalogi zijn op hun beurt nog statisch. Beide paden moeten apart worden benoemd.
- `docs/MASTERPLAN.md` bevat productdoelen en nog open beslissingen over CMS, Wise/PSP, levering en booking. Die stukken zijn geen bewijs dat keuzes zijn gemaakt of functies geïmplementeerd.
- `docs/PRACTICE-PORTAL.md` en `docs/SUPABASE-OPERATIONS.md` beschrijven praktijkisolatie en Supabase-grenzen die als bestaande technische context moeten worden behouden; eventuele afwijkingen moeten eerst worden onderzocht.

## 10. Bronbeperkingen

Deze nulmeting is afgeleid van lokale code en SQL-migraties in de repository op 24 september 2026. Voor deze update zijn de publieke Supabase Auth-instellingen en de status-/kostenrijen in de gekoppelde database alleen-lezen geraadpleegd. De SMTP-providerconfiguratie en -credentials, provideraccount, deploymentlogs en uitgevoerde back-ups zijn niet gecontroleerd. Een codepad bewijst dat een implementatie bestaat; het bewijst op zichzelf niet dat die in productie is ingeschakeld of correct geconfigureerd. Oudere documenten kunnen achterlopen; de verificatiestatus hierboven en actuele code zijn leidend totdat de andere docs zijn bijgewerkt.
