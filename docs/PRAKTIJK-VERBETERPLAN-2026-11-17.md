# MyGrowise — verbeterplan praktijk en cliëntafspraken

**Uitvoering:** geïmplementeerd; databasemigratie toegepast, applicatiedeployment en scheduleractivatie in uitvoering. Zie [uitvoeringsstatus en uitrol](PRAKTIJK-VERBETERINGEN-UITVOERING-2026-11-17.md). De bevindingen hieronder beschrijven het vertrekpunt.

Datum: 17 november 2026. Gebaseerd op de negen aangeleverde aandachtspunten en gerichte inspectie van lokale code en migraties bij commit `6c50b1f`. Dit is een uitvoeringsplan; de bevindingen zijn niet opnieuw in productie of tegen de productiedatabase gereproduceerd. Na akkoord is dit lokaal geïmplementeerd; er zijn geen blijvende databasewijzigingen of deployments uitgevoerd.

## Uitgangspunten en volgorde

De doelgroep is de praktijkbeheerder/begeleider die snel cliënten en vrije momenten wil vinden, en de cliënt die na een bevestigingsmail zijn afspraak moet terugvinden. Het bestaande functionele ontwerp blijft leidend: leesbaarheid, weinig stappen en betrouwbare registratie. De Startpunt-vormgeving in DESIGN.md geldt niet als nieuw ontwerp voor het praktijkportaal.

| Werkpakket | Prioriteit en volgorde | Feedback |
|---|---|---|
| A. Accountkoppeling herstellen | P0, eerst | 1 |
| B. Statusregistratie en historiek | P1, vóór nieuwe mailautomatisering | 9 |
| C. Typografie en agenda | P1, samen ontwerpen en controleren | 2, 4 |
| D. Cliënt zoeken en snel aanmaken | P1, gedeelde zoekbasis eerst | 3, 6, 8 |
| F. Lege foutieve dossiers verwijderen | P1, conservatieve bewaarplichtcontrole | 5 |
| E. Herinneringen en online-informatie | P1, mailtekst vroeg; planning/verzending na statusmodel | 7 |

Controles lokaal; deployments via de bestaande Vercel-integratie. Geen GitHub Actions, betaalde scheduler, betaald abonnement of keepalive. Vercel Free/Hobby en de bestaande Supabase Free-keuze blijven randvoorwaarden.

## 1. Adminafspraak zichtbaar bij Mijn begeleiding

**Bevinding.** `listCustomerBookings()` in `src/lib/supabase/accounts.ts` filtert uitsluitend op `bookings.customer_user_id`. De staff-bookingfunctie neemt die waarde over van `patients.customer_user_id`. Een dossier zonder accountkoppeling kan dus wel een bevestigingsmail krijgen, terwijl de afspraak niet in een account verschijnt. De bestaande `link_patient_customer_account()` vult bij latere koppeling wel `patient_id` in voor accountboekingen, maar vult niet omgekeerd `customer_user_id` in voor eerdere dossierboekingen. Dit is een concrete vermoedelijke oorzaak; de gemelde afspraak moet dit nog bevestigen.

**Uitvoering.**

- Reproduceer met een synthetische adminboeking, zowel vóór als na accountaanmaak/koppeling. Controleer ook de loginredirect vanaf ‘Bekijk mijn afspraak’ en de toegepaste migraties in de doelomgeving.
- Breid de expliciete koppelfunctie transactioneel uit: koppel eerdere boekingen van hetzelfde dossier zonder account aan het geverifieerde account; stop bij een conflicterende bestaande identiteit. Koppeling maakt geen nieuwe bevestigingsmails aan.
- Maak in dossier en planformulier zichtbaar of het cliëntaccount gekoppeld is. Bied de bestaande bevoegde koppelroute aan als dat nog niet zo is. Een cliënt zonder account krijgt een duidelijke route voor accountaanmaak en veilige koppeling.
- Gebruik naam of een gelijk e-mailadres uitsluitend als aanwijzing voor controle, nooit als zelfstandige toegang tot dossier of afspraken. Behoud de expliciete identiteit- en rechtencontrole.
- Lever een herhaalbare herstelmigratie voor bestaande afspraken met een al geverifieerde dossier-accountkoppeling; rapporteer conflicten voor afzonderlijke beoordeling.

**Acceptatie.** Een rechtstreeks gekoppelde en een later gekoppelde adminafspraak verschijnen één keer in Mijn begeleiding. Ongekoppelde, conflicterende en andere accounts krijgen geen toegang. Verplaatsen/annuleren blijven werken. Privénotities blijven intern. Herstel kan opnieuw draaien zonder dubbele events of mails.

## 2. Agenda schermvullend en compacter

**Bevinding.** `UnifiedAgenda.tsx` gebruikt een vaste hoogteformule, halve-uurblokken, een startscroll op 08.30 en een ruimer urenbereik. De gewenste werkdag van 08.00–17.00 past daardoor niet gegarandeerd tegelijk in beeld.

**Uitvoering.** Gebruik de werkelijke beschikbare hoogte onder de navigatie en agendawerkbalk. Maak een compacte werkdagweergave met 08.00–17.00 volledig zichtbaar; behoud kwartierselectie. Verklein vooral rijhoogte en witruimte. Geef afspraken buiten de werkdag een zichtbare indicatie en een actie ‘Alle uren’; verberg die afspraken niet stilzwijgend. Bewaar de gekozen weergave per gebruiker. Lange titels krijgen een korte kaart en volledige details bij openen, met bruikbare toetsenbordbediening.

**Acceptatie.** Test dag/week op 1366×768 en 1440×900 bij 100% zoom: 08.00 én 17.00 zichtbaar zonder verticale scroll binnen de agenda. Controleer korte en overlappende afspraken, MijnDiAd-momenten, blokkades en uren buiten de werkdag. Op kleine schermen en bij 200% zoom krijgt leesbaarheid voorrang en mag scrollen wel. Geen verkleining van de tekst om de hoogte-eis te halen.

## 3. Cliënt selecteren op voornaam of familienaam

**Bevinding.** `AgendaClientPicker.tsx` heeft al zoeken op naam/e-mail, met 250 ms vertraging, gevolgde resultaten in een apart selectveld en paginering. De backend gebruikt `agenda_client_choices`. Controleer eerst of dit daadwerkelijk actief is in de gemelde omgeving.

**Uitvoering.** Maak van zoeken en selecteren één toegankelijke combobox met direct zichtbare resultaten. Ondersteun gedeeltelijke voornaam, familienaam, samengestelde naam, hoofdletters en waar mogelijk accenten. Naam is primair; e-mailadres en toegestane extra herkenningsinformatie helpen bij gelijke namen. Voeg leeg-, laad-, fout- en geen-resultatenstatus toe, plus toetsenbordselectie en bescherming tegen oude zoekantwoorden. Hergebruik in adminformulier en praktijkdialoog. Behoud toegang uitsluitend tot toegestane cliënten en toon archivering expliciet.

**Acceptatie.** Zoeken op een deel van voornaam én familienaam vindt dezelfde cliënt, ook met een afwijkend e-mailadres. Test gelijke namen, paginering, snelle invoer, fout/herstel en selectie die behouden blijft wanneer afspraaktype of tijd verandert.

## 4. Leesbaarheid in dossiers, details en boekingen

**Bevinding.** Onder meer `practice-management.css`, `admin.css` en de cliëntpagina gebruiken functionele tekst van circa 11–13 px, soms kleiner. Boekingen hebben meerdere kleine secundaire regels en acties.

**Uitvoering.** Leg functionele typografietokens vast voor admin/praktijk: richtwaarde 16 px voor dossierinhoud, namen, invoer en boekingsgegevens; minimaal 14 px voor secundaire labels, datums en badges, met voldoende regelhoogte en contrast. Begin bij Boekingen, daarna cliëntlijst/dossier, vertrouwelijk dossier, afspraakdetails, begeleider en status. Geef naam, datum/tijd en status een duidelijke hiërarchie. Verbeter tabelruimte en mobiele stapeling. Stem dit af op de compacte agenda uit punt 2.

**Acceptatie.** Visuele controle met korte/lange namen, veel boekingen, lange notities en kleine schermen. Bij 200% zoom blijven inhoud en acties bereikbaar; geen afgekapt betekenisvol label. Controleer toetsenbordfocus en contrast. Geen medische of vertrouwelijke details in zoekresultaten.

## 5. Foutieve dossiers definitief verwijderen

**Uitvoering.** Superadmins kunnen een gearchiveerd, leeg en ongekoppeld dossier verwijderen na redenkeuze, het overtypen van de cliëntnaam en bevestiging van de controle op bewaarplicht. De database controleert dit opnieuw binnen dezelfde transactie. Afspraken (ook geannuleerd), verslagen (ook concept), zorggegevens en een gekoppeld account blokkeren de actie. Auditregistratie bewaart het verwijderde ID en de reden, zonder naam/e-mail te kopiëren. Geen automatische verwijdering op basis van een verzonnen bewaartermijn. Verwijdering van een account of een zorgdossier met historie blijft een afzonderlijk te beoordelen privacyverzoek.

**Acceptatie.** Test rolcontrole, ontbrekende/onjuiste bevestiging, eerst archiveren, zorggegevens en succesvolle verwijdering van een synthetisch leeg dossier. Geen afspraken of verslagen mogen via een cascade verdwijnen.

## 6. Nieuwe cliënt tijdens het plannen

**Bevinding.** Nieuwe dossiers kunnen al met naam en optionele e-mail worden aangemaakt via de dossierroute. De agenda selecteert alleen bestaande dossiers; een staff-boeking vereist nu een e-mailadres.

**Uitvoering.** Voeg bij de cliëntkiezer ‘Nieuwe cliënt’ toe met naam, e-mail en geboortedatum. Overige dossiergegevens kunnen later. E-mail is nodig voor de gevraagde bevestiging/accountflow; maak een afspraak zonder e-mail niet stilzwijgend mogelijk. Bewaar geselecteerde professional, tijd en afspraaktype tijdens de aanmaak. Controleer mogelijke dubbels en laat een bestaande cliënt kiezen. Maak minimale cliënt, toewijzing en afspraak atomair en idempotent via een serveractie; een bezet tijdstip mag geen verweesd dossier of dubbele mail opleveren. Geef een succesvolle boeking terug met mailstatus en accountkoppelstatus.

**Acceptatie.** Nieuwe cliënt en afspraak kunnen vanuit één planningsflow worden opgeslagen. Geen verlies bij validatiefouten, teruggaan of een mislukte overlapcontrole. Dubbelklikken maakt één dossier en één afspraak. De gemaakte afspraak volgt dezelfde accountkoppeling als punt 1.

## 7. Herinneringsmail en Google Meet

**Bevinding.** De boekingswachtrij ondersteunt `confirmation`, `rescheduled`, `cancelled`; er is geen herinneringsproducent of Meet-verzending gevonden. Een herinneringsvoorkeur bestaat al, maar wordt nog niet uitgevoerd. `vercel.json` heeft één dagelijkse mailfallback; `mailWorker.ts` verwerkt daarbij momenteel maximaal vier boekingsmails. Dat is geen toereikende basis voor tijdkritische of grotere aantallen herinneringen.

**Bevestigingsmail.** Voeg bij online sessies in HTML én platte tekst de gevraagde tekst toe:

> Vijf minuten vóór uw afspraak ontvangt u via e-mail een link naar Google Meet om deel te nemen aan uw online sessie.

Kevin bevestigde dat de begeleider deze link handmatig verstuurt. Gebruik de zin niet bij fysieke sessies of annuleringen. Automatisch Meet-links aanmaken is geen bewezen bestaande functie en vraagt een afzonderlijk integratiebesluit als de begeleider/externe agenda dit niet al verzorgt.

**Herinneringsplanning.** Bevestigd door Kevin: exact 72 verstreken uren vóór de afspraak. Gebruik `starts_at - interval '72 hours'`, ook bij zomer-/wintertijd. De begeleider verstuurt de Google Meet-link zelf; de mailtekst beschrijft deze handmatige werkwijze.

**Uitvoering.** Voeg een afzonderlijk mailtype en uniek event per afspraak/planningsversie toe. Verstuur alleen voor actuele bevestigde afspraken en volgens de bestaande herinneringsvoorkeur. Bij verplaatsen: oude job ongeldig maken, nieuwe deadline bepalen. Bij annuleren/no-show/afronden: niet meer versturen. Afspraken die na de herinneringsdeadline zijn gemaakt krijgen alleen hun bevestiging; geen onmiddellijke dubbele mail. Voor bestaande afspraken alleen toekomstige geldige deadlines aanmaken. Leg verlopen deadlines vast en verstuur geen oude herinnering alsnog vlak vóór of na de afspraak.

Breid claim/batches, retries, capaciteit en logboek uit; plan `scheduled_for`, `sent_at`, foutstatus en vertraging. Stuur niet alle historische deadlines bij uitrol. Onzekere SMTP-aflevering blijft een apart risico: unieke jobs voorkomen dubbele planning, maar leveren zonder idempotente mailprovider geen absolute garantie op één aflevering.

**Gratis planning.** De bestaande dagelijkse Vercel-worker blijft fallback. Voor 72-uursdeadlines is een post-deployment-installer voorbereid voor Supabase Cron (`pg_cron`, reeds aanwezig), `pg_net` en Vault. Een minuutcontrole roept alleen bij daadwerkelijk vervallen herinneringswerk het beveiligde boekingsmailendpoint aan, zonder cliëntgegevens in de aanvraag. Secrets blijven in Vault en Authorization-headers. Er is geen betaalde dienst, GitHub Action of keepalive toegevoegd. Zie [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) en [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net). Een herinnering mag tot 15 minuten na de deadline opnieuw worden geprobeerd; daarna wordt ze bij workercontrole ongeldig verklaard. Dit voorkomt dat de dagelijkse fallback oude herinneringen op een verkeerd tijdstip verstuurt. De installer wordt pas na de passende applicatiedeployment uitgevoerd en controleert eerst de endpointversie/autorisatie.

Minuutplanning betekent een streefmoment en meetbare vertraging; exact mailboxontvangst op 72 uur of vijf minuten is niet te garanderen. Ook [Supabase Free-pauzering](https://supabase.com/docs/guides/platform/free-project-pausing) blijft een operationele beperking; voeg geen keepalive toe.

**Acceptatie.** Test planning, voorkeur uit, geen account, herhaalde worker, verplaatsen, annuleren, no-show, providerfout, achterstand en meer dan vier gelijktijdige mails. Bewijs verzending met synthetische afspraken en mailboxcontrole. Maak geplande en werkelijke verzending zichtbaar. Meet-tekst is pas klaar als de beloofde werkwijze aantoonbaar werkt.

## 8. Algemene cliëntzoekfunctie bovenaan

**Bevinding.** De agenda zoekt nu alleen binnen de reeds geladen periode, op titel, subtitel en locatie. Het is geen algemene cliëntzoekfunctie. De admin- en praktijklayouts hebben nog geen centrale cliëntzoeker.

**Uitvoering.** Voeg een gedeelde cliëntzoeker toe aan beide bovenbalken voor rollen met dossierinzage. Gebruik dezelfde beperkte zoekbasis als punt 3, met resultaatnaam en veilige herkenningsinformatie. Geef per cliënt directe links naar dossier, notities en afspraken met bestaande ankers/routes. Hernoem het bestaande agendaveld naar ‘Zoek in deze agendaperiode’ met korte toelichting.

Bewaar maximaal vijf recente dossierbezoeken per medewerker aan serverzijde, uitsluitend cliënt-ID en laatste bezoektijd. Filter bij elk opvragen op actuele toegangsrechten; wis via ‘Recente cliënten wissen’. Geen namen, notitiefragmenten of e-mailadressen in lokale browseropslag. Zoek niet automatisch in vertrouwelijke notitie-inhoud. Gebruik korte vertraging, beperkte resultaten en geen volledige dossierqueries voor elke toetsaanslag.

**Acceptatie.** Vanuit elke bevoegde admin-/praktijkpagina kun je een cliënt buiten de agendaperiode vinden en naar de drie onderdelen gaan. Toegang intrekken/archiveren werkt ook door in recente resultaten. Test toetsenbord, mobiel, geen resultaten, laadfout en opruimen bij accountverwijdering.

## 9. No-show en andere statussen

**Huidig gedrag volgens code.** ‘Niet verschenen’ zet een bevestigde afspraak op `no_show`; de moderne agenda/detailpagina biedt dit vanaf de starttijd aan. De afspraak blijft bewaard met statusevent en auditregistratie. De algemene status-RPC handhaaft de tijdsgrens nog niet, zodat dit voor alle ingangen gelijkgetrokken moet worden. Er wordt geen aparte no-showmail ingepland en geen factuur aangemaakt. Het statusevent is wel cliëntzichtbaar en kan een melding in het account opleveren. Geannuleerde afspraken zijn standaard uit het agendaraster gefilterd; de data blijven bestaan. Een reeds wachtende bevestigingsmail kan volgens `booking_mail_is_current()` nog geldig zijn bij `no_show`; dat moet bij het mailherstel worden afgedekt.

**Uitvoering.**

- Behoud hoofstatussen `cancelled` en `no_show`; voeg gescheiden interne velden toe voor annuleringscategorie (`tijdig`, `laattijdig`, `onbekend`) en no-showfacturatie (`onbeoordeeld`, `gefactureerd`, `niet_gefactureerd`). Historische records krijgen geen verzonnen classificatie.
- Toon begrijpelijke combinaties zoals ‘Tijdig geannuleerd’, ‘Laattijdig geannuleerd’, ‘No-show — gefactureerd’ en ‘No-show — niet gefactureerd’. ‘Gefactureerd’ is een administratieve registratie, geen opdracht om een factuur te genereren; leg waar beschikbaar een factuurreferentie vast.
- Voeg een expliciete interne registratieactie toe, zonder automatische mail of cliëntmelding. Splits die van de bestaande actie ‘Annuleren en cliënt informeren’. Regel dit in de database/RPC én triggers, niet alleen door de verzendfunctie in de UI over te slaan.
- Maak alle ingangen consistent: agenda, afspraakdetail, adminboekingen en praktijkboekingen. Houd tijdsvoorwaarden, revisiecontrole en rechten servermatig aan.
- Bewaar tijdstip, uitvoerder, vorige/nieuwe categorie en facturatiebeslissing in interne historiek. Sta bevoegde correctie toe met auditspoor, ook na een eerdere eindstatus. Cliënt krijgt de algemene afspraakstatus te zien, zonder interne facturatie- of beslisdetails.
- Dossier en boekingenhistoriek tonen annuleringen/no-shows standaard; agenda houdt een duidelijk gelabeld filter. Laat administratieve tellingen dezelfde classificatie gebruiken.

**Acceptatie.** Elke nieuwe combinatie is terug te vinden, corrigeerbaar en zichtbaar in historiek. Interne registratie maakt nul mailjobs en nul cliëntmeldingen aan. Gewone annulering mét informeren blijft werken. Dubbel opslaan en gelijktijdige wijzigingen geven geen dubbele registratie. Nieuwe reminders en achterhaalde bevestigingen worden onderdrukt zodra de afspraak niet meer actief is.

## Verificatie en oplevering

Per werkpakket: gerichte tests van gedrag en rechten, daarna lokaal `npm test` en `npm run check`; bij migraties ook relevante databasecontroles in een geïsoleerde testomgeving. Gebruik onder andere de bestaande afspraak-, agenda- en mailtests. Voeg integratieproeven toe voor identiteit, interne statusupdates, atomair aanmaken en maildeadlines; alleen tekst- of broncodechecks bewijzen deze flows niet.

Voer de visuele controle van agenda, zoekers, dossiers en Boekingen gezamenlijk uit op desktop, mobiel en 200% zoom, met synthetische gegevens. Daarna migratie-/herstelcontrole, deployment via bestaande Vercel-integratie en gerichte acceptatie in de doelomgeving. Productiemails uitsluitend naar afgesproken testontvangers. Noteer per punt afzonderlijk: gebouwd, lokaal bewezen, uitgerold, productieacceptatie.

Nog te beantwoorden bedrijfskeuzes blokkeren alleen hun afhankelijke deel: herinneringstijdstip; huidige Meet-verzending en eigenaarschap; eventuele gewenste automatische berekening van tijdig/laattijdig. Tot een grens is bevestigd, is die categorie een expliciete interne keuze en wordt geen termijn verzonnen.
