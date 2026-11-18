# Virginies verzoeken en actuele status

Bronaudit op 18 november 2026, aangevuld met acceptatiecontrole tegen lokale HEAD `7bbc3ca`. De remote `origin/main` en remote HEAD wijzen tijdens de aanvullende controle naar dezelfde commit. Zie [acceptatiecontrole](PRAKTIJK-ACCEPTATIE-2026-11-18.md) voor nieuwe productietests en een gevonden fout in de herinneringsverwerking.

Bronnen: de volledige twee pagina's van de pdf “MyGrowwise – Overzicht aandachtspunten en verbeteringen”, doorgestuurd op 17 november om 19.34 uur, en het Messenger-gesprek vanaf dat document tot het laatst zichtbare bericht van Kevin om 22.08 uur. De relevante referentiefoto's zijn eerder bekeken. Om 21.09 uur staat onder het ebookgedeelte nog het verzoek om MyGrowise naar Google Agenda te koppelen. Dit ontbrak in het eerdere voorstel.

De oorspronkelijke controle betrof bronvergelijking en inspectie van code, Git en bestaande uitvoeringsregistraties. De aanvullende acceptatiecontrole omvat synthetische productieformulieren en mailtransport; zij vervangt geen volledige visuele acceptatie of controle van Virginies oorspronkelijke account.

## Negen punten uit de pdf

| Nr | Verzoek | Stand en wat nog resteert |
|---|---|---|
| 1 | Adminafspraak zichtbaar in Mijn begeleiding na inloggen | Gebouwd en uitrol geregistreerd. Geverifieerde dossier-accountkoppeling werkt door naar bestaande afspraken; conflicterende identiteiten worden geblokkeerd. Concrete ingelogde eindcontrole van de oorspronkelijk gemelde afspraak blijft nodig. |
| 2 | Schermvullende compacte agenda met 08.00–17.00 zichtbaar | Compacte werkdag en aangepaste hoogteberekening gebouwd; verdere agendawerkruimtewijzigingen staan inmiddels in lokale en remote HEAD `7bbc3ca`. Definitieve schermacceptatie op de afgesproken desktopformaten, mobiel en zoom niet uit de eerdere uitrolverslagen afleiden. |
| 3 | Tijdens plannen zoeken op gedeeltelijke voornaam/familienaam | Gebouwd en uitgerold: naam/e-mail, deelzoekopdracht, accentnormalisatie en toetsenbordselectie. |
| 4 | Grotere leesbare tekst in dossiers, namen, details, datums, vertrouwelijk dossier, begeleider, status en vooral Boekingen | Functionele typografie aangepast en uitgerold, plus filters/paginering bij Boekingen. Visuele acceptatie van alle genoemde oppervlakken blijft te controleren. |
| 5 | Testcliënten, dubbele accounts en foutieve registraties definitief verwijderen met bevestiging en bewaartermijnen | Gedeeltelijk ingevuld: lege, gearchiveerde, ongekoppelde dossiers mogen door superadmin worden verwijderd met reden, naam overtypen en bevestiging. Zorggegevens, verslagen, afspraken en gekoppelde accounts blokkeren verwijderen. Dubbele accounts verwijderen of dossiers met historie samenvoegen/opruimen is niet geleverd. |
| 6 | Vanuit vrij agendatijdslot cliënt aanmaken met naam, e-mail en geboortedatum | Gebouwd en uitgerold. Later uitgebreid naar aparte voornaam/achternaam; cliënt en afspraak atomair/idempotent. |
| 7 | Herinneringsmail drie dagen vooraf en Meet-informatie in bevestiging | De bij productieacceptatie gevonden claimfout is nadien op Kevins verzoek hersteld met productiemigratie `20261118100000`. Geldige toekomstige herinneringen blijven bewaard; de twee getroffen toekomstige taken staan weer op wachtend. Minuutplanning blijft in Supabase, Vercel wordt alleen bij werkelijk werk aangeroepen; plannerlogs worden na zeven dagen opgeruimd. Zie acceptatieverslag voor de ketenproef. Meet-tekst aanwezig; link handmatig door begeleider. |
| 8 | Centrale cliëntzoeker, recente cliënten, dossier/notities/afspraken; duidelijk doel agendazoekveld | Gebouwd en uitgerold, inclusief serverzijdige recente dossiers en rechtencontrole. Zoekveld binnen agenda heet Zoek in deze agendaperiode. |
| 9 | Tijdige/laattijdige annulering en no-show gefactureerd/niet gefactureerd, intern zonder mail, behoud historiek en uitleg no-show | Gebouwd en uitgerold: interne registratie, correcties en auditspoor zonder automatische cliëntmail. No-show vanaf starttijd; geen factuur of betalingsverzoek. Gewone annulering mét informeren blijft apart. |

Uitroldetails en bewijsgrenzen: [praktijkuitvoering](PRAKTIJK-VERBETERINGEN-UITVOERING-2026-11-17.md).

## Aanvullende praktijkverzoeken in Messenger

| Tijd 17 november | Verzoek | Stand |
|---|---|---|
| 19.39 | Naam, voornaam en e-mail niet opnieuw hoeven invullen | Gebouwd; migratie en applicatie-uitrol geregistreerd. Nieuwe directory- en agendacliënten bewaren aparte naamonderdelen. Negen oudere dossiers hadden geen veilige bron voor naamherstel en vragen eenmalige handmatige aanvulling. |
| 19.41 | Alle gevraagde aanheffen | Gebouwd en uitgerold: heer, meneer, mevrouw, heer/mevrouw, ouder(s)/verzorger(s) van, echtpaar en geen aanhef; gedeelde validatie en mailbegroeting. |
| 19.44 | Eerst therapeut, dan alfabetische afspraaktypes | Gebouwd en uitgerold in nieuwe-afspraakpagina en praktijkagendadialoog. Eén toegestane therapeut vooraf gekozen, geen stilzwijgend gekozen type. |
| 19.52 | Leeftijd naast geboortedatum | Gebouwd en uitgerold in dossier en formulier; dynamische berekening, geen opgeslagen leeftijd. |
| 19.56 | Informatiemail naar overgezette patiënten over ITransform/MyGrowise | Nog open. Geen aangetoonde specifieke verzendronde of ingerichte migratiewelkomstflow. |
| 20.10 | Vanuit e-mailadres in dossier mailvenster openen en bijlagen toevoegen | Nog open. De bestaande afspraak-/supportmails realiseren dit verzoek niet. |
| 20.11 | Na uitgevoerde sessie mail met overschrijvingsgegevens, vooral voor Virginie | Nog open. Status Uitgevoerd bestaat, betaalmail niet. |
| 20.13 | Bij no-show ook overschrijvingsverzoek | Nog open. De interne aanduiding gefactureerd verstuurt niets en maakt geen factuur. |
| 20.15 | Vervolgafspraak plannen met zicht op agenda en vrije momenten | Nog open. Knoppen en cliëntvoorselectie bestaan; ze openen nog de nieuwe-afspraakpagina met datum/tijdveld zonder agenda/beschikbare-tijdenweergave. |
| 21.09 na ebook | Nieuwe MyGrowise-afspraak ook in Google Agenda, zodat MijnDiAd die via Google blokkeert | Nog open en eerder gemist. Er bestaat MijnDiAd-import naar MyGrowise, geen aangetoonde uitgaande Google-koppeling. De werking Google naar MijnDiAd is Virginies beschrijving, niet hier geverifieerd. Ook verplaatsen, annuleren en synchronisatielussen moeten bij ontwerp worden meegenomen. |

Uitroldetails van de vier aanvullende gratis verbeteringen: [cliëntgegevens en afspraakkeuze](CLIENTGEGEVENS-EN-AFSPRAAKKEUZE-UITVOERING.md). Migratie `20261117180000` en implementatiecommit `7d05f9d`; technische live-bundelcontrole geregistreerd. Ingelogde volledige formulieracceptatie is niet volledig vastgelegd. De latere [UI/UX-uitvoering](UI-UX-PRAKTIJK-UITVOERING-2026-11-18.md) beschrijft aanvullende synthetische desktop-/mobielproeven en verslagbescherming, maar bewijst niet elk oorspronkelijk verzoek in productie.

## Ebookmeldingen

- 20.29: volledige betalingsgegevens in de aankoopmail zodat opnieuw inloggen niet nodig is.
- 20.59, met vervolg om 21.22: activatiecode/link geweigerd, volgens Virginie niet door een spatie.

Kevin gaf eerder expliciet aan dat het ebook is opgelost. De activatiemelding staat daarom als door Kevin afgemeld, niet als in deze ronde opnieuw bewezen met haar concrete aankoop/activatie.

Bij de betalingsmail is er een concrete afwijking: `src/lib/catalog/mail.ts` voegt bij bestelling bedrag en referentie toe, maar geen IBAN/begunstigde. De knop opent een persoonlijke aankooplink naar de betaalpagina, zonder verplicht account. Dat kan de inlogfrictie oplossen, maar realiseert niet haar letterlijke verzoek om alle overschrijvingsgegevens in de mail te zetten. Dit deel blijft inhoudelijk open tenzij Kevin die eerdere afbakening uitdrukkelijk handhaaft. Geen nieuwe ebookwijzigingen uit deze audit.

## Open werk en acceptatie

Zes inhoudelijke praktijkuitbreidingen: informatiemail, mailvenster met bijlagen, betalingsmail na sessie, betalingsmail bij no-show, visueel vervolgplannen en uitgaande Google Agenda-koppeling.

De eerste vijf staan in het eerdere familievoorstel voor samen €360. Google Agenda valt buiten die afbakening en is nog niet geprijsd. De audit wijzigt geen offerte en verleent geen opdracht tot uitvoering of verzending.

Daarnaast: veilige afhandeling van dubbele accounts/dossiers met historie, eenmalige aanvulling van de negen oude naamrecords, concrete oorspronkelijke accountafspraakcontrole en volledige visuele acceptatie. Live aanheffen, naamovername en leeftijd zijn inmiddels positief getest. Kevin bevestigde ontvangst van de eerdere testmail. De herinneringsclaimfout is daarna hersteld; zie acceptatieverslag voor de nieuwe ketenproef. Handmatige Meet-linkversturing is de gekozen werkwijze, geen nog te bouwen automatisering.

Ook de volledige bankgegevens in de aankoopmail zijn volgens de huidige code nog niet opgenomen, ondanks de eerdere algemene afmelding van het ebook.
