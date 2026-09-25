import { getSupabaseAdmin } from './supabase/server';

type AnalyticsOptions = { days?: number; hourly?: boolean; now?: Date };
type PageView = { id: string; anonymous_id: string | null; occurred_at: string; path: string | null; country_code: string | null };
export type AnalyticsTrendPoint = { key: string; timestamp: string; visitors: number; pageviews: number };
export type CountryCount = { code: string | null; visitors: number };

const timeZone = 'Europe/Brussels';
const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (date: Date) => {
  const value = Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
const hourKey = (date: Date) => date.toISOString().slice(0, 13);
const isPublicPath = (path: string) => path.startsWith('/') && !/^\/(admin|praktijk|account|api)(\/|$)/.test(path);

const loadAdminAnalytics = async ({ days = 30, hourly = false, now = new Date() }: AnalyticsOptions = {}) => {
  const rangeDays = Math.min(Math.max(days, 1), 365);
  const hourStart = new Date(now);
  hourStart.setUTCHours(hourStart.getUTCHours() - 23, 0, 0, 0);
  const previousHourStart = new Date(hourStart.getTime() - 24 * 3600000);
  const today = dayKey(now);
  const [year, month, day] = today.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, day - (rangeDays - 1)));
  const previousFirstDay = new Date(firstDay.getTime() - rangeDays * 86400000);
  const firstDayKey = firstDay.toISOString().slice(0, 10);
  const previousFirstDayKey = previousFirstDay.toISOString().slice(0, 10);
  // Read before the first local day to include Brussels midnight in either UTC offset.
  const comparisonAvailable = hourly || rangeDays < 365;
  const queryStart = hourly ? previousHourStart : new Date((comparisonAvailable ? previousFirstDay : firstDay).getTime() - 86400000);

  const bucketStarts = hourly
    ? Array.from({ length: 24 }, (_, index) => new Date(hourStart.getTime() + index * 3600000))
    : Array.from({ length: rangeDays }, (_, index) => new Date(firstDay.getTime() + index * 86400000));
  const trend: AnalyticsTrendPoint[] = bucketStarts.map((start) => ({
    key: hourly ? hourKey(start) : start.toISOString().slice(0, 10),
    timestamp: start.toISOString(), visitors: 0, pageviews: 0,
  }));
  const bucketIndex = new Map(trend.map((point, index) => [point.key, index]));
  const visitorsByBucket = trend.map(() => new Set<string>());
  const visitors = new Set<string>();
  const previousVisitors = new Set<string>();
  const visitorCountry = new Map<string, string | null>();
  const pages = new Map<string, number>();
  let pageviews = 0;
  let previousPageviews = 0;
  let lastEventAt: string | null = null;

  // Explicit pagination avoids silently truncating reports at Supabase's row limit.
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseAdmin().from('analytics_events')
      .select('id,anonymous_id,occurred_at,path,country_code')
      .eq('consented', true).eq('environment', 'production').eq('event_name', 'page_view')
      .gte('occurred_at', queryStart.toISOString()).lte('occurred_at', now.toISOString())
      .order('occurred_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message || 'analytics_unavailable');
    const rows = (data || []) as PageView[];
    for (const row of rows) {
      const path = row.path || '';
      if (!isPublicPath(path)) continue;
      const occurred = new Date(row.occurred_at);
      const key = hourly ? hourKey(occurred) : dayKey(occurred);
      const isPrevious = comparisonAvailable && (hourly
        ? occurred >= previousHourStart && occurred < hourStart
        : key >= previousFirstDayKey && key < firstDayKey);
      if (isPrevious) {
        previousPageviews += 1;
        if (row.anonymous_id) previousVisitors.add(row.anonymous_id);
        continue;
      }
      const index = bucketIndex.get(key);
      if (index === undefined) continue;
      trend[index].pageviews += 1;
      pageviews += 1;
      lastEventAt = row.occurred_at;
      if (row.anonymous_id) {
        visitors.add(row.anonymous_id);
        visitorsByBucket[index].add(row.anonymous_id);
        // One country per browser in the period. Prefer the first known code.
        const country = /^[A-Z]{2}$/.test(row.country_code || '') ? row.country_code : null;
        if (!visitorCountry.has(row.anonymous_id) || (!visitorCountry.get(row.anonymous_id) && country)) {
          visitorCountry.set(row.anonymous_id, country);
        }
      }
      pages.set(path, (pages.get(path) || 0) + 1);
    }
    if (rows.length < pageSize) break;
  }
  trend.forEach((point, index) => { point.visitors = visitorsByBucket[index].size; });
  const countryCounts = new Map<string | null, number>();
  for (const country of visitorCountry.values()) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  const known = [...countryCounts].filter(([code]) => code !== null).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const countries: CountryCount[] = known.slice(0, 5).map(([code, count]) => ({ code, visitors: count }));
  const other = known.slice(5).reduce((sum, [, count]) => sum + count, 0);
  if (other) countries.push({ code: 'OTHER', visitors: other });
  if (countryCounts.get(null)) countries.push({ code: null, visitors: countryCounts.get(null)! });

  return {
    visitors: visitors.size,
    pageviews,
    previous: { visitors: previousVisitors.size, pageviews: previousPageviews },
    comparisonAvailable,
    trend,
    topPages: [...pages].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([path, views]) => ({ path, views })),
    countries,
    lastEventAt,
  };
};

const analyticsCache = new Map<string, { expiresAt: number; result: ReturnType<typeof loadAdminAnalytics> }>();

export const getAdminAnalytics = (options: AnalyticsOptions = {}) => {
  // Only real-time dashboard requests are cached. Explicit `now` values remain
  // deterministic for callers that inspect a historical snapshot.
  if (options.now) return loadAdminAnalytics(options);
  const key = `${options.days ?? 30}:${options.hourly === true}`;
  const cached = analyticsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const result = loadAdminAnalytics(options).catch((error) => {
    analyticsCache.delete(key);
    throw error;
  });
  analyticsCache.set(key, { expiresAt: Date.now() + 60_000, result });
  return result;
};
