// Building facts for grounding the guide's answers.
//
// The frontend's curated campus data is the single source of truth, so the guide can never
// describe a building differently from what the map shows. That module is dependency-free,
// so the server imports it directly instead of keeping a second copy.

import { PLACES, DINING, STUDY_SPOTS, RESOURCES, CLUBS } from "../../src/data/campus.js";

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Every building name the guide is allowed to talk about as a known place. */
export const knownBuildings = [...new Set([
  ...PLACES.map((p) => p.mapName),
  ...DINING.map((d) => d.building),
  ...STUDY_SPOTS.map((s) => s.building),
  ...RESOURCES.map((r) => r.building),
])].filter(Boolean).sort();

/** Find a place by its map name or id, tolerating case and spacing differences. */
export function findPlace(name) {
  const q = norm(name);
  if (!q) return null;
  return PLACES.find((p) => norm(p.mapName) === q || norm(p.id) === q)
    ?? PLACES.find((p) => norm(p.mapName).includes(q) || q.includes(norm(p.mapName)))
    ?? null;
}

/**
 * Everything we know about one building, as plain text for the prompt.
 * Returns null when the building isn't in our data — the guide is then told to say it
 * doesn't have details rather than inventing them.
 */
export function buildingFacts(name, lang = "en") {
  const place = findPlace(name);
  const buildingName = place?.mapName ?? name;
  const dining = DINING.filter((d) => norm(d.building) === norm(buildingName));
  const study = STUDY_SPOTS.filter((s) => norm(s.building) === norm(buildingName));
  const resources = RESOURCES.filter((r) => norm(r.building) === norm(buildingName));
  const clubs = CLUBS.filter((c) => norm(c.building) === norm(buildingName));

  if (!place && !dining.length && !study.length && !resources.length && !clubs.length) return null;

  const text = place?.text?.[lang] ?? place?.text?.en;
  const lines = [`Building: ${buildingName}`];
  if (place?.category) lines.push(`Category: ${place.category}`);
  if (text?.description) lines.push(`Description: ${text.description}`);
  if (text?.purpose) lines.push(`Main purpose: ${text.purpose}`);
  if (text?.why) lines.push(`Why first-years go there: ${text.why}`);
  if (place?.departments?.length) lines.push(`Departments and services: ${place.departments.join(", ")}`);
  if (place?.accessibility) {
    const a = place.accessibility;
    lines.push(`Accessibility: step-free entrance ${a.stepFree ? "yes" : "not recorded"}, elevator ${a.elevator ? "yes" : "not recorded"}${a.entrance ? `, accessible entrance on the ${a.entrance} side` : ""}`);
  }
  if (dining.length) lines.push(`Dining here: ${dining.map((d) => `${d.name} (${d.food}, ${fmtHours(d.hours)})`).join("; ")}`);
  if (study.length) lines.push(`Study spots here: ${study.map((s) => `${s.name} (${s.style})`).join("; ")}`);
  if (resources.length) lines.push(`Student services here: ${resources.map((r) => r.name).join("; ")}`);
  if (clubs.length) lines.push(`Clubs that meet here: ${clubs.map((c) => c.name).join("; ")}`);
  return lines.join("\n");
}

const pad = (n) => String(n).padStart(2, "0");
const fmtHours = ([open, close]) => `${pad(Math.floor(open / 60))}:${pad(open % 60)}–${pad(Math.floor(close / 60))}:${pad(close % 60)}`;
