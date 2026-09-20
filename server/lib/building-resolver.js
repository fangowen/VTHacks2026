import { BUILDING_ALIASES } from "./building-aliases.js";

/** Normalize names without losing non-Latin letters Gemini may return. */
export function normalizeBuildingName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function similarity(a, b) {
  return 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);
}

const uniqueNames = (names) => [...new Set(
  (Array.isArray(names) ? names : [])
    .map((name) => String(name ?? "").trim())
    .filter(Boolean),
)];

/**
 * Resolve a model-produced place name against the exact building names supplied by the map.
 * Returns one of:
 *   { status: "match", name }
 *   { status: "ambiguous", candidates }
 *   { status: "none" }
 */
export function resolveBuilding(requested, buildingNames) {
  const names = uniqueNames(buildingNames);
  const query = normalizeBuildingName(requested);
  if (!query || !names.length) return { status: "none" };

  const indexed = names.map((name) => ({ name, normalized: normalizeBuildingName(name) }));
  const exact = indexed.find((item) => item.normalized === query);
  if (exact) return { status: "match", name: exact.name };

  const compactQuery = query.replace(/\s/g, "");
  const aliasTarget = Object.entries(BUILDING_ALIASES).find(([alias]) => {
    const normalized = normalizeBuildingName(alias);
    return normalized === query || normalized.replace(/\s/g, "") === compactQuery;
  })?.[1];
  if (aliasTarget) {
    const aliasMatch = indexed.find((item) => item.normalized === normalizeBuildingName(aliasTarget));
    if (aliasMatch) return { status: "match", name: aliasMatch.name };
  }

  // Partial labels are convenient ("Pritchard"), but multiple close names such as the Newman
  // buildings must be surfaced rather than silently choosing one.
  const partial = indexed.filter(({ normalized }) =>
    (query.length >= 4 && normalized.includes(query))
    || (normalized.length >= 4 && query.includes(normalized)));
  if (partial.length === 1) return { status: "match", name: partial[0].name };
  if (partial.length > 1) return {
    status: "ambiguous",
    candidates: partial.slice(0, 4).map((item) => item.name),
  };

  const ranked = indexed
    .map((item) => ({ ...item, score: similarity(query, item.normalized) }))
    .filter((item) => item.score >= 0.68)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  if (!ranked.length) return { status: "none" };

  const close = ranked.filter((item) => ranked[0].score - item.score < 0.08);
  if (close.length > 1) return {
    status: "ambiguous",
    candidates: close.slice(0, 4).map((item) => item.name),
  };
  return { status: "match", name: ranked[0].name };
}
