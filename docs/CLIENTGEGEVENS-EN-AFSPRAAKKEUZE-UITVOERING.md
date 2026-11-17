# Uitvoering cliëntgegevens en afspraakkeuze

Uitvoering van het plan van 17 november 2026.

## Gebouwd

- Directory en agendakiezer vragen afzonderlijke voornaam en achternaam. Nieuwe RPCs bewaren de naamonderdelen atomair, met hergebruik van bestaande autorisatie, toewijzing en audit. Agenda-aanmaak behoudt de bestaande idempotentiesleutel en rolt cliënt én afspraak terug bij een fout. Ook de verdeling van de naamonderdelen hoort bij de idempotentiecontrole; een herhaalde aanvraag overschrijft geen later gewijzigde cliëntgegevens.
- Validatiefouten in de directory worden op dezelfde pagina afgehandeld, met behoud van invoer. Namen en e-mail worden niet in een redirect-URL gezet. De afspraakpagina behoudt cliënt, naamvelden, e-mail, geboortedatum, sleutel, therapeut, type en starttijd.
- Oude volledige namen worden niet automatisch opgesplitst. De bewerkflow toont de opgeslagen volledige naam wanneer een naamonderdeel ontbreekt. De herstelroutine gebruikt alleen een reeds gekoppelde accountidentiteit, twee aanwezige naamonderdelen en een exact overeenkomende volledige naam. Ingevulde velden en boekingssnapshots blijven behouden. De routine geeft alleen aantallen terug.
- Gedeelde aanhefwaarden en labels voor heer, meneer, mevrouw, heer/mevrouw, ouder(s)/verzorger(s) van, echtpaar en Geen aanhef. Een formatter gebruikt dezelfde begroeting voor HTML en tekst in bevestigingen, verplaatsingen, annuleringen en herinneringen. Oude onbekende wachtrijwaarden krijgen een neutrale begroeting. De ontvanger wordt niet gewijzigd.
- Gedeelde kalenderdatumberekening voor leeftijd in Europe/Brussels. Dossier toont datum en leeftijd; het formulier werkt de leeftijd bij tijdens invoer. Ontbrekende, ongeldige en toekomstige datums geven geen leeftijd. Een verjaardag op 29 februari verhoogt de leeftijd in een gewoon jaar op 1 maart.
- Nieuwe-afspraakpagina en praktijkagendadialoog tonen Therapeut en Afspraaktype apart. Eén beschikbare therapeut is vooraf gekozen; een afspraaktype wordt nooit stilzwijgend gekozen. Alleen actieve, bevoegde types staan in de lijst. Nederlandse sortering, duur en uitvoeringsvorm helpen bij herkenning. Geldige `offer_id`-links en ingezonden keuzes blijven behouden. Verplaatsen behoudt de bestaande duur en het type.

## Lokale verificatie

- Baseline: 128 tests geslaagd; bestaande werkboom bevatte alleen het ongetrackte plandocument.
- Eindcontrole: 135 tests geslaagd; `npm run check` en `npm run check:artifact` geslaagd.
- Nieuwe gedragstests omvatten alle aanheffen in vier mailsoorten met HTML-escaping, leeftijdsgrenzen en schrikkeldagen, twintig therapeuten, sortering, voorselectie, gemanipuleerde therapeut/typekeuze en invoerbehoud na fouten.
- `tests/client-details-isolated-db.mjs`: 30 geslaagde controles in een wegwerpdatabase met PGlite (echte PostgreSQL-engine), zonder externe databaseverbinding of mailtransport. De bestaande relevante RPCs worden uit de migraties geladen; een beperkte fixture levert de benodigde tabellen. Deze proef vervangt geen volledige Supabase-platformtest. Een expres falende boekingsinsert bewijst het terugdraaien van cliëntaanmaak; de bestaande volledige overlapcontrole wordt door deze fixture niet nagebootst.
- PGlite is buiten de repository geïnstalleerd; geen nieuwe applicatieafhankelijkheid. Herhalen: installeer `@electric-sql/pglite` in een tijdelijke directory en voer `PGLITE_MODULE=/absoluut/pad/naar/pglite/dist/index.cjs node tests/client-details-isolated-db.mjs` uit.
- Productieschemarepetitie binnen een teruggedraaide transactie geslaagd; hashes en aantallen van afspraken, mailopdrachten en verslagen bleven gelijk. Supabase dry-run bevatte alleen migratie `20261117180000_patient_names_and_salutations.sql`.
- Eén Impeccable-detectorcontrole over alle zes gewijzigde UI-bestanden: alleen drie adviezen over bestaande agendakleuren buiten de Startpunt-palette. Deze kleuren horen bij de bestaande functionele agenda en zijn niet aangepast.

## Uitrol en resterende acceptatie

Database en applicatie: zie de definitieve uitrolregistratie hieronder.

Visuele desktop-/mobielcontrole en volledige ingelogde productieacceptatie zijn nog niet afgerond. De computerbediening liep bij zowel Chrome als de ingebouwde browser vast. Een tijdelijke lokale pagina met synthetische formuliergegevens leverde HTTP 200 en het formulier op; de pagina is verwijderd vóór de releasebuild. Dit bewijst geen visuele of toetsenbordacceptatie. Er zijn geen echte cliëntmails verstuurd en geen proefafspraken bij echte cliënten gemaakt.

De schemarepetitie rapporteerde negen dossiers met ontbrekende naamonderdelen zonder veilige herstelbron. Deze moeten door een bevoegde medewerker eenmaal handmatig worden aangevuld; namen worden niet gegokt of op spaties gesplitst.

Geen GitHub Actions, betaalde diensten of schedulers toegevoegd.

## Uitrolregistratie

- Database: migratie `20261117180000` succesvol toegepast en geregistreerd via de bestaande Supabase CLI-route, vóór applicatiepublicatie.
- Applicatie: de bijbehorende implementatie wordt via de bestaande Git/Vercel-integratie gepubliceerd; de uiteindelijke deploymentstatus wordt apart gecontroleerd.
