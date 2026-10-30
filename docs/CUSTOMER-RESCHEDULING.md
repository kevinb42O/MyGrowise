# Direct boeken en zelf verplaatsen

Implementatie en volledige gebruiksproef: 30 oktober 2026. De afsprakenwerkstroom is functioneel afgerond en gecontroleerd tegen de gekoppelde Supabase-omgeving `bwkqkehumzpfodmcesab`.

Nieuwe online boekingen worden door `book_customer_appointment` direct als `confirmed` opgeslagen. Er is geen goedkeuring door de professional nodig. Bestaande historische `pending`-records worden niet stilzwijgend omgezet; de klantweergave benoemt deze als oudere aanvragen.

Boeken, verplaatsen en annuleren hebben elk een accountmelding. Statusmeldingen bewaren het afspraakmoment dat bij die gebeurtenis gold, zodat een oorspronkelijke bevestiging na een verplaatsing niet ineens een andere datum krijgt. E-mail volgt de bestaande meldingsvoorkeur.

De klantactie **Afspraak verplaatsen** opent `/account/begeleiding/[id]/verplaatsen`. De klant kiest een vrij moment bij dezelfde professional voor hetzelfde afspraaktype. De oorspronkelijke afspraak en duur blijven behouden totdat één databasetransactie de wijziging opslaat. De oude tijd komt dan vrij; er wordt geen tweede boeking gemaakt.

De server controleert het bevestigde klantaccount, eigendom, actuele externe-agendastatus en de opnieuw berekende beschikbaarheid. De bestaande minimale aankondigingstermijn van de professional geldt ook voor het verplaatsen van de oorspronkelijke afspraak. Bij een niet meer online boekbaar afspraaktype of een te nabije afspraak wordt verwezen naar contact met de professional.

De database beschermt tegen verouderde formulieren en gelijktijdige wijzigingen. Een verouderd formulier gebruikt SQLSTATE `22023`: het is een invoerconflict, geen tijdelijke databasefout die door de API moet worden herhaald. Een herhaalde succesvolle inzending maakt geen extra historie of mailtaak. Verplaatsingen behouden de bestaande boekings-ID, registreren een schedule-event en accountmelding, en gebruiken de bestaande duurzame mailwachtrij met de meldingsvoorkeur van de klant.

## Verificatie

- `npm test`: unit/regressietests, inclusief autorisatie, verouderde formulieren en fouten bij de agendacontrole.
- `npm run test:appointments:db`: rollback-only databasecontrole, inclusief directe bevestiging, eigendom, bezette/geblokkeerde momenten, behoud van de duur, dubbele inzendingen, meldingen en toegangsrechten.
- `npx dotenv -e .env -- node tests/customer-rescheduling-http.mjs`: lokaal draaiende applicatie met tijdelijke synthetische accounts/afspraken; controleert de beveiligde pagina, CSRF, gelijktijdige POSTs, herhaling en notificaties. Mail staat voor deze accounts uit. De fixtures worden na afloop verwijderd.
- `npm run check` en `npm run check:artifact`: lokale types, build en release-artifact.

Alle drie migraties staan aantoonbaar in `supabase_migrations.schema_migrations` van `bwkqkehumzpfodmcesab.supabase.co`:

- `20261030032054_customer_appointment_rescheduling.sql`
- `20261030033003_customer_reschedule_conflict_response.sql`
- `20261030033534_customer_booking_lifecycle_notifications.sql`

Uitgevoerde controles:

| Controle | Resultaat |
| --- | --- |
| Unit/regressie | 84 geslaagd |
| Database, rollback-only | 78 geslaagd |
| Volledige HTTP-keten tegen lokale app + gekoppelde database | 30 geslaagd |
| Browsergebruiksproef | Inloggen, online boeken op 1 november 09:00, terugvinden als bevestigd, dezelfde afspraak verplaatsen naar 2 november 10:00, annuleren, drie juiste meldingen en afmelden |
| Agenda | Exact dezelfde booking-ID op het nieuwe moment; na annuleren uit de actieve praktijkagenda en het moment opnieuw boekbaar |
| Inmiddels bezet moment | HTTP-verplaatsing geweigerd, bestaande datum/status behouden |
| Externe agenda onbereikbaar | Synthetische fout-/backoffstatus op uitsluitend de testprofessional; geen echte bronconfiguratie gewijzigd. GET/POST weigeren verplaatsen; bestaande datum/status behouden. Annuleren blijft werken. |
| Twee gelijktijdige wijzigingen | Eén slaagt, één krijgt een begrijpelijk conflict; geen tweede boeking of dubbele mail |
| Build en artifact | Geslaagd; artifactcontrole 1671 bestanden |
| Opschoning | Geen synthetische accounts of professionals overgebleven; geen testmail verstuurd |

Lokaal bewijs staat onder `output/appointments-review/`: `environment-verification.json` en `browser-notifications.png`. De outputmap wordt niet gepubliceerd of meegecommit.

 De applicatiewijzigingen moeten via de bestaande Vercel-integratie worden uitgerold; geen GitHub Actions of extra scheduler.
