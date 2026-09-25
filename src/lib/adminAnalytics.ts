import { getSupabaseAdmin } from './supabase/server';

type AnalyticsOptions = { days?: number; hourly?: boolean; now?: Date };
type PageView = { id: string; anonymous_id: string | null; occurred_at: string; path: string | null };
export type AnalyticsTrendPoint = { key: string; timestamp: string; visitors: number; pageviews: number };

const timeZone = 'Europe/Brussels';
const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const localParts = (date: Date) => Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]));
const dayKey = (date: Date) => {
  const value = localParts(date);
  return `${value.year}-${value.month}-${value.day}`;
};
const hourKey = (date: Date) => date.toISOString().slice(0, 13);

// Query a little before the first local day to cover both Brussels UTC offsets.
export const getAdminAnalytics = async ({ days = 30, hourly = false, now = new Date() }: AnalyticsOptions = {}) => {
  const rangeDays = Math.min(Math.max(days, 1), 365);
  const hourStart = new Date(now);
  hourStart.setUTCHours(hourStart.getUTCHours() - 23, 0, 0, 0);
  const today = dayKey(now);
  const [year, month, day] = today.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, day - (rangeDays - 1)));
  const firstDayKey = firstDay.toISOString().slice(0, 10);
  const queryStart = hourly ? hourStart : new Date(firstDay.getTime() - 86400000);

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
  const pages = new Map<string, number>();
  let pageviews = 0;
  let lastEventAt: string | null = null;

  // Supabase returns at most one API page by default. Paginate explicitly.
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseAdmin().from('analytics_events')
      .select('id,anonymous_id,occurred_at,path')
      .eq('consented', true).eq('environment', 'production').eq('event_name', 'page_view')
      .gte('occurred_at', queryStart.toISOString()).lte('occurred_at', now.toISOString())
      .order('occurred_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message || 'analytics_unavailable');
    const rows = (data || []) as PageView[];
    for (const row of rows) {
      const path = row.path || '';
      // Keep account and operational routes out of public website reporting.
      if (!path.startsWith('/') || /^\/(admin|praktijk|account|api)(\/|$)/.test(path)) continue;
      const occurred = new Date(row.occurred_at);
      const key = hourly ? hourKey(occurred) : dayKey(occurred);
      if (!hourly && key < firstDayKey) continue;
      const index = bucketIndex.get(key);
      if (index === undefined) continue;
      trend[index].pageviews += 1;
      pageviews += 1;
      lastEventAt = row.occurred_at;
      if (row.anonymous_id) {
        visitors.add(row.anonymous_id);
        visitorsByBucket[index].add(row.anonymous_id);
      }
      pages.set(path, (pages.get(path) || 0) + 1);
    }
    if (rows.length < pageSize) break;
  }
  trend.forEach((point, index) => { point.visitors = visitorsByBucket[index].size; });
  return {
    visitors: visitors.size,
    pageviews,
    trend,
    topPages: [...pages].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, views]) => ({ path, views })),
    lastEventAt,
  };
};
