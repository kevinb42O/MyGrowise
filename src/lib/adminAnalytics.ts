import { getSupabaseAdmin } from './supabase/server';

type Row = Record<string, any>;
type AnalyticsOptions = { days?: number; hourly?: boolean };
export type AnalyticsTrendPoint = { timestamp: string; value: number };

const fail = (error: { message?: string } | null) => {
  if (error) throw new Error(error.message || 'analytics_unavailable');
};

/**
 * Daily points start at midnight. The 24-hour view uses 24 actual hourly
 * buckets; it never renders one daily total as if it were a time series.
 */
export const getAdminAnalytics = async ({ days = 30, hourly = false }: AnalyticsOptions = {}) => {
  const rangeDays = Math.min(Math.max(days, 1), 365);
  const now = new Date();
  const rangeStart = new Date(now);
  if (hourly) rangeStart.setUTCHours(rangeStart.getUTCHours() - 23, 0, 0, 0);
  else {
    rangeStart.setUTCHours(0, 0, 0, 0);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (rangeDays - 1));
  }

  const { data, error } = await getSupabaseAdmin()
    .from('analytics_events')
    .select('event_name,anonymous_id,occurred_at,route_key,path')
    .eq('consented', true)
    .gte('occurred_at', rangeStart.toISOString())
    .order('occurred_at');
  fail(error);

  const rows = (data || []) as Row[];
  const count = (event: string, route?: string) => rows.filter((row) => row.event_name === event && (!route || row.route_key === route)).length;
  const sessions = new Set(rows.filter((row) => row.event_name === 'page_view').map((row) => row.anonymous_id).filter(Boolean)).size;
  const bucketKey = (value: string) => {
    const point = new Date(value);
    if (hourly) point.setUTCMinutes(0, 0, 0);
    else point.setUTCHours(0, 0, 0, 0);
    return point.toISOString();
  };
  const visits = new Map<string, number>();
  rows.filter((row) => row.event_name === 'page_view').forEach((row) => {
    const key = bucketKey(String(row.occurred_at));
    visits.set(key, (visits.get(key) || 0) + 1);
  });
  const countPoints = hourly ? 24 : rangeDays;
  const increment = hourly ? 3600000 : 86400000;
  const trend: AnalyticsTrendPoint[] = Array.from({ length: countPoints }, (_, index) => {
    const bucket = new Date(rangeStart.getTime() + index * increment);
    const timestamp = bucket.toISOString();
    return { timestamp, value: visits.get(timestamp) || 0 };
  });

  return {
    sessions,
    events: rows.length,
    checkoutStarted: count('checkout_started'),
    bookingClicks: count('booking_clicked'),
    self: {
      sessions: new Set(rows.filter((row) => row.event_name === 'page_view' && row.route_key === 'self').map((row) => row.anonymous_id).filter(Boolean)).size,
      route: count('route_selected', 'self'), product: count('product_viewed', 'self'), checkout: count('checkout_started', 'self'),
    },
    care: {
      sessions: new Set(rows.filter((row) => row.event_name === 'page_view' && row.route_key === 'care').map((row) => row.anonymous_id).filter(Boolean)).size,
      route: count('route_selected', 'care'), professional: count('professional_viewed', 'care'), booking: count('booking_clicked', 'care'),
    },
    trend,
    lastEventAt: rows.length ? String(rows[rows.length - 1].occurred_at) : null,
  };
};
