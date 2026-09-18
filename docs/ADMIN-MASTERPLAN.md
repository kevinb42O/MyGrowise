# MyGrowise Admin — product-, data- en uitvoeringsplan

Status: bouwreferentie 1.0  
Datum: 24 augustus 2026  
Route: `/admin`  
Doel: één rustige, veilige werkplek om omzet, aanbod, content en begeleiding te beheren.

## 1. Productbeslissing

Het dashboard wordt geen generiek CMS en geen medisch dossier. Het is het operationele controlecentrum van MyGrowise met vier taken:

1. zien wat vandaag aandacht nodig heeft;
2. begrijpen welke commerciële route werkt of lekt;
3. aanbod en website zelfstandig aanpassen;
4. elke gevoelige of financiële actie controleerbaar uitvoeren.

De visuele richting volgt het beste van het FabriceBoekenKunst-dashboard: een vaste zijbalk, compacte topbalk, wit canvas, lage visuele ruis, sterke informatiedichtheid en duidelijke lege/loading/fout-states. MyGrowise gebruikt zijn eigen groene merktoon, met roze en geel alleen als functionele accenten.

## 2. Niet-onderhandelbare grenzen

- Geen vragenlijstantwoorden, scores, vermoedelijke diagnoses of vrije hulpvraag in analytics.
- Geen therapeutische sessienotities in dit dashboard.
- Geen productiegegevens voordat authenticatie, rollen en auditlogging actief zijn.
- Geen omzet of conversie voorspiegelen wanneer de bron niet gekoppeld of onbetrouwbaar is.
- Geen betaling als “geslaagd” markeren op basis van de browserredirect; alleen een gevalideerde provider-webhook is leidend.
- Geen boeking als “bevestigd” markeren op basis van een uitgaande klik; alleen providerbevestiging is leidend.
- Publicatie van klinisch gevoelige productinhoud vereist een reviewstatus en verantwoordelijke reviewer.
- Alle beheerpagina’s krijgen `noindex`; productie beschermt `/admin` server-side, niet alleen in de interface.

## 3. Gebruikers en rollen

### 3.1 Rollen

| Rol | Doel | Standaardrechten |
|---|---|---|
| Eigenaar | volledige bedrijfsvoering | alle modules, rollen, integraties, terugbetalingen, export |
| Beheerder | dagelijkse operatie | alle content en verkoop; geen eigenaar verwijderen of providergeheimen tonen |
| Contentredacteur | website en aanbod | pagina’s, blogs, media, conceptproducten; geen prijzen publiceren zonder recht |
| Klinisch reviewer | inhoudelijke kwaliteitscontrole | producten beoordelen en goed-/afkeuren; geen financiële data nodig |
| Support/operations | klanten helpen | orders, levering, berichten; gemaskeerde/minimale persoonsgegevens |
| Professional | eigen profiel en leads | alleen eigen profiel, geaggregeerde eigen referrals en beschikbaarheid |
| Analist | rapportage | alleen geaggregeerde read-only analytics; geen klantrecords |

### 3.2 Autorisatieregels

- Deny by default: een recht moet expliciet aan een rol zijn toegekend.
- Server-side controle op iedere query en mutatie; verborgen knoppen zijn geen beveiliging.
- Hoog-risico acties vragen herauthenticatie: terugbetaling, rolwijziging, API-sleutel vervangen, bulkexport.
- Professionals worden altijd begrensd op `professional_id`.
- Exportrechten zijn apart van leesrechten.
- Auditlogs zijn append-only en niet wijzigbaar via de gewone admininterface.
- Eigenaar en beheerders gebruiken verplicht 2FA.

## 4. Informatiearchitectuur

### Overzicht

- Dashboard
- Analytics
  - Overzicht
  - Acquisitie
  - Funnels
  - Content
  - Datakwaliteit

### Verkoop

- Bestellingen
- Klanten
- Producten

### Begeleiding

- Boekingen/referrals
- Professionals

### Aanbod & content

- Profielen/vragenlijsten
- Modules
- Website & blogs

### Organisatie

- Berichten
- Instellingen
  - Gebruikers & rollen
  - Integraties
  - Bedrijfsgegevens
  - Analyticsregels
  - E-mailtemplates
  - Auditlog
  - Privacy & retentie

## 5. Dashboard `/admin`

### 5.1 Doel

Binnen tien seconden antwoord geven op:

- Hoeveel netto-omzet en betaalde orders zijn er in de gekozen periode?
- Waar zit de grootste conversielek?
- Zijn er mislukte betalingen of leveringen?
- Zijn er berichten, reviews of publicaties die actie vragen?
- Werken analytics, checkout, mail en boekingskoppeling correct?

### 5.2 Kerncijfers

1. **Netto-omzet** = geslaagde betalingen minus terugbetaald bedrag, exclusief testorders. Standaard inclusief btw tonen; tooltip specificeert dit.
2. **Betaalde bestellingen** = unieke orders met gevalideerde status `paid`, minus volledig terugbetaalde orders wanneer de zakelijke definitie dit vereist. Beide aantallen blijven drill-downbaar.
3. **Aankoopconversie** = unieke sessies met `payment_succeeded` / in-scope consented sessies. Toon `—` bij onvoldoende/ongeldige meetdata.
4. **Boekingsklikken** = unieke consented sessies met gevalideerd event `booking_clicked`. Dit is nadrukkelijk geen bevestigde boeking.

Elke kaart bevat: waarde, vergelijking met vorige gelijklange periode, bronstatus, tooltipdefinitie en doorklikfilter.

### 5.3 Actiecentrum

Prioriteitvolgorde:

1. betaling geslaagd maar levering mislukt;
2. provider-webhook faalt of loopt achter;
3. terugbetaling/dispuut vraagt opvolging;
4. nieuw supportbericht;
5. content wacht op klinische review;
6. publicatie staat klaar of is mislukt;
7. integratie of trackingkwaliteit verslechterd.

Elke actie toont eigenaar, leeftijd, deadline, objectlink en één primaire vervolgstap.

### 5.4 Overige panelen

- omzettrend met dag/week/maand-aggregatie;
- conversiefunnel per route;
- topaanbod op omzet, orders en productweergaven;
- recente activiteit uit audit- en business-events;
- systeemgezondheid: betalingen, e-mail, analytics, boekingen;
- lancering/checklist zolang kernintegraties ontbreken.

## 6. Analyticsontwerp

### 6.1 Meetprincipes

- First-party en dataminimaal.
- Consentstatus wordt op het moment van het event opgeslagen.
- Events zonder vereist consent komen niet in marketing-/gedragsrapportages.
- Geen sessiereplay, toetsaanslagopname of vrije-tekstcapture.
- URLs worden genormaliseerd; querystrings met mogelijke persoonsgegevens worden verwijderd.
- Producten gebruiken neutrale interne ID’s in events, geen medische labels in advertentieparameters.
- IP-adressen worden niet als rapportagedimensie bewaard; waar technisch nodig worden ze vóór opslag geminimaliseerd/gehasht volgens juridisch advies.
- Rapportages met kleine aantallen kunnen worden onderdrukt om herleidbaarheid te beperken.

### 6.2 Eventcatalogus

| Event | Trigger | Verplichte velden | Verboden velden |
|---|---|---|---|
| `page_view` | geldige routeweergave | `event_id`, `occurred_at`, `anonymous_id`, `path`, `referrer_class`, `consent_state` | volledige URL-query, formulierinhoud |
| `route_selected` | keuze zelfzorg/begeleiding | `route_key` (`self`/`care`) | reden, symptomen |
| `product_viewed` | productdetail zichtbaar | `product_id`, `product_type` | productantwoorden, score |
| `checkout_started` | server maakt checkout aan | `order_id`, `product_id`, `amount_minor`, `currency` | providergeheimen |
| `payment_succeeded` | gevalideerde webhook | `order_id`, `payment_id`, `amount_minor`, `currency` | kaart-/rekeningdetails |
| `payment_failed` | gevalideerde webhook | `order_id`, `failure_class` | ruwe providerpayload in analytics |
| `payment_refunded` | webhook/adminactie | `order_id`, `refund_amount_minor`, `reason_code` | vrije gevoelige tekst |
| `entitlement_delivered` | toegang werkelijk aangemaakt | `order_id`, `entitlement_id`, `delivery_channel` | downloadtoken |
| `professional_viewed` | profiel zichtbaar | `professional_id` | hulpvraag |
| `booking_clicked` | gecontroleerde uitgaande link | `professional_id`, `booking_provider` | agenda-inhoud |
| `booking_confirmed` | betrouwbare provider-webhook | `professional_id`, `booking_reference_hash` | naam, hulpvraag, sessienotitie |
| `content_published` | succesvolle publicatie | `content_id`, `content_type`, `actor_id` | conceptinhoud in analytics |

Voor alle events gelden: schema-versie, omgeving (`preview`/`production`), bron, user-agentklasse, grof apparaattype en botclassificatie.

### 6.3 Funnels

**Zelf aan de slag**

`consented_session → route_selected(self) → product_viewed → checkout_started → payment_succeeded → entitlement_delivered`

Conversies worden zowel vanaf sessie als vanaf vorige stap berekend. De periode gebruikt eventtijd; late webhooks worden met een zichtbaar “data bijgewerkt tot”-tijdstip verwerkt.

**Begeleiding**

`consented_session → route_selected(care) → professional_viewed → booking_clicked → booking_confirmed`

`booking_confirmed` wordt verborgen of als niet beschikbaar gemarkeerd zolang de provider geen betrouwbare terugkoppeling levert.

### 6.4 Acquisitie

Dimensies:

- source, medium en campaign op basis van geschoonde UTM-waarden;
- referrerdomeinklasse, niet noodzakelijk de volledige URL;
- landingspagina;
- organisch, direct, referral, e-mail, social en betaald;
- nieuw/terugkerend op geanonimiseerde first-party identifier;
- apparaatklasse en grof land/regio alleen wanneer juridisch en technisch verantwoord.

Rapportages:

- sessies, engaged sessions, productviews, checkoutstarts, betalingen, netto-omzet;
- conversie en opbrengst per sessie;
- first-touch en last-non-direct naast elkaar, nooit onbenoemd mengen;
- campagnekosten/ROAS pas na betrouwbare cost-import.

### 6.5 Contentanalytics

- landingspagina’s op consented sessies en conversie;
- blogartikelen op bereik en kwalitatieve vervolgstap;
- productpagina’s op view-to-checkout;
- professionals op profielview-to-booking-click;
- interne zoektermen alleen wanneer ze geen gevoelige vrije tekst kunnen bevatten; anders niet opslaan.

### 6.6 Datakwaliteit

Een apart scherm toont:

- laatste ontvangen event per type;
- schemafouten en weggegooide events;
- webhookvertraging p50/p95;
- aandeel onbekende consentstatus;
- interne/bottrafficfilterstatus;
- orders met discrepantie tussen betaling en levering;
- dubbele eventratio op `event_id`;
- versie van tracking- en eventschema;
- annotaties voor releases en campagnes.

Dashboardcijfers krijgen status `betrouwbaar`, `onvolledig`, `vertraagd` of `niet beschikbaar`.

## 7. Verkoopmodules

### 7.1 Bestellingen

Lijstkolommen: ordernummer, datum, klant, product, totaal, betaling, levering en bron. Filters: periode, producttype, betaalstatus, leveringsstatus, bedrag, test/live.

Orderdetail:

- tijdlijn van creatie, checkout, webhook, betaling, levering, e-mail en refund;
- financiële samenvatting in minor units (centen), nooit floats;
- providerreferenties gemaskeerd;
- toegangsrecht en vervaldatum;
- interne notitie met auteur/tijd;
- acties met bevestiging en idempotency key.

Statusmachines:

- order: `draft → pending_payment → paid → fulfilled`; zijpaden `cancelled`, `partially_refunded`, `refunded`, `disputed`;
- betaling: `created → pending → succeeded|failed|expired`, daarna optioneel refund/dispute;
- levering: `pending → processing → delivered|failed → retried`.

### 7.2 Klanten

Toont alleen wat support nodig heeft: naam, e-mail, facturatiegegevens indien vereist, orders, entitlements, communicatieconsent en privacyverzoeken. Geen vragenlijstdata. Duplicaten worden niet automatisch destructief samengevoegd.

AVG-acties: data-export, correctie, anonimisering/verwijderverzoek en wettelijke uitzondering, telkens met goedkeuring en auditlog.

### 7.3 Producten

Gemeenschappelijke velden:

- interne naam, publieke titel, slug, type, korte/lange omschrijving;
- prijs in minor units, valuta, btw-categorie;
- afbeelding/media, SEO, status en publicatievenster;
- leveringsmethode, versie en reviewer;
- cross-sell/gerelateerd aanbod.

Publicatiestatus: `draft → in_review → approved → scheduled|published → archived`. Een wijziging in klinische kerninhoud maakt eerdere goedkeuring ongeldig.

## 8. Begeleiding

### 8.1 Professionals

- profiel, foto, bio, talen, erkenning/kwalificaties;
- expertise als redactionele categorie, niet als diagnoseclaim;
- boekingslink/provider, actieve status en volgorde;
- fee-model met ingangsdatum en versie;
- eigen geaggregeerde referralrapportage;
- volledige wijzigingshistoriek.

### 8.2 Boekingen/referrals

Er zijn drie betrouwbaarheidsniveaus:

1. profiel bekeken;
2. boekingslink geklikt;
3. extern bevestigd.

De interface benoemt altijd het niveau. Een klik wordt nooit automatisch een lead of afspraak genoemd. Persoonsgegevens uit de agenda worden alleen binnengehaald als dit noodzakelijk, contractueel geregeld en juridisch goedgekeurd is.

## 9. Profielen en modules

### 9.1 Profielen/vragenlijsten

Beheer scheidt vier objecten:

- verkoopproduct;
- vragenlijstversie;
- score-/interpretatieregelset;
- rapportsjabloon.

Een gepubliceerde aankoop blijft reproduceerbaar met de toen geldige versies. Nieuwe versies overschrijven historische resultaten niet. Resultaatgegevens horen in een apart, zwaarder beveiligd domein en zijn standaard niet zichtbaar in commerciële adminrollen.

### 9.2 Online modules

Structuur: module → hoofdstuk → les → blok/download. Per module: prijs, toegangstermijn, publicatiestatus, teaser, leerdoelen en review. Analytics blijft geaggregeerd (start/voltooiing per les of module) en vermijdt gevoelige reflectie-inhoud.

## 10. Website & content

Het CMS ondersteunt:

- pagina’s uit toegestane sectieblokken;
- blogs met auteur, categorie, cover, samenvatting, SEO en planning;
- FAQ, testimonials met bewijs van toestemming, navigatie en footer;
- media met alt-tekst, bron/rechten, afmetingen en automatisch geoptimaliseerde varianten;
- redirects bij slugwijziging;
- previewlink die niet indexeerbaar is;
- revisiehistorie, vergelijken en herstellen;
- concept → review → gepland → gepubliceerd → gearchiveerd.

Prijswijzigingen tonen vooraf gevolgen voor btw en actieve checkoutlinks. Historische orders bewaren hun oorspronkelijke prijs.

## 11. Berichten en support

Inboxstatus: `nieuw`, `in_behandeling`, `wacht_op_klant`, `opgelost`, `gesloten`. Elk gesprek heeft eigenaar, prioriteit, tags, SLA-timer en interne notities. Medische inhoud wordt niet aangemoedigd in het contactformulier; urgente situaties krijgen vaste doorverwijzingstekst.

E-mailverzending registreert templateversie, aflevering en foutklasse, niet onnodig de volledige berichtinhoud in analytics.

## 12. Datamodel

Kernentiteiten:

- `admin_users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`;
- `products`, `product_versions`, `prices`, `questionnaire_versions`, `report_templates`;
- `modules`, `chapters`, `lessons`, `lesson_blocks`;
- `orders`, `order_lines`, `payments`, `refunds`, `entitlements`, `delivery_attempts`;
- `customers`, `customer_consents`, `privacy_requests`;
- `professionals`, `professional_versions`, `booking_referrals`, `fee_agreements`;
- `content_items`, `content_versions`, `media_assets`, `redirects`;
- `conversations`, `messages`, `support_assignments`;
- `analytics_events`, `analytics_sessions`, `analytics_daily_rollups`, `event_rejections`;
- `integration_connections`, `webhook_receipts`, `system_health_checks`;
- `audit_log`.

Belangrijke technische regels:

- UUID/ULID als publieke identifiers; oplopende interne nummers alleen waar nuttig.
- Geld als integer `amount_minor` plus ISO-valuta.
- Tijden in UTC opslaan, in Europe/Brussels tonen.
- Webhooks bewaren provider-event-ID en unieke constraint voor idempotentie.
- PII scheiden van analytics-events.
- Soft delete alleen waar zakelijk/juridisch passend; anonimisering is een expliciete workflow.
- Elke wijzigbare hoofdentiteit krijgt `created_at`, `updated_at`, `created_by`, `updated_by` en versie.

## 13. Integraties

### Betalen

Wise mag niet zonder verificatie als webshop-checkout worden aangenomen. Voor implementatie moet worden vastgesteld welke Wise-functionaliteit en het specifieke account in België werkelijk ondersteunen: klantcheckout, betaalmethodes, redirects, webhooks, refunds, btw/facturen en sandbox. Als dat niet volstaat, is een erkende PSP nodig; uitbetaling kan mogelijk nog naar Wise lopen.

### E-mail

Transactionele provider met SPF, DKIM, DMARC, webhookstatus, templateversies en retrybeleid. Kritieke levering heeft dead-letter queue en adminactie.

### Boeken

Provider moet minimaal gecontroleerde links ondersteunen. Voor bevestigde-bookinganalytics is een ondertekende webhook of betrouwbare API nodig.

### Analytics

Voorkeur voor first-party eventendpoint en eigen geaggregeerde rapportage. Externe tooling kan aanvullend, mits DPA, EU-datastroom, consentgedrag en gevoelige-categoriebeleid passen.

## 14. Veiligheid en compliance

- 2FA voor hoge rollen; korte sessieduur en rotatie van refresh tokens.
- CSRF-bescherming, secure/httpOnly/sameSite cookies en rate limiting.
- Content Security Policy en strikte allowlist voor externe scripts.
- Secrets uitsluitend server-side; nooit in browserbundel of auditdetails.
- Uploadvalidatie op type, grootte, malware en metadata.
- Encryptie in transit en at rest; back-up plus hersteltest.
- Audit op login, export, refund, publicatie, rol-, prijs- en integratiewijziging.
- DPA/verwerkersovereenkomst per provider en register van verwerkingsactiviteiten.
- Bewaartermijnen per gegevenscategorie, met automatische jobs en rapportage.
- Incidentprocedure met eigenaar, ernst, tijdlijn en notificatiebesluit.

Juridische en klinische keuzes worden vóór productie gevalideerd door bevoegde adviseurs; de software doet geen medische of juridische aannames.

## 15. UX-contract

Iedere module implementeert:

- desktop, tablet en mobiel zonder horizontale paginascroll;
- toetsenbordbediening en zichtbare focus;
- semantische koppen, labels, tabelbijschriften en status zonder kleur alleen;
- skeleton/loading, lege state, gedeeltelijke data, foutstate, offline/vertraagd en rechtenstate;
- optimistic UI alleen wanneer terugdraaien veilig is;
- bevestigingsdialogen die object, gevolg en onomkeerbaarheid benoemen;
- toast als aanvulling, nooit als enige bevestiging van kritieke actie;
- filters in URL zodat views deelbaar/herstelbaar zijn;
- lokale datum-/geldnotatie en expliciete tijdzone bij relevante acties.

## 16. Fasen en afhankelijkheden

### Fase A — fundament (huidige slice gestart)

- adminshell, responsieve navigatie en design tokens;
- dashboard- en analyticsblauwdruk;
- datamodel en eventcontract;
- preview/empty states en `noindex`.

### Fase B — beveiliging en kernplatform

- authenticatie, 2FA, rollen/rechten en server-side guards;
- database, migraties, auditlog en omgevingenscheiding;
- error monitoring, back-up en secretsbeheer.

### Fase C — zelfbeheer

- producten, profielen, modules;
- website, blogs, media, SEO en preview;
- revisies, review en publicatie.

### Fase D — commerce

- definitieve providerkeuze na Wise-validatie;
- orders, checkout, webhooks, refunds en entitlements;
- transactionele mail en leveringsretries;
- volledige testmatrix inclusief dubbele/late webhook.

### Fase E — analytics

- consentmanager en first-party events;
- sessie-, acquisitie- en funnelaggregaties;
- datakwaliteit, interne traffic en annotaties;
- reconciliatie van omzet tegen payment ledger.

### Fase F — begeleiding en operations

- professionals, bookinglinks/providerkoppeling;
- referralrapportage en fee-overzicht;
- supportinbox, privacyverzoeken en organisatie-instellingen.

## 17. Acceptatiecriteria voor MVP

1. Onbevoegde bezoeker kan geen enkele `/admin`-response met bedrijfsdata ontvangen.
2. Rollen slagen voor een server-side permissionsmatrix; negatieve tests bestaan per mutatie.
3. Virginie kan zonder code een product, prijs, blog en FAQ wijzigen en vooraf bekijken.
4. Publicatie is versieerbaar en herstelbaar.
5. Een testorder doorloopt checkout → webhook → paid → entitlement → e-mail exact één keer, ook bij dubbele webhook.
6. Mislukte levering verschijnt binnen één dashboardrefresh als actie en kan veilig worden herprobeerd.
7. Omzet in dashboard reconcileert met de payment ledger voor dezelfde periode.
8. Geen verboden gezondheids- of vrije-tekstvelden verschijnen in analytics-events of logs.
9. Funnels tonen `—` in plaats van misleidende percentages bij ongeldige/no-data denominators.
10. Bookingklik en bookingbevestiging worden aantoonbaar apart gerapporteerd.
11. Alle kernflows zijn toetsenbordbedienbaar en slagen op relevante WCAG 2.2 AA-controles.
12. Desktop, tablet en mobiel hebben geen kritieke layoutoverflow.
13. Auditlog bevat actor, actie, object, tijd, voor/na-samenvatting en request-ID voor hoge-risico wijzigingen.
14. Restore van back-up en rollback van publicatie zijn getest.

## 18. Open beslissingen vóór livebouw

- Welke exacte Wise-producten en API-/webhookmogelijkheden zijn op het account beschikbaar?
- Welke landen, valuta, btw-regels en factuureisen gelden bij lancering?
- Worden profielen direct na betaling ingevuld of via een aparte beveiligde klantomgeving?
- Welke bookingprovider gebruiken de professionals, en levert die bevestigingswebhooks?
- Wie heeft formeel klinisch reviewrecht en wat maakt een herreview verplicht?
- Welke dataretentie is per product, betaling, analytics en support juridisch nodig?
- Welke naam en afzenderdomeinen gebruikt transactionele e-mail?
- Is er een fee per lead, bevestigde boeking, maandabonnement of hybride model voor professionals?

Deze beslissingen blokkeren niet het beheer- en contentfundament, maar wel een betrouwbare commerce- en bookingimplementatie.
