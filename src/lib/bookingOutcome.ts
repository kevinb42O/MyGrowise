export type BookingOutcome = { cancellationCategory?: string; noShowBilling?: string };
export function bookingOutcomeLabel(booking: BookingOutcome & { status: string }) {
  if (booking.status === 'cancelled') return ({ timely: 'Tijdig geannuleerd', late: 'Laattijdig geannuleerd' } as Record<string, string>)[booking.cancellationCategory || ''] || 'Geannuleerd';
  if (booking.status === 'no_show') return ({ invoiced: 'No-show — gefactureerd', not_invoiced: 'No-show — niet gefactureerd' } as Record<string, string>)[booking.noShowBilling || ''] || 'No-show — facturatie te beoordelen';
  return ({ pending: 'Oude aanvraag', confirmed: 'Bevestigd', completed: 'Afgerond', declined: 'Geweigerd' } as Record<string, string>)[booking.status] || booking.status;
}
