-- Align only the eight supplied public titles and exact age labels; keep prices, status and order snapshots.
update public.products set title='Persoonlijk Stress- & Emotieprofiel',updated_at=now() where type='profile' and slug='stress-en-emotieprofiel';
update public.catalog_details set age_label='Vanaf 18 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='stress-en-emotieprofiel');
update public.products set title='Persoonlijkheidsprofiel Volwassenen',updated_at=now() where type='profile' and slug='persoonlijkheidsprofiel-volwassenen';
update public.catalog_details set age_label='Vanaf 18 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='persoonlijkheidsprofiel-volwassenen');
update public.products set title='Persoonlijkheidsprofiel Kind',updated_at=now() where type='profile' and slug='persoonlijkheidsprofiel-kind';
update public.catalog_details set age_label='8–13 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='persoonlijkheidsprofiel-kind');
update public.products set title='Werk & Loopbaanprofiel',updated_at=now() where type='profile' and slug='werk-en-loopbaanprofiel';
update public.catalog_details set age_label='Vanaf 18 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='werk-en-loopbaanprofiel');
update public.products set title='Werk & Burn-outprofiel',updated_at=now() where type='profile' and slug='werk-en-burn-outprofiel';
update public.catalog_details set age_label='Vanaf 18 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='werk-en-burn-outprofiel');
update public.products set title='Prikkelverwerkingsprofiel',updated_at=now() where type='profile' and slug='prikkelverwerkingsprofiel';
update public.catalog_details set age_label='Vanaf 8 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='prikkelverwerkingsprofiel');
update public.products set title='Trauma & Herstelprofiel',updated_at=now() where type='profile' and slug='trauma-en-herstelprofiel';
update public.catalog_details set age_label='Vanaf 18 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='trauma-en-herstelprofiel');
update public.products set title='Emotioneel Welzijnsprofiel Jongeren',updated_at=now() where type='profile' and slug='emotioneel-welzijnsprofiel-jongeren';
update public.catalog_details set age_label='8–17 jaar',updated_at=now() where product_id=(select id from public.products where type='profile' and slug='emotioneel-welzijnsprofiel-jongeren');
notify pgrst,'reload schema';
