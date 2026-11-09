# Verkoopvrijgave — 9 november 2026

Kevin bevestigde op 9 november: verkoop via overschrijving inschakelen; Virginie handelt afnames en levering handmatig af; terugkerende keuzehulp/contactoproepen verwijderen. E-book, module-inhoud en recensies volgen later.

## Gedrag

- Productie krijgt expliciet `COMMERCE_SALES_ENABLED=true`. De bestaande pauzeschakelaar blijft beschikbaar voor herstel. Vercel Free/Hobby; geen GitHub Actions.
- De bestaande gast- en accountcheckout registreert de bestelling, toont de bankgegevens en unieke referentie en verstuurt bevestigingen aan klant en team. Een bestelling of QR-scan bevestigt geen betaling.
- Virginie controleert de ontvangen overschrijving en bevestigt die in beheer. Ze bereidt afnames handmatig voor en stuurt de afnamelink en instructies per e-mail. Mijn aankopen blijft beschikbaar voor bestelstatus en beschikbare updates/rapporten.
- De teammail verwijst rechtstreeks naar het betrokken besteloverzicht, met klantgegevens, gekochte onderdelen en handmatige betaalbevestiging.
- Terugkerende hulp-bij-je-keuze-links en vergelijkbare mailoproepen zijn verwijderd uit catalogus, productpagina's en winkelmandje. Algemene contactnavigatie en hulp bij concrete betaalproblemen blijven beschikbaar.
- Geen boek of module gepubliceerd en geen productmateriaal of catalogusstatus gewijzigd.

## Verificatie vóór uitrol

- 103 unit-/servicetests, TypeScript en productiebuild geslaagd; mailregressie uitgebreid voor handmatige afname-instructies en de directe beheerlink.
- 65 commerce-databasecontroles geslaagd in een teruggedraaide transactie.
- 78 HTTP-controles tegen localhost:4322 met synthetische gegevens en lokale MIME-capture: gastcheckout, overschrijvingsgegevens, idempotentie, aankooptoegang, betaalbevestiging, handmatige afname-instructies, rapporten, eigenaarsscheiding en mail.
- Synthetische records en testbestanden verwijderd. Geen echte overschrijving uitgevoerd en geen echte klant- of teammail verstuurd tijdens de test.
- Checkout visueel gecontroleerd op desktop en mobiel; geen horizontale overloop. Profielpagina gecontroleerd op verwijderde keuzehulp en correcte handmatige opvolging.
- Release-artifact gecontroleerd op uitgesloten testcaptures en geheimen.

## Dagelijks gebruik

Open Bestellingen in beheer, vergelijk bedrag en mededeling met de echte bankontvangst en bevestig uitsluitend ontvangen betalingen. Volg daarna de afname handmatig op. Mislukte bevestigingsmails zijn zichtbaar onder Mailopvolging.

Bij een probleem kan `COMMERCE_SALES_ENABLED=false` nieuwe orders pauzeren na heruitrol; bestaande orders en aankooptoegang blijven beschikbaar. Historische release-audits beschrijven de eerdere gesloten verkoopstand.
