-- Align public practitioner profiles with the services they actually offer.
update public.practitioners
set expertise = array_append(expertise, 'EMDR-therapie')
where slug = 'virginie'
  and not ('EMDR-therapie' = any(expertise));

update public.practitioners
set bio = replace(bio, 'intimiteit, relaties, lichaamsbeleving', 'intimiteit, lichaamsbeleving'),
    expertise = array_remove(expertise, 'Relaties')
where slug = 'amy';
