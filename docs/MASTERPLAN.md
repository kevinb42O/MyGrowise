# MyGrowise — masterplan voor herbouw en lancering

**Versie:** 1.0  
**Datum:** 24 augustus 2026  
**Status:** beslis- en uitvoeringsplan; nog geen goedgekeurde scope  
**Hoofddoel:** van een informatieve, versnipperde site naar een beheersbaar verkoop- en boekingsplatform dat aantoonbaar inkomsten genereert zonder klinische, juridische of operationele risico's te negeren.

---

## 1. Managementsamenvatting

MyGrowise heeft niet één, maar drie verschillende producten:

1. een webshop voor digitale psychologische producten (profielen, vragenlijsten, e-book en modules);
2. een vind- en boekingsplatform voor online begeleiding;
3. op termijn een B2B-platform voor aangesloten professionals.

Die producten mogen onder één merk leven, maar hebben verschillende gebruikers, koopmotieven, regelgeving, datastromen en conversiepaden. De nieuwe website krijgt daarom één heldere merkbelofte met twee primaire routes:

- **Zelfstandig aan de slag:** ontdekken → product kiezen → betalen → toegang ontvangen;
- **Persoonlijke begeleiding:** hulpvraag herkennen → professional vergelijken → afspraak boeken.

Het B2B-luik wordt in de eerste lancering bewust secundair gehouden. Het is wel voorbereid in de architectuur, maar mag de primaire omzetfunnels niet vertroebelen.

### Aanbevolen strategie

- Bouw de bestaande Webnode-site niet verder uit en plaats er ook geen losse voorpagina voor. Dat creëert twee systemen, inconsistente navigatie, dubbele analytics, SEO-problemen en extra beheer.
- Gebruik het huidige Astro-project alleen als visueel/prototypisch materiaal. Het is geen productieklare basis.
- Bouw één nieuw platform met een gestructureerd, visueel CMS waarin de eigenaar zelfstandig producten, prijzen, professionals, pagina's, blogs en FAQ's beheert.
- Lanceer eerst een **Revenue MVP**: productcatalogus, echte productpagina's, checkout/levering, professionals, boekingslinks, content/SEO en analytics.
- Voeg pas daarna complexe vragenlijstscoring, een leeromgeving, community, interne agenda's en partnerafrekening toe.

### Drie beslissingen die vóór bouw vast moeten staan

1. **Betaling:** bedoelt de klant “de klant rekent af in Wise” of “het geld moet uiteindelijk op de Wise Business-rekening landen”? Wise biedt geen publieke API voor een volwaardige geautomatiseerde webshopcheckout. Dit verschil bepaalt de hele orderarchitectuur.
2. **Professionalsmodel:** een percentage of vergoeding per aangebrachte therapiecliënt is deontologisch risicovol. De Belgische code vermeldt dat een psycholoog geen commissie aanbiedt of aanvaardt voor doorverwijzingen. Werk daarom voorlopig met een vaste, transparante platform-/marketing-/softwarefee, onder voorbehoud van juridisch en deontologisch advies.
3. **Productverantwoordelijkheid:** per vragenlijst moet worden bevestigd wie de klinische eigenaar is, welk instrument wordt gebruikt, of er licentierechten zijn, welke claims toegestaan zijn en of het om screening, psycho-educatie of diagnostiek gaat.

---

## 2. Nulmeting

### 2.1 Live website

De live website bevat nuttige inhoud en authentieke beelden, maar is niet ingericht als omzetmachine.

Belangrijkste vaststellingen:

- de homepage probeert profielen, modules, community, therapie, professionals en het kwaliteitskader tegelijk uit te leggen;
- er is boven de vouw geen duidelijke primaire koop- of boekingsactie;
- complete secties worden visueel herhaald;
- er staan meerdere H1's, lege koppen en onlogische headingniveaus op pagina's;
- navigatie bevat te veel opties en overlappende termen;
- meerdere links gebruiken inconsistente of foutieve URL-patronen;
- een belangrijke homepage-link naar `/nl/onlinepsycholoog/` geeft een 404;
- Nederlandse knoppen verwijzen naar een Spaanse `/contacto/`-pagina;
- de prijspagina maakt prijzen niet betrouwbaar machineleesbaar of scanbaar;
- modulebestelling verwijst naar een andere taal-/URL-variant van de prijspagina;
- de sitemap bevat dubbele talen, oude URL's, demo-achtige Spaanse producten en irrelevante productnamen;
- de site heeft wel een winkelwagen, maar productkeuze en checkout zijn niet de natuurlijke eindpunten van de content;
- de visuele hiërarchie, witruimte, typografie en herhaling maken mobiel en desktop onnodig lang en moeilijk scanbaar;
- bewijsvoering (kwalificaties, methodologie, proces, resultaten, voorwaarden) staat verspreid en is niet gekoppeld aan het beslismoment.

### 2.2 Huidige lokale code

De workspace is een AI-prototype in Astro met React-eilanden, Tailwind, Mollie en Supabase-stubs. Bruikbare elementen zijn het beeldmateriaal, een eerste componentinventaris en een richting voor de huisstijl. Niet productiegeschikt zijn onder andere:

- `npm run build` faalt door ongeldige imports naar `AuthForm`;
- producten, professionals, beschikbaarheid en boekingen zijn hardgecodeerde mockdata;
- datums en agenda's zijn statisch en al verlopen;
- de checkout gebruikt Mollie in plaats van de vereiste Wise-route;
- bij ontbrekende configuratie kan een mockbetaling als “paid” eindigen;
- het boekingsendpoint vertrouwt bedragen en commissiepercentages uit de browser;
- het boekingsendpoint markeert een boeking direct als betaald;
- boekingen worden alleen in procesgeheugen bewaard en verdwijnen bij herstart;
- er is geen voorraad-/slotlocking, waardoor dubbele boekingen mogelijk zijn;
- contact, downloads en enkele activaties zijn alleen visuele demo's met `alert()`;
- wettelijke links in de footer wijzen naar `#`;
- registratienummers, erkenningen, prijzen, terugbetaling en beschikbaarheid lijken gegenereerde aannames en moeten door de klant worden bevestigd;
- er ontbreekt een echte contentrepository, database-migratie, e-mailservice, observability, testset en deploymentconfiguratie;
- er is geen gitrepository in de workspace, dus ook geen betrouwbare wijzigingshistoriek of rollbackpad.

**Conclusie:** behoud alleen gevalideerde copy, foto's en enkele ontwerpideeën. Behandel alle feiten, prijzen, claims, diploma's, registraties, testimonials en beschikbaarheden als onbevestigd totdat de klant ze schriftelijk goedkeurt.

---

## 3. Productvisie en positionering

### 3.1 Kernbelofte

Werkhypothese voor de positionering:

> Begrijp wat er bij jou gebeurt en kies de ondersteuning die nu past — zelfstandig of met een erkende professional.

De belofte combineert inzicht en begeleiding, zonder diagnose te suggereren en zonder alle productcategorieën in de hero op te sommen.

### 3.2 Primaire doelgroepen

#### A. De zelfstarter

- ervaart stress, overprikkeling, emotionele belasting of relationele patronen;
- wil eerst zelf begrijpen wat er speelt;
- zoekt privacy, duidelijkheid en een concrete uitkomst;
- koopt een profiel, vragenlijst, e-book of module.

#### B. De hulpzoeker

- wil sneller met een geschikte professional spreken;
- wil weten wie past bij de hulpvraag, wat het kost en wanneer er plaats is;
- boekt een intake of klikt door naar een beveiligde externe agenda.

#### C. De geïnteresseerde, nog niet koopklaar

- komt via Google, social of een verwijzing;
- leest educatieve content of doet een veilige, niet-diagnostische zelfcheck;
- schrijft zich eventueel in voor e-mail en wordt rustig naar passend aanbod geleid.

#### D. De professional

- zoekt zichtbaarheid, inhoudelijk kader en administratieve ondersteuning;
- krijgt een aparte informatiepagina en aanvraagflow;
- is geen primaire homepageboodschap tijdens de Revenue MVP.

### 3.3 Aanbodladder

Een logisch aanbod voorkomt dat bezoekers meteen tussen zeven onvergelijkbare producten moeten kiezen.

| Niveau | Doel | Voorbeelden | Indicatieve actie |
|---|---|---|---|
| Gratis | vertrouwen en oriëntatie | artikel, audio-oefening, korte niet-diagnostische check | “Ontdek waar je kan starten” |
| Laagdrempelig | eerste betaalde stap | e-book, mini-module | “Direct toegang” |
| Kernproduct | persoonlijk inzicht | stress-/emotieprofiel, relatieprofiel | “Bekijk wat je ontvangt” |
| Verdieping | gedragsverandering | online module of bundel | “Start op je eigen tempo” |
| Persoonlijk | professionele begeleiding | intake, vervolgconsult | “Vind een professional” |

Prijzen en bundels worden pas vastgezet na een eenvoudige margesheet met btw, betaalfee, licentiekost, interpretatietijd, supporttijd en terugbetalingsrisico.

### 3.4 Niet doen in de eerste versie

- geen diagnostische beloftes voor ADHD, autisme, burn-out of trauma;
- geen zeven vragenlijsten lanceren voordat één vragenlijst end-to-end klinisch, technisch en commercieel bewezen is;
- geen eigen videobelplatform bouwen;
- geen community bouwen zonder moderatie-, crisis- en privacybeleid;
- geen interne marktplaatsafrekening bouwen voordat het professionalsmodel is goedgekeurd;
- geen agressieve scarcity, aftelklokken of schuld-/angstmarketing in een zorgcontext;
- geen AI die autonoom klinische scores interpreteert of behandeladvies schrijft.

---

## 4. Conversiestrategie

### 4.1 Homepage

De homepage is een keuzepagina, geen encyclopedie.

Aanbevolen volgorde:

1. **Hero:** één belofte, korte onderbouwing, twee CTA's: “Zelfstandig aan de slag” en “Persoonlijke begeleiding”.
2. **Vertrouwensstrip:** geverifieerde professionele kwalificaties, veilige verwerking, transparante prijzen; alleen aantoonbare claims.
3. **Herkenning:** drie tot vijf concrete situaties waarin bezoekers zichzelf herkennen.
4. **Twee routes:** visueel evenwaardig maar inhoudelijk gescheiden.
5. **Aanbevolen startpunt:** één kernproduct met duidelijke deliverables, tijdsduur en prijs.
6. **Zo werkt het:** maximaal drie stappen per route.
7. **Professionals:** compacte selectie met specialisme, doelgroep, prijs en eerstvolgende mogelijkheid of externe boekingsknop.
8. **Methodologie en grenzen:** wat MyGrowise wel en niet doet.
9. **Sociaal bewijs:** alleen met aantoonbare toestemming; geen misleidende gezondheidsuitkomsten.
10. **FAQ:** aankoop, privacy, levering, begeleiding, crisis en terugbetaling.
11. **Slot-CTA:** herhaal de twee routes.

### 4.2 Productfunnel

`Landingspagina/artikel → categorie of keuzehulp → productdetail → checkout → betaling → bevestiging → toegang → opvolging`

Iedere productpagina bevat:

- voor wie het is en voor wie niet;
- het probleem in gewone taal;
- precies wat de klant ontvangt;
- werkwijze en benodigde tijd;
- wetenschappelijke/klinische basis, genuanceerd beschreven;
- voorbeeld of preview van het resultaat;
- prijs inclusief belastingen;
- levermoment en toegangsduur;
- privacy en gegevensgebruik;
- herroepings-/annuleringsinformatie;
- FAQ en support;
- één primaire koopknop die op mobiel sticky mag worden;
- relevante cross-sell pas na de kernbeslissing.

### 4.3 Begeleidingsfunnel

`Hulpvraag → passende professional(s) → profiel → afspraaktype → beveiligde agenda → bevestiging`

In de Revenue MVP blijven agenda, intake en klinische communicatie bij voorkeur in de bestaande professionele cliëntenomgeving. De publieke site stuurt alleen minimale niet-klinische context door en meet een geanonimiseerde uitgaande boekingsklik. Een echte interne boekingsengine komt pas na verificatie van privacy, agenda-integraties, annulaties, slotlocking, rollen en beroepsgeheim.

### 4.4 Lead nurturing

Alleen met expliciete toestemming en zonder antwoorden op psychologische vragen als marketingprofiel te gebruiken.

Voorbeeldreeks:

1. aangevraagde oefening of gids leveren;
2. uitleggen hoe stress/overbelasting zich kan tonen;
3. de twee startroutes uitleggen;
4. relevant kernproduct of begeleiding tonen;
5. rustige herinnering, daarna normale nieuwsbriefcadans.

Geen retargeting op basis van bezochte gevoelige onderwerpen zonder gespecialiseerde privacybeoordeling.

---

## 5. Informatiearchitectuur

### 5.1 Hoofdnavigatie

- Zelf aan de slag
- Begeleiding
- Kennisbank
- Over MyGrowise
- CTA: Vind jouw startpunt

Secundair in utility/footer:

- Voor professionals
- Contact
- Inloggen
- Privacy
- Cookies
- Algemene voorwaarden
- Herroeping/annulatie
- Toegankelijkheid
- Crisisinformatie

### 5.2 Sitemap voor Revenue MVP

```text
/
├── /zelf-aan-de-slag
│   ├── /profielen
│   │   └── /profielen/[slug]
│   ├── /modules
│   │   └── /modules/[slug]
│   └── /ebooks/[slug]
├── /begeleiding
│   ├── /professionals
│   │   └── /professionals/[slug]
│   └── /hoe-werkt-online-begeleiding
├── /kennisbank
│   ├── /thema/[slug]
│   └── /artikel/[slug]
├── /over-mygrowise
├── /voor-professionals
├── /contact
├── /checkout
├── /bestelling/[referentie]
├── /account
│   ├── /bibliotheek
│   └── /bestellingen
└── /juridisch/*
```

### 5.3 SEO-migratie

- exporteer alle huidige URL's uit sitemap, Search Console en analytics;
- bepaal per URL: behouden, samenvoegen, 301-redirecten of 410;
- maak één canonieke Nederlandse URL-structuur;
- verwijder demo-/Spaanse productpagina's uit index en sitemap;
- herstel hreflang alleen als beide talen volledig en inhoudelijk equivalent bestaan;
- migreer titels, descriptions, headings, altteksten en interne links;
- voeg Organization, Person, Article, Breadcrumb en waar passend Product/Service structured data toe;
- gebruik geen Review schema voor niet-toegestane of onbewezen gezondheidsreviews;
- lever XML-sitemap, robots.txt, canonicals en redirecttest mee;
- monitor 404's, indexatie en rankings gedurende minstens zes weken na launch.

---

## 6. CMS en eigen beheer

### 6.1 Advies

Gebruik één gestructureerd headless CMS met visuele preview naast de Astro-frontend. Voorkeursrichting: **Sanity Studio** of een vergelijkbaar beheerd CMS, pas definitief kiezen na een korte hands-on test met de klant.

Waarom niet Webnode behouden:

- de nieuwe funnels vereisen relaties tussen producten, professionals, thema's en artikelen;
- prijs, beschikbaarheid en juridische tekst moeten op één plaats beheerd worden;
- checkout en levering vragen betrouwbare identifiers en webhooks;
- SEO-migratie en analytics worden onnodig complex over twee platformen;
- één losse voorpagina lost de structurele problemen achter die voorpagina niet op.

Waarom niet alles in Supabase beheren:

- Supabase is geschikt voor transacties en accounts, niet als vriendelijke redactionele omgeving;
- de klant heeft previews, validatie, concepten, planning en duidelijke formulieren nodig.

### 6.2 CMS-contentmodellen

- **Pagina:** titel, slug, SEO, hero, modulaire secties, CTA, publicatiestatus;
- **Product:** type, titel, slug, prijs, btw-regel, status, doelgroep, deliverables, duur, preview, FAQ, gerelateerde producten, checkout-ID;
- **Vragenlijst:** versie, klinisch eigenaar, instrument/licentie, doelgroep, disclaimer, score-engine-ID, resultaattemplate;
- **Module:** lessen, duur, media, werkboek, toegangsduur, vereisten;
- **Professional:** naam, geverifieerde titel, registratie, expertise, doelgroep, talen, prijs, foto, boekingslink, status;
- **Artikel:** auteur, reviewer, reviewdatum, thema, leestijd, bronnen, medische disclaimer;
- **FAQ:** vraag, antwoord, categorie, relevante pagina's;
- **Testimonial:** tekst, context, toestemming, vervaldatum, anonimiseringsniveau;
- **Juridisch document:** type, versie, ingangsdatum, eigenaar;
- **Redirect:** oude URL, nieuwe URL, type, gecontroleerd op;
- **Site-instelling:** contact, crisisinfo, social links, globale meldingen.

### 6.3 Rollen en workflow

- **Eigenaar:** alles beheren en publiceren;
- **Redacteur:** pagina's, blogs, FAQ en media;
- **Klinisch reviewer:** inhoud en claims goedkeuren;
- **Technisch beheerder:** schema's, integraties en deployment;
- **Professional:** alleen eigen publieke profielgegevens voorstellen/wijzigen, indien later nodig.

Workflow: `Concept → klinische review indien nodig → preview → publicatie → periodieke review`.

### 6.4 Acceptatiecriteria eigen beheer

De klant moet zonder developer binnen tien minuten kunnen:

- een prijs wijzigen met geplande publicatiedatum;
- een product dupliceren en als concept bewaren;
- een professional pauzeren;
- een blog publiceren met SEO-preview;
- een FAQ aan twee pagina's koppelen;
- een afbeelding correct croppen en alttekst invoeren;
- de wijziging in preview zien;
- een fout herstellen via versiegeschiedenis.

Deze taken worden tijdens oplevering door de klant zelf uitgevoerd. Pas dan is “zelf beheerbaar” bewezen.

---

## 7. Technische doelarchitectuur

### 7.1 Componenten

| Verantwoordelijkheid | Aanbevolen systeem |
|---|---|
| Publieke frontend | Astro met selectieve React-interactiviteit |
| Redactionele content | beheerd headless CMS met preview |
| Accounts, orders, rechten | relationele database/auth, bijvoorbeeld Supabase |
| Digitale assets | private object storage met tijdelijke signed URLs |
| Betaling | beslispoort Wise versus PSP + Wise-uitbetaling |
| E-mail | transactionele e-mailprovider met EU/DPA-beoordeling |
| Boekingen MVP | bestaande beveiligde cliëntenagenda via geverifieerde deep links |
| Analytics | privacyvriendelijke analytics; geen antwoorden/intake in events |
| Errors/uptime | foutmonitoring en uptimecheck zonder gevoelige payloads |
| Hosting | EU-regio waar mogelijk, met preview- en productieomgeving |

### 7.2 Datagrenzen

Houd drie domeinen strikt uit elkaar:

1. **Publieke/redactionele data:** CMS;
2. **commerciële data:** klant, order, factuurstatus, productrecht;
3. **klinische/gezondheidsdata:** vragenlijstantwoorden, score, intake en dossier.

Klinische data hoort niet in analytics, logs, CMS of betaalmetadata. Betaalproviders ontvangen alleen wat voor betaling noodzakelijk is. Gebruik willekeurige orderreferenties, geen probleemomschrijving zoals “trauma”, “ADHD” of “seksuologie” in publieke betaalomschrijvingen wanneer dat vermijdbaar is.

### 7.3 Minimale productiedatabase

- users
- products (commerciële snapshot/identifier)
- product_versions
- orders
- order_items
- payments
- entitlements
- questionnaire_sessions
- questionnaire_answers (versleuteld/afgeschermd; alleen indien nodig)
- result_reports
- audit_events
- consent_records
- email_events

Orders bewaren een snapshot van titel, prijs, btw en voorwaarden op aankoopmoment. Prijs wordt altijd server-side opgehaald; nooit vertrouwen op een bedrag uit de browser.

### 7.4 Niet-functionele eisen

- WCAG 2.2 AA;
- Core Web Vitals “good” op representatieve mobiele pagina's;
- JavaScriptbudget per openbare pagina vastleggen;
- afbeeldingen als AVIF/WebP met responsieve formaten;
- idempotente betaalwebhooks;
- rate limiting, schema-validatie, CSRF-/originbescherming waar passend;
- gescheiden secrets voor preview en productie;
- dagelijkse back-up en geteste herstelprocedure;
- auditlog voor prijs-, score- en publicatiewijzigingen;
- bewaartermijnen en verwijderflow per datatype;
- geen persoonsgegevens in URLs;
- beveiligingsheaders, CSP en dependency scanning;
- staging gebruikt synthetische data, nooit gekopieerde cliëntdata.

---

## 8. Betalingen: Wise-beslisdocument

### 8.1 Feitelijke beperking

Wise Business ondersteunt betaal-/Quick Pay-links die vanaf een website geopend kunnen worden. Bedrag, valuta en omschrijving kunnen in een open link worden voorgevuld. Wise documenteert echter dat:

- Wise niet als publieke API-checkoutoptie in een online checkout kan worden ingebouwd;
- payment links niet via de publieke API kunnen worden aangemaakt;
- de API vooral voor transfers/payouts en balansbeheer dient;
- kaartbetaling via Wise voor nieuwe zakelijke klanten mogelijk niet beschikbaar is.

Daardoor ontbreekt voor een klassieke webshop een betrouwbare automatische keten van orderaanmaak → checkout → webhook → entitlement → e-mail, tenzij Wise voor dit account specifieke mogelijkheden bevestigt.

### 8.2 Scenario's

#### Scenario A — Wise-only MVP

- per product een vaste herbruikbare Wise-link of één open Quick Pay-link;
- order vooraf lokaal aanmaken;
- orderreferentie in omschrijving zetten;
- betaling handmatig of via inkomende-transactie-reconciliatie koppelen;
- levering pas na bevestigde matching.

Voordelen: voldoet letterlijk aan Wise, laagste opstartcomplexiteit.  
Nadelen: meer frictie, beperkte betaalmethoden/geschiktheid, geen gegarandeerde realtime webhook, supportlast, moeilijkere refunds en zwakkere conversiemeting.

Geschikt als tijdelijke validatie met laag volume, niet als eindarchitectuur voor schaalbare digitale levering.

#### Scenario B — aanbevolen: checkoutprovider, uitbetaling naar Wise

- klant rekent af via een gereguleerde PSP zoals Mollie of Stripe;
- webhook bevestigt betaling;
- systeem levert product automatisch en maakt correcte order/factuurdata;
- PSP betaalt uit naar de zakelijke Wise-IBAN, **alleen als beide partijen/accountvoorwaarden dit bevestigen**.

Voordelen: beste conversie, Bancontact/kaart/wallets, automatische levering, refunds en robuuste webhooks.  
Nadelen: de checkout zelf is niet Wise; verificatie van Wise-IBAN als uitbetalingsrekening is nodig.

#### Scenario C — enterprise Wise-integratie

Alleen onderzoeken als Wise schriftelijk bevestigt dat MyGrowise voor een partner-/enterpriseproduct in aanmerking komt. Voor deze projectomvang waarschijnlijk niet economisch.

### 8.3 Go/no-go test

Voor engineering beantwoordt de klant samen met Wise:

- is het een geverifieerd Wise Business-account?
- is Quick Pay beschikbaar?
- zijn kaartbetalingen voor dit bestaande account geactiveerd?
- welke betaalmethoden krijgt een Belgische consument werkelijk te zien?
- kan een unieke orderreferentie betrouwbaar worden meegestuurd en teruggevonden?
- bestaat er voor dit account een webhook of alleen transactiereconciliatie?
- zijn refunds vanuit dezelfde flow uitvoerbaar?
- mag een PSP naar de Wise EUR-IBAN uitbetalen?
- welke omschrijving ziet de klant/bank en lekt die gevoelige informatie?

Bouw daarna één betaling van €1 in een sandbox/testcontext, plus geannuleerde, mislukte, dubbele en terugbetaalde scenario's. Zonder succesvolle proef geen definitieve checkoutbouw.

---

## 9. Professionalsmodel en zorgcontext

### 9.1 Verdienmodel

Een commissie per therapiecliënt of doorverwijzing wordt niet opgenomen in de MVP. Onderzoek met gespecialiseerde adviseur en Psychologencommissie:

- vaste maandelijkse software-/platformfee;
- vaste marketing-/profielkost die niet afhangt van aantal cliënten of omzet;
- transparante advertentie-/directory-overeenkomst;
- aparte vergoeding voor aantoonbare administratieve diensten;
- eigenaarschap van cliëntrelatie, facturatie en dossier.

De overeenkomst moet ook bepalen: klachten, no-shows, refunds, bereikbaarheid, kwalificatiecontrole, aansprakelijkheid, beëindiging, gegevensdeling en continuïteit.

### 9.2 Professionele verificatie

Voor publicatie van ieder profiel:

- officiële beroepstitel en bevoegdheid;
- erkennings-/registratiestatus via bevoegde bron;
- diploma's en aanvullende opleidingen;
- beroepsverzekering;
- doelgroep en leeftijdsgrenzen;
- talen en werkgebied;
- exacte tarieven en eventuele terugbetalingsvoorwaarden;
- crisis- en uitsluitingscriteria;
- toestemming voor foto, bio en publicatie.

Vermijd de huidige verwarring waarbij beroepsverenigingen en officiële erkenningsinstanties als uitwisselbaar worden voorgesteld.

### 9.3 Crisis en veiligheid

- prominente maar rustige melding dat MyGrowise geen crisisdienst is;
- Belgische actuele noodroutes, door klinisch eigenaar gecontroleerd;
- veiligheidsmelding bij intake/zelfcheck zonder antwoorden naar marketing te sturen;
- protocol voor suïcidaliteit, geweld, misbruik, minderjarigen en grensoverschrijdende zorg;
- duidelijke responstijden: geen verwachting van 24/7 monitoring.

---

## 10. Vragenlijsten en modules

### 10.1 Eén “golden path” eerst

Start met één bestaand kernprofiel. Pas nadat aankoop, consent, invullen, scoring, rapport, e-mail, support en gegevensverwijdering werken, wordt het model gekopieerd naar andere vragenlijsten.

### 10.2 Klinisch productdossier per vragenlijst

- doel en doelgroep;
- eigenaar/reviewer;
- broninstrument en versie;
- licentie- en reproductierechten;
- psychometrische onderbouwing;
- scoringalgoritme met testcases;
- interpretatiegrenzen en verboden claims;
- contra-indicaties;
- tekst voor informed consent;
- escalatie-/crisisregels;
- bewaartermijn;
- changelog en herbeoordelingsdatum.

ADHD- en autismescreeners worden nooit als diagnose verkocht. Formuleer resultaat en vervolgstap samen met bevoegde klinische eigenaar.

### 10.3 Vragenlijstflow

`Product gekocht → account/toegangslink → uitleg & consent → invullen met autosave → controle → indienen → deterministische scoring → rapport → passende vervolgstap`

Eisen:

- hervatten op ander moment;
- toegankelijke toetsenbord- en schermlezerbediening;
- bevestiging voor definitief indienen;
- geen score in URL of analytics;
- versie van vragen en score-engine vastleggen;
- reproduceerbaar rapport;
- klinisch veilige foutafhandeling;
- handmatige review mogelijk waar het instrument dat vereist;
- export/verwijdering volgens beleid.

### 10.4 Modules

Revenue MVP kan starten met gated pagina's, audio, video en downloads. Een volwaardige LMS-laag komt pas als voortgang, quizzen, certificaten, cohorten of complexe lessen daadwerkelijk nodig zijn.

---

## 11. Content- en merkproductie

### 11.1 Contentinventaris

Per bestaand item vastleggen:

- URL;
- eigenaar;
- doelgroep;
- funnelstadium;
- actualiteit;
- klinische reviewstatus;
- SEO-waarde/verkeer;
- actie: behouden, herschrijven, samenvoegen of verwijderen;
- nieuwe URL en redirect.

### 11.2 Benodigde kerncontent vóór launch

- merkbelofte en korte elevator pitch;
- gevalideerde beschrijving van alle live producten;
- professionele bio's en bewijsstukken;
- “hoe werkt het” voor producten en begeleiding;
- prijs-/btw-/leveringsteksten;
- privacy, cookies, voorwaarden, herroeping, refunds en klachten;
- crisisinformatie;
- e-mails voor order, betaling, toegang, mislukte betaling, reminder, refund en support;
- minstens drie inhoudelijke artikelen die naar een concreet aanbod leiden;
- FAQ per funnel;
- beeldselectie met rechten en altteksten.

### 11.3 Tone of voice

- warm, rustig, concreet en volwassen;
- geen wollige wellnessclaims;
- geen diagnose op afstand suggereren;
- geen overdaad aan “wetenschappelijk onderbouwd” zonder bron of betekenis;
- problemen erkennen zonder angst te vergroten;
- benoem altijd wat iemand ontvangt en wat de volgende stap is.

---

## 12. Analytics en succesmeting

### 12.1 Noordster

**Maandelijkse omzet uit correct geleverde digitale producten plus gekwalificeerde, bevestigde boekingen**, met refund-, klacht- en supportvolume als kwaliteitsrem.

### 12.2 Funnel-KPI's

- homepage → routekeuze;
- categorie → productdetail;
- productdetail → checkoutstart;
- checkoutstart → betaalbevestiging;
- betaalbevestiging → succesvolle toegang;
- begeleiding → professionalprofiel;
- professionalprofiel → boekingsklik;
- boekingsklik → bevestigde afspraak, indien privacyveilig meetbaar;
- e-mailinschrijving → eerste aankoop;
- omzet per product en gemiddelde orderwaarde;
- refund, chargeback, support en no-show;
- organische klikken, non-brand rankings en indexatiefouten;
- Core Web Vitals en toegankelijkheidsfouten.

### 12.3 Eventregels

Events bevatten alleen technische/commerciële identifiers. Nooit opslaan:

- antwoorden of scores;
- intakevrije tekst;
- vermoedelijke diagnose;
- gekozen gevoelig specialisme indien niet strikt noodzakelijk;
- e-mailadres/telefoon in analytics;
- producttitel wanneer die onnodig gezondheidsinformatie onthult; gebruik neutrale interne ID's.

Meet een baseline vanaf dag één en definieer pas na 200–500 relevante sessies realistische conversiedoelen. Optimaliseer niet op statistische ruis.

---

## 13. Juridische en privacy-werkstroom

Dit plan is geen juridisch advies. Vóór launch laat de eigenaar minstens de volgende onderdelen controleren:

- ondernemingsidentiteit, contactgegevens en gereglementeerde beroepstitels;
- rollen van MyGrowise en iedere professional: verwerkingsverantwoordelijke/verwerker/gezamenlijke verantwoordelijkheid;
- beroepsgeheim en voorwaarden voor gegevensdeling;
- register van verwerkingen en verwerkersovereenkomsten;
- DPIA-noodzaak voor grootschalige/systematische gezondheidsgegevens;
- rechtsgrond per gegevensstroom, niet één algemene toestemming voor alles;
- privacyverklaring in lagen en consentregistratie;
- cookiebanner en blokkering van niet-noodzakelijke trackers;
- bewaartermijnen, inzage, export, correctie en verwijdering;
- consumentenrecht voor digitale inhoud, diensten en afspraken;
- expliciete instemming met onmiddellijke digitale levering en erkenning van verlies van herroepingsrecht waar wettelijk van toepassing;
- prijs inclusief belastingen, betaalverplichting en bestelbevestiging op duurzame drager;
- wettelijke conformiteitsgarantie voor digitale inhoud/diensten;
- btw-behandeling per product en dienst;
- claims, testimonials, reclame en professionele onafhankelijkheid;
- minderjarigen en leeftijdsgrenzen;
- algemene voorwaarden, klachtenproces en bevoegde geschillenroute.

---

## 14. Fasering en planning

De volledige visie past niet verantwoord in één septemberrelease. Plan een omzetgerichte soft launch en daarna uitbreidingen.

### Fase 0 — beslissprint (24–28 augustus)

Deliverables:

- kickoff van 90 minuten;
- aanbod- en prijsinventaris;
- Wise-accountcapaciteiten getest;
- bestaand boekingssysteem en eigenaar bevestigd;
- professionalsmodel voorlopig gekozen;
- klinische en juridische eigenaars benoemd;
- scope, acceptatiecriteria, budget en releasebesluit.

Exitcriteria:

- één betaalroute is technisch bewezen;
- één kernproduct is inhoudelijk volledig;
- alle live professionals hebben akkoord en gevalideerde gegevens;
- klant tekent scope en verantwoordelijkheden af.

### Fase 1 — UX, contentmodel en prototype (31 augustus–4 september)

- journey maps en sitemap;
- low-fidelity flows voor homepage, product, checkout, bevestiging, professional;
- CMS-schema en adminprototype;
- design direction en componenttokens;
- usabilitytest met 5 representatieve gebruikers;
- copydeck en contentmigratiematrix.

Exitcriteria: taken kunnen zonder uitleg worden voltooid; klant kan in CMS-prototype prijs/blog aanpassen.

### Fase 2 — Revenue MVP bouwen (7–18 september)

- frontend en responsive componenten;
- CMS + preview;
- productcatalogus en één volledig kernproduct;
- checkout, order, betaling, webhook/reconciliatie en toegang;
- professionals en veilige externe boekingslinks;
- transactionele e-mails;
- juridische pagina's en consent;
- analytics, SEO-basis, redirects;
- account/bibliotheek alleen indien nodig voor levering.

### Fase 3 — hardening en soft launch (21–25 september)

- content freeze;
- volledige QA-matrix;
- security/privacy review;
- accessibility- en performancefixes;
- productiebetaling met lage bedragen;
- back-up/restore en incidentrunbook;
- CMS-training en opname;
- soft launch naar beperkte groep;
- dagelijkse monitoring.

### Fase 4 — publieke launch (vanaf 28 september)

- DNS/redirects/sitemap/Search Console;
- live monitoring van errors, payments, e-mail en 404's;
- dagelijkse check eerste week;
- wekelijkse funnelreview eerste zes weken;
- alleen bewezen frictie optimaliseren.

### Fase 5 — uitbreiding (oktober en later)

Prioriteit op basis van data:

1. tweede/derde vragenlijst;
2. modulebibliotheek en voortgang;
3. bundels/upsells;
4. diepere agenda-integratie;
5. B2B-professionalportal en vaste fee;
6. community, alleen met moderatie en governance;
7. extra taal, pas als volledige content en support beschikbaar zijn.

---

## 15. Backlog per werkstroom

### Strategie en business

- aanbod normaliseren;
- ICP en primaire problemen bevestigen;
- prijs/marge/btw modelleren;
- professionalsmodel laten toetsen;
- support- en refundbeleid bepalen;
- launchdoel en KPI-eigenaar aanwijzen.

### UX en design

- journeys en wireframes;
- componentbibliotheek;
- mobile-first prototypes;
- checkout- en formulierfouten;
- toegankelijkheidsstates;
- CMS usabilitytest.

### Content en SEO

- audit/migratiematrix;
- copy per funnel;
- klinische review;
- structured data;
- redirects/canonicals/hreflang;
- e-mailcopy;
- social share assets.

### Commerce

- betaalbesluit;
- server-side pricing;
- order state machine;
- webhook idempotency;
- refunds;
- factuur/bewijs;
- entitlement;
- delivery retry;
- customer support lookup.

### Zorg en vragenlijsten

- klinisch productdossier;
- licenties;
- deterministic scoring tests;
- consent en disclaimers;
- crisisprotocol;
- dossier-/retentiebeleid;
- reviewer sign-off.

### Platform en operations

- omgevingen en CI/CD;
- monitoring en alerts;
- back-up/restore;
- toegangsrollen;
- incidentrespons;
- dependency/security updates;
- eigenaarshandover.

---

## 16. QA- en acceptatieplan

### Kritieke end-to-endscenario's

1. gast koopt product met succesvolle betaling;
2. betaling mislukt/geannuleerd/verloopt;
3. webhook wordt twee of tien keer afgeleverd zonder dubbele order/toegang;
4. klant sluit browser na betaling en krijgt later toch toegang;
5. verkeerde of gemanipuleerde browserprijs wordt geweigerd;
6. refund trekt toegang in of volgt expliciet beleid;
7. e-mail faalt en kan veilig opnieuw worden verstuurd;
8. bestaande gebruiker koopt hetzelfde product opnieuw;
9. professional wordt gepauzeerd zonder gebroken links;
10. externe boekingslink werkt mobiel en desktop;
11. vragenlijst wordt halverwege hervat;
12. score is identiek voor vastgelegde testvectoren;
13. gebruiker vraagt data-export/verwijdering;
14. redacteur verandert prijs zonder layout of checkout te breken;
15. oude top-URL redirect éénmaal naar correcte nieuwe pagina.

### Apparaten en toegankelijkheid

- iPhone Safari, Android Chrome, desktop Chrome/Firefox/Safari/Edge;
- 320 px tot brede desktop;
- toetsenbord, zichtbare focus, skiplink;
- VoiceOver/NVDA smoke test;
- 200% zoom/reflow;
- reduced motion;
- voldoende contrast en foutmeldingen die niet alleen kleur gebruiken;
- captions/transcripts voor audio/video.

### Go-livecriteria

- geen P0/P1-defecten;
- alle betalingstoestanden getest;
- build en deployment reproduceerbaar;
- juridische teksten goedgekeurd;
- alle claims/credentials door eigenaar bevestigd;
- redirects van waardevolle URL's getest;
- analytics respecteert dataminimalisatie;
- monitoring en rollback werken;
- klant slaagt voor CMS-acceptatietaken;
- support- en incidentverantwoordelijke is bereikbaar.

---

## 17. Governance en verantwoordelijkheden

| Onderdeel | Eindverantwoordelijke |
|---|---|
| Businessdoelen, prijzen, aanbod | eigenaar MyGrowise |
| Klinische claims en vragenlijsten | aangewezen bevoegde klinische eigenaar |
| Juridisch/deontologisch | eigenaar + gespecialiseerde adviseur |
| UX, techniek, QA, deployment | ontwikkelaar/productteam |
| Foto's, testimonials, rechten | eigenaar MyGrowise |
| Professionalsgegevens | professional + eigenaar |
| Dagelijks CMS-beheer | eigenaar/redacteur |
| Privacyverzoeken en incidenten | formeel aangewezen privacy-eigenaar |

Gebruik één wekelijkse besluitmeeting van 45 minuten. Ieder besluit krijgt datum, eigenaar en impact. Nieuwe ideeën gaan naar de backlog; ze veranderen de lopende sprint alleen bij een expliciet scopebesluit.

---

## 18. Benodigde input van de klant

Voor de kickoff aanleveren:

- toegang of exports van Webnode, domein/DNS, Search Console en analytics;
- lijst van alle producten met prijs, btw, inhoud, formaat, duur en leverwijze;
- de echte eerste module en het e-book;
- klinische dossiers/licenties van bestaande en geplande vragenlijsten;
- Wise Business-accountmogelijkheden en contactantwoord van Wise;
- boekingssysteem en testmogelijkheden;
- ondernemingsgegevens en facturatiegegevens;
- privacy/voorwaarden/contracten die al bestaan;
- professionele gegevens en schriftelijke publicatieakkoorden;
- alle originele foto's/logo's plus gebruiksrechten;
- echte testimonials plus bewijs van toestemming;
- gewenste talen en wie support per taal doet;
- beschikbare wekelijkse tijd voor contentreview en CMS-test.

---

## 19. Kickoffagenda (90 minuten)

1. **10 min — omzetdoel:** welke omzet, tegen wanneer, uit welk product?
2. **15 min — aanbod:** wat bestaat echt en kan binnen vier weken geleverd worden?
3. **15 min — klant:** wie koopt als eerste en welk probleem wil die opgelost zien?
4. **15 min — betaling:** Wise-betekenis, accountstatus, test en alternatief.
5. **10 min — begeleiding:** agenda, cliëntrelatie, fee en professionele verantwoordelijkheid.
6. **10 min — beheer:** klant voert vijf CMS-taken uit in kandidaat-systemen.
7. **10 min — content/compliance:** claims, licenties, rechten en juridische eigenaar.
8. **5 min — besluit:** MVP-scope, eigenaar per open punt, deadline en go/no-go.

---

## 20. Raming en scopecontrole

Pas na Fase 0 wordt een vaste prijs verantwoord. Voor planning kan men rekenen in werkpakketten:

- strategie, audit en architectuur;
- UX/UI en design system;
- CMS en contentmigratie;
- commerce, betaling en digitale levering;
- professionaldirectory en boekingskoppeling;
- vragenlijstengine;
- legal/privacy implementatie;
- QA, launch en training;
- onderhoud en optimalisatie.

Een Revenue MVP is substantieel kleiner dan het volledige platform. Een offerte moet aannames, inbegrepen contentmigratie, aantal templates/producten, revisierondes, externe kosten, klantverantwoordelijkheden en meerwerk expliciet vermelden. Vermijd één totaalprijs voor “de complete site” zolang payment, scoring en professionalsmodel onbeslist zijn.

Aanbevolen contractvorm:

1. vaste prijs voor Fase 0;
2. vaste prijs per goedgekeurd werkpakket voor Revenue MVP;
3. aparte onderhoudsovereenkomst voor hosting, updates, support en conversie-optimalisatie;
4. uitbreidingen op basis van meetdata en nieuwe scope.

---

## 21. Beslisregister

| ID | Besluit | Deadline | Eigenaar | Status |
|---|---|---|---|---|
| D01 | Wise-only of PSP met uitbetaling naar Wise | 28 aug | klant + developer | open |
| D02 | CMS-keuze na beheertest | 1 sep | klant + developer | open |
| D03 | Eerste kernproduct en definitieve prijs | 28 aug | klant | open |
| D04 | Vaste professionalsfee en juridische toets | vóór B2B-publicatie | klant + adviseur | open |
| D05 | Bestaande externe agenda behouden in MVP | 28 aug | klant | aanbevolen |
| D06 | Account verplicht of magic link voor levering | 1 sep | productteam | open |
| D07 | Klinische eigenaar per vragenlijst | 28 aug | klant | open |
| D08 | Alleen Nederlands in MVP | 28 aug | klant | aanbevolen |
| D09 | Community uit MVP | 28 aug | klant | aanbevolen |
| D10 | Definitieve launchdatum na payment spike | 28 aug | gezamenlijk | open |

---

## 22. Definitie van succes

De herbouw is geslaagd wanneer:

- een nieuwe bezoeker binnen vijf seconden begrijpt wat MyGrowise biedt;
- die bezoeker zonder hulp de juiste van twee startroutes kiest;
- een product volledig en betrouwbaar gekocht en geleverd wordt;
- een hulpzoeker een geverifieerde professional kan kiezen en boeken;
- de eigenaar zonder developer content, producten, prijzen en professionals beheert;
- gevoelige data aantoonbaar van marketing, betalingen en publieke content gescheiden blijft;
- bestaande SEO-waarde niet door migratiefouten verdwijnt;
- omzet, boekingen, refunds, fouten en support meetbaar zijn;
- het platform uitbreidbaar is zonder iedere nieuwe vragenlijst of module als maatwerkproject te herbouwen.

Het doel is niet “een mooiere website”. Het doel is een klein, betrouwbaar en meetbaar digitaal bedrijf dat veilig kan groeien.

---

## 23. Geraadpleegde primaire bronnen voor beslispoorten

- [Wise Help Centre — Quick Pay op een website](https://wise.com/help/articles/5qGvWQuTiX0RSSvxWvKcBC/how-to-use-quick-pay-to-get-paid-through-your-website);
- [Wise Platform — beperking als online checkout](https://docs.wise.com/guides/product/partner/business-account-support);
- [FOD Economie — informatieverplichtingen bij e-commerce](https://economie.fgov.be/nl/themas/ondernemingen/guidance/handelspraktijken/informatieverplichting-bij-e/veelgestelde-vragen-over-de);
- [FOD Economie — digitale inhoud en diensten](https://economie.fgov.be/nl/themas/consumentenbescherming/garantie/garantieregels-voor-digitale);
- [Gegevensbeschermingsautoriteit — gevoelige gegevens](https://www.gegevensbeschermingsautoriteit.be/professioneel/thema-s/gevoelige-gegevens);
- [Belgische Psychologencommissie — deontologische code](https://www.compsy.be/nl_BE/le-code-de-deontologie).

Deze bronnen vormen een startpunt voor scope en risicobeheersing, niet de vervanging van account-specifiek, juridisch, fiscaal of klinisch advies.
