/** Static council hierarchy — used as fallback when DB lookup is empty or unavailable. */

export const regionalCouncilMap: Record<string, string[]> = {
  "CENTRAL REGION": ["HAFIZABAD", "LAHORE", "MULTAN & BAHAWALPUR", "PESHAWAR", "RAWALPINDI", "SARGODHA"],
  "GILGIT REGION": ["GILGIT", "SKARDU", "DSOR"],
  "GUPIS & YASIN REGION": ["GHOLAGHMULI", "GUPIS", "PHUNDER", "PINGAL", "SILGAN", "SULTANABAD", "THOI", "YASIN"],
  "HUNZA REGION": ["ALTIT & KARIMABAD", "ALYABAD & HYDERABAD", "CHUPERSON", "GUJAL BALA", "GULMIT", "NASIRABAD", "SHIMSHAL"],
  "ISHKOMAN & PUNIYAL REGION": ["CHATOORKHAND", "DAMAS", "GAHKUCH", "ISHKOMAN", "SHERQUILLA", "SINGAL", "IMMIT"],
  "LOWER CHITRAL REGION": ["ARKARI", "CHITRAL TOWN", "GARAMCHASHMA", "MADAKLASHT", "PARABEG", "SHOGHORE", "SUSUM"],
  "SOUTHERN REGION": ["GARDEN", "GULSHAN", "HYDERABAD", "KARIMABAD", "KHARADAR", "TANDO TUREL", "THATTA & SHAH BUNDER"],
  "UPPER CHITRAL REGION": [
    "BANG",
    "BOONI",
    "BREP",
    "KHOT",
    "MASTUJ",
    "MULKHOW",
    "YARKHOON LASHT",
    "RECH",
    "LASPUR",
    "CENTER TORKHOW"
  ]
};

export const regionalCouncilOptions = Object.keys(regionalCouncilMap);

export function buildCouncilMapFromRows(
  rows: Array<{ RegionalCouncil?: string | null; LocalCouncil?: string | null }>
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const regional = row.RegionalCouncil?.trim();
    const local = row.LocalCouncil?.trim();
    if (!regional || !local) {
      continue;
    }
    if (!map[regional]) {
      map[regional] = [];
    }
    if (!map[regional].includes(local)) {
      map[regional].push(local);
    }
  }
  return map;
}
