# MyGrowise kennisbank

**Laatste statusactualisatie: 30 oktober 2026**, tegen lokaal geteste en naar `origin/main` gepushte code `29d4b87`. Het masterplan vergelijkt code, Git-historie en bestaande acceptatieverslagen. In deze ronde zijn 99 tests, TypeScript, build, dependency-audit en artifactcontrole lokaal uitgevoerd; productie en database zijn niet opnieuw integraal getest. Oudere onderwerpplannen behouden hun eigen controledatum.

## Begin hier

De [lanceringsaudit van 30 oktober](LAUNCH-AUDIT-2026-10-30.md) beschrijft de actuele www-migratie, herstelde social sharing, productiecontrole van 55 pagina's en 35 oude URL's, en resterende lanceringspunten. De afzonderlijke [beveiligingsaudit](SECURITY-AUDIT-2026-10-30.md) bevat urgente, nog open punten rond beheerrechten en authenticatie.

1. [MASTERPLAN.md](MASTERPLAN.md) — actuele functies, vaste keuzes en resterende volgorde.
2. [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) — Vercel Free, verkoopvrijgave, migraties, tests en herstel.
3. [DECISIONS.md](DECISIONS.md) — bevestigde en nog open bedrijfsbesluiten.
4. [BUILD-HANDOFF.md](BUILD-HANDOFF.md) — systeemkaart en lokale controle.

## Documenten per onderwerp

Het [praktijkverbeterplan van 17 november 2026](PRAKTIJK-VERBETERPLAN-2026-11-17.md) plant het herstel van accountafspraken, leesbaarheid, compacte agenda, cliëntzoeken en -aanmaak, herinneringen en interne afspraakstatussen. De implementatie is uitgerold; zie het [uitvoeringsverslag](PRAKTIJK-VERBETERINGEN-UITVOERING-2026-11-17.md) voor migratie, Vercel-deployment, actieve scheduler en de resterende visuele acceptatie.

De [MijnDiAd-agendakoppeling](MIJNDIAD-AGENDA-IMPORT.md) beschrijft de 262 overgenomen momenten voor Virginie en verversing bij gebruik voor Supabase Free, met gedeelde cache en boekingsbescherming, inclusief foutafhandeling en synchronisatiegrenzen.

| Document | Doel en actualiteit |
|---|---|
| [APPOINTMENT-FLOW-ACCEPTANCE.md](APPOINTMENT-FLOW-ACCEPTANCE.md) | Productieacceptatie van afspraken/dossiers op 30 oktober, inclusief bevestigde ontvangst van drie afspraakmails. |
| [AANKOPEN-ERVARING.md](AANKOPEN-ERVARING.md) | Nieuwe aankoopwerkruimte, lokale visuele controles en grenzen van het bewijs. |
| [ADMIN-MAIL-VISUEEL-PLAN.md](ADMIN-MAIL-VISUEEL-PLAN.md) | Rustige mailwerkplek met statusnavigatie, gecombineerde historiek en uitklapbare details; uitvoering op 18 november 2026. |
| [ADMIN-VERZONDEN-MAILS-PLAN.md](ADMIN-VERZONDEN-MAILS-PLAN.md) | Verzonden mails in superadmin: uitvoering, eerlijke statusindeling, migratie en verificatie op 18 november 2026. |
| [TRANSACTIONELE-MAILS.md](TRANSACTIONELE-MAILS.md) | HTML/plain text, zes opgeslagen Auth-templates, migratieregistratie en lokale mailcontroles. |
| [MOBILE-HERSTEL-2026-10-29.md](MOBILE-HERSTEL-2026-10-29.md) | Mobiel herstel, nacorrecties en nog open fysieke toestelproeven. |
| [HOMEPAGE-VISUEEL-PLAN.md](HOMEPAGE-VISUEEL-PLAN.md) | Goedgekeurde homepageproef lokaal geïntegreerd op 29 oktober, met alle hoofdstukken, scrolltransities en Virginies foto in de hero; lokale browsercontroles en bewijsgrenzen vastgelegd. |
| [PROFILES-RUNBOOK.md](PROFILES-RUNBOOK.md) | Acht volledige profielpagina’s, filters, inhoudsbeheer en broncontrole. |
| [PROFIELEN-LANDINGSPAGINA-PLAN.md](PROFIELEN-LANDINGSPAGINA-PLAN.md) | Uitgevoerde profielspecificatie; actuele uitvoering in het profielrunbook. |
| [ADMIN-MASTERPLAN.md](ADMIN-MASTERPLAN.md) | Actuele codeaudit van beheermodules, rechten, datagrenzen en beperkingen. |
| [PRACTICE-PORTAL.md](PRACTICE-PORTAL.md) | Praktijkrollen, beschikbaarheid, boekingen en de nieuwe agenda- en dossierfuncties. |
| [CONTACT-BERICHTENPLAN.md](CONTACT-BERICHTENPLAN.md) | Huidige publieke en ingelogde supportstroom. |
| [SUPPORT-BERICHTEN-RUNBOOK.md](SUPPORT-BERICHTEN-RUNBOOK.md) | Dagelijks beheer en herstel van supportmail. |
| [MODULES-RUNBOOK.md](MODULES-RUNBOOK.md) | Modulebeheer, PDF/audio, gemengde aankopen en uitgevoerde controles op 18 oktober 2026. |
| [SUPABASE-OPERATIONS.md](SUPABASE-OPERATIONS.md) | Migraties, geheimen en productiecontrole voor Supabase. |
| [QUESTIONNAIRE-LANDINGS-RUNBOOK.md](QUESTIONNAIRE-LANDINGS-RUNBOOK.md) | De 22 vragenlijstpagina’s, beheer, inhoudsimport en uitgevoerde controles op 18 oktober 2026. |

De [historische plannen](archive/README.md) bewaren de oorspronkelijke visie en eerdere audits. Hun conclusies zijn niet de huidige status.

## Waar staat de waarheid?

- **Gedrag en rechten:** `src/pages`, `src/lib`, `src/middleware.ts` en `src/lib/adminPermissions.ts`.
- **Datamodel:** gecommitte bestanden in `supabase/migrations`; controleer daarnaast of ze in de doelomgeving toegepast zijn.
- **Configuratie:** `.env.example` beschrijft variabelen, maar bevestigt geen ingestelde productievariabelen. Zet nooit geheimen in deze kennisbank.
- **Product- en bedrijfskeuzes:** een expliciet bevestigd besluit in [DECISIONS.md](DECISIONS.md). Een geïmplementeerde route is niet automatisch een goedgekeurde releasekeuze.
- **Productie:** deployment, afleverproeven, restoreproef en acceptatie door de eigenaar moeten apart worden vastgelegd; die zijn niet uit GitHub af te leiden.

## Onderhoudsregel

Wijzig documentatie in dezelfde pull request als een verandering aan de beschreven flow. Zet bovenaan een datum en, waar nuttig, de gecontroleerde commit. Schrijf bij elke belangrijke claim of die **aanwezig in code**, **getest in de doelomgeving** of **nog te bevestigen** is. Sluit of vervang oude bevindingen zodra ze zijn opgelost; voeg niet alleen een nieuwe laag tekst toe. Voor een releasebesluit: actualiseer eerst het beslisregister en de open punten in het masterplan.

- [Praktijkverbeteringen: uitvoering en uitrol, 17 november](PRAKTIJK-VERBETERINGEN-UITVOERING-2026-11-17.md) — uitgerolde implementatie, toegepaste migratie, actieve scheduler, controles en bewijsgrenzen.
