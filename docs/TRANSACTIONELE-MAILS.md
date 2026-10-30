# MyGrowise transactionele mails

Uitgewerkt en gecontroleerd op 30 oktober 2026.

## Vormgeving en inhoud

`src/lib/emailTemplate.ts` is de gedeelde HTML-basis voor alle applicatiemails. Opmaak: bestaand lelie-logo, donkergroen, warm papier, roze afsluitvlak, duidelijke titel, relevante gegevens en één primaire actie. Dynamische tekst en attributen worden ge-escaped; actieknoppen accepteren uitsluitend HTTPS, lokale HTTP-testlinks of de expliciete Supabase-providerplaceholder. Er zijn geen trackingpixels, externe webfonts of scripts.

De opmaak gebruikt presentatietabellen en inline stijlen, met een vaste Outlook-breedte en mobiele aanpassingen. Arial/Helvetica voor leestekst en Georgia voor titels zijn bewust gekozen voor e-mailcompatibiliteit. De mechanische Impeccable-controle vergelijkt ook met de uitsluitend voor `/startpunt` geschreven DESIGN.md en meldt daarom onder meer afwijkende e-maillettergroottes, Arial en de bestaande warme kleurkeuze. Deze meldingen zijn beoordeeld als contextgebonden ontwerpkeuzes, niet als bewijs van een defecte mail.

## Gedekte mailsoorten

| Route | Varianten |
| --- | --- |
| Afspraken | Bevestiging, verplaatsing en annulering; Belgische datum en begin-/eindtijd, therapeut, vorm/locatie, accountknop |
| Bestellingen | Bestelling ontvangen, betaling bevestigd, afname-/rapportupdate, teammeldingen |
| Aankooptoegang | Persoonlijke eenmalige toegangslink, geldigheidsduur en uitleg zonder verplicht account |
| Contact | Interne ontvangst van publieke contactvragen, met bericht en juiste Reply-To |
| Bestaande supportgesprekken | Ontvangst/toegang en antwoordmelding, met knop naar het beveiligde gesprek |
| Supabase Auth | Registratie, uitnodiging, magic link, e-mailwijziging, wachtwoordherstel en herauthenticatiecode |

Elke applicatiemail bevat zowel HTML als volledige plain text (`multipart/alternative`). Bestelbevestigingen behouden de volledige bij aankoop afgesproken voorwaarden en de geregistreerde verklaring over directe digitale levering in beide versies. Die kopie wordt niet vervangen door een link naar later gewijzigde voorwaarden. Annuleringsmails tonen geen instructies voor deelname aan de geannuleerde sessie. Er wordt geen dossier- of verslaginhoud toegevoegd.

## Supabase: uitgevoerd

De zes Auth-templates en Nederlandse onderwerpregels zijn op 30 oktober rechtstreeks opgeslagen in het productieproject `bwkqkehumzpfodmcesab`, via Authentication → Emails in de bestaande ingelogde beheersessie. Na opslaan was de knop Save changes uitgeschakeld; de herauthenticatietemplate is ook na herladen gecontroleerd. De placeholders `{{ .ConfirmationURL }}` en `{{ .Token }}` zijn behouden. Er zijn geen Auth-instellingen, toegangsrechten, SMTP-credentials of uitgeschakelde beveiligingsmeldingen aangezet of gewijzigd.

De lokale kopieën staan in `supabase/templates/`; `supabase/config.toml` verwijst naar alle zes templates. `node --experimental-strip-types scripts/build-email-templates.mjs` genereert deze bestanden en synthetische previews opnieuw. Dat script verzendt niets en wijzigt geen remote configuratie.

Databasecontrole: de migratieregistratie is rechtstreeks met alle lokale SQL-bestanden vergeleken. **61 migraties toegepast, nul ontbrekende migraties.** Voor de mailopmaak is geen schemamigratie nodig: de bestaande wachtrijen en payloads blijven bruikbaar. Er is daarom geen onnodige SQL-migratie toegevoegd of uitgevoerd.

## Verificatie en uitrolgrens

- TypeScript en Astro-productiebuild geslaagd.
- 99 unit-/regressietests geslaagd, inclusief vijf nieuwe mailtests voor escaping, veilige URL's, Belgische tijden, Supabase-placeholders, multipart-capture en sluiten van de SMTP-verbinding bij fouten.
- Bestaande bestelmailtest uitgebreid met behoud van de voorwaarden in HTML én plain text.
- Release-artifactcontrole geslaagd; geen lokale captures, testdata of geconfigureerde geheimen in publieke assets.
- Afspraakmail daadwerkelijk in de browser bekeken op desktop en 375 px breed; geen horizontale overflow.
- Geen echte mails of nieuwe Auth-uitnodigingen verstuurd voor deze vormgevingscontrole. MIME is lokaal opgevangen met synthetische gegevens.

De zes Supabase-accounttemplates zijn live opgeslagen. De applicatieaanpassingen voor afspraken, aankopen, contact en support zijn lokaal gebouwd en getest; deze side-conversation heeft geen Git-commit, push of Vercel-uitrol uitgevoerd, om lopend werk in de hoofdchat niet te doorkruisen. Deze mailbestanden moeten samen met hun gedeelde renderer in de volgende applicatie-uitrol worden meegenomen. De mailwijziging voegt geen dependency, GitHub Actions-workflow of scheduler toe.

Lokale voorbeelden staan onder `output/email-preview/`. Deze map wordt niet meegecommit of gepubliceerd. De voorbeelden bevatten uitsluitend fictieve gegevens.
