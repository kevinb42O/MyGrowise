/** Read stable ordered pages before marking a conversation read; PostgREST caps single reads. */
export async function readMessagePages<T>(page: (offset: number, end: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await page(offset, offset + 499);
    if (result.error) throw new Error(result.error.message || 'messages_unavailable');
    rows.push(...(result.data || []));
    if (!result.data || result.data.length < 500) return rows;
  }
}
