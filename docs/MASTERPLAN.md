# MyGrowise — actuele voortgang en volgende stappen

**Controle: 30 oktober 2026.** Codebasis: `29d4b87`, na lokale verificatie gecommit en naar `origin/main` gepusht. De remote is via `git fetch` gecontroleerd; vóór de fixcommit stonden lokaal en remote op `56b9ce7`. Deze actualisatie vergelijkt de code, recente Git-historie en bestaande acceptatieverslagen. Er is in deze ronde geen nieuwe productie-, database- of mailboxproef uitgevoerd. De [oude visie](archive/MASTERPLAN-2026-08-24.md) blijft historische context.

## Vaste keuzes

- Vercel Free/Hobby blijft de hostingrandvoorwaarde. Directe verzendpogingen bij handelingen, één dagelijkse mailfallback en expliciet herstel via beheer. Geen betaalde scheduler of keepalive.
- Kevin verbiedt GitHub Actions. Controles worden lokaal uitgevoerd; uitrol loopt rechtstreeks via de bestaande Vercel-integratie.
- Digitale producten kopen en openen kan zonder account. Een bevestigd klantaccount blijft vereist voor afspraken. Een aankoopaccount koppelen is vrijwillig.
- Zes zelfstandige modules van €89 blijven in ontwikkeling tot de definitieve PDF/audio en praktische informatie gecontroleerd zijn. Eerst modules 1–3 voorbereiden.
- Modules, losse vragenlijsten en beschikbare extra's volgen 0%, 5% bij 2–3 en 10% vanaf 4 verschillende items. Vaste profielen behouden hun bevestigde pakketprijs.
- De ondernemingsgegevens zijn op 29 oktober verwerkt in contact, footer, privacy en voorwaarden (`85943b9`): I-Transform SLU, Andorra. De oude claim dat deze gegevens nog niet ontvangen zijn vervalt. Volledige voorwaarden, een blijvende kopie bij bestellen en afzonderlijke toestemming voor directe digitale levering zijn geïmplementeerd. Dit bevestigt geen onafhankelijke juridische/fiscale beoordeling.
- Nieuwe productieorders blijven in de code standaard gesloten zonder expliciete `COMMERCE_SALES_ENABLED=true`. Deze ronde wijzigt de verkoopvrijgave niet; de actuele productievariabele is niet opnieuw uitgelezen.

## Huidige productstand

| Onderdeel | Geïmplementeerd en gecontroleerd | Resterende grens |
|---|---|---|
| Publieke website | Doorlopende homepage met portret, landschap en scrolltransities; rustige weergave en reduced motion. Mobiele herkenning, compacte iPhone-intro, titelbegrenzing, menu, formulieren, checkoutvolgorde en responsieve beelden hersteld. Startpunt vernieuwd, catalogusbeelden en zelfhulpoverzicht verfijnd, PWA-iconen en metadata toegevoegd. | Lokale browserproeven staan in het homepageplan en mobiele herstelverslag. Safari op fysieke toestellen, schermtoetsenbord, tekstvergroting en werkelijke Core Web Vitals blijven afzonderlijke controles. |
| Catalogus | 22 uitgebreide vragenlijstpagina's, acht volledige profielpagina's, beheer, leeftijds-/themafilters, prijsregels en samensteller. | Instrumentversies/licenties, inhoudelijke goedkeuring en werkelijke professionele afname/rapportlevering blijven verantwoordelijkheid van de eigenaar. |
| Aankopen | Gast- en accountorders, handmatige Wise-verificatie, rechten, afnames, rapporten, veilige aankooplinks en vrijwillige accountkoppeling. Alle aankooproutes hebben een gedeelde werkruimte, zichtbare betaalstatus, herstel bij ongeldige toegang en verzorgde lege/404-weergaven. | Lokale visuele controle inclusief 320/390 px en tablet is vastgelegd. De nieuwe vormgeving bewijst geen volledige productieorder/bankbetaling/rapportlevering of echte PDF/audio-toegang. |
| Modules | Zes covers/detailpagina's, PDF/MP3, private opslag, materiaalversies, preview/publicatie, gemengde aankopen en optionele verdieping. | Geen definitief materiaal voor alle zes bevestigd. Geen moduleverkoop vóór materiaal- en inhoudsacceptatie. |
| Praktijk en dossiers | Dagoverzicht met afspraken van vandaag, volgende afspraken, vrije momenten en verslagwerk; dossiers rechtstreeks onder `/praktijk/clienten`, met gedeelde beheercomponenten. Concepten en geselecteerde afspraken blijven bereikbaar buiten de eerste historiepagina. Werkruimteredirects en rechten behouden. | Nieuwe werkruimte lokaal gebouwd en met zeven gerichte regressietests gecontroleerd; dagelijkse gebruikersacceptatie en volledige browserproef van deze nieuwe schermen blijven open. |
| Afsprakenketen | Boeken, dossier, concept/definitief verslag, vervolgafspraak, zelf verplaatsen en annuleren; veilige agenda- en mailafhandeling. Op 30 oktober bewezen op productiecode `ba80615`: 53 HTTP-controles, drie verstuurde afspraakmails en expliciet bevestigde ontvangst. Gelijktijdig boeken en rolafscherming zijn meegenomen. | Het bestaande productieverslag geldt voor de toen geteste versie. Nieuwe HTML-opmaak en werkruimte in `29d4b87` vragen een nacontrole na uitrol. Auth-uitnodiging/herstel is daarmee niet bewezen. Herinneringen/weekoverzichten zijn niet actief. |
| MijnDiAd | Alleen-lezen import, eigenaarsscheiding, gedeelde cache, verversing bij gebruik en blokkeren van boekingen als de bron niet veilig gecontroleerd kan worden. Bestaand acceptatieverslag bevat 27 on-demand-databasecontroles. | iCal-publicatie kan achterlopen; geen wederzijdse realtime kalender. Supabase Free kan bij inactiviteit pauzeren. De historische telling van 262 momenten is geen actuele inventaris. |
| Contact en mail | Publieke mailboxvraag met Reply-To, bestaande supportgesprekken, duurzame wachtrijen en `/admin/mail`. Gedeelde HTML-renderer plus volledige plain text voor afspraken, orders, aankooptoegang, contact en support. Voorwaarden/toestemming blijven in de bestelmail bewaard. | Geen vijfminutengarantie op retries. Nieuwe opmaak lokaal bekeken en synthetisch als MIME gecontroleerd; werkelijke clientweergave en aflevering van alle mailsoorten blijven apart te bewijzen. |
| Auth-mail en database | Zes Nederlandse Supabase Auth-templates, lokale kopieën en generator. Het mailverslag registreert rechtstreeks opgeslagen productietemplates en 61 toegepaste migraties, nul ontbrekend op 30 oktober. | Dit is bestaand uitvoeringsbewijs, geen nieuwe databasecontrole in deze ronde. Echte registratie-, uitnodigings- en herstelmails zijn nog niet als ontvangen bewezen. |
| Websitebeheer en SEO | Gepubliceerde algemene CMS-pagina's hebben een route; vaste routes zijn beschermd tegen slugconflicten. Sitemap, robots, canonicals en gecontroleerde Webnode-redirects/demo-410's aanwezig. | Resterende oude content/locatiepagina's, Search Console en definitief domein controleren. Redactionele siteonderdelen blijven deels in code. |
| Release en dependencies | `29d4b87` bevat alle openstaande fixes. 99 tests, TypeScript, productiebuild en artifactcontrole lokaal geslaagd; 1685 artifactbestanden gecontroleerd. `npm audit --omit=dev`: nul kwetsbaarheden na lockfile-updates en Zod-override. | De eerdere zeven auditbevindingen uit het afspraakverslag zijn historisch; de nieuwe uitslag is tijdgebonden. Push is geslaagd; Vercel-status van deze nieuwe release is in deze ronde niet afzonderlijk vastgesteld. |

## Afgerond sinds de vorige masterplancontrole

- `1625d35` en `0b6a2f9`: catalogus-/praktijkrelease voor Hobby en vastlegging van het Actions-verbod.
- `85943b9`, `add0ff8`, `1ed6130`: ondernemingsgegevens, volledige voorwaarden en expliciete digitale-leveringstoestemming. Het rijksregisternummer is uit de boekingsinvoer verwijderd; oude inzendingen worden genegeerd.
- `6f2912d` tot en met `cb2fa3d`: homepage, mobiel herstel en nacorrecties, PWA-metadata, praktijkprofielen/footer, Startpunt en cataloguspresentatie. Zie de onderwerpverslagen voor de afzonderlijke bewijsgrenzen.
- `ba80615` en `56b9ce7`: afspraak-/dossierketen en vastgelegde productieacceptatie inclusief ontvangst van bevestiging, verplaatsing en annulering.
- `29d4b87`: praktijkwerkruimte, dossiernavigatie, aankoopomgeving, transactionele HTML-mails, zes Auth-templates en dependencyfixes. Eerst gecommit en gepusht; daarna is dit masterplan bijgewerkt.

## Volgende volgorde

1. Controleer de Vercel-uitrol van de nieuwe fixcommit en voer een gerichte nacontrole uit op de praktijkwerkruimte, aankooptoegang en nieuwe mailopmaak. Behoud de bestaande verkoopvrijgave totdat die bewust wordt beoordeeld.
2. Test Auth-registratie, uitnodiging en wachtwoordherstel met een afgesproken ontvanger; controleer echte weergave en links van de vernieuwde transactionele mails. De oude afspraakketen hoeft niet opnieuw als volledig onbewezen te worden behandeld.
3. Sluit de volledige gastorder/bankontvangst/afname/rapportstroom in de doelomgeving. Bevestig rekening/QR, levering, fiscale afspraken en resterende juridische beoordeling op basis van de inmiddels ingevulde bedrijfsgegevens.
4. Ontvang materiaal en praktische informatie van modules 1–3; controleer echte PDF/audio en mobiele klanttoegang vóór beschikbaar maken.
5. Rond gebruikersacceptatie, fysieke mobiele tests, monitoring, back-up/herstel, domein en resterende SEO-migratie af. Geef verkoop daarna bewust vrij. Community, automatische scoring en extra B2B-functies blijven vervolgfase.

## Onderliggende verslagen

- [Acceptatie afspraak- en dossierketen](APPOINTMENT-FLOW-ACCEPTANCE.md) — lokale en productieproeven, mailontvangst, migraties en exacte deployment.
- [Mijn aankopen](AANKOPEN-ERVARING.md) en [transactionele mails](TRANSACTIONELE-MAILS.md) — nieuwe vormgeving, controles en uitrolgrenzen.
- [Mobiel herstel](MOBILE-HERSTEL-2026-10-29.md) en [homepageplan](HOMEPAGE-VISUEEL-PLAN.md) — implementatie, browsermetingen en nacorrecties.
- [Releaserunbook](RELEASE-RUNBOOK.md), [besluiten](DECISIONS.md) en [modulebeheer](MODULES-RUNBOOK.md) — operationele procedure en open keuzes.

Deze controle actualiseert het masterplan en de direct gekoppelde statusverwijzingen. Oudere onderwerpplannen blijven gedateerde specificaties; zij vormen geen nieuwe volledige productieaudit.

## Aanvullende lokale afwerking — 30 oktober 2026

Na de bovenstaande consolidatie zijn de vijf accounttoegangspagina's gelijkgetrokken met Mijn aankopen en zijn Contact, Prijzen en Over ons afgewerkt. De lopende checkoutvernieuwing is behouden. Wachtwoordherstel bewaart nu de oorspronkelijke vervolgroute. 102 unit-/regressietests, 78 commerce-HTTP-controles, 65 teruggedraaide databasecontroles en 30 gerichte account-/publieke HTTP-controles slagen. Kevin bevestigde ontvangst van de echte wachtwoordherstel- en aankooptoegangsmail. Registratie/invitatie met een nieuw adres, echte bankontvangst en uitrol van deze nieuwe lokale code blijven afzonderlijke grenzen. Modules zijn op verzoek niet aangepakt. Zie [uitvoering en bewijsgrenzen](AFWERKING-ACCOUNT-EN-PUBLIEKE-PAGINAS.md).
