import { classificationFor } from "./building-classifications.js";
import { resolveBuilding, normalizeBuildingName } from "./building-resolver.js";
import { buildingFacts } from "./buildings.js";

export const GUIDE_TOOLS = [
  {
    type: "function",
    name: "get_current_location",
    description: "Return the building or campus point where the guide bird currently is, including map coordinates. Use this before answering relative requests such as near me or closest.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "find_buildings",
    description: "Search the real campus building directory by an optional category and/or free-text query. Results include categories, descriptions, and whether the building contains dining.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        category: { type: "string", description: "A functional category such as dining, academic, residence, library, athletics, services, arts, student-life, parking, or other." },
        query: { type: "string", description: "A building name, nickname, purpose, feature, or other search phrase." },
        limit: { type: "integer", minimum: 1, maximum: 12 },
      },
    },
  },
  {
    type: "function",
    name: "nearest",
    description: "Return the nearest matching real campus buildings, sorted by straight-line map distance. Use category=dining for every building that is a dining destination or contains dining.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        category: { type: "string", description: "A functional category such as dining, academic, residence, library, athletics, services, arts, student-life, parking, or other." },
        query: { type: "string", description: "Optional name, purpose, or feature to narrow the candidates." },
        from: { type: "string", description: "Optional exact or approximate building name. Omit to use the bird's current location." },
        limit: { type: "integer", minimum: 1, maximum: 8 },
      },
    },
  },
  {
    type: "function",
    name: "fly_to",
    description: "Request that the frontend fly the camera to and flag one real building. Call when the user asks to locate, identify which building, see, find, show, or go to that place. Never call for a passing mention.",
    parameters: {
      type: "object", additionalProperties: false,
      required: ["building"],
      properties: { building: { type: "string", description: "The exact building name returned by another tool." } },
    },
  },
  {
    type: "function",
    name: "get_student_context",
    description: "Return the student's saved profile, class schedule, interests, current demo time, selected building, and last suggested place when available.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];

const cleanString = (value, max = 800) => typeof value === "string" ? value.trim().slice(0, max) : "";
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function buildCatalog(buildings) {
  const seen = new Set();
  return (Array.isArray(buildings) ? buildings : []).flatMap((raw) => {
    const name = cleanString(typeof raw === "string" ? raw : raw?.name, 140);
    const key = normalizeBuildingName(name);
    if (!name || seen.has(key)) return [];
    seen.add(key);
    const saved = classificationFor(name);
    const categories = [...new Set((Array.isArray(saved.categories) ? saved.categories : ["other"])
      .map((category) => cleanString(category, 40).toLowerCase()).filter(Boolean))];
    return [{
      name,
      x: finite(raw?.x),
      y: finite(raw?.y),
      categories: categories.length ? categories : ["other"],
      containsDining: !!saved.containsDining,
      description: cleanString(raw?.description, 900),
      details: cleanString(buildingFacts(name, "en"), 1800),
      tags: raw?.tags && typeof raw.tags === "object"
        ? Object.fromEntries(Object.entries(raw.tags).slice(0, 35).map(([key, value]) => [cleanString(key, 80), cleanString(value, 180)]))
        : {},
    }];
  });
}

function categoryMatches(building, requested) {
  const category = normalizeBuildingName(requested);
  if (!category) return true;
  if (category === "dining") return building.containsDining || building.categories.includes("dining");
  return building.categories.some((candidate) => normalizeBuildingName(candidate) === category);
}

function textScore(building, requested) {
  const query = normalizeBuildingName(requested);
  if (!query) return 1;
  const name = normalizeBuildingName(building.name);
  if (name === query) return 100;
  if (name.includes(query) || query.includes(name)) return 70;
  const haystack = normalizeBuildingName([
    building.name, building.description, building.categories.join(" "),
    Object.values(building.tags).join(" "),
  ].join(" "));
  const tokens = query.split(" ").filter((token) => token.length > 1);
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 8 : 0), 0);
}

function publicBuilding(building, distanceMeters = null) {
  return {
    name: building.name,
    categories: building.categories,
    containsDining: building.containsDining,
    description: building.description || undefined,
    details: building.details || undefined,
    ...(distanceMeters == null ? {} : { distanceMeters: Math.round(distanceMeters) }),
  };
}

function searchCatalog(catalog, { category = "", query = "", limit = 8 } = {}) {
  const cap = Math.max(1, Math.min(12, Number(limit) || 8));
  return catalog
    .filter((building) => categoryMatches(building, category))
    .map((building) => ({ building, score: textScore(building, query) }))
    .filter(({ score }) => !query || score > 0)
    .sort((a, b) => b.score - a.score || a.building.name.localeCompare(b.building.name))
    .slice(0, cap)
    .map(({ building }) => publicBuilding(building));
}

function resolveOrigin(from, state) {
  if (cleanString(from)) {
    const resolved = resolveBuilding(from, state.catalog.map((building) => building.name));
    if (resolved.status !== "match") return { error: resolved.status === "ambiguous" ? "ambiguous_building" : "building_not_found", candidates: resolved.candidates };
    const building = state.catalog.find((candidate) => candidate.name === resolved.name);
    if (building?.x != null && building?.y != null) return building;
    return { error: "coordinates_unavailable", building: resolved.name };
  }
  const current = state.currentLocation;
  if (current?.x != null && current?.y != null) return current;
  return { error: "current_location_unavailable" };
}

export function executeGuideTool(call, state) {
  const args = call?.arguments && typeof call.arguments === "object" ? call.arguments : {};
  switch (call?.name) {
    case "get_current_location":
      return state.currentLocation ?? { error: "current_location_unavailable" };

    case "get_student_context":
      return state.studentContext ?? {};

    case "find_buildings": {
      const matches = searchCatalog(state.catalog, args);
      return matches.length ? { matches } : { error: "no_matching_buildings" };
    }

    case "nearest": {
      const origin = resolveOrigin(args.from, state);
      if (origin.error) return origin;
      const matches = state.catalog
        .filter((building) => categoryMatches(building, args.category))
        .filter((building) => !args.query || textScore(building, args.query) > 0)
        .map((building) => building.x == null || building.y == null ? null : {
          building,
          distance: Math.hypot(building.x - origin.x, building.y - origin.y),
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance || a.building.name.localeCompare(b.building.name))
        .slice(0, Math.max(1, Math.min(8, Number(args.limit) || 5)))
        .map(({ building, distance }) => publicBuilding(building, distance));
      return matches.length ? { from: origin.name ?? state.currentLocation?.name ?? "current location", distanceType: "straight-line", matches }
        : { error: "no_matching_buildings" };
    }

    case "fly_to": {
      const requested = cleanString(args.building, 140);
      const resolved = resolveBuilding(requested, state.catalog.map((building) => building.name));
      if (resolved.status === "ambiguous") return { error: "ambiguous_building", candidates: resolved.candidates };
      if (resolved.status !== "match") return { error: "building_not_found", requested };
      state.action = { type: "flyTo", building: resolved.name };
      return { ok: true, building: resolved.name, instruction: "The frontend will fly to and flag this building after your reply." };
    }

    default:
      return { error: "unknown_tool" };
  }
}
