-- Published progress note: local implementation is complete; availability awaits application deployment.
with inserted as (
 insert into public.platform_updates(slug,title,summary,body,next_step,status,category,audience,published,action_path,action_label)
 values (
 'clienten-sneller-terugvinden',
 'Cliënten sneller en overzichtelijker terugvinden',
 'Een verfijnde cliëntzoeker met duidelijkere resultaten, relevantere overeenkomsten en snelle toegang tot verslagen en afspraken.',
 E'De cliëntzoeker is vernieuwd met compacte resultaatrijen, initialen en subtiele markering van de woorden waarop je zoekt. Vanuit elk resultaat kun je rechtstreeks het dossier, de verslagen of de afspraken openen.\n\nExacte overeenkomsten verschijnen eerst. Namen worden ook gevonden zonder accenten en met voor- en achternaam in een andere volgorde. Gearchiveerde dossiers neem je desgewenst mee via een aparte keuze. Bij meer resultaten kun je verder zoeken in het volledige cliëntenoverzicht.\n\nDe bediening met pijltjestoetsen, Enter en Escape is verfijnd. Met Ctrl K of Command K activeer je het zichtbare zoekveld. Ook de weergave tijdens laden, bij geen resultaten en bij een tijdelijke fout is uitgewerkt.\n\nDe implementatie is lokaal gecontroleerd met synthetische cliëntgegevens. Deze update beschrijft het afgeronde ontwikkelwerk; de vernieuwde zoekinterface wordt beschikbaar zodra de applicatie via Vercel is uitgerold.',
 'De applicatiewijziging uitrollen via de bestaande Vercel-integratie en daarna de live werking controleren.',
 'review','Agenda & cliënten','dashboard',true,'/admin/clienten','Open cliëntendossiers'
 ) on conflict(slug) do nothing returning *
)
insert into public.platform_update_events(update_id,title,body,status,revision)
select id,'Zoekfunctie vernieuwd en lokaal gecontroleerd',
 'De vormgeving, zoekvolgorde, toetsenbordbediening en directe dossierlinks zijn uitgewerkt. Lokale controles bestrijken desktop en mobiel, accenten, naamvolgorde, archivering, toegangsrechten en herstel na een zoekfout. De applicatie-uitrol volgt nog.',
 status,revision from inserted;
