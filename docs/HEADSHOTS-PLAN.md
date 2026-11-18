# Persoonlijke headshots

Datum: 18 november 2026

## Gedrag en uitvoering

- Een herbruikbaar fotoveld met ronde voorvertoning, bestandseisen en duidelijke foutmelding.
- Iedere gebruiker kan de eigen foto opslaan, vervangen of verwijderen via persoonlijke accountinstellingen. Medewerkers krijgen daarvoor een eigen accountpagina; toegang tot organisatie-instellingen blijft apart geregeld.
- Optionele foto bij het aanmaken van een teamaccount via Gebruikers & rollen.
- Eén bron voor de foto in admin-, praktijk- en klantnavigatie. Bestaande teamportretten blijven de terugval voor bekende medewerkers; overige gebruikers zien hun eigen initialen.
- De server controleert en decodeert JPEG, PNG en WebP (maximaal 3 MB en 20 megapixels), verwijdert metadata en maakt een vierkante WebP van 512 pixels.
- Foto's staan in een private Supabase Storage-bucket. Alleen de server beheert de verwijzing in Auth app_metadata; de foto-API toont uitsluitend de eigen foto aan een aangemelde gebruiker.
- De bucket wordt bij de eerste upload idempotent aangemaakt binnen de bestaande Supabase-opslag. Geen betaalde diensten, scheduler of GitHub Actions.
- Nieuwe objecten krijgen een unieke naam. Bij fouten wordt de nieuwe upload opgeruimd; na een geslaagde wijziging wordt de vorige upload verwijderd.

## Verificatie

Lokale typecheck en build, gerichte tests voor bestandsvalidatie, eigenaarschap, opslagfouten en accountaanmaak, plus browsercontrole van voorvertoning en navigatie in beide standen. Geen productieaccounts wijzigen voor tests.

## Opgeleverd en lokaal gecontroleerd

- Foto-instelling beschikbaar in `/admin/instellingen`, `/admin/account`, `/praktijk/account` en `/account/instellingen`.
- Fotoveld toegevoegd aan het aanmaken van een teamaccount in `/admin/gebruikers`.
- De nieuwe persoonlijke accountbevoegdheid geeft geen extra toegang tot organisatiebeheer of gebruikersbeheer.
- `npm test`: 160 tests geslaagd, inclusief 10 gerichte headshot-tests.
- `npm run check`: TypeScript en productiebuild geslaagd.
- `npm run check:artifact`: releasepakket geslaagd.
- `tests/headshots-browser.mjs`: voorvertoning, ongeldige bestanden, multipart-upload bij wijzigen en aanmaken, verwijderen, medewerkersrechten, praktijkavatar en mobiel gecontroleerd. Opslagreacties zijn hierbij gesimuleerd; geen productieaccounts of bestaande foto's gewijzigd.
- Screenshots van de browsercontrole: `/tmp/mygrowise-headshots-browser/desktop.png` en `/tmp/mygrowise-headshots-browser/mobile.png`.

De private bucket wordt automatisch bij de eerste echte upload aangemaakt. Er is geen databasemigratie nodig. De wijzigingen zijn lokaal geïmplementeerd; er is in deze taak niet gedeployd.
