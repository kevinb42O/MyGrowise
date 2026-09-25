# Contact en berichten: frictieloze publieke flow

**Status:** uitgevoerd op 25 september 2026; dit document bewaart de ontwerpkeuzes en aandachtspunten.
**Uitgangspunt:** één MyGrowise-supportinbox voor praktische vragen; geen intake, medische gegevens of sessie-inhoud.

## 1. Besluit

Maak op `/contact` een direct invulbaar berichtformulier. Vraag een nieuwe bezoeker **geen wachtwoord en geen accountregistratie vóór het versturen**. Laat die het gesprek later openen via een veilige, eenmalige e-maillink. Een ingelogde klant krijgt hetzelfde gesprek in `/account/ondersteuning`. Houd `mailto:info@mygrowise.be` als zichtbare uitwijkmogelijkheid.

Voor een bezoeker is bezit van het e-mailadres de lichtste zinvolle vorm van identificatie om antwoorden privé terug te lezen. Een klikbare link in een e-mail is toegang, dus het adres moet correct zijn en de link moet beperkt geldig, eenmalig en herroepbaar zijn. Voor accountklanten blijft de bestaande sessie leidend. Een supportgesprek mag geen reden zijn om automatisch een volwaardig winkel- of begeleidingsaccount aan te maken.

Dit vraagt een uitbreiding van het huidige datamodel: `support_conversations.customer_user_id` en `support_messages.sender_user_id` zijn nu verplicht en verwijzen naar `profiles`. Een anonieme bezoeker kan vandaag dus niet in deze inbox schrijven. De admin-inbox, statussen en notities kunnen wel worden hergebruikt.

| Keuze | Frictie | Gevolg | Advies |
|---|---|---|---|
| Alleen `mailto:` | laag bij werkende mailapp | antwoord buiten platform; geen gedeelde opvolging | behoud als alternatief |
| Eerst account registreren | hoog: naam, wachtwoord, bevestiging, login | sluit veel eerste vragen uit | niet voor algemene contactvragen |
| Bezoeker stuurt bericht, leest via e-maillink | laag: naam, e-mail, vraag | vergt gasttoegang en transactionele e-mail | aanbevolen |
| Alleen een e-mailformulier | laag | contact wordt alsnog handmatig in mailbox afgehandeld | geen eindbeeld |

## 2. Publieke pagina en microcopy

De eerste zichtbare actie is **‘Stuur ons een bericht’** met het formulier direct op de pagina. Geen modal en geen doorgang via een loginpagina. Naast het formulier: ‘Liever e-mailen? info@mygrowise.be’. Houd de bestaande route naar professionals en de crisishulptekst gescheiden van het algemene supportformulier.

Veldvolgorde op mobiel en desktop:

1. **Waarover gaat je vraag?** Zes bestaande categorieën: algemeen, bestelling, toegang, afspraak, privacy, anders. Voeg ‘Samenwerking’ toe als routeringslabel of als aparte optie die naar de juiste eigenaar gaat. Selecteer geen medische categorie.
2. **Je vraag**. Eén tekstvak; maximum 4.000 tekens, duidelijke foutmelding, behoud inhoud bij een fout. Geen verplichte onderwerpregel: genereer intern een neutraal onderwerp uit categorie plus referentie; optioneel onderwerp kan later.
3. **E-mailadres**. Leg ernaast uit: ‘Hier sturen we een melding wanneer je antwoord klaarstaat.’
4. **Naam**. Bij voorkeur optioneel voor eerste contact; vraag alleen wat het team nodig heeft om passend aan te spreken. Bij ingelogde klanten voorinvullen en niet opnieuw vragen.
5. **Verstuur bericht**. Geen verplichte marketingtoestemming. Toon onder de knop: ‘Je bericht en onze antwoorden blijven in een beveiligd gesprek. Deel hier geen medische of andere gevoelige informatie.’ Link naar de definitieve privacyverklaring.

Microcopy na verzending: ‘Je vraag is ontvangen. We sturen een bevestiging naar [gemaskeerd adres]. Via de link in die e-mail kan je ons antwoord lezen en reageren. Kijk ook in je spammap.’ Noem een antwoordtermijn alleen als het team die daadwerkelijk kan halen. Geef een korte referentiecode; toon geen berichtinhoud in de URL of bevestigingsmail.

Schrijf toegankelijk: echte labels, `autocomplete`, toetsenbordbediening, duidelijke fout per veld, focus op de foutmelding, statusmelding voor schermlezers, voldoende contrast en geen verlies van concepttekst bij netwerkfouten. Bouw met standaard HTML-formulier; JavaScript mag de ervaring verbeteren maar is niet vereist.

## 3. Stroom per bezoeker

| Situatie | Actie | Resultaat |
|---|---|---|
| Nieuwe bezoeker | formulier invullen en verzenden | gesprek verschijnt in adminwachtrij; bevestigingsmail met veilige toegangslink |
| Bestaande klant, ingelogd | formulier met accountidentiteit verzenden | gesprek direct zichtbaar in `/account/ondersteuning`; bevestiging toont knop ‘Bekijk gesprek’ |
| Bestaande klant, uitgelogd | formulier als bezoeker verzenden | werkt zonder wachtwoord; geen automatische accountkoppeling op alleen een gelijk e-mailadres |
| Medewerker antwoordt | antwoord wordt opgeslagen; e-mailtaak wordt aangemaakt | klant krijgt melding met knop naar gesprek, zonder antwoordtekst in e-mail |
| Bezoeker opent e-maillink | link wordt server-side gecontroleerd en ingewisseld | korte, beveiligde gastsessie voor uitsluitend dat gesprek; lezen en antwoorden mogelijk |
| Link verlopen, gebruikt of kwijt | ‘Stuur nieuwe toegangslink’ na invoer e-mailadres of referentie | neutrale bevestiging; bestaande sessies en accounts blijven intact |
| Klant logt later in | expliciete, geverifieerde koppeling aan account | gesprek verschijnt bij Berichten; geen koppeling op naam of onbevestigd e-mailadres |

Een ontvangen e-mail mag nooit de enige opslagplaats voor het antwoord zijn. De inhoud leeft in het platform; e-mail is een melding en een toegangspad. Het gesprek kan ook zonder live e-mailbeantwoording verdergaan. Een reply-to op notificatiemails moet duidelijk zijn: ofwel werkende reply-inname met veilige koppeling aan het gesprek, ofwel `no-reply` met expliciete instructie om via de knop te antwoorden. Geef nooit de indruk dat reply-to werkt als die antwoorden verdwijnen.

## 4. Technische vorm

**Datamodel.** Breid de supportconversatie uit met een gastafzender: `customer_user_id` mag ontbreken wanneer er een geverifieerd of nog te verifiëren gastadres is. Bewaar genormaliseerd e-mailadres, weergavenaam, `email_verified_at`, willekeurige publieke referentie en contactkanaal. De databaseconstraint eist precies één eigenaarstype. Voor berichten: expliciete `sender_type` (`customer`, `guest`, `staff`) en een passende afzenderreferentie; interne notities blijven uitsluitend `staff`. Geen schijnprofiel of gedeeld ‘gastaccount’ aanmaken. Onderzoek een aparte `support_guest_identities`-tabel als één bezoeker meerdere gesprekken krijgt, maar geef elk gesprek afzonderlijk toegang.

**Verzenden.** Voeg een publiek POST-endpoint toe met servervalidatie, origin/CSRF-bescherming, spamremming en idempotency key. Sla gesprek, eerste bericht en een uitgaande mailtaak transactioneel op; zo kan e-mailfalen het bericht niet doen verdwijnen. Toon na succes een bevestigingspagina. Verifieer het e-mailadres bij de eerste geopende toegangslink; tot dan mag het team het bericht triëren, maar wees voorzichtig met persoonsgebonden antwoorden naar een ongeverifieerd adres. Gebruik geen klantprofiel op grond van een ingevoerd e-mailadres.

**Toegang.** Maak per link een cryptografisch willekeurig token; sla alleen de hash op. Koppel het aan één gesprek, doel, vervaltijd en gebruiksstatus. Openen van de URL via GET mag niets verbruiken: e-mailbeveiligers bezoeken links automatisch. Wissel het token via POST in voor een beperkte `HttpOnly`, `Secure`, `SameSite` gastsessie. Maak de link eenmalig en laat de sessie na een korte periode verlopen; bij verlopen toegang kan de bezoeker een nieuwe link aanvragen. Gebruik `Referrer-Policy: no-referrer`, `noindex`, `Cache-Control: no-store`; laat tokens en berichtinhoud uit analytics, logs en foutmeldingen. Rate-limit aanvraag, inwisseling en herverzending in een gedeelde datastore, niet alleen in procesgeheugen. Maak herstelmails en fouten neutraal om e-mailadressen en bestaande gesprekken niet te onthullen. Verwijder sessies bij afmelden; denk aan gedeelde apparaten.

**Autorisatie.** Alle gastlees- en schrijfacties toetsen server-side de sessie aan precies dit gesprek. Adminacties blijven achter `support.write`. Versterk de database- en applicatielaag samen: RLS voor accountklanten, serverroute voor gasten, nooit publiek service-role-toegang. Een gast mag geen andere gesprekken, accountgegevens, interne notities of personeelsoverzicht zien. Een eventueel account-claimproces vergt bewezen beheer van het gastadres én een ingelogde account met hetzelfde bevestigde adres.

**E-mail.** Gebruik een betrouwbare transactionele verzender voor ontvangst, teamantwoord en nieuwe toegangslink, met afleverstatus, retries, idempotente verzending, bounce-afhandeling en een zichtbaar operationeel alarm. De huidige repository toont Supabase Auth-mails, maar geen applicatie-e-mail voor supportantwoorden. De mailinhoud blijft neutraal: ‘Er staat een antwoord voor je klaar’, referentie en knop; geen onderwerp, categorie, naam van professional of medische inhoud. SPF/DKIM/DMARC, templates, afzender en privacytekst moeten vóór publieke release zijn bevestigd. Dagelijkse bundeling is ongewenst voor een eerste antwoord; meld direct, maar voorkom meerdere mails bij snel opeenvolgende teambijdragen.

**Beheer.** Toon gastnaam, adresverificatie, kanaal, referentie en afleverstatus in `/admin/berichten`. Een medewerker ziet duidelijk of een bericht ongeverifieerd is. Behoud eigenaar, status, prioriteit en interne notities. Maak ‘Antwoord versturen’ pas succesvol als bericht plus uitgaande mailtaak zijn opgeslagen; bij bezorgfalen blijft het gesprek zichtbaar met herstelactie. Voor `privacy`-vragen kan een eigen eigenaar/routering nodig zijn. De categorie ‘samenwerking’ hoort mogelijk bij een ander team; beslis dat operationeel, zonder extra bezoekersstap.

## 5. Concrete reparaties in de bestaande inbox

1. `src/lib/supportInbox.ts` kiest in `mapConversation` de nieuwste voorvertoning vóór interne notities voor klanten worden weggefilterd. Filter vóór het bepalen van `preview` en `unread`, zowel voor de lijst als voor het gesprek. Test dat interne notities op geen enkele klant- of gastweergave verschijnen.
2. `getSupportConversation` markeert een gesprek bij openen als gelezen. Zorg dat de geretourneerde toestand de bijgewerkte leestijd weerspiegelt. Maak ongelezentellingen afhankelijk van een zichtbaar bericht van de andere partij, niet van de eigen laatste bijdrage.
3. `people()` haalt via `auth.admin.listUsers({ page: 1, perPage: 100 })` slechts de eerste 100 gebruikers op. Daardoor verdwijnen namen en e-mailadressen later uit de inbox. Gebruik gerichte, gepagineerde opzoeking of een toegangsbeperkte contacttabel.
4. `listSupportConversations` beperkte zich tot 100 gesprekken en las alle berichten. De nieuwe samenvattingsview en paginering lossen de grens en overbodige berichtlezingen op.
5. Maak aanmaken van conversatie plus eerste bericht atomair. Nu kan een mislukte tweede insert een leeg gesprek achterlaten. Maak ook verzendacties idempotent tegen dubbelklikken en netwerkherhaling.
6. Controleer statusovergangen: interne notities mogen geen publieke preview, ongelezen klantstatus of klantmail veroorzaken. Een teamantwoord moet een antwoordmelding krijgen; het huidige systeem maakt alleen interne meldingen bij klantberichten.

## 6. Privacy en afbakening

Deze inbox is voor praktische vragen. De waarschuwing ‘geen medische of andere gevoelige informatie’ helpt, maar voorkomt niet dat bezoekers zulke inhoud toch typen. Richt daarom triage in: beperken wie dit leest, geen inhoud in analytics of notificatiemails, veilige verwijdering/verplaatsing volgens een vastgesteld protocol en geen automatische doorsturing naar een klinisch dossier. Geen bestanden in de eerste versie. Gebruik een bewaartermijn, verwijderprocedure en verwerkersoverzicht die in de definitieve privacyverklaring terugkomen. De huidige `/privacy` is nog een placeholder; dit is een releasevoorwaarde. Bij acute nood blijven 112 en 1813 zichtbaar, zonder een valse verwachting van onmiddellijke ondersteuning.

## 7. Volgorde van uitvoering

**Fase 0 — voorwaarden.** Kies eigenaar van de supportwachtrij, werkelijk haalbare responstermijn, routering voor samenwerking/privacy, bewaartermijn en transactionele e-mailprovider. Rond privacytekst af. Repareer de zichtbaarheid van interne notities en test rolgrenzen.

**Fase 1 — publieke basis.** Bouw publieke formulierpagina, gastenmodel, atomair opslaan, anti-spam, bevestiging, veilige link, gastsessie, gastgesprek en teaminbox-uitbreiding. Laat het bestaande `mailto:` staan.

**Fase 2 — betrouwbaar antwoordpad.** Voeg ontvangst- en antwoordmails, outbox/retries, afleverstatus, herstel van verlopen links, monitoring en een runbook toe. Publiceer de formulieractie pas als dit end-to-end werkt; anders belooft de pagina een antwoordkanaal dat bezoekers niet kunnen bereiken.

**Fase 3 — samenhang met accounts.** Hergebruik de publieke formuliercomponent voor ingelogde klanten, toon bestaande gesprekken in hun inbox, voeg een expliciete claimflow voor geverifieerde gastgesprekken toe en toon ongelezen klantberichten in de accountnavigatie.

## 8. Acceptatiecriteria

- Een nieuwe bezoeker kan vanaf `/contact` op mobiel in één scherm een vraag versturen zonder account of wachtwoord; een dubbele klik maakt één gesprek.
- Het team ziet de vraag in dezelfde wachtrij, kan toewijzen en antwoorden; de bezoeker ontvangt één neutrale melding, opent veilig het juiste gesprek en kan reageren.
- Een accountklant kan dezelfde flow zonder opnieuw naam/e-mail in te vullen en ziet het gesprek in `/account/ondersteuning`.
- Een verloren/verlopen link is via e-mail te herstellen; URL-gokken, URL-delen na verbruik en een ander account geven geen toegang.
- Interne notities, andere klantgesprekken en antwoordtekst zijn onzichtbaar in gastpagina, klantlijst, notificatiemail, analytics en publiek cachegeheugen.
- Een geblokkeerde of mislukte e-mail wordt zichtbaar voor het team met retry; de vraag verdwijnt niet stilzwijgend.
- Formulierfouten bewaren de tekst; spamremming blokkeert misbruik zonder legitieme bezoekers systematisch uit te sluiten.
- De privacyverklaring, bewaartermijn, supporteigenaar en noodtekst zijn vóór de publieke lancering vastgelegd.

## 9. Te meten na lancering

Meet zonder berichtinhoud: percentage bezoekers dat het formulier start/voltooit, afleverpercentage van ontvangst- en antwoordmails, percentage geopende antwoorden, tijd tot eerste menselijk antwoord, verloop van links, spamratio en aantal vragen dat alsnog via gewone e-mail binnenkomt. Bekijk de eerste weken vooral waar mensen afhaken bij e-mailadres, mailontvangst en terugkeerlink; pas pas daarna de formulieren aan.

## 10. Bronnen bij ontwerpkeuzes

- [Supabase: passwordless e-mail en toegestane redirects](https://supabase.com/docs/guides/auth/auth-email-passwordless). Beschrijft OTP/magic links en de standaardmogelijkheid om bij OTP een gebruiker aan te maken; voor deze gastflow is een apart beperkte toegangslayer bewust gekozen.
- [OWASP: herstel- en toegangstokens](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Onderbouwt eenmalige, tijdelijk geldige tokens en bescherming tegen brute force en tokenlekken.
- [EDPB: richtlijnen over gezondheidsgegevens](https://www.edpb.europa.eu/system/files/2022-03/edpb_03-2022_guidelines_on_dark_patterns_in_social_media_platform_interfaces_en.pdf). Gezondheidsgegevens vallen onder bijzondere categorieën; daarom blijft de supportinbox beperkt tot praktische ondersteuning.
