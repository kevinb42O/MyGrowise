# MyGrowise praktijkportaal

Status: Supabase-backed boekingen, beschikbaarheid, professionalprofielen, accounts, voorkeuren en auditdata. Bestaande lokale identiteiten zijn zonder e-mailverzending geïmporteerd en gebruiken de wachtwoordherstelroute voor eerste toegang.
Routes: `/praktijk`, `/praktijk/agenda`, `/praktijk/boekingen`, `/praktijk/beschikbaarheid`.

## Accounts en rollen

| Account | Rollen | Startomgeving |
|---|---|---|
| `virginie@mygrowise.com` | `super_admin`, `practitioner` | `/admin` |
| `margot@mygrowise.com` | `practitioner` | `/praktijk` |
| `amy@mygrowise.com` | `practitioner` | `/praktijk` |

Virginie kan vanuit organisatiebeheer naar haar eigen praktijk schakelen. Een professional heeft nooit toegang tot `/admin` of `/api/admin/*`; server-side middleware dwingt die grens af.

## Datagrenzen

- Elke professional werkt via één `practitioner_id`.
- Beschikbaarheid, uitzonderingen en boekingen worden op iedere query en mutatie aan dat eigen ID gebonden.
- Een gegokte boekings-ID van een andere professional geeft geen toegang.
- De publieke API geeft alleen vrije start- en eindtijden terug. Geen cliënten, bezette periodes, privénotities of reden van blokkade.
- Boekingen slaan alleen operationele gegevens op: naam, e-mail, tijdslot, professional en status. Geen intake- of sessie-inhoud.

## Beschikbaarheid

1. Iedere professional beheert een eigen wekelijks basisrooster.
2. Een los tijdsbereik kan als onbeschikbaar worden geblokkeerd, bijvoorbeeld vakantie of opleiding.
3. Publieke slots zijn alleen zichtbaar wanneer ze binnen het basisrooster vallen, minstens 24 uur in de toekomst liggen, niet overlappen met een blokkade en niet overlappen met een `pending` of `confirmed` boeking.
4. Tijden worden voor gebruikers getoond in `Europe/Brussels`.

## Boekingstatus

```text
publiek vrij slot → pending → confirmed
                         └→ declined
confirmed → cancelled | completed | no_show
```

- De server controleert bij een publieke aanvraag opnieuw of het slot nog vrij is.
- Een `pending` aanvraag reserveert het slot meteen.
- Alleen de gekoppelde professional kan een eigen `pending` aanvraag accepteren of weigeren.
- De statusactie en beschikbaarheidswijzigingen schrijven naar `security_audit_log`.

## Volgende productieblokken

1. Superadmin-uitnodigingen in plaats van vooraf geconfigureerde accounts.
2. Individueel wachtwoord wijzigen en sessies intrekken.
3. Transactionele e-mail voor aanvraag, acceptatie, weigering en herinnering.
4. Persoonlijke agenda-uitzonderingen met tijdzoneconversie die expliciet in de browser wordt vastgelegd.
5. Eventuele externe agenda-integratie na toestemming en providerselectie.
6. Configureer de productie-SMTP-, site- en herstel-URL's in Supabase Auth voordat er echte herstel- of bevestigingsmails worden verstuurd.
7. Productie-hosting met back-up, monitoring en juridisch/privacyreview.
