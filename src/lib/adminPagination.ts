export const ADMIN_PAGE_SIZE = 25;
export function adminPage(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 1000000) : 1;
}
type Result<T> = { data: T[] | null; error: {message?: string} | null; count?: number | null };
export async function readAdminPage<T>(query: (start: number, end: number) => PromiseLike<Result<T>>, requested: unknown, size = ADMIN_PAGE_SIZE) {
  let page = adminPage(requested);
  let result = await query((page - 1) * size, page * size - 1);
  if (result.error) throw new Error('De lijst kon niet worden geladen. Probeer opnieuw.');
  const total = result.count || 0;
  const pages = Math.max(1, Math.ceil(total / size));
  if (page > pages) {
    page = pages;
    result = await query((page - 1) * size, page * size - 1);
    if (result.error) throw new Error('De lijst kon niet worden geladen. Probeer opnieuw.');
  }
  return {items: result.data || [], total, page, pages, pageSize: size};
}
export async function readAllAdminRows<T>(query: (start: number, end: number) => PromiseLike<Result<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const {data, error} = await query(start, start + 499);
    if (error) throw new Error('De gegevens konden niet volledig worden geladen. Probeer opnieuw.');
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
export function adminPageHref(url: URL, parameter: string, page: number, hash = '') {
  const target = new URL(url);
  target.searchParams.set(parameter, String(page));
  return target.pathname + target.search + hash;
}
