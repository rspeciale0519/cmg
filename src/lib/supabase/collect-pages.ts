export const POSTGREST_PAGE_SIZE = 1_000;

export type PageResult<Row> = {
  data: Row[] | null;
  error: { message: string } | null;
};

/**
 * Exhausts a PostgREST collection without relying on the server's implicit
 * max-rows ceiling. Callers keep ownership of ordering and RLS; this helper
 * only advances explicit, non-overlapping ranges until a short page arrives.
 */
export async function collectPostgrestPages<Row>(
  load: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<Row[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError("PostgREST page size must be a positive integer.");
  }

  const data: Row[] = [];

  for (let from = 0; ; from += pageSize) {
    const page = await load(from, from + pageSize - 1);
    if (page.error) {
      throw new Error(`PostgREST collection read failed: ${page.error.message}`);
    }

    if (!Array.isArray(page.data)) {
      throw new Error("PostgREST collection read failed: response data was not an array");
    }

    const rows = page.data as Row[];
    data.push(...rows);
    if (rows.length < pageSize) return data;
  }
}
