import { readFileSync } from "node:fs";

const DATA_URL = new URL("../data/building-classifications.json", import.meta.url);

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function load() {
  try {
    const parsed = JSON.parse(readFileSync(DATA_URL, "utf8"));
    return parsed?.buildings && typeof parsed.buildings === "object" ? parsed.buildings : {};
  } catch (error) {
    console.warn(`[classifications] Could not load ${DATA_URL.pathname}: ${error.message}`);
    return {};
  }
}

export const BUILDING_CLASSIFICATIONS = Object.freeze(load());
const INDEX = new Map(Object.entries(BUILDING_CLASSIFICATIONS).map(([name, value]) => [normalize(name), value]));

export function classificationFor(name) {
  const exact = INDEX.get(normalize(name));
  if (exact) return exact;
  // The renderer adds compass suffixes only when two distant OSM features share a name.
  const base = String(name ?? "").replace(/\s+\((north|south|east|west|northeast|northwest|southeast|southwest|\d+)\)$/i, "");
  return INDEX.get(normalize(base)) ?? { categories: ["other"], containsDining: false };
}
