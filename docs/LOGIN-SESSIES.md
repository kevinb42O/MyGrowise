# Blijvend ingelogd op een toestel

18 november 2026. Praktijk-, beheer- en klantlogin gebruiken dezelfde servergestuurde sessievernieuwing. Geen databasewijziging, betaald abonnement, cronjob of browserkeepalive nodig.

## Gebruikersgedrag

De optionele, standaard uitgevinkte checkbox **Ingelogd blijven op dit toestel** bewaart de login gedurende 30 dagen zonder gebruik. Een geslaagde sessievernieuwing verlengt die termijn. Zonder vinkje blijven de cookies browsergebonden; browserinstellingen voor sessieherstel kunnen zulke cookies ook na herstart herstellen. In beide gevallen vernieuwt de volgende serveraanvraag een verlopen toegangstoken, ook na een lange pauze of bij het versturen van een open formulier. De agenda hoeft daarvoor niet geopend te blijven.

Bestaande logins bevatten geen refresh token. Ze blijven werken tot hun huidige uur verstreken is; daarna is één nieuwe login nodig om de nieuwe sessie en toestelkeuze vast te leggen.

## Implementatie en beveiliging

- `authSession.ts` beheert `mg_session`, `mg_refresh` en `mg_remember`. Alle cookies zijn HttpOnly, SameSite Strict, pad `/` en in productie Secure. Tokens komen niet in browser-JavaScript of localStorage.
- De middleware vernieuwt wanneer het toegangstoken ontbreekt of binnen 60 seconden vervalt. Een nieuw Supabase-authclient per refresh voorkomt gedeelde gebruikersstaat. Supabase beheert refresh-tokenrotatie en de bescherming tegen hergebruik; gelijktijdige aanvragen zijn met de echte provider gecontroleerd.
- Geldige toegangstokens worden serverzijdig bij Supabase geverifieerd. Rollen en praktijkrechten worden opnieuw opgehaald; de checkbox wijzigt geen rechten. Beveiligde en sessieafhankelijke pagina's krijgen `private, no-store`.
- Tijdelijke Auth-/databaseproblemen en rate limits behouden de cookies en leveren een tijdelijke fout op. Een ongeldig refresh token wist de sessiecookies.
- Afmelden trekt de betreffende Supabase-sessie in en verwijdert alle drie de cookies. Bij een providerstoring blijft afmelden een fout geven en moet de gebruiker opnieuw proberen; de interface rapporteert dan geen geslaagde afmelding.
- Alle sessies afmelden gebruikt nu correct het actuele JWT in plaats van de gebruikers-ID. Het wijzigen van het praktijkwachtwoord trekt eveneens alle sessies in. Zoals bij Supabase gebruikelijk kunnen reeds uitgegeven toegangstokens op andere toestellen nog geldig zijn tot hun korte vervaltijd; hun refresh tokens zijn ingetrokken.
- Deferred admin-islands gebruiken dezelfde sessievernieuwing.

## Controle

`npm test`, `npm run check`, `npm run check:artifact` en `git diff --check` lokaal uitvoeren. Gerichte tests staan in `tests/auth-session.test.mjs`.

De expliciete integratieproef `tests/auth-session-http.mjs` maakt één synthetisch bevestigd account aan en verwijdert dit in `finally`; er wordt geen mail verstuurd. Vereist lokale `.env`, Playwright en een browser. Standaard wordt de lokale server op poort 4321 gebruikt. `AUTH_TEST_ORIGIN` kiest een uitgerolde HTTPS-omgeving; `PLAYWRIGHT_MODULE` en `CHROME_PATH` kunnen de geïnstalleerde browserruntime aanwijzen. De proef controleert de drie inlogschermen op desktop/mobiel, cookiebeleid met en zonder vinkje, echte Supabase-refresh na geforceerd verlopen toegangstoken, gelijktijdige aanvragen, herstel met bewaarde cookies, afmelden en afwijzen van een ingetrokken refresh token. Alleen het lokale browsertestvenster wordt gebruikt; bestaande gebruikerssessies blijven ongemoeid.
