update public.integration_status
set state = 'healthy',
    detail = 'Consent-gestuurde first-party page- en route-events zijn actief.',
    last_checked_at = now()
where key = 'analytics';
