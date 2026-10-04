# Plan voor vragenlijsten en pakketten

Datum: 4 oktober 2026. Status: uitgevoerd op 4 oktober 2026. Catalogus, samensteller, checkout, superadminbeheer, afnamelevering en mailwachtrij zijn geïmplementeerd; de acht additieve migraties zijn toegepast op het gekoppelde Supabase-project. Zie [beheer en verificatie](QUESTIONNAIRE-CATALOG-RUNBOOK.md). De applicatiewijzigingen worden via `main` aangeboden aan de bestaande Vercel-integratie; de productiedeployment heeft een afzonderlijke status.

MyGrowise krijgt drie manieren om vragenlijsten te bestellen: een losse vragenlijst, een vast profielpakket of een zelf samengestelde combinatie. De PDF levert de verkoopprijzen. Het Word-bestand levert de omschrijvingen, opgegeven leeftijdsgroepen en interne uitgeverskosten. Het plan bouwt voort op de bestaande productcatalogus, orders, handmatige betaalcontrole en bibliotheek.

## Vastgelegde prijsbeslissing

De gebruiker heeft op 4 oktober 2026 expliciet bevestigd:

- De acht pakketten behouden de vaste prijzen uit de PDF.
- Een zelf samengestelde combinatie met één vragenlijst krijgt geen korting.
- Een zelf samengestelde combinatie met twee of drie vragenlijsten krijgt 5% korting.
- Een zelf samengestelde combinatie met vier of meer vragenlijsten krijgt 10% korting.
- Er komt geen extra volumekorting op vaste pakketten.

De eerste doorgestuurde toelichting gaat over interne afnamekosten. De latere toelichting en de PDF geven de verkoopprijzen. Deze bedragen worden niet met elkaar verwisseld. De kolom met ongeveer 5% pakketkorting in de PDF is geen formule voor de vaste prijzen.

## Bronnen en bewijs

- `/Users/kevin/Downloads/Vragenlijsten prijzen.docx`: alle tabellen en de vier gerenderde pagina's gelezen. Bevat 22 vragenlijsten in acht categorieën en acht pakketvoorstellen met interne testkosten exclusief btw.
- `/Users/kevin/Downloads/Prijzen website.pdf`: beide pagina's gelezen en visueel gecontroleerd. Bevat 22 losse verkoopprijzen en acht vaste pakketprijzen. Btw-status van de verkoopprijzen wordt niet vermeld.
- Berichten die de gebruiker heeft doorgestuurd: context over kosten, vrij samenstellen en de kortingsstaffel.
- Rechtstreekse bevestiging door de gebruiker: vaste pakketprijzen, korting op eigen combinaties.
- Lokale code: productbeheer, publieke catalogus, checkout, orders, betaalcontrole en bibliotheek gecontroleerd om de bouwstappen af te bakenen.

De bronbestanden blijven ongewijzigd. De daarin genoemde leeftijdsgroepen zijn aangeleverde metadata, geen onafhankelijk gecontroleerde normen of beslisregels voor de afname.

## Losse vragenlijsten

Deze tabel is intern. De uitgeverskosten horen niet in publieke productteksten, browserdata, klantmails of de checkout. De bedragen zijn niet de volledige kost van professionele afname, verwerking en rapportage.

| Categorie volgens Word | Vragenlijst | Leeftijd volgens Word | Verkoopprijs volgens PDF | Uitgeverskost per afname excl. btw volgens Word |
|---|---|---|---:|---:|
| Persoonlijkheid en zelfbeeld | HiPIC | 6–13 jaar | €79 | €7,10 |
| Persoonlijkheid en zelfbeeld | Piers-Harris 3 | 8–18 jaar | €59 | €3,70 |
| Persoonlijkheid en zelfbeeld | NEO-PI-3 | Vanaf 16 jaar | €99 | €16,50 |
| Trauma en posttraumatische klachten | TSCYC | 3–12 jaar | €69 | €7,10 |
| Trauma en posttraumatische klachten | TSCC | 8–16 jaar | €69 | €7,10 |
| Trauma en posttraumatische klachten | TSI / TSI-2 | Vanaf 18 jaar voor TSI | €69 | €5,75 voor TSI; TSI-2 niet apart gespecificeerd |
| Emotieregulatie | FEEL-KJ | 8–18 jaar | €69 | €6,80 |
| Emotieregulatie | FEEL-E | Vanaf 18 jaar | €69 | €6,80 |
| ADHD en executieve functies | Conners | 6–18 jaar | €69 | €5,60 |
| ADHD en executieve functies | BRIEF-2 | 5–18 jaar | €69 | €7,10 |
| ADHD en executieve functies | BRIEF-A | 18–65 jaar | €69 | €7,10 |
| Autisme en prikkelverwerking | SRS-2 | 2,5–18 jaar | €69 | €5,60 |
| Autisme en prikkelverwerking | SRS-A | Vanaf 18 jaar | €69 | €5,60 |
| Autisme en prikkelverwerking | SPM-2 | 2–80 jaar | €69 | €4,30 |
| Stress, coping en veerkracht | CERQ | Volwassenen | €59 | €3,50 |
| Stress, coping en veerkracht | CISS | Vanaf 18 jaar | €59 | €3,50 |
| Stress, coping en veerkracht | RS-NL | Volwassenen | €59 | €3,50 |
| Werk, burn-out en loopbaan | OBOI | Werkende volwassenen, vanaf 18 jaar | €59 | €4,00 |
| Werk, burn-out en loopbaan | BIP-6F-X | Volwassenen, vanaf 18 jaar | €109 | €15,00 |
| Werk, burn-out en loopbaan | SDS | Vanaf 15 jaar | €69 | €9,70 |
| Stemming en psychisch functioneren | CDI-2 | 8–21 jaar | €59 | €4,40 |
| Stemming en psychisch functioneren | Mini-SCL | Vanaf 12 jaar | €49 | €1,80 |

TSI / TSI-2 is één prijsregel in de PDF. Dit is nog geen bevestiging dat beide versies als afzonderlijke producten beschikbaar zijn. Het eigen MyGrowise Stress/Arousal-profiel staat alleen als onderdeel van het uitgebreide pakket; er is geen losse verkoopprijs aangeleverd.

## Vaste profielpakketten

De inhoud en verkoopprijzen hieronder volgen de PDF. De interne pakketkosten volgen het Word-bestand en blijven uitsluitend intern.

| Pakket | Inbegrepen vragenlijsten | Vast te betalen | Interne pakketkost excl. btw volgens Word |
|---|---|---:|---:|
| Persoonlijk Stress- en Emotieprofiel | NEO-PI-3, FEEL-E, CERQ, CISS, RS-NL, TSI-2 en eigen MyGrowise Stress/Arousal-profiel | €275 | €50 |
| Persoonlijkheidsprofiel Volwassenen | NEO-PI-3, CERQ en RS-NL | €205 | €23,50 |
| Persoonlijkheidsprofiel Kind | HiPIC, FEEL-KJ en Piers-Harris 3 | €195 | €17,60 |
| Werk en Loopbaanprofiel | BIP-6F-X en SDS | €169 | €24,70 |
| Werk en Burn-outprofiel | BIP-6F-X, OBOI en CISS | €215 | €22,50 |
| Prikkelverwerkingsprofiel | SPM-2 en FEEL-E | €130 | €11,10 |
| Trauma en Herstelprofiel | TSI-2, CERQ en RS-NL | €179 | €12,75, met TSI in het Word-bestand |
| Emotioneel Welzijnsprofiel Jongeren | CDI-2, FEEL-KJ en Piers-Harris 3 | €179 | €14,90 |

Het stresspakket bevat zes extern geprijsde vragenlijsten plus één eigen profiel. De zes losse verkoopprijzen tellen op tot €414. De vaste €275 wordt dus niet berekend met de volumekorting. Aan het eigen profiel wordt geen losse prijs of extra kortingsteller toegekend zolang het niet als afzonderlijk verkoopbaar product is gedefinieerd.

De bron noemt een aparte premiumprijs voor dit pakket. Dat geeft geen uitsluitsel over verschillen in rapportage of dienstverlening tussen een pakket en een losse combinatie; die uitleg moet nog worden aangeleverd.

## Rekenregels voor eigen combinaties

Uitvoeringsvoorstel: een combinatie geldt voor één deelnemer en bevat verschillende, verkoopbare vragenlijstproducten. Hetzelfde product kan niet meerdere keren worden toegevoegd om een hogere kortingsdrempel te bereiken. Ouder-, leerkracht- of andere versies tellen niet automatisch als extra tests; eerst moet de verkoopeenheid per instrument vaststaan.

1. De server leest de actuele verkoopprijzen en beschikbaarheid uit de catalogus.
2. De server telt de verschillende geselecteerde vragenlijsten.
3. De korting is 0%, 5% of 10% volgens de bevestigde staffel.
4. De korting geldt op de hele som van deze vragenlijsten, ook op de eerste vragenlijst.
5. Het totaal wordt één keer afgerond op eurocenten, met halve centen naar boven.
6. De order bewaart de gekozen producten, oorspronkelijke prijzen, staffel, korting en het werkelijk verschuldigde totaal zoals ze op het bestelmoment waren.
7. Een eventuele verdeling van de korting over orderregels gebruikt dezelfde totaalkorting; afrondingscenten worden deterministisch verdeeld zodat de regels exact optellen tot het ordertotaal.

Bij een subtotaal in centen S en kortingspercentage P is het te betalen totaal `floor((S × (100 − P) + 50) / 100)`. De geboekte totaalkorting is `S − te betalen totaal`. Voor deze catalogus met hele europrijzen ontstaan momenteel geen halve centen; deze regel bepaalt ook later het gedrag bij centprijzen. Rond het totaal en de korting niet onafhankelijk van elkaar af.

| Geselecteerd | Subtotaal | Korting | Te betalen |
|---|---:|---:|---:|
| Mini-SCL | €49 | 0% / €0 | €49,00 |
| CERQ en FEEL-E | €128 | 5% / €6,40 | €121,60 |
| NEO-PI-3, CERQ en RS-NL | €217 | 5% / €10,85 | €206,15 |
| Vier verschillende vragenlijsten van €69 | €276 | 10% / €27,60 | €248,40 |
| Vijf vragenlijsten van €49, €59, €59, €69 en €99 | €335 | 10% / €33,50 | €301,50 |

Er wordt niet opnieuw op een heel eurobedrag afgerond. De vaste pakketprijs is een afzonderlijk prijsbeleid. Een pakket wordt niet opengeklapt in zeven kortingstellers.

## Prijsverschillen die zichtbaar moeten blijven

De vaste prijzen zijn bevestigd en worden niet aangepast om de staffel na te bootsen.

| Pakket | Som losse PDF-prijzen | Zelf samenstellen volgens staffel | Vaste pakketprijs |
|---|---:|---:|---:|
| Persoonlijk Stress- en Emotieprofiel | €414 voor de zes externe lijsten; eigen profiel ongeprijsd | €372,60 voor alleen deze zes lijsten | €275 incl. eigen profiel |
| Persoonlijkheidsprofiel Volwassenen | €217 | €206,15 | €205 |
| Persoonlijkheidsprofiel Kind | €207 | €196,65 | €195 |
| Werk en Loopbaanprofiel | €178 | €169,10 | €169 |
| Werk en Burn-outprofiel | €227 | €215,65 | €215 |
| Prikkelverwerkingsprofiel | €138 | €131,10 | €130 |
| Trauma en Herstelprofiel | €187 | €177,65 | €179 |
| Emotioneel Welzijnsprofiel Jongeren | €187 | €177,65 | €179 |

De laatste twee pakketten zijn €1,35 duurder dan dezelfde vragenlijsten via de samensteller. Als een pakket aanvullende rapportage of begeleiding omvat, moet die meerwaarde concreet worden uitgelegd. Zonder die uitleg kan het prijsverschil verwarrend zijn. Vermeld geen algemene claim dat elk pakket exact 5% goedkoper is.

Bij een combinatie die exact overeenkomt met een goedkoper vast pakket kan de samensteller dat pakket voorstellen met beide prijzen. De klant kiest bewust; de server wisselt het prijsbeleid niet stilzwijgend om. Het stresspakket heeft daarnaast het eigen profiel en is daarom geen volledig identieke combinatie.

## Presentatie op de website

Onder Zelf aan de slag komen twee duidelijke ingangen: Persoonlijke profielen en Losse vragenlijsten. Op de vragenlijstpagina kan de bezoeker één lijst kiezen of een eigen combinatie maken. Modules blijven daarnaast zichtbaar met hun huidige beschikbaarheidsmelding.

Voorstel voor routes:

- `/profielen`: overzicht van de acht vaste pakketten die daadwerkelijk gereed zijn, plus bestaande profielen in ontwikkeling.
- `/vragenlijsten`: alle gereed gemelde losse lijsten, filters op thema en doelgroep, met keuzevakjes voor een eigen combinatie.
- `/vragenlijsten/[slug]`: korte uitleg, opgegeven doelgroep, invuller, verkoopprijs, inbegrepen dienstverlening en verloop na bestelling.
- `/samenstellen`: overzicht van de gekozen lijsten, verwijderen/toevoegen, subtotaal, aantal, staffel, korting en totaal.
- Een gemeenschappelijke bestelpagina voor een vast pakket of een samengestelde set, met dezelfde betaalreferentie en statusopvolging.

Gebruik naast instrumentnamen zoals NEO-PI-3 ook begrijpelijke onderwerptitels. Vermeld per product wat de klant voor het bedrag ontvangt. De aangeleverde omschrijvingen worden niet uitgebreid met zelfbedachte diagnostische claims.

Voorstel voor de eerste versie: één vast pakket of één samengestelde set per bestelling en per deelnemer. Dit voorkomt onbesliste kortingsregels en dubbele afnames bij gemengde mandjes. Pakketten combineren met extra lijsten, meerdere deelnemers en meerdere pakketten per mandje worden pas toegevoegd nadat de regels daarvoor zijn vastgelegd.

De huidige accountstroom blijft tijdens de catalogusbouw bruikbaar. Kopen zonder voorafgaand account uit MG-02 blijft een afzonderlijke werkstroom; prijsberekening en productinhoud mogen niet afhankelijk worden van een bepaalde inlogmethode.

## Technische bouwstappen

### Stap 1 Catalogus en beheer

Aanvullen van het bestaande productbeheer, zonder parallelle prijsadministratie:

- Een expliciet producttype voor een losse vragenlijst toevoegen aan de Supabase-enum en de TypeScript-typen. Het bestaande type `profile` blijft voor vaste profielen.
- Vragenlijstmetadata toevoegen: categorie, instrument en versie, doelgroep/leeftijd, wie invult, afnamemethode, leverwijze en gereedstatus.
- Leeftijd waar nodig in maanden modelleren, bijvoorbeeld voor de bronwaarde 2,5 jaar. Geen numerieke minimumleeftijd verzinnen voor bronregels die alleen Volwassenen vermelden.
- Pakketonderdelen koppelen aan bestaande vragenlijstproducten. Het eigen arousalprofiel krijgt een aparte component zonder gefingeerde losse verkoopprijs.
- De 22 prijsregels en acht pakketprijzen eerst als concept invoeren. Catalogusgegevens zijn beschikbaar; publicatie volgt per product nadat afname en levering vaststaan.
- Uitgeverskosten desgewenst bewaren in een aparte afgeschermde administratie. Ze maken geen deel uit van een publieke productresponse.
- Productgereedheid en publicatiestatus leidend maken. De eerdere tijdelijke blokkering van het hechting- en relatieprofiel kan blijven tot die status via beheer wordt ondersteund.

Belangrijkste bestaande onderdelen: `src/lib/adminProducts.ts`, `src/components/admin/ProductForm.astro`, `src/pages/api/admin/products/`, `src/lib/publicProducts.ts` en `src/lib/supabase/database.types.ts`.

Gereed wanneer één losse vragenlijst en één profiel met onderdelen correct kunnen worden beheerd en de publieke response geen uitgeverskosten bevat.

### Stap 2 Overzichten en samensteller

- Publieke vragenlijstcatalogus en detailpagina toevoegen.
- Profieloverzicht uitbreiden met gereed gemelde vaste pakketten en duidelijke inhoud.
- Een samensteller bouwen die keuzes, prijzen en korting direct zichtbaar maakt en keuzes bij navigeren bewaart.
- De server levert de prijsopgave; de browser toont die. De gekozen instrumenten, niet een clienttotaal, gaan mee naar bestellen.
- Beschikbaarheid en de door Virginie vastgelegde toepasselijkheidsregels controleren vóór betaling. Ongeldige combinaties tonen een concrete uitleg.

Gereed wanneer één, twee, drie en vier geselecteerde lijsten de juiste staffel tonen, verwijderen de prijs herberekent en een pakket zijn vaste prijs behoudt.

### Stap 3 Orders voor meerdere vragenlijsten

De huidige checkout verwerkt één productslug. De database heeft al `order_items`, maar de bestelroute, de hergebruikregel voor openstaande orders en sommige klantweergaven gaan uit van één product. Voor zelf samenstellen is een uitbreiding nodig.

- Een serverfunctie voor een set product-ID's of één vast pakket maken, met transactie, actuele cataloguscontrole en herhaalbeveiliging.
- Alleen IDs/selectie en een unieke aanvraagcode van de browser accepteren; bedragen, staffel en eindtotaal op de server berekenen.
- Orderprijs en samenstelling vastleggen. Latere prijs- of pakketwijzigingen veranderen bestaande orders niet.
- De huidige unieke sleutel op klant plus `checkout_product_id` aanpassen of aanvullen voor combinaties. Verschillende sets mogen niet dezelfde openstaande order krijgen. Een herhaalde identieke aanvraag mag geen dubbele order maken.
- Eén SEPA-referentie en één QR-code voor het totale verschuldigde bedrag behouden.
- `getWiseManualOrder`, transacties en orderweergaven uitbreiden zodat ze de volledige bestelling tonen; alleen `order_items[0]` gebruiken is onvoldoende.
- De bestaande handmatige betaalcontrole behouden. Meerdere producten veranderen niet hoe echte ontvangst wordt vastgesteld.

Belangrijkste bestaande onderdelen: `src/lib/wiseCheckout.ts`, `src/pages/api/checkout/wise-order.ts`, `src/pages/aanbod/[slug].astro`, `src/lib/supabase/accounts.ts`, `src/pages/account/transacties.astro` en de Wise-order- en bevestigingsmigraties.

Gereed wanneer een samengestelde set één order krijgt met correct totaal, correcte referentie, volledige regels en veilige herhaling.

### Stap 4 Afname en levering

De documenten geven namen en prijzen, maar geen daadwerkelijke vragen, scoringssoftware, uitgeversintegratie of rapporttemplates. Een productkaart en een toegangsrecht zijn nog geen vragenlijstafname of rapportlevering.

- Virginie legt per lijst vast via welke omgeving de deelnemer invult en wie de afname organiseert.
- Vastleggen wie koopt en wie invult; dit kan verschillen bij kinderen of ouder-/verzorgervragenlijsten. Een koper is niet automatisch de onderzochte deelnemer.
- Per bestelling afnametaken aanmaken voor de losse lijsten of pakketonderdelen. Een vast pakket mag niet alleen toegang tot zijn verkoopkaart opleveren.
- Statussen voor de feitelijke uitvoering onderscheiden van betaalstatus en toegangsrecht, bijvoorbeeld afname klaarzetten, uitnodiging verstuurd, afname ontvangen en rapport beschikbaar.
- Rapporten en deelnemersinformatie via de daarvoor bedoelde afgeschermde toegang leveren. Praktische mails bevatten geen scores of klinische inhoud.
- De bibliotheek toont de echte vervolgstap of het resultaat; een link naar een verkooppagina is geen definitieve levering.
- Bestaande beloften zoals een rapport van ongeveer 40 pagina's binnen zeven werkdagen niet automatisch overnemen voor elk nieuw product.
- Automatische scoring of uitgevers-API's alleen als afzonderlijke integratie plannen wanneer die aantoonbaar beschikbaar zijn.

Gereed wanneer een volledige proefbestelling van betaling tot echte afname en geleverd resultaat werkt voor één losse lijst en één pakket.

### Stap 5 Publiceren

- Eerst de gegevens en prijzen van alle conceptproducten nalopen.
- Per gereed product omschrijving, doelgroep, versie, invuller, dienstverlening, prijsstatus en levertermijn invullen.
- Eén losse afname, een eigen combinatie en een vast pakket volledig testen.
- Pas daarna de gereed gemelde producten publiceren. De rest kan in ontwikkeling zichtbaar blijven.
- Vragenlijsten blijven gescheiden van modules en community in de uitvoeringsplanning.

## Punten die Virginie nog moet invullen

Deze punten verhinderen de voorbereiding van de catalogus en de samensteller niet, maar wel ongecontroleerde publicatie of uitvoering van de betreffende producten.

| Punt | Wat ontbreekt | Benodigde uitkomst |
|---|---|---|
| Instrumentversies | Word noemt TSI; PDF noemt TSI / TSI-2 en gebruikt TSI-2 in pakketten. Conners en sommige andere labels noemen geen concrete versie of formulier. | Exact instrument, versie en invuller per verkoopbaar product; TSI en TSI-2 niet stilzwijgend samenvoegen. |
| Sterretjes | Bij Piers-Harris 3 in het kindpakket staat `*`; bij FEEL-E in het prikkelprofiel staat `**`. Er is geen toelichting gevonden. | Betekenis of alternatieve samenstelling vastleggen. |
| Doelgroep van pakketten | De kindlijsten hebben verschillende leeftijdsbereiken; hetzelfde geldt voor jeugd- en prikkelpakketten. | Een geldige pakketdoelgroep en eventuele varianten vastleggen. Op basis van de bronranges is de overlap bij het kindpakket 8–13, bij emotioneel welzijn 8–18 en bij het huidige prikkelprofiel 18–80 jaar; dit zijn rekenkundige overlaps, geen bevestigde klinische toepassingsregels. |
| Inbegrepen dienstverlening | Losse prijzen zeggen niet of rapport, uitleg of nabespreking inbegrepen is. | Concreet leverresultaat en termijn per lijst en pakket. |
| Pakketmeerwaarde | Trauma en Herstel en Emotioneel Welzijn Jongeren zijn €1,35 duurder dan de eigen combinatie. | Uitleg over eventuele extra inhoud/dienstverlening; de bevestigde prijzen blijven tot een nieuw besluit behouden. |
| Interne stresskost | Word geeft €50. De zes externe regels tellen met de TSI-kost op tot €39,55; een aparte TSI-2-kost en kost voor het eigen profiel ontbreken. | Interne €50 controleren; niet als fout of complete kostbasis beschouwen zonder uitleg. |
| Prijsstatus | Alleen de interne Word-kosten zijn expliciet exclusief btw. | Vastleggen hoe de klantprijzen fiscaal worden aangeduid; geen btw-percentage uit de interne kosten afleiden. |
| Afnametoegang | Geen uitgeversomgeving, formulieren, scoreprocedure of rapporttemplates aangeleverd. | Per product een uitvoerbaar afname- en leverproces. |

## Acceptatiecontroles

- Alle 22 losse PDF-prijzen en acht vaste pakketprijzen komen exact overeen met de bron.
- De zeven overige Word-pakketkosten komen overeen met de som van hun bronregels; de onverklaarde stresskost blijft afzonderlijk gemarkeerd.
- Lege selectie kan niet besteld worden; één, twee, drie, vier en meer verschillende lijsten krijgen respectievelijk de juiste korting.
- Hetzelfde product dubbel toevoegen verhoogt de kortingsteller niet.
- Twee producten van €59 en €69 kosten €121,60. Drie producten van €99, €59 en €59 kosten €206,15. Vier producten van €69 kosten €248,40.
- Het vaste volwassenpersoonlijkheidspakket blijft €205 en het stresspakket €275, zonder extra staffelkorting.
- Kortingen zijn exact in centen; op een rekenvoorbeeld met subtotaal €60,10 en 5% korting is het onafgeronde eindtotaal €57,095. Dit wordt €57,10, met een geboekte korting van €3,00. Totaal en korting blijven samen exact €60,10.
- Een aangepast clientbedrag, gemanipuleerd kortingspercentage, verwijderd product of dubbele aanvraag kan geen onjuiste order maken.
- Cataloguswijzigingen na bestellen veranderen een bestaande orderprijs of samenstelling niet.
- Betaalbevestiging activeert de bedoelde producten of het pakket en zijn afnametaken precies één keer.
- Een bestaande bestelling met één product blijft correct zichtbaar en betaalbaar.
- Transacties, beheer, QR-code en bibliotheek gebruiken de hele bestelling en dezelfde totaalprijs.
- Uitgeverskosten, scores en afname-inhoud komen niet terecht in publieke responses of praktische bestelmail.
- Een product wordt pas bestelbaar na bewezen afname en levering; beschikbaarheid volgens een aangeleverd lijstje is niet hetzelfde als een werkende digitale levering.

## Eerste uitvoeringspakket

Begin met stap 1 en 2: conceptcatalogus, vaste pakketonderdelen, publieke overzichten en een samensteller met de bevestigde prijsregels. Parallel kan Virginie de open inhoudelijke productgegevens aanvullen. Vervolgens breiden we orders en levering uit. Er wordt geen datum voor verkoop van alle producten beloofd op basis van alleen deze prijslijsten.

De uitvoering en controles staan in de runbook. De eerdere tekstcorrecties blijven behouden; de bestaande login is ongewijzigd.
