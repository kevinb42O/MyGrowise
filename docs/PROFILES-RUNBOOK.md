# Profielen — inhoud, beheer en controle

**18 oktober 2026:** de acht aangeleverde profielteksten zijn opgenomen in de bestaande catalogus en volledig weergegeven op de bestaande slugs. De bron staat in [profielpakketten-brontekst.txt](content/profielpakketten-brontekst.txt); de eenmalige gestructureerde importbron in [profile-landings.json](content/profile-landings.json). De database is na import de inhoudsbron.

Open **Vragenlijsten & profielen** en kies een profiel. Naast prijs/publicatie/pakketonderdelen zijn herkenningsvraag, introductie, meetdomeinen, instrumentuitleg, verwachtingen, afbakening, leeftijdsgrenzen, thema's en aantallen beheerbaar. De bestaande atomaire save valideert de nieuwe inhoud; oude integraties zonder profielvelden behouden de opgeslagen tekst. Gedeeltelijke inhoud wordt geweigerd. Alle tekstvelden bewust leegmaken herstelt de algemene template.

Het overzicht toont acht gelijkwaardige kaarten, met een aparte ontwikkelteaser. Filters gebruiken overlappende leeftijdsbereiken en beheerde thema's, met URL-herstel. De detailpagina's behouden alle inleidingen, instrumenten, verwachtingen en afbakeningen. Het prikkelprofiel toont twee leeftijdsvarianten; het stressprofiel onderscheidt zes vragenlijsten en één eigen onderdeel. Prijzen komen uitsluitend uit de catalogus. De productieve checkout blijft gesloten tot de ontbrekende verkoopinformatie is verwerkt.

Er zijn drie profieltests en 22 rollback-databasecontroles toegevoegd. De volledige unitset bevat 52 tests. Aanvullende HTTP-controle controleert alle acht pagina's en een echte formulier-save met een tijdelijk profiel. Browsercontrole bevestigde 3/2/6 resultaten voor de leeftijdsfilters en alle acht detailpagina’s met precies één H1 en zonder horizontale overloop op 320 px. Een gevonden mobiele grid-overloop is hersteld en opnieuw gecontroleerd. Dit bevestigt geen nieuwe professionele of klinische beoordeling.

Zie [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) voor migraties, toepassing en productiegrenzen.
