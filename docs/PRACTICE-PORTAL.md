# MyGrowise praktijkportaal

**Stand: 18 oktober 2026, `b2cfabd` plus de releasewijzigingen.** Het [oorspronkelijke uitvoeringsplan](CLIENTENDOSSIERS-AFSPRAKEN-PLAN.md) en de [implementatiebeschrijving](PRACTICE-IMPLEMENTATION.md) bewaren de details; de onderstaande werking vervangt de oudere aanvraag-/goedkeuringsflow.

## Toegang

Een gekoppelde practitioner gebruikt `/praktijk`; praktijkbeheer heeft afzonderlijke `practice.manage`-rechten. Beheer van therapeuten/afspraaktypes geeft geen automatische toegang tot behandelnotities. Dossiertoegang wordt per rol en toewijzing gecontroleerd. Alleen Virginies gekoppelde eigen praktijkidentiteit gebruikt de Itransform-agendascope; de algemene MyGrowise-adminagenda sluit die uit.

## Boeken en dossiers

Een bevestigd klantaccount kiest therapeut/afspraaktype, een beschikbaar tijdstip en controleert de noodzakelijke persoonsgegevens. De boeking wordt onmiddellijk **confirmed**, met automatische dossierkoppeling, tijd-/aanbodsnapshot en een duurzame bevestigingsmailtaak. De therapeut hoeft nieuwe boekingen niet eerst te aanvaarden. Historische pending-aanvragen zijn niet massaal bevestigd en blijven afzonderlijk opvolgbaar.

De slotberekening combineert rooster, uitzonderingen, volledige afspraakduur, bestaande boekingen en blokken. Dezelfde dag in Europe/Brussels is uitgesloten; de ingestelde noticeperiode vormt een aanvullende grens. De database beschermt tegen overlap en dubbele inzending. Handmatig plannen en verplaatsen gebruiken hetzelfde model; verplaatsen bewaart de oorspronkelijke duur.

Agenda en dossier openen hetzelfde afspraakdetail: status, planningshistoriek, verplaatsen/annuleren, uitgevoerd/no-show en maillog/herverzending. De dossierhistoriek heeft paginering; sessie-export bevat alleen uitgevoerde sessies. Notities en correcties blijven afgeschermd en horen niet in commerciële overzichten of gewone mail.

## MijnDiAd en mail

De 262 MijnDiAd-momenten zijn alleen-lezen geïmporteerd. Agenda en beschikbaarheid delen een cache van maximaal 300 seconden; toekomstig boeken/verplaatsen vraagt maximaal 60 seconden oude broncontrole. Bij een bronstoring blijft de opgeslagen agenda leesbaar, maar worden onzekere tijden niet als vrij aangeboden. Er is geen permanente importcron of keepalive. Zie [de koppeling](MIJNDIAD-AGENDA-IMPORT.md).

Bevestiging, verplaatsing en annulering proberen direct mail te versturen. De dagelijkse Vercel Free-worker en expliciet beheerherstel zijn vangnetten. Herinneringen en weekoverzichten zijn nog niet beschikbaar. Werkende mailcode en geverifieerde lokale configuratie bewijzen geen externe inboxaflevering.

## Open voor dagelijks gebruik

Test met de eigenaar de beroepsgegevens, duur/roosters, uitnodiging, cliëntlogin, afspraak/dossier/mail/wijziging en rolgrenzen. Controleer gelijktijdig boeken via twee HTTP-sessies, zomer-/wintertijd, retentie, back-up/herstel en incidentopvolging in de doelomgeving. Zie [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md).
