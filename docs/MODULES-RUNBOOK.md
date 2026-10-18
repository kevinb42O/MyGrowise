# Modules — beheer en verificatie

**Stand:** 18 oktober 2026. De modulefunctionaliteit is gebouwd in de lokale checkout. Migratie `20261018162741_module_materials` is toegepast en geregistreerd in de gekoppelde database. Er is vanuit deze opdracht geen website-deployment uitgevoerd.

## Huidig aanbod

Zes modules van €89 zijn als gepubliceerde aanbodrecords aanwezig, allemaal met **In ontwikkeling** als verkoopstatus. Definitieve PDF's en MP3's ontbreken nog. De zes covers zijn op 18 oktober uit het module-document gehaald en als WebP toegevoegd via `src/content/moduleImages.ts`; het overzicht en alle zes detailpagina's zijn in de lokale browser gecontroleerd. Originele PNG's staan onder `output/modules/document-images`. De eerste drie zijn bedoeld voor de eerste lancering; er staat nog geen module open voor verkoop.

**Uitgevoerd herstel:** het [uitvoeringsrunbook](WEBSITE-HERSTEL-RUNBOOK.md) beschrijft de geteste gasttoegang en optionele verdieping. De onderstaande accountflow blijft werken; `/aankopen` biedt de route zonder verplicht account.

Publieke routes: `/modules` en `/modules/[slug]`. Beheer: `/admin/modules`. Klantmateriaal: `/account/modules/[slug]` en `/account/modules/[slug]/audio/[trackKey]`.

## Een module klaarmaken

1. Open **Modules** in superadmin en kies de module.
2. Bewaar naam, omschrijving, ondertitels, inleiding en kernonderwerpen. Kies een definitieve cover onder `/images/` en vul de beeldbeschrijving in. De standaardcover komt uit het aangeleverde document; een expliciete beheercover vervangt die standaard.
3. Vul doelgroep, toegangsduur en inbegrepen ondersteuning in volgens het werkelijke aanbod. Deze informatie is verplicht voordat verkoop beschikbaar kan worden.
4. Maak een **materiaalconcept**. Bij een al gepubliceerde module begint het concept met een kopie van de bestaande materiaalkoppelingen; de actieve versie verandert nog niet.
5. Upload de MP3's, geef elke oefening een vaste audiocode, titel en volgorde. Een audiocode identificeert dezelfde oefening over versies heen; gebruik een nieuwe code voor een andere oefening.
6. Kopieer de vaste audiolinks naar het brondocument van het werkboek. Controleer eerst dat `PUBLIC_SITE_URL` naar het definitieve domein verwijst.
7. Exporteer het werkboek als PDF en upload dat. Een nieuwe PDF vervangt de concept-PDF. Een nieuwe MP3 met dezelfde code vervangt alleen die oefening in het concept.
8. Open het klantvoorbeeld en controleer werkboek en elke track. Controleer de links in de PDF tegen de zichtbare audiolinks. De website herschrijft de PDF niet en beoordeelt de inhoud niet automatisch.
9. Bevestig de controle en kies **Materiaalversie publiceren**. Er moet minimaal één gecontroleerde PDF en één gecontroleerde audiotrack zijn; onvoltooide uploads blokkeren publicatie.
10. Zet de website op gepubliceerd en verkoop op beschikbaar, en bewaar. Dat kan alleen met gepubliceerd materiaal en ingevulde praktische informatie.

## Upload en bestanden

De private bucket heet `module-materials`. De browser uploadt rechtstreeks via de ondertekende TUS-route `/storage/v1/upload/resumable/sign`, met een beperkte uploadhandtekening en de publieke projectsleutel. De geheime serversleutel blijft op de server.

De upload kan worden gepauzeerd en hervat zolang de pagina openblijft. Na een herlaadbeurt kan een reeds voltooide upload opnieuw worden gecontroleerd; een niet voltooide upload kan opnieuw worden toegevoegd. Publicatie blijft geblokkeerd zolang een gekoppeld bestand niet gecontroleerd is.

Grenzen: PDF 25 MB, MP3 150 MB; TUS-chunks 6 MB. Deze grenzen zijn ook in de database/bucket begrensd. De voltooiingsroute controleert werkelijke storagegrootte, MIME en een bestandssignatuur. Dit is geen inhoudelijke of volledige decodercontrole; het klantvoorbeeld blijft nodig.

Bestanden krijgen nieuwe unieke paden. Een eerdere gepubliceerde versie wordt niet overschreven. Ongebruikte objecten uit vervangen of verwijderde conceptuploads worden niet automatisch verwijderd; ruim zulke objecten alleen op na controle dat geen behouden versie ze gebruikt.

## Klanttoegang en bijwerken

Na betaalbevestiging geeft het bestaande orderproces moduletoegang. Modules maken geen `assessment_delivery` aan. Vragenlijsten en profielen uit andere orderregels houden hun eigen afnamelevering.

De bibliotheek koppelt op product-ID. Een actieve aankoop opent het werkboek en de audiolijst. De vaste PDF-link opent na klantlogin precies dezelfde audiopagina. De server controleert aankooprecht en de relatie tussen module en track voordat een tijdelijke bestandslink wordt gegeven.

Kopers zien de actuele gepubliceerde versie. Een oude audiocode zoekt eerst de huidige versie en kan terugvallen op de laatste gepubliceerde versie waarin die oefening nog voorkomt. Bij een slugwijziging blijven oude openbare en accountlinks via de catalogusaliassen werken.

Verkoop pauzeren blokkeert nieuwe aankopen; bestaande actieve aankooprechten blijven werken. Bij een materiaalprobleem kan een eerdere gepubliceerde versie vanuit beheer worden teruggezet. Ingetrokken aankooprechten blokkeren nieuwe materiaalverzoeken; een al uitgegeven tijdelijke URL blijft geldig tot de vervaltijd.

De audiopagina vraagt tijdelijke toegang bij laden. Na een lange pauze of een verlopen audiobron kan zij opnieuw autoriseren en de tijdpositie herstellen. De werkelijke definitieve audio moet nog op mobiele browsers worden beluisterd; synthetische transportbestanden bewijzen geen geluidskwaliteit.

## Combineren en bestellen

Modules en losse vragenlijsten delen één selectie onder `mg-selection-v1`; de oude `mg-questionnaires`-selectie wordt eenmalig overgenomen. Eén product: 0%; twee of drie: 5%; vier of meer: 10%, via de centrale aanpasbare prijsinstellingen.

Nieuwe bestel-URL: `/bestellen?producten=<id,id>`. Oude `vragenlijsten`- en `pakket`-links blijven geldig. Conflicterende URL-selecties worden geweigerd. De vaste profielpakketten houden hun eigen prijs en krijgen geen extra combinatiekorting.

De server controleert quote, producttypen, beschikbaarheid en eigendom opnieuw. Een al aangekochte module wordt niet opnieuw afgerekend voor dezelfde deelnemer. Een gelijke openstaande modulebestelling wordt hergebruikt; een andere overlappende modulebestelling verwijst naar transacties.

Voorbeeld: twee modules van €89 plus één vragenlijst van €59 = €237 × 95% = €225,15. Dit is een rekenvoorbeeld met een vragenlijst van €59, geen vaste prijs voor alle vragenlijsten.

## Uitgevoerde verificatie

- `npm run check`: TypeScript en productiebuild geslaagd.
- `npm run test:catalog`: 9 bestaande tests geslaagd.
- `npm run test:modules`: 5 tests geslaagd, inclusief gemengde prijzen, selectie, uploadvalidatie en de afbakening van praktijkrechten bij klant-/superadminsessies.
- `npm run test:modules:db`: 47 controles geslaagd, onder meer publicatie, revisies, betalingstoegang, dubbelbestellingen, herstellen, RLS en private opslag.
- `npm run test:catalog:db`: 28 bestaande databasecontroles geslaagd.
- `npm run test:questionnaires:db`: 38 bestaande databasecontroles geslaagd.
- `dotenv -e .env -- node tests/modules-http.mjs`: 32 HTTP/Storage-controles geslaagd met tijdelijk testproduct, synthetische PDF-/MP3-bytes en tijdelijke accounts. Gecontroleerd: beheerscherm, metadata bewaren, revisieconflicten, rolcontrole, echte signed TUS-upload, bestandscontrole, publicatie, preview, PDF-bytes, audio Range-verzoek, login-terugkeer en geen toegang met een andere klant. Geen betaalopdracht of mailversturing uitgevoerd. Tijdelijke bestanden en gegevens zijn opgeruimd.
- Publieke modulepagina's, samensteller, bestaande profiel-/vragenlijstpagina's lokaal geopend. Overzicht op desktop en een iframe met 360 px breedte visueel nagekeken. Dit is geen volledige test op elk mobiel apparaat.
- Security-advisor vóór en na de migratie: geen nieuwe beveiligingsmeldingen; de bestaande waarschuwing over `btree_gist` in `public` blijft aanwezig. Zie [Supabase-uitleg](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

De databaseproeven draaien binnen een rollbacktransactie. De HTTP/Storage-proef gebruikt tijdelijk een apart ongepubliceerd product en verwijdert dat samen met accounts en objecten; voer deze proef bewust uit tegen de gekozen testomgeving. Geen geheime keys of tijdelijke upload-/downloadtokens loggen.

De CLI voor automatische database-typengeneratie gaf in deze omgeving geen bruikbare uitvoer. Er is geen bestaand typebestand vervangen. De modulelaag gebruikt eigen expliciete types; de applicatie compileert en de werkelijke RPC/Storage-responses zijn in de HTTP-proef gecontroleerd.

## Nog nodig voor de eerste lancering

Definitieve PDF's en MP3's van modules 1–3, de doelgroep, de toegangstermijn en de omschrijving van ondersteuning. De documentcovers zijn al toegevoegd. Controleer daarnaast de bestaande fiscale prijsvermelding/voorwaarden en het publieke domein voordat definitieve PDF's worden verspreid. Voer met het echte materiaal een complete klantproef uit in de doeldeployment.

De modulecode is nog niet vanuit deze opdracht gedeployed. De praktijkmigratie is later op 18 oktober tijdens het websiteherstel toegepast en geregistreerd. De huidige gezamenlijke uitrol volgt [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md). Klant- en superadminsessies doen geen overbodige praktijkmanageropzoeking; rollen waarvoor een praktijkmanagergrant relevant is, behouden die controle.
