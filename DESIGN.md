---
name: MyGrowise — Startpunt
description: Warm en uitgesproken, met grote praktijkfotografie en een heldere keuzehulp.
colors:
  forest: '#173d35'
  forest-deep: '#0e2b25'
  rose: '#f3c9c8'
  rose-ink: '#823f49'
  rose-light: '#fcf0eb'
  paper: '#fbf8f2'
  white: '#fffdf9'
  muted: '#5f716c'
typography:
  display:
    fontFamily: 'DM Serif Display, Georgia, serif'
    fontSize: 'clamp(3.8rem, 6.3vw, 6rem)'
    fontWeight: 400
    lineHeight: 0.99
    letterSpacing: '-0.04em'
  question:
    fontFamily: 'DM Serif Display, Georgia, serif'
    fontSize: 'clamp(2rem, 3.5vw, 3.1rem)'
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: '-0.03em'
  body:
    fontFamily: 'DM Sans, system-ui, sans-serif'
    fontSize: '1.05rem'
    lineHeight: 1.7
rounded:
  action: '6px'
  answer: '10px'
  result: '12px'
components:
  begin-link:
    backgroundColor: '{colors.forest}'
    textColor: '{colors.white}'
    rounded: '{rounded.action}'
    padding: '1rem 1.5rem'
  result-link:
    backgroundColor: '{colors.rose}'
    textColor: '{colors.forest-deep}'
    rounded: '{rounded.action}'
    padding: '1rem 1.5rem'
---

# Design System: MyGrowise — Startpunt

## Overview

Deze documentatie beschrijft het herontwerp van `/startpunt`, geen nieuwe regels voor alle bestaande pagina's. Kevin koos voor warm en uitgesproken: grote fotografie, roze accenten en een heldere keuzehulp. De gedeelde navigatie, footer, beeldbank en lettertypes sluiten aan bij het bestaande merk.

## Colors

Roze draagt het volledige introductievlak. Donkergroen geeft tekst en acties contrast en draagt het resultaatvlak. Warm papier ondersteunt het beantwoorden; de donkerroze tint markeert de voortgang.

## Typography

De bestaande DM Serif Display draagt de introductie en vragen. DM Sans blijft de functionele stem voor antwoorden, knoppen en toelichting. De hero heeft drie bewuste regels, ook mobiel. Functionele teksten behouden normale letterspatiëring.

## Layout

De desktopintroductie heeft een 1.1fr/1fr-verdeling tussen tekst en fotografie. De keuzehulp heeft een smalle voortgangskolom en een brede vraagkolom. Vanaf 700px en smaller stapelen de kolommen; de drie voortgangsstappen staan dan naast elkaar. Horizontale marges zijn mobiel 1.5rem. De inhoud van een nieuwe vraag houdt rekening met de sticky navigatie via 7rem scrollmarge.

## Elevation & Depth

De pagina gebruikt kleurvlakken en fotografie in plaats van schaduwen. Antwoorden krijgen één fijne rand; het resultaat staat rechtstreeks op een donkergroen vlak.

## Shapes

Acties hebben hoeken van 6px, antwoorden 10px en het resultaat 12px. Cirkelvormen zijn uitsluitend stapmarkeringen en kleine pijlvlakken. Fotografie blijft rechthoekig en wordt per schermbreedte uitgesneden.

## Components

Antwoorden zijn volledige actieknoppen met titel, uitleg en pijl. Een klik, Enter of spatie gaat onmiddellijk verder. Teruggaan behoudt eerdere antwoorden, inclusief de mogelijkheid hetzelfde antwoord opnieuw te kiezen. Bij een nieuwe vraag ontvangt de legend focus; bij het resultaat de titel. Herstart wist alle antwoorden uit het paginageheugen. Verminderde beweging schakelt de lokale transities uit.

De foto is het bestaande bestand `public/images/editorial/mygrowise-13.jpg`, een portret van Virginie uit de projectbeeldbank. Er zijn geen nieuwe of gegenereerde beelden gebruikt.

## Do's and Don'ts

- Gebruik de gehele antwoordknop als klikgebied.
- Behoud bestaande productroutes en de betekenis van de drie vragen.
- Toon een duidelijke voorgaande stap en een herstartmogelijkheid.
- Voeg geen extra bevestigingsknop na een antwoord toe.
- Bewaar of verstuur de antwoorden niet.
