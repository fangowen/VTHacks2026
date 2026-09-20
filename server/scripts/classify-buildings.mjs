#!/usr/bin/env node

import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { PLACES, DINING, STUDY_SPOTS, RESOURCES, CLUBS } from "../../src/data/campus.js";

const ROOT = new URL("../../", import.meta.url);
const CAMPUS_URL = new URL("vt-campus.json", ROOT);
const OUTPUT_URL = new URL("../data/building-classifications.json", import.meta.url);
const MODEL = process.env.GEMINI_CLASSIFICATION_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const BATCH_SIZE = Math.max(5, Math.min(40, Number(process.env.CLASSIFICATION_BATCH_SIZE) || 24));
const CATEGORIES = ["dining", "academic", "residence", "library", "athletics", "services", "arts", "student-life", "parking", "other"];

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required. Add it to server/.env before running this script.");
  process.exit(1);
}

const norm = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

const campus = JSON.parse(await readFile(CAMPUS_URL, "utf8"));
const curated = new Map(PLACES.filter((place) => place.mapName).map((place) => [norm(place.mapName), place]));
const linkedContents = new Map();
function link(building, text) {
  const key = norm(building);
  if (!key) return;
  const values = linkedContents.get(key) ?? [];
  values.push(text); linkedContents.set(key, values);
}
for (const item of DINING) link(item.building, `Dining venue: ${item.name}`);
for (const item of STUDY_SPOTS) link(item.building, `Study space: ${item.name} (${item.style})`);
for (const item of RESOURCES) link(item.building, `Student service: ${item.name}`);
for (const item of CLUBS) link(item.building, `Student organization activity: ${item.name}`);
const records = new Map();

const samePoint = (a, b) => a?.lat === b?.lat && a?.lon === b?.lon;
function joinRings(ways) {
  const open = ways.filter((way) => way.length > 1).map((way) => way.slice());
  const rings = [];
  while (open.length) {
    let ring = open.shift();
    for (let grew = true; grew && !samePoint(ring[0], ring[ring.length - 1]);) {
      grew = false;
      for (let index = 0; index < open.length; index++) {
        const way = open[index], end = ring[ring.length - 1];
        if (samePoint(end, way[0])) ring = ring.concat(way.slice(1));
        else if (samePoint(end, way[way.length - 1])) ring = ring.concat(way.slice(0, -1).reverse());
        else continue;
        open.splice(index, 1); grew = true; break;
      }
    }
    rings.push(ring);
  }
  return rings;
}
function outerRings(element) {
  if (element.type === "way" && element.geometry) return [element.geometry];
  return joinRings((element.members ?? []).filter((member) => member.geometry && member.role !== "inner").map((member) => member.geometry));
}
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat)
      && point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}
function elementCenter(element) {
  const points = element.geometry ?? (element.members ?? []).flatMap((member) => member.geometry ?? []);
  if (!points.length) return null;
  return points.reduce((sum, point) => ({ lat: sum.lat + point.lat / points.length, lon: sum.lon + point.lon / points.length }), { lat: 0, lon: 0 });
}
const campusRings = (campus.elements ?? [])
  .filter((element) => element.tags?.amenity === "university" && element.tags?.name === "Virginia Tech")
  .flatMap(outerRings);
const onCampus = (element) => {
  const center = elementCenter(element);
  return !campusRings.length || (center && campusRings.some((ring) => pointInRing(center, ring)));
};
const GREEK = /\b(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b.*\b(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b|fraternity|sorority/i;
const excluded = (tags, name) => GREEK.test(name) || !!tags.shop || !!tags.brand
  || (["restaurant", "fast_food", "bar", "pub", "cafe"].includes(tags.amenity)
    && !["university", "college", "dormitory"].includes(tags.building));

function usefulTags(tags = {}) {
  const omit = /^(addr:|contact:|phone$|website$|wikidata$|wikipedia$|operator:wikidata$|start_date$|architect)/;
  return Object.fromEntries(Object.entries(tags)
    .filter(([key, value]) => !omit.test(key) && typeof value === "string" && value.length <= 240)
    .slice(0, 35));
}

function add(name, tags = {}) {
  const clean = String(name ?? "").trim();
  if (!clean) return;
  const key = norm(clean);
  const prior = records.get(key);
  const place = curated.get(key);
  const description = [place?.text?.en?.description, ...(linkedContents.get(key) ?? [])].filter(Boolean).join(" ");
  if (!prior) records.set(key, { name: clean, tags: usefulTags(tags), description });
  else records.set(key, { ...prior, tags: { ...prior.tags, ...usefulTags(tags) }, description: prior.description || description });
}

for (const element of campus.elements ?? []) {
  const tags = element.tags ?? {};
  if (tags.name && (tags.building || tags.leisure === "stadium") && onCampus(element) && !excluded(tags, tags.name)) add(tags.name, tags);
}
for (const place of PLACES) if (place.kind !== "landmark") add(place.mapName, { source: "curated-campus-data" });

const buildings = [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
let previous = {};
try {
  const current = JSON.parse(await readFile(OUTPUT_URL, "utf8"));
  previous = current?.buildings ?? {};
} catch {}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const generated = {};

for (let offset = 0; offset < buildings.length; offset += BATCH_SIZE) {
  const batch = buildings.slice(offset, offset + BATCH_SIZE).map((building, index) => ({ id: String(offset + index), ...building }));
  const manual = batch.filter((building) => previous[building.name]?.manualOverride === true);
  for (const building of manual) generated[building.name] = previous[building.name];
  const pending = batch.filter((building) => previous[building.name]?.manualOverride !== true);
  if (!pending.length) continue;

  const interaction = await ai.interactions.create({
    model: MODEL,
    store: false,
    system_instruction: `Classify Virginia Tech campus buildings only from the supplied name, OSM tags, and description. A building may have multiple categories. Use only: ${CATEGORIES.join(", ")}. Mark containsDining=true whenever the evidence says food, dining, a food court, cafe, market, or dining venue exists inside the building, even when its primary purpose is student-life, residence, academic, or services. Do not infer specific occupants without evidence. Use other when the evidence is insufficient. Return every input id exactly once. Keep rationale under 18 words.`,
    input: JSON.stringify(pending),
    generation_config: { thinking_level: "low" },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "object", additionalProperties: false, required: ["results"],
        properties: {
          results: {
            type: "array",
            items: {
              type: "object", additionalProperties: false,
              required: ["id", "categories", "containsDining", "rationale"],
              properties: {
                id: { type: "string" },
                categories: { type: "array", minItems: 1, items: { type: "string", enum: CATEGORIES } },
                containsDining: { type: "boolean" },
                rationale: { type: "string" },
              },
            },
          },
        },
      },
    },
  });

  const parsed = JSON.parse(interaction.output_text || "{}");
  const results = new Map((parsed.results ?? []).map((result) => [String(result.id), result]));
  for (const building of pending) {
    const result = results.get(building.id);
    if (!result) throw new Error(`Gemini omitted ${building.name} (id ${building.id})`);
    generated[building.name] = {
      categories: [...new Set(result.categories.filter((category) => CATEGORIES.includes(category)))],
      containsDining: !!result.containsDining,
      rationale: String(result.rationale ?? "").trim(),
    };
    if (!generated[building.name].categories.length) generated[building.name].categories = ["other"];
  }
  console.log(`Classified ${Math.min(offset + BATCH_SIZE, buildings.length)}/${buildings.length}`);
}

const ordered = Object.fromEntries(Object.entries(generated).sort(([a], [b]) => a.localeCompare(b)));
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT_URL, `${JSON.stringify({
  _meta: {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    categories: CATEGORIES,
    note: "Set manualOverride=true on a building to preserve hand edits when this script is rerun.",
  },
  buildings: ordered,
}, null, 2)}\n`);

const dining = Object.entries(ordered).filter(([, value]) => value.containsDining || value.categories.includes("dining"));
console.log(`Saved ${Object.keys(ordered).length} classifications to ${OUTPUT_URL.pathname}`);
console.table(dining.map(([name, value]) => ({ building: name, categories: value.categories.join(", "), containsDining: value.containsDining })));
