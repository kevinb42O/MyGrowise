# Mijn aankopen — visuele afwerking

30 oktober 2026. Lokaal geïmplementeerd; geen deployment uitgevoerd.

De vijf routes onder `/aankopen` gebruiken een gedeelde `PurchaseLayout` met compacte navigatie, dezelfde typografie, kleuren en knoppen. De publieke marketingfooter en automatische inhoudsanimaties zijn hier vervangen door een rustige werkruimte.

- Toegang: bestaand modulebeeld, e-mailformulier, bevestiging zonder informatie over het bestaan van aankopen, herstel bij een ongeldige link en één primaire actie bij een ontvangen token. De hash wordt uit de browsergeschiedenis verwijderd. De server blijft tokens en vervolg-URLs valideren.
- Overzicht: werkboeken/audio en afnames eerst, bestellingen daaronder, afzonderlijke betaalstatus en directe betaalgegevens bij openstaande bestellingen. Lege overzichten hebben uitleg en een vervolgstap. Accountkoppeling blijft optioneel.
- Afname: instructies, vragenlijst en beschikbaar rapport met herkenbare acties.
- Module/audio: gedeelde structuur voor openen/downloaden en luisteren. De bestaande speler en private materiaalroutes blijven in gebruik.
- Niet beschikbare inhoud: een 404 met vormgegeven uitleg en links naar het eigen overzicht en contact; geen inhoud wordt vrijgegeven zonder bestaande eigendomscontrole.

De visuele richting is vastgelegd in `.impeccable/surfaces/aankopen.md`; de bestaande `DESIGN.md` blijft specifiek voor Startpunt.

## Verificatie en grenzen

Desktopweergaven van toegang, overzicht, module en afname bekeken. Toegang en overzicht ook op 390 px; bevestiging, overzicht, leeg overzicht, module, afname en audio op 320 px. Op de gecontroleerde kleine schermen geen horizontale pagina-overflow. Interactieve acties in de hoofdinhoud zijn minimaal 44 px hoog. Een tabletcontrole op 820 px leidde tot het stapelen van de hulpkolom onder het overzicht.

Een lokaal, kunstmatig token controleerde de zichtbare openactie, het verbergen van het aanvraagformulier, focus op de nieuwe titel en het verwijderen van de hash. Een ongeldig token toonde herstel. Een leeg e-mailformulier werd door de browser tegengehouden zonder verzending.

Afgeschermde weergaven zijn met tijdelijke lokale voorbeeldpagina's beoordeeld. Die worden vóór de eindbuild verwijderd. Er zijn geen bestellingen geplaatst, echte toegangsmails verstuurd of echte PDF/audio-inhoud geopend. Deze controle bewijst geen volledige productieflow of Safari-gedrag op fysieke toestellen.

Eindcontroles: 87 lokale tests geslaagd; TypeScript en productiebuild geslaagd; release-artifact gecontroleerd (1673 bestanden); `git diff --check` geslaagd. De Impeccable-detector gaf geen bevindingen op de aankooproutes, layout en aankoopcomponenten. De tijdelijke voorbeeldroutes zijn verwijderd vóór de eindbuild. Toetsenbordcontrole: Tab vanaf het e-mailveld bereikt direct de verzendknop; de opnieuw-aanvragenlink opent het formulier met behoud van het vervolgpad.
