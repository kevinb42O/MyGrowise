# Afwerking accounttoegang en publieke pagina's

30 oktober 2026. Uitgangspunt `580ecfd` plus de lopende checkoutwijziging. Modules zijn op verzoek buiten deze ronde gehouden. Geen deployment of verkoopvrijgave uitgevoerd.

## Wat al klaar was

De afspraak-/dossierketen heeft al productieacceptatie en bevestigde mailontvangst; die is niet opnieuw gebouwd. Mijn aankopen en de transactionele mailopmaak waren gecommit. De lopende checkout had de nieuwe PurchaseLayout, kopieerbare betaalgegevens, optionele QR en mobiele volgorde intro → overzicht → betaalgegevens al gekregen. De tijdelijke checkout-reviewpagina was vóór deze ronde verwijderd. Dit werk is behouden.

## Nieuwe wijzigingen

- Eén AuthLayout en gedeelde wachtwoordvelden voor inloggen, registreren, herstel aanvragen, nieuw wachtwoord en bevestigingslink. Rustige aankoopnavigatie in plaats van de volledige marketingfooter; dezelfde kleuren, knoppen en formulieren als Mijn aankopen.
- Geldige invoer houdt de bestaande serverroutes en controles. Wachtwoordzichtbaarheid, clientfeedback bij ongelijke wachtwoorden, verzendstatus en bfcache-herstel. Geen automatische focus die op telefoons meteen het toetsenbord opent.
- Herstel zonder geldige sessie of bij technische fout geeft een directe nieuwe-linkactie. Een mislukte opslag laat opnieuw proberen toe.
- De gewenste vervolgroute ging vroeger verloren bij wachtwoordherstel. Login → aanvraag → herstelmail → herstelpagina → opnieuw inloggen bewaart nu de gesanitiseerde route. Drie regressietests controleren behoud, externe URL's, origin en neutrale fout-/limietreacties.
- Contact opent met het formulier naast een compacte introductie. Praktische privacy-uitleg staat bij het bericht; direct e-mailcontact, afspraken, crisisinformatie en bedrijfsgegevens blijven behouden. Naam/e-mailadres staan op desktop uitgelijnd.
- Prijzen heeft categorieankers en compacte vergelijkingsregels. Prijzen/kortingen blijven uit de catalogus komen. De bestaande €80 en gemiddelde 50 minuten voor begeleiding zijn behouden; het afspraakmodel bevat geen prijsveld waaruit een dynamisch tarief kan worden afgeleid.
- Over ons behoudt inhoud, fotografie en video met rustigere kleuren, koppen, bijschriften en witruimte. Geen nieuwe beelden of behandelclaims.

## Uitgevoerde acceptatie

- 78 HTTP-controles tegen de geïsoleerde lokale mailcapture-app en de gekoppelde database geslaagd: gastcheckout, afnames, rapport, bestanden, aankooplinks, eigenaarsscheiding, accountkoppeling, annulering/refundtoegang en contact/MIME. Alle synthetische records en bestanden na afloop verwijderd. Geen echte bankoverschrijving; dit bewijst de technische keten.
- 65 aanvullende commerce-databasecontroles geslaagd in één teruggedraaide transactie. Geen blijvende schemawijziging of mail.
- 30 gerichte account-/publieke HTTP-controles geslaagd: rendering, private/no-store en noindex voor accountpagina's, CSRF, ongelijke registratievelden en vervolgroute.
- Echte wachtwoordherstel- en aankooptoegangsmail aangevraagd via de bestaande applicatieroutes voor het afgesproken testadres. De aankooptaak stond op sent na één poging. Kevin bevestigde expliciet: beide ontvangen. Zijn wachtwoord en account zijn niet gewijzigd.
- Beide opgegeven mailadressen bleken reeds bevestigde accounts. Geen account verwijderd, opnieuw geregistreerd of onnodig uitgenodigd. Ontvangst van registratie/invitatie voor een nieuw adres blijft daarom een aparte bewijsgrens, geen afgeronde proef.
- Desktop van de gewijzigde account-, contact-, prijs- en overpagina bekeken. Na uitval van de Chromeverbinding zijn de controles hervat in de in-app browser.
- Acht routes op 320px: inloggen, aanmaken, herstelbevestiging, bevestigingslink, ongeldige herstelpagina, Contact, Prijzen en Over ons. Documentbreedte telkens 320px, zichtbare invoer 16px, geen buiten het scherm lopende beelden. Registratie en Contact ook op 390px visueel bekeken. Vier pagina's aanvullend op 820px zonder pagina-overflow.
- Tonen/verbergen van het lege wachtwoordveld getest; Tab gaat van e-mail naar wachtwoord. De ongeldige herstelpagina toont daadwerkelijk de herstellinkactie. Geen echt wachtwoord in de browser ingevuld of gewijzigd.
- Impeccable-detector uitgevoerd. Meldingen betreffen de vergelijking met het uitsluitend voor Startpunt geschreven DESIGN.md (lettergroottes, kleuren en radii); de bewuste aansluiting op Mijn aankopen is in de surface briefs vastgelegd. Geen nieuwe algemene merkspecificatie toegevoegd.

## Resterende grenzen

Een echte bankontvangst, inhoudelijke levering en fysieke Safari-toesteltest volgen niet uit deze technische proeven. Registratie- en uitnodigingsontvangst voor een nieuw account vereisen een ongebruikt afgesproken adres. De nieuwe code moet nog worden uitgerold; bestaande productieacceptatie is geen bewijs van deze lokale vormgevingsronde.

Eindcontroles: 102 unit-/regressietests geslaagd, TypeScript en productiebuild geslaagd, release-artifactcontrole geslaagd (1691 bestanden), broncontrole schoon. De capture-server voor de HTTP-proef wordt na afloop gestopt; de bestaande lokale website blijft draaien. De echte ontvangstproef wijzigde geen account of wachtwoord.
