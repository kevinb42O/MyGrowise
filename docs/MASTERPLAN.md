# MyGrowise — actuele voortgang en volgende stappen

**Controle: 18 oktober 2026.** Basis: lokale en remote `main` op `b2cfabd`, plus de volledige gewijzigde werkboom die voor deze release wordt klaargemaakt. De definitieve releasecommit is terug te vinden in Git. Dit document vervangt de brede status van 26 september; de [oude visie](archive/MASTERPLAN-2026-08-24.md) blijft historische context.

## Vaste keuzes

- Kevin bevestigt op 18 oktober: Vercel Free/Hobby blijft de hostingrandvoorwaarde. Eén dagelijkse mailcron; directe verzendpogingen bij handelingen en expliciet herstel via beheer. Geen betaalde scheduler of keepalive.
- Kevin verbiedt GitHub Actions. Controles worden lokaal uitgevoerd; uitrol loopt rechtstreeks via de bestaande Vercel-integratie. Dit is een vaste voorkeur, los van facturatie.
- Digitale producten kopen en openen kan zonder account. Een bevestigd klantaccount blijft vereist voor afspraken. De voorkeur voor gastcheckout geldt dus niet automatisch voor boeken.
- Zes zelfstandige modules van €89 blijven in ontwikkeling tot de definitieve PDF/audio en praktische informatie gecontroleerd zijn. Eerst modules 1–3 voorbereiden.
- Modules, losse vragenlijsten en beschikbare extra's volgen 0%, 5% bij 2–3 en 10% vanaf 4 verschillende items. Vaste profielen behouden hun bevestigde pakketprijs.
- Kevin verwacht de definitieve ondernemings- en verkoopgegevens op 19 oktober van de klant. Ze zijn nog niet ontvangen. Daarom zijn nieuwe bestellingen in productie standaard gepauzeerd via `COMMERCE_SALES_ENABLED`; bestaande aankopen en betaalcontrole blijven bruikbaar.

## Huidige productstand

| Onderdeel | Geïmplementeerd en gericht getest | Resterende grens |
|---|---|---|
| Catalogus | 22 uitgebreide vragenlijstpagina's, acht volledige profielpagina's, beheer, prijsregels en samensteller. Profielen hebben leeftijds-/themafilters en volledige bronteksten. | Instrumentversies/licenties, inhoudelijke goedkeuring en werkelijke professionele afname/rapportlevering blijven verantwoordelijkheid van de eigenaar. |
| Aankopen | Gast- en accountorders, handmatige Wise-verificatie, rechten, afnames, rapporten, veilige aankooplinks en vrijwillige accountkoppeling. | Werkelijke bankontvangst, fiscale/verkoopafspraken en externe mailaflevering moeten voor vrijgave bevestigd zijn. Geen automatische betaalprovider, refundbetaling of facturatie. |
| Modules | Zes covers/detailpagina's, PDF/MP3, private opslag, materiaalversies, preview/publicatie, gemengde aankopen en optionele verdieping. | Alle zes hebben nog geen definitief gepubliceerd materiaal of complete praktische informatie. Geen moduleverkoop. |
| Praktijk | Therapeuten, afspraaktypes, directe links, direct bevestigde boekingen, dossierkoppeling, volledige historiek en afspraakmails. | Echte mail-/uitnodigingsaflevering, werkprocesacceptatie en test met twee gelijktijdige HTTP-boekingen blijven open. Herinneringen/weekoverzichten zijn niet actief. |
| MijnDiAd | 262 momenten, eigenaarsscheiding, alleen-lezen import, gedeelde cache bij gebruik en strengere controle voor boeken. | iCal-publicatie kan achterlopen op de bron; geen wederzijdse realtime kalender. Supabase Free kan bij inactiviteit pauzeren. |
| Contact en mail | Eenvoudige publieke mailvraag met Reply-To; bestaande supportgesprekken blijven behouden. Directe pogingen, duurzame wachtrijen, dagelijkse fallback en `/admin/mail`. | Geen vijfminutengarantie op retries. SMTP, Auth-mail, DNS en inbox-/spamaflevering moeten in de deployment apart worden bewezen. |
| Websitebeheer en SEO | Algemene gepubliceerde CMS-pagina's hebben nu een route; vaste routes zijn beschermd tegen slugconflicten. Sitemap, robots, vaste canonicals en een gecontroleerde set Webnode-redirects/demo-410's zijn toegevoegd. | Geen volledige migratie van alle oude content/locatiepagina's; zie releaserunbook. Redactionele siteonderdelen blijven deels in code. |
| Release | Lokale build, tests, dependency-audit en controle van het echte Vercel-artifact; rechtstreekse Vercel-uitrol na push. GitHub Actions is niet toegestaan. Testmail en lokale output zijn uitgesloten. | Push, Vercel-status en productieacceptatie zijn afzonderlijke stappen. Een groene build bevestigt geen externe mail, betaling of herstelvoorziening. |

## Volgende volgorde

1. Deze geteste wijzigingsset naar `main` pushen en Vercel-uitrol controleren. Houd nieuwe verkoop gepauzeerd tot de ontbrekende gegevens verwerkt zijn.
2. Definitieve verkoper/verwerkingsverantwoordelijke, privacy, levertermijn, voorwaarden, btw-/refundafspraken en bankgegevens invullen en inhoudelijk bevestigen.
3. In de doeldeployment één volledige gastorder/betaling/afname/rapportstroom en één afspraak/dossier/mail/verplaatsing/annulering bewijzen. Test Auth-mail afzonderlijk.
4. Materiaal en praktische informatie van modules 1–3 ontvangen; echte PDF/audio en mobiele klanttoegang controleren vóór beschikbaar maken.
5. Beheeracceptatie, monitoring, back-up/herstel, domein en resterende SEO-migratie sluiten. Daarna verkoop bewust vrijgeven. Community, automatische scoring en extra B2B-functies blijven vervolgfase.

De operationele procedure staat in [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md); besluiten staan in [DECISIONS.md](DECISIONS.md). Alleen bevestigde bedrijfsgegevens worden als definitief gepubliceerd.
