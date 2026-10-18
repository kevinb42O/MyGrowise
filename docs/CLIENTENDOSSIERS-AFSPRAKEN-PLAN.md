# MyGrowise — plan cliëntendossiers en afsprakenbeheer

Datum: 18 oktober 2026. Voor Kevin, op basis van de aangeleverde klantfeedback, negen referentiefoto's van MijnDiAd en een gerichte controle van de lokale code bij commit `b2cfabd`, inclusief aanwezige lokale wijzigingen. De foto's verduidelijken de gewenste werking; zichtbare knoppen, instructieteksten en voorbeeldinstellingen gelden niet automatisch als opdracht voor MyGrowise. Dit document bewaart het overeengekomen uitvoeringsplan. De eerste implementatie is lokaal gebouwd; zie [PRACTICE-IMPLEMENTATION.md](PRACTICE-IMPLEMENTATION.md) voor de concrete status, uitgevoerde tests en nog uit te voeren productiecontroles.

**Vaststaande verduidelijking van Kevin:** een online boeking moet onmiddellijk definitief bevestigd zijn. De therapeut hoeft de boeking niet eerst goed te keuren. Een bevestigingsmail volgt automatisch.

## 1. Doel en afbakening

De praktijkbeheerder kan zelfstandig therapeuten, afspraaktypes, behandelkleuren en rechtstreekse boekingslinks beheren. Een cliënt boekt bij de juiste therapeut het juiste afspraaktype; persoonsgegevens, dossier, afspraak, agenda en bevestigingsmail sluiten automatisch op elkaar aan.

Deze opdracht betreft cliëntendossiers, praktijkbeheer en de volledige afsprakenflow. De overige dashboardonderdelen zijn door de klant nog niet beoordeeld en vallen buiten deze beoordeling.

De oorspronkelijke tekst noemt DIAT; de later aangeleverde foto's tonen MijnDiAd. Dit plan gebruikt daarom verder de naam DIAD. De laatste zin van punt 10 is afgebroken; zelfstandig beheer is duidelijk gevraagd, eventuele ontbrekende aanvullende eisen zijn niet ingevuld.

De referentiefoto's onderbouwen vooral een compact dossierformulier, een centraal overzicht van afspraaktypes, een linkgenerator met voorselecties en een planner die vastgelegde keuzes overslaat. Ze tonen daarnaast optionele functies zoals privéagendakoppelingen, herinneringen en factuurinstellingen. Die extra functies krijgen hieronder een expliciete scopekeuze. Persoonsgegevens en privéagendatokens uit de voorbeelden worden niet overgenomen in documentatie, testdata of ontwerpen.

## 2. Startpunt vóór deze implementatie

| Onderdeel | Aanwezig in code | Benodigde uitbreiding |
|---|---|---|
| Cliëntendossier | Naam, e-mail, accountkoppeling, toewijzingen, notities en archivering | Volledige persoonsgegevens, aanmeldingsgegevens, bewerken en overzicht bovenaan |
| Dossierhistoriek | Gekoppelde afspraken, gesorteerd van nieuw naar oud | Afspraaktype, duidelijke status, volledige bereikbaarheid via paginering, bruikbaar overzicht van sessiedata |
| Afspraak boeken | Bevestigd klantaccount, beschikbaarheid, bescherming tegen overlap en herhaalde inzending | Afspraaktype, gegevens verzamelen, automatische dossierkoppeling en onmiddellijke definitieve bevestiging |
| Beschikbaarheid | Standaardduur per therapeut | Duur per aangeboden afspraaktype, met controle op de volledige benodigde periode |
| Agenda | Boekingen en afzonderlijke agenda-items; boekingskleur hangt af van status | Behandelkleur, type en intake/vervolg zichtbaar in beide agendaweergaven |
| Mails | Mailvoorzieningen voor support/catalogus en boekingsmeldingen in het klantaccount | Betrouwbare automatische afspraakbevestigingsmail met therapeut en type |
| Therapeutenbeheer | Overzicht en profiel-/beschikbaarheidsfuncties | Volledige beheerflow voor toevoegen, wijzigen, activeren en deactiveren |
| Publieke planner | Therapeut uit database én vaste lijst in `src/content/site.ts` | Nieuwe therapeuten vanuit beheer kunnen publiceren zonder codewijziging |

De dossierquery haalt momenteel maximaal 100 afspraken op. Een hoger totaalaantal betekent dus nog geen volledig doorbladerbare historiek. De huidige publieke boekingsfunctie maakt een aanvraag aan en koppelt daarbij nog niet automatisch een dossier.

Bronnen: `src/lib/clientRecords.ts`, `src/pages/admin/clienten/[id].astro`, `src/lib/practiceStore.ts`, `src/pages/api/bookings.ts`, `src/pages/begeleiding/[slug].astro`, `src/lib/adminAgenda.ts`, `src/lib/practiceAgenda.ts`, `src/components/admin/UnifiedAgenda.tsx`, `src/pages/admin/professionals/index.astro`, `src/lib/adminPermissions.ts` en bijbehorende migraties.

Dit bevestigt de lokale implementatie, niet welke migraties, mailinstellingen of deployments in productie actief zijn.

## 3. Cliëntendossier

Bij het openen verschijnt bovenaan een vaste overzichtskaart met alle twaalf gevraagde gegevens:

- Voornaam en achternaam als afzonderlijke velden.
- Geboortedatum.
- Geslacht.
- Aanhef, afzonderlijk van geslacht.
- Intakedatum.
- Adres: straat, huisnummer, bus, postcode, gemeente en land.
- Mobiel telefoonnummer.
- E-mailadres.
- Rijksregisternummer.
- Reden van aanmelding.
- Doorverwijzer.

Daaronder staat onmiddellijk het afsprakenoverzicht; notities en toegangsbeheer krijgen een eigen duidelijk afgebakende plaats. De gegevens blijven leesbaar op kleinere schermen, zonder ze elk in een afzonderlijk uitklaponderdeel te verbergen. Ontbrekende gegevens worden herkenbaar als ontbrekend getoond.

De foto's tonen het scherm **Cliënt wijzigen**. Voor MyGrowise onderscheiden we een leesoverzicht bij openen en een actie **Gegevens bewerken**. In het leesoverzicht groeperen we de kaart in Persoonsgegevens, Adres & contact en Aanmelding. Reden van aanmelding en doorverwijzer blijven dus ook direct in het overzicht staan. In de bewerkweergave staan dezelfde groepen, met duidelijke acties Opslaan en Annuleren, veldvalidatie en behoud van invoer bij een fout. Een waarschuwing bij verlaten voorkomt verlies van niet-opgeslagen wijzigingen.

Voorletters, tussenvoegsel, een tweede telefoonnummer, alternatief postadres, zorgverzekering en extra e-mailadressen zijn zichtbaar in DIAD, maar zijn geen aanvullende harde eis uit de klanttekst. Een Belgische naam kan volledig worden ingevoerd in de velden voornaam/achternaam; een apart tussenvoegsel is daarvoor niet verplicht. Het rijksregisternummer blijft wel onderdeel van de vraag, ook al is dat niet herkenbaar als afzonderlijk veld op deze foto's. Verzekerings- of polisnummers worden niet zonder verificatie als rijksregisternummer geïnterpreteerd.

Een bevoegde medewerker kan gegevens toevoegen en corrigeren. Geboortedatum en intakedatum zijn echte datumvelden. De intakedatum is niet de aanmaakdatum van een account of dossier. Voorstel: datum van de eerste uitgevoerde intake, met mogelijkheid tot correctie voor oudere dossiers. Bij meerdere behandeltrajecten blijven de afzonderlijke intakes herkenbaar in de historiek.

De definitieve verplichte velden worden vooraf vastgesteld. Rijksregisternummer en doorverwijzer zijn niet automatisch voor iedere cliënt verplicht. Het rijksregisternummer hoort uitsluitend in de beveiligde dossierflow, nooit in boekingslinks, bevestigingsmails of gewone applicatielogs. Bestaande toegangsbeperkingen blijven van toepassing op de uitgebreide gegevens.

## 4. Beheerbare afspraaktypes en behandelkleuren

Het systeem maakt onderscheid tussen:

1. **Behandelgroep:** bijvoorbeeld EMDR of hypnose; bepaalt de herkenbare agendakleur.
2. **Afspraaktype:** bijvoorbeeld ‘Intake EMDR – online’ of ‘EMDR-sessie – online’; bewaart het onderscheid intake/vervolg.
3. **Aanbod per therapeut:** bepaalt welke types de therapeut aanbiedt en welke duur en boekingsinstellingen daarbij horen.

Deze opzet laat Virginie en Margot dezelfde EMDR-groep gebruiken, terwijl hun andere benamingen verschillen. De naam ‘psychotherapie’ wordt bij Margot nergens in plaats van ‘psycholoog/psychologiesessie’ gebruikt.

Beheer biedt naam, behandelgroep/kleur, intake/vervolg/overig, online/locatie, standaardduur, gekoppelde therapeuten en actief/boekbaar. Een afwijkende duur per therapeut kan op de koppeling worden ingesteld. De referentieplanner toont ook een prijs. Voorstel: een optioneel tariefveld per aanbod, zichtbaar in de boekingssamenvatting en vastgelegd bij de afspraak indien ingesteld. Prijzen en duren uit de foto's zijn referentiewaarden, geen bevestigde configuratie voor MyGrowise. Een prijs tonen verplicht niet tot online betalen; betalingen, btw-logica en facturatie vormen een aparte opdracht.

**Afspraaktypelijst:** zoekveld, filters op therapeut/behandelgroep/boekbaarheid, knop Nieuw afspraaktype en per rij een kleurbol, naam, intake/vervolg, duur, gekoppelde therapeuten, boekbaarheidsstatus en actie Bewerken. Een eventueel ingesteld tarief kan als extra kolom worden getoond. Het formulier laat de kleur bij de gekozen behandelgroep zien; een nieuwe groep/kleur kan vanuit hetzelfde formulier worden toegevoegd. De praktijkbeheerder hoeft het onderliggende datamodel niet te kennen.

**Twee onafhankelijke instellingen:** 'Online sessie' beschrijft de uitvoeringsvorm; 'Door cliënten boekbaar' beschrijft of een cliënt het type via de planner kan boeken. Een fysieke sessie kan ook via internet geboekt worden; een online sessie kan uitsluitend door medewerkers ingepland worden. Beschikbare tijden worden gecontroleerd over de hele agenda van de therapeut, over alle behandelingen en uitvoeringsvormen heen.

De rij Blokkade in de DIAD-lijst wordt niet als publieke behandeling overgenomen. In MyGrowise blijven niet-beschikbaarheidsblokken een afzonderlijke agenda-actie die boekingen verhindert.

Types kunnen worden aangemaakt, gewijzigd en gedeactiveerd. Een gebruikt type wordt niet definitief verwijderd. Een nieuwe behandeling zoals relatietherapie of een evaluatiegesprek vraagt geen codewijziging.

### Initiële configuratie: 14 therapeut/type-combinaties

| Therapeut | Behandelgroep | Intake | Vervolgsessie |
|---|---|---|---|
| Virginie | EMDR | Intake EMDR – online | EMDR-sessie – online |
| Virginie | Psychotherapie | Intake psychotherapie – online | Psychotherapiesessie – online |
| Virginie | Hypnose | Intake hypnose – online | Hypnosesessie – online |
| Virginie | Hypnose stoppen met roken | Intake hypnose stoppen met roken – online | Hypnose stoppen met roken – online |
| Amy | Seksuologie | Intake seksuoloog – online | Seksuoloog sessie – online |
| Margot | EMDR | Intake EMDR – online | EMDR-sessie – online |
| Margot | Psychologie | Intake psycholoog – online | Psychologiesessie – online |

De tabel bevat 14 therapeut/type-combinaties. Gedeelde typegegevens mogen worden hergebruikt waar naam en betekenis exact gelijk zijn.

Omdat beide EMDR-types bij Virginie en Margot dezelfde naam hebben, kan dit technisch met 12 unieke afspraaktypes en 14 therapeutkoppelingen. Duur, boekbaarheid en eventueel tarief blijven per therapeut instelbaar.

Intake en vervolg binnen een behandelgroep krijgen dezelfde kleur. Kleuren zijn instelbaar; een concreet palet wordt met de klant afgestemd. Voorstel: stoppen met roken krijgt aanvankelijk de hypnosekleur, maar blijft een apart selecteerbaar aanbod. De klant kan dit anders instellen.

Kleur duidt de behandeling aan. De status staat in tekst of een badge, zodat die de behandelkleur niet overschrijft. De naam en intake/vervolg blijven ook zonder kleur begrijpelijk.

## 5. Rechtstreekse boekingslinks

In beheer komt een actie ‘Boekingslink maken’:

1. Kies een actieve therapeut.
2. Kies een actief afspraaktype dat aan deze therapeut gekoppeld is.
3. Bekijk de voorselectie en klik op ‘Kopieer boekingslink’.
4. De cliënt opent direct de planner voor die combinatie en kiest een vrij moment.

De foto's verduidelijken de schermindeling: selecties naast een direct bijgewerkte link, een kopieerknop en een actie Voorbeeld openen. Het gegenereerde resultaat toont in gewone taal welke therapeut, behandeling en uitvoeringsvorm vastliggen. Na kopiëren verschijnt een korte bevestiging. Bij een ongeldige combinatie of een niet-boekbaar aanbod kan geen misleidende link worden gekopieerd.

Voor de eerste oplevering is de specifieke therapeut/type-link verplicht. Voorstel als kleine uitbreiding: ook een algemene praktijklink en een link naar alle boekbare types van één therapeut ondersteunen. In alle gevallen toont de planner uitsluitend nog de keuzes die niet vastliggen. Als de geselecteerde therapeut wordt gewijzigd, wordt een niet langer passend type gewist en moet een geldig type worden gekozen. Een afzonderlijke locatiefilter is nu niet nodig omdat alle gevraagde types online zijn; de uitvoeringsvorm wordt wel expliciet getoond.

De HTML-widgetcode op de foto is een tweede manier om de DIAD-planner te openen. Een eigen insluitbare widget en instelbare taal/stappenvolgorde zijn geen voorwaarde voor deze opdracht. Eerst leveren we de rechtstreeks deelbare MyGrowise-link met vaste, eenvoudige stappen.

Voorgestelde route: `/afspraak/virginie/intake-emdr-online`, met intern een duurzame koppeling aan het aanbod. Dit is een routevoorstel, geen bestaande werkende link. Namen kunnen veranderen zonder oude links ongemerkt naar een andere behandeling te laten wijzen; bewaar daarvoor een stabiele verwijzing of redirect.

De server controleert de combinatie opnieuw bij het ophalen van tijdsloten én bij het boeken. Een gedeactiveerde therapeut of een ingetrokken type geeft een duidelijke melding en passende alternatieven. De link bevat geen persoonsgegevens en verleent geen toegang tot dossiers.

De huidige accountplicht is een afzonderlijke keuze van de onmiddellijke boekingsbevestiging. Bij behoud van de accountplicht moeten therapeut en type behouden blijven tijdens registratie, inloggen en e-mailverificatie, en bij validatiefouten. De cliënt keert daarna rechtstreeks terug naar dezelfde planner.

## 6. Automatische gegevensovername en definitief boeken

De gewenste keten is:

**Boekingslink → juiste therapeut en type → beschikbaar moment → gegevens controleren/aanvullen → definitieve afspraak + gekoppeld dossier → agenda en historiek → bevestigingsmail.**

Het formulier verzamelt de afgesproken dossiergegevens. Bij een terugkerende cliënt worden bekende gegevens vooraf ingevuld en gecontroleerd. De reden van aanmelding kan bij een nieuw traject verschillen; bestaande klinische informatie wordt niet automatisch vervangen door een nieuwe formulierinzending. E-mailwijzigingen volgen de bestaande accountverificatie.

**Concreet plannerverloop op basis van foto 7:**

1. Bovenaan staat een compacte samenvatting van therapeut, volledig type, online/locatie, duur en eventueel ingesteld tarief.
2. De cliënt kiest een beschikbare dag en vervolgens een tijdstip. Dagen zonder vrije momenten zijn herkenbaar. Bij nul vrije momenten verschijnt een duidelijke lege toestand en de mogelijkheid verder in de toegestane boekingsperiode te kijken.
3. Persoonsgegevens verschijnen in overzichtelijke groepen; bekende gegevens worden alleen na betrouwbare identificatie vooraf ingevuld. Een e-mailadres intypen geeft nooit toegang tot bestaande dossiergegevens.
4. Een laatste samenvatting toont de afspraakgegevens en één duidelijke knop **Afspraak definitief boeken**. Tot die knop kan de cliënt teruggaan zonder ingevulde gegevens te verliezen. Het openen van de pagina of selecteren van een dag maakt nog geen afspraak.
5. Na succesvol opslaan verschijnt **Je afspraak is bevestigd**, met dezelfde details en een verwijzing naar de bevestigingsmail. Er verschijnt geen melding dat de therapeut nog moet goedkeuren.

Wanneer een tijdslot intussen bezet raakt, blijft de overige invoer behouden en kiest de cliënt een ander moment. Bij behoud van accountplicht worden de accountstappen zo ingepast dat de directe linkcontext behouden blijft. De foto's tonen niet het volledige registratie- of afrondingsproces en bewijzen dus niet dat DIAD zonder account boekt.

De server voert het volgende samenhangend uit:

- Identificeer het bestaande dossier via een betrouwbare accountkoppeling, of maak een dossier aan voor een nieuwe cliënt.
- Voeg persoonsgegevens toe of verwerk expliciete correcties volgens de vastgelegde regels.
- Controleer therapeut, type, duur, beschikbaarheid, blokkades en overlap opnieuw.
- Sla de afspraak direct op als **bevestigd**, gekoppeld aan dossier, therapeut en type.
- Leg vast welke behandelaar toegang nodig heeft volgens de gekozen toewijzingsregels.
- Registreer de gebeurtenis en zet de bevestigingsmail klaar.

De databasebewerking moet atomair zijn: geen dossierwijziging zonder geslaagde boeking, geen boeking zonder de vereiste dossierkoppeling. Gelijktijdige boekingen op hetzelfde moment mogen niet beide slagen. Herhaald klikken of een netwerkretry mag geen tweede afspraak, dossier of bevestigingsopdracht maken.

Voor deze nieuwe publieke flow verdwijnt de stap ‘therapeut keurt aanvraag goed’. Bevestigingsschermen, knoppen, klantaccount, meldingen en therapeutenschermen krijgen bijpassende teksten. Bestaande open aanvragen krijgen een expliciete overgangsafspraak; ze worden niet zonder controle massaal bevestigd.

Oudere dossiers zonder accountkoppeling worden niet uitsluitend op basis van naam of e-mailadres automatisch samengevoegd. Een mogelijke dubbele identiteit krijgt een beheeractie voor controle en koppeling. Bij een gearchiveerd dossier wordt vooraf bepaald of heractivering nodig is; er wordt niet stilzwijgend een tweede dossier gemaakt.

## 7. Agenda en volledige afsprakenhistoriek

Beide agendaweergaven tonen cliënt, afspraaktype, intake/vervolg, behandelkleur en status. Vanuit een afspraak opent een bevoegde gebruiker rechtstreeks het dossier. Ook handmatig ingeplande afspraken gebruiken dezelfde therapeut/type-koppeling, duurregels en dossierkoppeling.

In het dossier verschijnt een chronologisch, volledig doorbladerbaar overzicht met datum, tijd, therapeut, volledig afspraaktype, status en eventuele verplaatsing. Voorstel: nieuwste eerst, met omkeerbare sortering en filters op therapeut, type, periode en status. Alle afspraken blijven bereikbaar; de huidige limiet van 100 wordt vervangen door paginering.

Geannuleerde afspraken en niet-verschenen afspraken blijven herkenbaar in de historiek. Een verplaatsing verandert de afspraak en bewaart de wijzigingshistoriek, zonder een tweede uitgevoerde sessie te suggereren.

Voor mutualiteitsattesten is er een overzicht van daadwerkelijk uitgevoerde sessiedata. Voorstel binnen deze uitbreiding: periodefilter en ‘sessiedata kopiëren/afdrukken’. Een automatisch opgemaakt mutualiteitsattest valt buiten de expliciete vraag en kan later apart worden uitgewerkt.

## 8. Bevestigingsmails

Na iedere geslaagde online boeking volgt automatisch een bevestiging met het gekozen afspraaktype, therapeut, datum, uur, tijdzone en online/locatie-informatie. Voorbeeldonderwerp: ‘Afspraak bevestigd: Intake EMDR – online bij Virginie’. De mail bewaart ook het onderscheid tussen intake en vervolg.

De mail gebruikt dezelfde vastgelegde afspraakgegevens als agenda en dossier. Naam, duur en relevante omschrijving worden bij het boeken als momentopname bewaard, zodat een latere naamswijziging de betekenis van een oude afspraak of een opnieuw verzonden mail niet verandert. Voorstel: een kleurwijziging geldt wel voor de actuele agendaweergave; inhoudelijke behandelingwijzigingen vragen een nieuw type.

Gebruik een persistente verzendwachtrij met afleverstatus en herhaalpogingen. Een tijdelijke mailfout maakt de bevestigde afspraak niet ongedaan. Een bevoegde beheerder kan mislukte verzending zien en opnieuw laten uitvoeren. Een technische herhaalpoging mag geen tweede afspraakbevestigingsopdracht opleveren; extern dubbel afleveren bij onzekere providerstatus moet worden beperkt en zichtbaar gemaakt.

Rijksregisternummer, aanmeldingsreden en dossiernotities komen niet in de bevestigingsmail. Wijzigings- en annuleringsberichten gebruiken dezelfde gegevensbron en sluiten aan op de bestaande status- en planningsgebeurtenissen. Er wordt geen videoplatformintegratie verondersteld; de gewenste online-instructies worden vooraf vastgesteld.

Foto 9 toont een **herinnering**, geen eerste boekingsbevestiging. Voorstel voor later: een apart instelbaar herinneringsmoment en een herinneringssjabloon, naast de onmiddellijke bevestiging. Bij verplaatsen moet een oude geplande herinnering vervallen en bij annuleren mag geen herinnering meer worden verstuurd. Deze uitbreiding is nog geen vaststaande klanteis.

De voorbeeldmail vermeldt dat de therapeut kort voor de sessie handmatig een Google Meet-link stuurt. Dat is een mogelijke werkinstructie per therapeut, geen bewijs van automatische Meet-aanmaak en geen opdracht om dit exact over te nemen. Bevestigingssjablonen krijgen variabele velden voor aanhef/naam, type, therapeut, datum, tijd en online-instructies. Bij ontbrekende aanhef gebruiken ze een neutrale begroeting. Afzendernaam, antwoordadres en ondertekening moeten voor MyGrowise expliciet worden gekozen; de branding en promotionele tekst uit de referentiemail worden niet automatisch gekopieerd.

Voor dagelijks beheer voorzien we een compact verzendlogboek bij de afspraak: soort bericht, verzendtijd, status en Opnieuw versturen. Bewaar wat daadwerkelijk is verstuurd; een bewuste herverzending is te onderscheiden van een technische herhaalpoging. 'Geaccepteerd door mailprovider' is niet automatisch 'afgeleverd' of 'gelezen'; toon alleen status die aantoonbaar beschikbaar is.

## 9. Zelfstandig beheer door de praktijk

Virginie of een aangewezen praktijkbeheerder krijgt gerichte rechten voor therapeuten, afspraaktypes, kleuren en boekingslinks. Dagelijks praktijkbeheer mag niet afhankelijk zijn van toegang tot alle technische en financiële superadminfuncties. De precieze rechten worden expliciet toegevoegd; de huidige practitionerrol heeft deze beheerrechten nog niet.

Therapeutenbeheer omvat profiel aanmaken/bewerken, account uitnodigen of koppelen, beschikbaarheid instellen, types koppelen, publiceren en deactiveren. De publieke planner en eventuele profielkaarten moeten nieuwe therapeuten uit de database kunnen weergeven. Alleen een beheerformulier toevoegen volstaat niet zolang de vaste publieke therapeutenlijst een extra vereiste blijft.

Dossiertoegang wordt per rol en toewijzing afgedwongen op server- en databaseniveau. Afspraakbeheer geeft niet automatisch toegang tot alle behandelnotities. Wijzigingen krijgen een auditspoor zonder onnodig gevoelige veldinhoud te loggen.

## 10. Technische opbouw

Voorgestelde uitbreiding van het bestaande model:

- `patients`: gestructureerde identiteit, contactgegevens en intake-/aanmeldingsgegevens; eventueel afgeschermde opslag voor gevoelige identificatiegegevens.
- `treatment_groups`: naam, beheerde kleur en actieve status.
- `appointment_types`: naam, behandelgroep, intake/vervolg/overig, kanaal en standaardduur.
- `practitioner_appointment_types`: therapeut/type-koppeling, actief/boekbaar, eventuele afwijkende duur en duurzame boekingsverwijzing.
- `bookings`: koppeling met het aanbod plus momentopname van naam, duur, uitvoeringsvorm en eventueel getoond tarief; bestaande dossier- en statuskoppelingen hergebruiken.
- Persistente mailopdrachten en verzendpogingen gekoppeld aan de afspraak/gebeurtenis; bestaand bruikbaar mailpatroon hergebruiken.

Indien het optionele tarief wordt opgenomen: geldbedragen als gehele centen plus valuta opslaan en onderscheid maken tussen onbekend/niet ingesteld en expliciet gratis. `null` betekent niet automatisch € 0. Vermijd een impliciete wijziging van bestaande betaal- of bestelstromen.

De boekingsfunctie en beschikbaarheidsfunctie krijgen het gekozen aanbod als invoer. De server bepaalt eindtijd en duur; vrije formulierwaarden mogen die instellingen niet omzeilen. Alle schrijfingangen, inclusief handmatig plannen en verplaatsen, moeten hetzelfde model gebruiken. Bij een latere wijziging van de standaardduur blijven bestaande afspraken hun opgeslagen tijd behouden.

## 11. Uitvoeringsvolgorde en oplevering

| Fase | Werk | Concreet oplevercriterium |
|---|---|---|
| 1. Ontwerp en besluiten | Zes schermen uitwerken, veldregels, rechten, duur per type, accountkeuze en bestaande aanvragen | Voorbeeldflow en configuratiematrix zijn volledig genoeg om te bouwen |
| 2. Datamodel en migratie | Dossiervelden, behandelgroepen, types, therapeutkoppelingen, momentopnames en mailopdrachten | Bestaande data blijft bereikbaar; initieel aanbod is correct ingericht |
| 3. Zelfstandig beheer | Therapeuten, typen, kleuren, publicatie, rechten en linkgenerator | Praktijkbeheerder kan een nieuwe therapeut en relatietherapie publiceren zonder Kevin |
| 4. Dossier en agenda | Overzichtskaart, bewerken, behandelkleur, handmatig plannen en volledige historiek | Alle gevraagde dossiergegevens en alle afspraken zijn bereikbaar en consistent |
| 5. Publieke boekingsflow en mails | Directe links, accountterugkeer, gegevensovername, directe bevestiging, mailverzending en verzendlogboek | Een cliënt doorloopt de volledige keten zonder handmatige goedkeuring of dubbele invoer |
| 6. Migratiecontrole en acceptatie | Historische afspraken, oude links, open aanvragen, rechten, gelijktijdigheid en mailherstel | Kevin en klant kunnen de afgesproken praktijkscenario's succesvol doorlopen |

Opleveren gebeurt op basis van een werkende volledige keten. De losse fases zijn bouwstappen, geen reden om een gedeeltelijke boekingsflow voortijdig live te zetten. Een betrouwbare tijdsinschatting volgt na fase 1 en de controle van de doelomgeving.

## 12. Bestaande gegevens veilig meenemen

Schema-uitbreidingen beginnen waar nodig met optionele velden, zodat oudere dossiers bruikbaar blijven. Bestaande volledige namen worden niet blind opgesplitst: meervoudige voor- en achternamen vragen controle. Ontbrekende gegevens kunnen bij een volgende boeking of door de medewerker worden aangevuld.

Bij bestaande afspraken is het behandelingstype mogelijk onbekend. Dat wordt expliciet ‘nog te bepalen’, met een beheeractie voor correctie. Er wordt geen EMDR- of psychologietype afgeleid uit alleen de naam van de therapeut. Bevestigde afspraken behouden hun tijd, status en dossierkoppeling.

Voor productie: controleer toegepaste migraties, mailconfiguratie en open aanvragen; voer de overgang eerst in een testomgeving uit; maak een herstelscenario en controleer aantallen en koppelingen voor en na de migratie. Oude publieke links blijven bruikbaar of krijgen een gerichte redirect.

## 13. Acceptatiescenario's

1. Open een volledig dossier: alle twaalf gegevensgroepen zijn direct zichtbaar en bewerkbaar voor de bevoegde medewerker.
2. Controleer alle 14 therapeut/type-combinaties, inclusief exact de verschillende benamingen voor Virginie en Margot.
3. Maak als praktijkbeheerder relatietherapie aan, kies een kleur, koppel een nieuwe therapeut en publiceer een werkende boekingslink zonder codeaanpassing.
4. Open een directe link en doorloop eventueel registratie/inloggen/verificatie: therapeut en type blijven geselecteerd.
5. Boek als nieuwe cliënt: gegevens, dossier en definitief bevestigde afspraak ontstaan samen; agenda, historiek en mail stemmen overeen. Er is geen goedkeuringsactie nodig.
6. Boek opnieuw als dezelfde cliënt: dezelfde dossierkoppeling wordt gebruikt; bevestigde oude gegevens en notities worden niet stilzwijgend overschreven.
7. Laat twee cliënten tegelijk hetzelfde tijdslot boeken en herhaal een inzending: maximaal één geldige afspraak per therapeut/tijdslot en geen duplicaten per inzending.
8. Test verschillende intakeduren, vervolgduren, blokkades en overgang tussen zomer- en wintertijd in Europe/Brussels.
9. Plan handmatig, verplaats, annuleer en markeer een sessie als uitgevoerd/niet verschenen: agenda, historiek en berichten blijven consistent.
10. Controleer een dossier met meer dan 100 afspraken: alle pagina's en alle uitgevoerde sessiedata blijven bereikbaar; geannuleerde afspraken tellen niet als uitgevoerde sessies.
11. Wijzig of deactiveer een type: bestaande afspraken en oude mailinhoud blijven begrijpelijk, nieuwe boekingen volgen de actuele instellingen.
12. Simuleer een mailstoring: de afspraak blijft bevestigd, de fout is zichtbaar en verzending kan worden hervat.
13. Controleer ongeoorloofde dossierinzage, aangepaste type-/therapeut-ID's en ongeoorloofd beheer: de server/databank weigert deze handelingen.
14. Controleer migratie van oudere namen, afspraken zonder type, gearchiveerde dossiers en mogelijke dubbele identiteiten zonder blind samenvoegen.
15. Controleer de linkgenerator: juiste combinatie, kopieerfeedback, voorbeeld openen en opnieuw kiezen na een therapeutwijziging. Vooraf vastgelegde keuzes worden in de planner niet opnieuw gevraagd.
16. Controleer uitvoeringsvorm en boekbaarheid onafhankelijk: een medewerker kan een niet-publiek type plannen, maar de publieke server weigert een ingetrokken/niet-boekbaar type. Agenda-overlap geldt over alle typen heen.
17. Controleer de samenvatting, lege beschikbaarheid, een intussen bezet tijdslot en teruggaan tussen stappen zonder onnodig invoerverlies of onbedoelde boeking.
18. Controleer een bewuste herverzending en ontbrekende aanhef. Als tariefweergave wordt meegenomen, controleer onbekend versus gratis en behoud van de bij boeking getoonde prijs.

## 14. Nog vast te leggen bedrijfskeuzes

Dit blok bevat open details; onmiddellijke definitieve bevestiging is al beslist.

- Duur en eventuele buffertijd per type en therapeut.
- Welke persoonsgegevens verplicht zijn bij eerste boeking, welke optioneel zijn en hoe buitenlandse cliënten worden verwerkt.
- Definitie van intakedatum bij meerdere behandeltrajecten en moment waarop dossier-/notitietoegang wordt toegekend.
- Accountplicht behouden of boeken zonder account mogelijk maken; de bestaande code vereist een bevestigd klantaccount.
- Gewenst kleurenpalet, inclusief al dan niet dezelfde kleur voor hypnose en stoppen met roken.
- Of alle intake- en vervolgtypes publiek boekbaar zijn of sommige uitsluitend via gedeelde links/door medewerkers; een openbare link is op zichzelf geen toegangsbeperking.
- Wie namens de praktijk therapeuten en types mag beheren, en of therapeuten hun eigen aanbod mogen wijzigen.
- Tekst van online-instructies en afhandeling van bestaande open aanvragen bij de omschakeling.
- Tariefweergave meenemen in deze oplevering; zo ja, actuele bedragen en of ze per therapeut verschillen. Foto 7 toont een concreet bedrag en een duur, maar bevestigt niet de toekomstige MyGrowise-tarieven.
- Herinneringen en externe agendakoppelingen als afzonderlijke vervolgfase beoordelen.

De DIAD-foto's zijn verwerkt als functionele en visuele referentie. Het ontbrekende tekstslot van punt 10 wordt alleen aangevuld als de klant daar nog extra vereisten had.

## 15. Vertaling van de negen referentiefoto's

| Foto | Zichtbaar in de referentie | Besluit voor het plan |
|---|---|---|
| 1 | Cliënt wijzigen, persoonsgegevens, adres, contact en verzendvoorkeuren | Gegroepeerd dossierformulier en leesoverzicht; gevraagde velden behouden; extra voorkeuren niet automatisch overnemen |
| 2 | Aanmeldingsreden, doorverwijzer, zorgverzekering en factuur-/toegangsinstellingen | Aanmelding in het directe dossieroverzicht; verzekering en facturatie apart; bestaande dossierrechten zorgvuldig behouden |
| 3 | Doorzoekbare typelijst met kleur, consulttijd, prijs en online te plannen | Centraal typebeheer met kleur, duur en boekbaarheid; tariefweergave als expliciet voorstel; Blokkade blijft een agenda-actie |
| 4 | Linkgenerator met therapeut/type/locatie/taal, kopieeractie en widgetcode | Specifieke link, automatische voorselectie, kopiëren en voorbeeld openen; widget, taalbeheer en meerdere locaties niet vereist |
| 5 | Keuze tussen behandelaars en hele praktijk | Specifieke therapeut verplicht ondersteund; praktijkbrede link als voorgestelde uitbreiding; overige voorbeeldtherapeuten niet importeren |
| 6 | Keuze uit intake-/afspraaktypes en trajecten | Intake en vervolg herkenbaar; alleen het aanbod van MyGrowise configureren; trajectpakketten zijn een aparte functie |
| 7 | Planner met online locatie, type, duur, prijs, therapeut en kalender | Samenvatting met vaste keuzes boven kalender; alleen resterende keuzes vragen; prijs en duur niet blind overnemen |
| 8 | iCal-abonnement en Google-agendakoppeling | Optionele vervolgfase voor externe agenda; niet nodig om de gevraagde boekingsflow te leveren |
| 9 | Herinneringsmail, persoonlijke aanhef, online-instructie en opnieuw versturen | Bevestiging en herinnering onderscheiden; neutrale fallback voor aanhef, aanpasbare instructie en verzendlogboek; geen veronderstelde Meet-automatisering |

De foto's bevatten geen aparte volledige afsprakenhistoriek en tonen evenmin het uiteindelijke boekingsresultaat. Die eisen blijven gebaseerd op de klanttekst en Kevins expliciete correctie over directe bevestiging.

## 16. Zes concrete schermen voor de eerste bouwfase

De volgende schermen worden uitgewerkt in de bestaande MyGrowise-huisstijl. Routes zijn voorstellen; de bestaande dossierroute wordt hergebruikt.

| Scherm | Opbouw | Belangrijkste actie |
|---|---|---|
| 1. Cliëntendossier | Kop met naam, gegroepeerde gegevenskaart, eerstvolgende afspraak, volledige afsprakenlijst; notities en rechten apart | Gegevens bewerken, afspraak plannen, sessiedata opzoeken |
| 2. Afspraaktypes | Zoekveld, filters, kleur/naam/intake-vervolg/duur/therapeuten/boekbaarheid, eventueel tarief | Nieuw type, Bewerken, Deactiveren |
| 3. Therapeuten | Overzicht, profiel, toegang, beschikbaarheid en gekoppelde afspraaktypes | Therapeut toevoegen, aanbod instellen, publiceren |
| 4. Boekingslinks | Therapeut, type, zichtbaar kanaal, linkveld, betekenis van de voorselectie | Kopieer boekingslink, Voorbeeld openen |
| 5. Publieke planner | Vaste samenvatting, datum/tijd, persoonsgegevens, laatste controle en bevestigingsresultaat | Afspraak definitief boeken |
| 6. Afspraakdetail | Cliënt, therapeut, type, tijd, status, link naar dossier en verzendlogboek | Verplaatsen, Annuleren, uitgevoerd/niet verschenen registreren, mail opnieuw versturen |

Het afspraakdetail mag als zijpaneel vanuit de bestaande agenda openen; hiervoor is geen extra hoofdmenu nodig. Het typeformulier kan eveneens vanuit de lijst openen. De zes schermen beschrijven de benodigde taken, niet zes nieuwe losse applicaties.

**Menuvoorstel:** Agenda, Cliënten, Therapeuten, Afspraaktypes en Boekingslinks. De beheeritems zijn alleen zichtbaar voor bevoegde gebruikers. Agenda en dossier openen hetzelfde afspraakdetail, zodat wijzigingen niet via verschillende formulieren uiteenlopen.

**Afbakening van de eerste oplevering:** alle oorspronkelijke dossier- en afsprakenwensen, de 14 aanbodcombinaties, zelfstandig beheer, directe links, directe definitieve boeking, automatische gegevensovername, volledige historiek en bevestigingsmail met verzendcontrole. Tariefweergave is een voorstel dat vóór bouwen wordt vastgelegd.

**Mogelijke vervolgfase:** automatische herinneringen, iCal-abonnement, Google/Outlook/iCloud-koppelingen, insluitbare websitewidget, extra talen, meerdere locaties, zorgverzekeringsbeheer, facturatie en trajectpakketten. Deze onderdelen zijn geen stilzwijgende toezegging op basis van de referentiefoto's.

Bij een eventuele externe agendafase moet vooraf worden gekozen tussen alleen MyGrowise-afspraken tonen in een andere agenda en ook externe bezette tijden gebruiken om boekingen te blokkeren. Dat zijn verschillende integraties; een eenrichtingsabonnement voorkomt niet vanzelf dubbele boekingen met externe afspraken. Kalenderabonnementen krijgen eigen intrekbare tokens en tonen alleen de afgesproken minimale details. De privéagendalink uit de referentiefoto wordt niet geopend, hergebruikt of gepubliceerd.
