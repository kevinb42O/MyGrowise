# Publieke therapeutenprofielen

Implementatienotitie — 29 oktober 2026. Betreft `/begeleiding/[slug]`.
Dit is een herontwerp binnen de bestaande MyGrowise-huisstijl: bosgroen
(`#173d35`), papier (`#fbf8f2`), crème (`#f3ecdf`), DM Serif Display en DM Sans.
De afspraken gelden voor deze profielpagina's; bestaande product- en
ontwerpdocumentatie blijft behouden.

## Opbouw en gedrag

- Een groot portret, naam, actuele rol, introductie, bio en expertise openen het profiel.
- De persoonlijke aanpak en doelgroep krijgen een eigen leesbaar tekstgedeelte.
- Gepubliceerde afspraaktypes staan per behandelingsgroep; intakes gaan binnen
  elke groep vóór vervolgafspraken. Duur, kanaal/locatie en de bestaande
  boekingslink komen uit de afspraakcatalogus.
- Een agenda-ophaalfout toont een afzonderlijke contactmelding terwijl het
  profiel leesbaar blijft. De response krijgt dan HTTP 503.
- Bij een profiel-ophaalfout verschijnt een eigen foutmelding met HTTP 503;
  een onbekend of inactief profiel verwijst naar `/begeleiding`.
- De inhoud wordt op de server gerenderd en vereist geen animatie of JavaScript.
  Op smalle schermen worden de hoofdgedeelten onder elkaar geplaatst.

## Bronnen en eigenaarschap

| Onderdeel | Bron en onderhoud |
| --- | --- |
| Naam, actieve status, rol, bio, expertise, talen en `image_url` | Supabase `practitioners`; `src/lib/practiceStore.ts` leest en vertaalt deze velden. |
| Boekingsinstellingen | Supabase `practitioner_settings`; geen lokale kopie voor beschikbaarheid of boekingen. |
| Gepubliceerde afspraaktypes en boekingsroutes | Bestaande `src/lib/appointmentCatalog.ts`, via `listOffers` en `bookingPath`. |
| Portret bij ontbrekende `image_url` | Lokale `practitioners` in `src/content/site.ts`; zonder beide bronnen verschijnt een initiaal. |
| Rol/bio als de betreffende Supabase-waarde leeg is | Lokale `role`/`focus` uit `src/content/site.ts`. |
| Persoonlijke introductie, aanpak en doelgroep | Redactionele `practitionerStories` in `src/content/practitionerProfiles.ts`, per slug. |
| Pagina en vormgeving | `src/pages/begeleiding/[slug].astro` en `src/styles/practitioner-profile.css`. |

De langere teksten voor Margot, Virginie en Amy zijn hersteld uit de originele
websiteteksten in `scratch_content.json`. Amy's tekst respecteert de correctie
in migratie `20260925120000`: er worden geen claims over koppeltherapie toegevoegd.
Actuele Supabase-profielvelden blijven de primaire bron voor de korte bio en rol.

Een toekomstige actieve therapeut krijgt via dezelfde route het actuele
Supabase-profiel en de gepubliceerde afspraaktypes. Zonder lokale portretfallback
en zonder `image_url` verschijnt een initiaal. Zonder redactionele story ontbreken
de persoonlijke opening, aanpak, doelgroep en bijbehorende navigatielink; deze
worden pas getoond nadat een story voor de slug is toegevoegd. De verwijzingen
naar andere therapeuten blijven afkomstig uit de lokale lijst in `site.ts`.

## Lokale validatie

Tijdens de implementatieronde gecontroleerd:

- `npm run typecheck` en `npm run build`: geslaagd.
- `npm test`: 77 van 77 tests geslaagd; ontwerpdetector: `[]`.
- Desktop op 1440 px en mobiel op 344/390 px visueel beoordeeld;
  tablet op 768 px op horizontale overflow gecontroleerd.
- Margots intake-link bereikt de juiste bestaande boekingsroute met loginpoort.
  Er zijn geen afspraken aangemaakt.
- Screenshots staan lokaal in `output/therapist-profiles/` (genegeerd door Git).

De wijzigingen zijn lokaal en nog niet gedeployed. Controles blijven lokaal;
GitHub Actions zijn volgens `AGENTS.md` verboden. Deployment verloopt via de
bestaande Vercel-integratie, binnen Free/Hobby zonder betaalde scheduler.
