# Updates voor Virginie — uitvoering

18 november 2026. Applicatie lokaal gebouwd en getest. De drie gerichte databasemigraties zijn na een teruggedraaide repetitie op de gekoppelde productiedatabase toegepast en geregistreerd. De applicatiewijziging is nog niet uitgerold.

## Wat is gebouwd

- Eigen menukeuze onder Dashboard, met een subtiele indicatie voor nieuwe inhoud. Het dashboard verwijst bij ongelezen berichten naar de nieuwste ontwikkeling.
- Overzicht op `/admin/updates`: alles, in ontwikkeling, beschikbaar, terugblik en concepten; zoeken in titel, samenvatting en uitleg; alleen nieuw; paginering. Een aparte keuze Alles / Website / Dashboard werkt samen met de statusfilters en is ook beschikbaar in de redactie. Actieve onderwerpen staan eerst, gevolgd door recente opleveringen en terugblikken.
- Detailpagina per vaste linknaam: begrijpelijke uitleg, status en volgende stap, chronologische mijlpalen, feedback en antwoorden. De leeskolom en statuskolom stapelen op telefoon.
- Feedback met Ontvangen/In behandeling/Beantwoord; Beantwoord ontstaat via een werkelijk antwoord. Een antwoord kan verwijzen naar een concrete mijlpaal. Bij verzendfouten blijft de invoer staan; een retry-token voorkomt dubbele reacties.
- Redactie via Nieuwe update en Update beheren: concept/publiceren, tekstcorrecties en nieuwe mijlpalen met statuswijziging. Onopgeslagen redactie krijgt bij sluiten een keuze om verder te schrijven of te verwerpen.
- Gelezen-status per account en revisie, pas na het zichtbaar weergeven van details. Correcties hoeven een bericht niet opnieuw nieuw te maken. Nieuwe mijlpalen en antwoorden maken dat wel. Geen polling. Nieuwe feedback wordt wel rechtstreeks naar de webdesigner gemaild, zoals aanvullend gevraagd.
- Tien bewust geschreven onderwerpen, vanaf de eerste vastgelegde projectversie op 18 september. Historische bouwstappen dragen het label Terugblik en claimen geen actuele beschikbaarheidscontrole. De mailhistoriek steunt op het bestaande productiecontroleverslag. De nieuwe Updates-sectie zelf staat nog In uitvoering.

## Beveiliging en opslag

De vier inhoudstabellen: platform_updates, platform_update_events, platform_update_comments en platform_update_reads. De aanvullende private tabel platform_update_mail_jobs bewaart de mailwachtrij. Alleen de serverrol heeft tabeltoegang. Middleware en API controleren expliciete updates-rechten; de mutatiefunctie controleert de actuele superadminrol opnieuw. De huidige rechtenmatrix kent deze rechten uitsluitend aan superadmins toe.

Mijlpalen, statuswijzigingen en auditregistratie worden samen opgeslagen. Redactie gebruikt een verwachte revisie om gelijktijdige overschrijvingen te weigeren. Reacties gebruiken de sessie-identiteit, platte tekst en maximale lengtes. Mijlpaal- en antwoordverwijzingen moeten bij hetzelfde onderwerp horen. Interne actie-links worden gevalideerd. De API gebruikt private/no-store; er komen geen updategegevens in publieke browserbundels.

Geen GitHub Actions, extra abonnement of scheduler. De bestaande Vercel-integratie blijft de uitrolroute binnen Free/Hobby.

## Lokaal herhalen

De gewone suite bevat `tests/platform-updates.test.mjs`. Deze controleert rechten, cross-originweigering, validatie, identiteitsgebruik en het voorkomen van een losstaande status Beantwoord.

De SQL-proef draait de echte migraties met synthetische accounts in PGlite. Installeer PGlite buiten de repository en voer uit:

```sh
PGLITE_MODULE=/absoluut/pad/naar/pglite/dist/index.cjs node tests/platform-updates-isolated-db.mjs
```

De browserproef gebruikt de echte AdminLayout en React-workspace, met onderschepte API-antwoorden. Start Astro lokaal en voer uit:

```sh
PLAYWRIGHT_MODULE=/absoluut/pad/naar/playwright/index.mjs node tests/platform-updates-browser.mjs
```

Standaard gebruikt de proef `http://localhost:4321`; UPDATES_TEST_ORIGIN kan dat aanpassen. De proef maakt tijdelijk een uitsluitend in development bruikbare fixturepagina en verwijdert die nadien. Fixtures staan onder tests/fixtures/platform-updates*. Screenshots staan lokaal onder output/updates en worden niet gecommit. De browserproef verstuurt geen productiereacties.

## Uitrolvolgorde

1. Toegepast: `20261118190000_platform_updates.sql`: tabellen, rechten en transactiefuncties.
2. Toegepast: `20261118191000_platform_updates_history.sql`: de tien eerste onderwerpen. De vaste linknamen voorkomen dubbele invoer.
3. Toegepast: `20261118192000_update_feedback_mail_and_scope.sql`: omgevingsfilter, transactionele feedbackmailwachtrij en gerichte claimfunctie.
4. Rol de applicatiewijziging uit via de bestaande Vercel-integratie.
5. Controleer met een echte superadminsessie overzicht, detail, een feedbackreactie, antwoord en gelezen-status op een tweede toestel. Controleer dat medewerkers en niet-aangemelde bezoekers geen toegang hebben.
6. Voeg pas na die productiecontrole een mijlpaal Beschikbaar toe aan het onderwerp over de Updates-sectie.

De bestaande werkboom bevat gelijktijdig ander werk aan mail en cliëntendossiers. Dat is niet automatisch onderdeel van deze oplevering. Er is geen commit of deployment uitgevoerd vanuit deze taak.

## Aanvulling: mail naar de webdesigner

Kevin heeft expliciet gevraagd om nieuwe feedback naar bourguignonphotography@gmail.com te sturen. De mail bevat de reactie in een roze leesvlak, auteur, onderwerp, Website/Dashboard, onderdeel, voortgang, datum, samenvatting, volgende stap en waar van toepassing het eerdere bericht en een gekoppelde mijlpaal. HTML en platte tekst worden samen verstuurd. De knop opent de beschermde update; antwoorden op de e-mail worden niet automatisch in het dashboard geplaatst.

Een trigger slaat reactie en mailtaak samen op. De unieke comment_id voorkomt meerdere taken bij een herhaalde aanvraag. Direct na opslaan probeert de server de specifieke mail te verzenden. Bij storing blijft feedback succesvol opgeslagen en de taak wachtend; de bestaande dagelijkse worker verwerkt ook deze wachtrij. Er is geen extra scheduler. Gelijktijdige workers worden gescheiden door een lease en token. De eigen antwoorden van het account met het webdesigneradres sturen geen mail naar zichzelf.

De feedbackstroom gebruikt poort 587 met verplichte STARTTLS. Dit is geauthenticeerd getest en is een door [Webnode ondersteunde verbinding](https://www.webnode.com/support/iphone-new-webmail/). De eerdere lokale proef via 465 liep tegen een verbindingstimeout aan. Andere mailstromen behouden hun standaardtransport. Het gedeelde verzendhulpmiddel kreeg uitsluitend een optionele poortkeuze.

## Migratiebewijs

`scripts/apply-platform-updates.mjs` voert uitsluitend de drie genoemde bestanden uit. Het gebruikt een transactie, advieslock, korte lock-timeout en statement-timeout, controleert bestaande migratie-inhoud, vergelijkt aantallen van bestaande kerngegevens en registreert alleen de expliciet geselecteerde migraties. Geen algemene db push en geen uitvoering van het gelijktijdige dossierwerk.

Eerst gerepeteerd en teruggedraaid; vervolgens toegepast en geregistreerd; daarna opnieuw zonder wijzigingen gecontroleerd. Behouden: 2 bestellingen, 2 toegangsrechten, 10 boekingen, 17 cliënten en 7 profielen. Nieuwe inhoud: 10 onderwerpen en 10 mijlpalen; geen historische feedback geïmporteerd. Browserrollen hebben geen tabeltoegang en er zijn geen brede RLS-policies toegevoegd.

## Echte mailproef

`scripts/test-update-feedback-email.mjs --send` heeft één duidelijk gemarkeerde testmail via de echte worker en de nieuwe databasewachtrij naar het afgesproken Gmail-adres verstuurd. De server registreerde status sent, één poging, op 18 november 2026 om 13:53:42 Belgische tijd. Onderwerp: “Feedback van Kevin (technische test) · [TEST] Feedbackmeldingen voor de webdesigner — MyGrowise”. Dit bewijst SMTP-acceptatie; de ontvanger kan de daadwerkelijke inbox-/spamplaatsing controleren. De tijdelijke conceptupdate, testreactie, mailtaak en gegenereerde testruntime zijn verwijderd. Er is geen echte feedback namens Virginie geplaatst.

De scriptvariant zonder --send genereert uitsluitend een lokale HTML-/tekstpreview onder output/updates. De mail is visueel beoordeeld op desktop en op 390px. De SQL-proef controleert ook één taak per reactie, het uitsluiten van eigen designerantwoorden, leaseherstel en het Website-filter. De browserproef controleert beide omgevingsfilters samen met status, zoeken, reacties en foutbehoud.
