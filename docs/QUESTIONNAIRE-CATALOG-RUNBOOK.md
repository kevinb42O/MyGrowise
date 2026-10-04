# Vragenlijsten, profielen en afnames beheren

Geïmplementeerd op 4 oktober 2026. De acht additieve migraties zijn toegepast op het gekoppelde Supabase-project; de controle vóór de Git-release bevestigt dat de database bijgewerkt is. De applicatiewijzigingen worden via `main` aangeboden aan de bestaande Vercel-integratie. Een geslaagde Git-push bevestigt op zichzelf geen geslaagde productiedeployment. De oorspronkelijke Word- en PDF-bestanden zijn ongewijzigd.

## Wat is ingericht

22 losse instrumenten, acht vaste profielen en de bestaande beschikbaarheidsstatus voor het hechtingsprofiel. De PDF bepaalt de klantprijzen; het Word-document bepaalt interne uitgeverskosten en broninformatie. TSI / TSI-2 blijft één losse prijsregel, met een interne waarschuwing dat de versie en TSI-2-kost nog bevestigd moeten worden. Eigen pakketonderdelen hebben geen verzonnen losse prijs.

De vaste profielen behouden hun afzonderlijke PDF-prijs. Bij zelf samenstellen geldt 0% bij één lijst, 5% bij twee of drie, 10% vanaf vier. Eén bestelling bevat één vast profiel of één zelf samengestelde selectie voor één persoon. Dubbele instrumenten en mengen van pakketten met losse lijsten worden afgewezen. De kortingsregels zijn aanpasbaar. Alleen het definitieve bedrag wordt afgerond; de betaalbare regelbedragen worden met de grootste-restmethode verdeeld en tellen exact op tot het totaal.

Publieke pagina's: `/profielen`, `/vragenlijsten`, `/samenstellen`, productdetails en `/bestellen`. Zoeken, thema- en doelgroepfilters, opgeslagen selectie binnen de browsersessie, combinatiekorting, responsive besteloverzicht en een controleerbare checkout zijn beschikbaar. De browser bewaart alleen publieke product-ID's. Prijzen, publicatie en beschikbaarheid worden bij bestellen opnieuw gecontroleerd op de server.

## Superadmin: catalogus en prijsstructuur

Open **Verkoop → Vragenlijsten & profielen** (`/admin/vragenlijsten`).

- Maak een instrument of vast profiel aan met **Nieuw aanbod**.
- Bewerk naam, URL, type, publicatiestatus, beschikbaarheid en verkoopprijs.
- Bewerk thema, doelgroep, leeftijd, exacte versie, korte en lange omschrijving, wat inbegrepen is en vervolgstappen na betaling.
- Kies pakketonderdelen en hun namen/volgorde. Eigen onderdelen kunnen als aparte regels worden toegevoegd.
- Vul interne uitgeverskost **exclusief btw**, kostnotities en professionele controlepunten in. Deze staan in afgeschermde tabellen en worden niet naar publieke pagina's of React-props gestuurd.
- Stel de volgorde en het lokale afbeeldingspad in. Gebruik bestanden onder `/images/`.
- Pas onderaan de kortingsdrempels, percentages en het publieke prijslabel aan. Er is bewust geen ongefundeerde btw-vermelding.

**Concept/in review/gearchiveerd** wordt niet verkocht. **Gepubliceerd + beschikbaar** kan besteld worden. **In ontwikkeling** is zichtbaar zonder bestelknop. **Gepauzeerd** verdwijnt uit de interactieve catalogus en kan niet besteld worden. Een los instrument pauzeren wijzigt de pakketpublicatie niet: vaste pakketten worden afzonderlijk beheerd. Een instrument dat in pakketten voorkomt kan niet naar het type profiel worden omgezet totdat het uit die pakketten verwijderd is.

Opslaan gebeurt atomair. Oude catalogus-URL's worden bij slugwijzigingen als alias bewaard. Bij wijzigingen aan de relevante catalogusgegevens moet een open checkout opnieuw gecontroleerd worden. De inhoud en prijs van een gemaakte bestelling worden daarna niet gewijzigd door latere catalogusbewerkingen.

## Bestelling en betaling

De klant maakt een bestelling met het bestaande klantaccount en aanvaardt de voorwaarden. De prijsberekening gebruikt de database; meegestuurde browserprijzen worden niet vertrouwd. Een unieke aanvraag-ID voorkomt dubbele bestellingen door dubbel klikken. Een prijs-/inhoudshash voorkomt bestellen op een verouderd overzicht. Eén bestelling heeft één overschrijvingsreferentie en één QR-code.

Open **Bestellingen** en klik op de productnaam voor het volledige besteloverzicht (`/admin/bestellingen/[id]`). Vergelijk bedrag en mededeling met de werkelijke bankoverschrijving en bevestig alleen een ontvangen betaling. Een klantverklaring of QR-scan activeert niets.

Bevestiging is idempotent en activeert alle regels. Voor een pakket worden alle bij aankoop vastgelegde onderdelen als afnametaken aangemaakt. Bij oudere betaalde profielen zonder historische pakketgegevens wordt het oorspronkelijk gekochte profiel als één taak behouden; de huidige pakketinhoud wordt niet achteraf als historische aankoop ingevuld.

## Superadmin: afname en rapportlevering

Open **Afnames & rapporten** (`/admin/afnames`) of de afnames vanuit het besteloverzicht.

1. Controleer de interne versie-/leeftijds-/afnamepunten en stem professioneel af voor wie de afname bestemd is. De koper is niet automatisch de beoordeelde persoon.
2. Open de afnametaak, schrijf de klantinstructies en voeg eventueel een officiële HTTPS-afnamelink toe.
3. Zet de voortgang op voorbereid, klaar om te starten, antwoorden ontvangen of afgerond.
4. Upload het afgewerkte rapport als PDF, maximaal 15 MB. Het bestand staat in de private bucket `assessment-reports`. De naam in opslag bevat alleen UUID's. Er worden geen rapportinhoud, scores of afnamelinks naar het auditlog geschreven.
5. De klant vindt instructies, voortgang, afnamelink en beschikbare rapporten in **Mijn bibliotheek** en de afnamedetailpagina.

Rapporttoegang vereist een eigen klantaccount, eigendom van de afname en een bestelling met status betaald/afgehandeld. De download gebruikt een ondertekende URL die 60 seconden geldig is, met private/no-store- en no-referrerheaders. Een vervangende upload verandert de rapportverwijzing; oudere bestanden worden bewaard. Bij een niet langer betaalde bestelling is nieuwe rapporttoegang geblokkeerd.

Dit is een complete workflow voor professioneel beheerde afname en levering. Er zijn geen uitgeversvragen, automatische scores, rapportinhoud, licenties of uitgevers-API's verzonnen. Virginie koppelt de juiste bestaande afname en het professioneel opgemaakte resultaat per taak.

## E-mail en opvolging

Een duurzame mailwachtrij ontvangt bestelbevestigingen, betalingsbevestigingen en afname-updates. De klant krijgt neutrale meldingen met een accountlink; producttitels, klinische antwoorden en rapporten worden niet per gewone mail verstuurd. Het team krijgt nieuwe bestellingen en bevestigde betalingen. Verzendadres/SMTP komen uit de bestaande geverifieerde mailconfiguratie. Zonder geverifieerde SMTP blijven meldingen in de wachtrij.

Verzending wordt direct geprobeerd bij de actie. Een lease voorkomt dat twee workers dezelfde taak tegelijk verwerken. Fouten krijgen een oplopende wachttijd, maximaal zes pogingen. De bestaande beschermde cronroute `/api/cron/support-mail` verwerkt zowel support- als bestelmeldingen; het bestaande dagelijkse cronschema is niet gewijzigd. SMTP heeft geen gegarandeerde exactly-once-levering bij een crash na verzenden. Het beheer toont wachtende/mislukte meldingen en heeft een knop om opnieuw te proberen. Er zijn tijdens de verificatie geen echte klantmails verzonden.

## Beveiliging en verificatie

Alle catalogusmutaties en afnamebeheer vereisen superadmin, met dezelfde controle in de databasefuncties. De functies zijn expliciet ingetrokken voor `public`, `anon` en `authenticated`: Supabase kan naast PUBLIC ook afzonderlijke standaardgrants hebben. De browser kan de private kosten, afnames en mailwachtrij niet rechtstreeks lezen. De bestaande middleware voert de autorisatie en origincontrole uit; nieuwe routes staan in de centrale permissiematrix.

Uitgevoerde controles:

- `npm run check`: TypeScript en Astro/Vercel-build.
- `npm run test:catalog`: vijf gerichte tests voor kortingsdrempels, vaste prijzen, centverdeling, dubbele selecties, instelbare korting en veilige afnamelinks.
- `npm run test:catalog:db`: 28 checks voor prijzen, afronding, idempotentie, prijswijzigingen, beschikbaarheid, pakket-snapshots, betaling, afnamecreatie, atomaire cataloguswijzigingen, URL-aliases, mailleases, prijsinstellingen en anon/authenticated-rechten. Alle wijzigingen draaien in één transactie die altijd wordt teruggedraaid. Geen testaccounts, orders of afnames blijven achter.
- Browser: drie lijsten (NEO/CERQ/RS) tonen €206,15 bij 5%; met FEEL-E erbij €257,40 bij 10%, gelijk aan de servercheckout. Selectie blijft bewaard tussen catalogus, samensteller en checkout.
- Responsive controle op 390 px: 22 kaarten zichtbaar, geen horizontale overflow; mobiel besteloverzicht blijft bereikbaar. De bestaande paginanimatie wordt voor de lange functionele catalogus overgeslagen.

Een echte professionele afname, daadwerkelijk rapport van een cliënt en SMTP-bezorging aan een echte klant zijn operationele handelingen en zijn niet met echte klantgegevens gesimuleerd. Brononduidelijkheden blijven expliciet in de interne controlepunten staan.
