# MyGrowise Admin — actuele functies en grenzen

**Controle: 18 oktober 2026, `b2cfabd` plus de releasewijzigingen.** De [audit van 24 september](archive/ADMIN-MASTERPLAN-2026-09-24.md) is historisch. De releaseprocedure en open externe controles staan in [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md).

## Autorisatie

`src/middleware.ts` en `src/lib/adminPermissions.ts` weigeren onbekende adminroutes. Services toetsen eigendom/toewijzing opnieuw; kritieke databasefuncties controleren de actor. Superadmin heeft alle gedefinieerde rechten. `practice.manage` is afzonderlijk verleend aan bevoegde praktijkmanagers; dit geeft geen automatische inzage in alle behandelnotities. Niet-superadmins zien alleen toegewezen dossiers. Algemene support, audit en analytics bevatten geen dossierinhoud.

## Aanwezige beheertaken

| Werkgebied | Huidige werking | Resterende grens |
|---|---|---|
| Catalogus | Losse vragenlijsten, vaste profielen, prijsregels, pakketonderdelen, uitgebreide landingsinhoud en slugaliassen. `/admin/profielen` verwijst naar echt catalogusbeheer. | Professionele versie-/licentiecontrole en goedkeuring blijven menselijke taken. Vaste siteonderdelen zijn deels code. |
| Modules | Tekst, prijs, concepten, private PDF/audio-upload, bestandscontrole, materiaalversies, preview/publicatie/herstel en optionele verdieping. | Definitieve bestanden en praktische informatie ontbreken; geen module open voor verkoop. |
| Bestellingen en afnames | Orderdetail, prijs-/inhoudssnapshot, handmatige bankverificatie, afnametaken, instructies en private rapportupload. | Geen automatische providerbevestiging, bankrefund, factuur of volledige refund-ledger. Nieuwe orders zijn productief gepauzeerd tot verkoopvrijgave. |
| Praktijk | Therapeuten toevoegen/uitnodigen, afspraaktypes, aanbod per therapeut, boekingslinks en afspraakdetails met verplaatsen/annuleren/historiek/maillog. | Uitnodiging en mailboxaflevering in productie apart testen. Herinneringen/weekoverzichten zijn niet gebouwd. |
| Dossiers | Persoonsgegevens, versiecontrole bij wijzigen, toewijzingen, verslagen/correcties, historiek en export van uitgevoerde sessiedata. | Retentie, AVG-uitvoering en taakgerichte rolacceptatie in de doelomgeving blijven nodig. |
| Agenda | MyGrowise-adminagenda; afzonderlijke eigen praktijkagenda met bedrijfsgrenzen. Alleen Virginies bevoegde eigen agenda toont de MijnDiAd-import. | iCal is alleen-lezen en kan achterlopen. Een kalenderitem is geen boeking. |
| Content | Artikelen en algemene CMS-pagina's met preview, versies en slugredirects; gepubliceerde pagina's hebben een publieke route. Gereserveerde website-URLs kunnen niet als nieuwe pagina worden opgeslagen. | Geen algemene mediabibliotheek, volledige versieherstelknop of reviewerworkflow. Geen bewijs dat alle redactionele websitevelden zelfbeheerbaar zijn. |
| Mail | `/admin/mail` toont vier wachtrijen, beperkte directe verwerking en expliciete herstart van mislukte taken. Oude supportinbox blijft behouden. | Geen vijfminutencron op Vercel Free, geen gegarandeerde inboxaflevering of automatische bounceafhandeling. |
| Dashboard en analytics | Periodeomzet, consentgebonden paginaweergaven, top-pagina's en landen. | Omzet is geen nettoresultaat; browser-ID is geen persoon/sessie. Geen volledige omzetfunnel. Klanttotalen en sommige lijsten hebben begrenzingen. |
| Gebruikers/privacy/instellingen | Rollen/schorsing, AVG-verzoekregistratie, integratiestatus, werkitems en terugkerende kosten. | Een geregistreerd verzoek voert geen export/verwijdering uit. Geen algemene MFA-flow of onbeperkte Auth-lijst. Een opgeslagen integratiestatus is geen live providerproef. |

## Volgende prioriteit

Bewijs met de eigenaar echte betaling/levering, mail, dagelijkse beheertaken en dossiergrenzen. Maak juridische gegevens definitief en geef verkoop bewust vrij. Bouw vervolgens alleen beheeruitbreidingen die uit die taakproeven nodig blijken; herbouw geen bestaande catalogus, modulelevering of afspraakdetails.
