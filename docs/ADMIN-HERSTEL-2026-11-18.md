# Herstel van de /admin-audit

Alle zestien genummerde bevindingen uit [de audit](./ADMIN-AUDIT-2026-11-18.md) zijn in de lokale code aangepakt. Dit document beschrijft de implementatie en verificatie; het oorspronkelijke auditrapport blijft als momentopname bewaard. Geen deployment, productiegegevenswijziging of mailverzending uitgevoerd.

| Audit | Herstel |
|---|---|
| F01 — kleur/groepsselectie | De selector vindt uitsluitend het kleurinput. Een echte Chrome-test wisselt tussen twee groepen en controleert zowel kleur als ongewijzigde groeps-ID's. |
| F02 — invoerverlies | Content POST rechtstreeks naar de editor: bij fouten wordt het formulier met de ingezonden inhoud opnieuw gerenderd. Werkt ook zonder JavaScript en zonder grote cookies. Content en producten hebben een vertrekwaarschuwing. De module-editor bewaart gewijzigde andere secties tijdelijk in sessionStorage vóór een reload en herstelt ze daarna; revisievelden komen uitsluitend van de server. Verder typen tijdens een request blijft eveneens behouden. Een gekozen bestand blokkeert een ongerelateerde reload. Geblokkeerde browseropslag geeft een fout vóór de actie als een concept nodig is. |
| F03 — onvolledige modulecreatie | Generieke creatie is beperkt tot e-books. UI en oude POST-ingang verwijzen gespecialiseerde typen naar hun bestaande beheerflow. De service weigert gespecialiseerde creatie en typewijzigingen van bestaande producten. Het bestaande Fien-boek blijft ondanks zijn technische guide-type in de producteditor met zijn eigen leveringsflow; het gaat niet naar de module-editor. Er worden geen bestaande records automatisch omgebouwd. |
| F04 — mailretry via oud pad | Oude catalogus-mailactie doet geen mutaties meer en verwijst naar Mailopvolging. Centrale retry vereist bevestiging, valideert wachtrij en eventueel taak-ID, registreert de aanvraag vóór mutatie en wijzigt alleen mislukte taken. Leasevelden worden afgestemd op de wachtrij. |
| F05 — standaard Superadmin | Nieuw account heeft een verplichte, lege rolkeuze. De bestaande servervalidatie weigert een ontbrekende rol vóór accountcreatie. |
| F06 — contrast en kleine tekst | Leesbaar secundair teksttoken, cataloguskleuren op gedeelde tokens, grotere relevante metadata en formulierhints. Tekstgebieden gebruiken het gedeelde lettertype; mobiel heeft de inhoudeditor 16px tekst. Contrasttest op wit, canvas en subtiele achtergrond. |
| F07 — mobiele mailtabel | Gedeelde AdminMailSummary met expliciete cellabels en drie statuskolommen op mobiel. Ook het laatste label blijft zichtbaar. Chrome controleert de werkelijk berekende pseudo-elementstijl en pagina-overflow. |
| F08 — onzichtbare privacyfout | Foutredirect krijgt een zichtbare melding dat niet is opgeslagen, met herstelinstructie. |
| F09 — stille limieten | Klantoverzicht: databasepaginatie en zoeken op naam; levenslange ordertotalen worden volledig opgehaald voor de klanten op de pagina. Team: alle Auth- en rolpagina's worden gelezen, daarna zichtbare paginatie. Privacy: standaard open verzoeken, aparte afgehandelde/alle weergaven, volledige tellingen. Taken, content, afnames, versies en de vier klantdetailsecties hebben bereikbare vervolgpagina's. Afnamefilters worden vóór paginatie toegepast. |
| F10 — dood Professionals-pad | Oude pagina redirect naar Therapeuten; bestaande verwijzing vanuit Boekingen gecorrigeerd. |
| F11 — dubbele navigatie | Dubbele Profielen-ingang verwijderd. Vragenlijsten/profielen, productoverzicht, modules en websitecontent staan bijeen onder Aanbod & content. |
| F12 — dashboardhiërarchie | Dubbel aandachtpaneel verwijderd; het centrale Op te volgen-overzicht blijft de ingang. Recente bestellingen en komende afspraken linken rechtstreeks naar hun detail. Omzet gebruikt de beschikbare breedte. |
| F13 — maildiagnose | Filterbare, gepagineerde taaklijst met referentie, aanmaakmoment, pogingenaantal, planning/lease en veilige foutuitleg. Gericht opnieuw proberen per taak, naast expliciete bulkherstelactie. Willekeurige providerfouten, ontvangers en mailinhoud worden niet naar de browser gestuurd. De websitewachtrij wordt zonder niet-bestaande foutkolom uitgelezen. |
| F14 — inhoud van versies/herstel | Historische versie en huidige inhoud naast elkaar bekijken. Een versie kan als concept in de editor worden geladen. Dit wijzigt niets op de website totdat iemand expliciet opslaat; bestaande versies blijven bestaan. Selectie is begrensd op content-ID én versie-ID. |
| F15 — nulresultaten | Afnames tonen een gerichte nulresultaatmelding en wissen-actie, inclusief actief bestelfilter. Vragenlijsten en modules hebben een expliciete lege toestand. Content behoudt zijn bestaande nulresultaatmelding en gebruikt volledige tellingen. |
| F16 — succes als fout | Accountcreatie, rolwijziging, schorsing en heractivering gebruiken succesfeedback; fouten blijven foutmeldingen. |

## Verificatie

- `npm test`: **184 geslaagd, 0 mislukt** in de geteste werkstaat. Andere gelijktijdige werkzaamheden voegen ook tests toe; 24 van de huidige tests zijn specifiek voor dit herstel.
- `npm run test:admin:audit`: de 24 gerichte regressietests in `tests/admin-audit-fixes.test.mjs`.
- `npm run check`: TypeScript en Astro-productiebuild geslaagd.
- `git diff --check`: geslaagd.
- `tests/admin-audit-browser.mjs`: negen scenario's geslaagd in lokale Chrome, op 1440px en 390px. De test gebruikt echte gedeelde componenten, synthetische gegevens en onderschepte module-API's. De native content-POST doorloopt de echte formulierhandler met JavaScript uitgeschakeld; de fixture weigert geldige schrijfacties en laat alleen de bekende validatiefout toe.

Browser uitvoeren met een beschikbare Playwright-installatie:

```sh
PLAYWRIGHT_MODULE=/absoluut/pad/naar/playwright/index.mjs npm run test:admin:audit:browser
```

De test hergebruikt zo mogelijk de lokale Astro-server op 4321/4322, of start een eigen server. `MYGROWISE_AUDIT_ORIGIN` kan een andere lokale oorsprong aanwijzen. Tijdelijke fixture wordt na afloop verwijderd. Er is geen nieuwe browserdependency aan het project toegevoegd. Schermafbeeldingen staan lokaal in `/tmp/mygrowise-admin-audit-fixes/`.

## Grenzen en resterende operationele observaties

Dit herstel vereist geen nieuwe databasemigratie of betaalde dienst. Er zijn geen GitHub Actions toegevoegd of gebruikt. De bestaande Vercel Hobby-integratie en dagelijkse mailronde blijven gelden.

De auditobservatie over testachtige of dubbel ogende cliëntgegevens is geen van de zestien codebevindingen. Echte dossiers zijn niet verwijderd of samengevoegd. Een alleen-lezen cataloguscontrole vond zeven module/guide-producten en nul ontbrekende module-details, na uitsluiting van het Fien-boek dat een eigen leveringsflow heeft. Er waren dus geen bestaande onvolledige modules te herstellen. De nieuwe creatieblokkade voorkomt dat het onvolledige aanmaakpad zulke records maakt.

Geen volledige belastingtest, fysieke touchtest, penetratietest of productieacceptatie uitgevoerd. De browserproeven gebruiken lokale componenten en fixtures; ze vervangen geen acceptatie van echte publicaties, uitnodigingen, mailbezorging of financiële mutaties. De werkmap bevatte en bevat ook wijzigingen van andere werkzaamheden; die zijn behouden.
