import { getSqlPool } from "@/lib/db";
import { buildCouncilMapFromRows, regionalCouncilMap } from "@/lib/council-data";

const CACHE_TTL_MS = 60_000;

type CouncilCacheEntry = {
  map: Record<string, string[]>;
  source: "database" | "static";
  expiresAt: number;
};

let councilCache: CouncilCacheEntry | null = null;

export async function getResolvedCouncilMapWithSource(): Promise<{
  map: Record<string, string[]>;
  source: "database" | "static";
}> {
  const now = Date.now();
  if (councilCache && councilCache.expiresAt > now) {
    return { map: councilCache.map, source: councilCache.source };
  }

  const pool = await getSqlPool();

  try {
    const result = await pool.request().query(`
      SELECT RegionalCouncil, LocalCouncil
      FROM [rifiiorg].[Council_Lookup]
      ORDER BY RegionalCouncil, LocalCouncil;
    `);
    const map = buildCouncilMapFromRows(result.recordset ?? []);
    if (Object.keys(map).length > 0) {
      councilCache = { map, source: "database", expiresAt: now + CACHE_TTL_MS };
      return { map, source: "database" };
    }
  } catch {
    /* Table may not exist yet — use static map. */
  }

  councilCache = {
    map: regionalCouncilMap,
    source: "static",
    expiresAt: now + CACHE_TTL_MS
  };
  return { map: regionalCouncilMap, source: "static" };
}

export function clearCouncilMapCache() {
  councilCache = null;
}
