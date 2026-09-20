// Places = the map's building records joined to campus metadata.
// A place always points back at the existing map object (b.id / THREE.Group) instead of duplicating it.

import { PLACES, DINING, STUDY_SPOTS, RESOURCES } from "./data/campus.js";
import { pickLang, t, catLabel } from "./i18n.js";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const DESCRIPTION_KEY = {
  "Academic & admin": "placeDescAcademic", "Residence halls": "placeDescResidence",
  "Dining": "placeDescDining", "Athletics & recreation": "placeDescAthletics",
  "Libraries": "placeDescLibrary", "Parking": "placeDescParking",
  "Landmarks": "placeDescLandmark", "Other": "placeDescOther",
};

// Describe an uncurated building by both its map category and its position on campus. This keeps
// every directory entry useful without inventing departments, opening hours, or accessibility
// claims that are not present in the source data.
function campusLocationKey(place) {
  if (Math.hypot(place.x, place.y) < 260) return "campusCenter";
  if (Math.abs(place.x) > Math.abs(place.y)) return place.x > 0 ? "campusEast" : "campusWest";
  return place.y > 0 ? "campusNorth" : "campusSouth";
}

export class PlaceIndex {
  constructor(map) {
    this.map = map;
    this.places = [];
    this.byIdMap = new Map();
    this.byBuilding = new Map();

    const metaByObj = new Map(), metaByName = new Map();
    for (const m of PLACES) {
      if (m.mapObjectId) metaByObj.set(m.mapObjectId, m);
      if (m.mapName && m.kind !== "landmark") metaByName.set(norm(m.mapName), m);
    }

    // 1. Every building on the map becomes a place; featured ones pick up metadata
    for (const b of map.buildings) {
      const meta = metaByObj.get(b.id) ?? metaByName.get(norm(b.name)) ?? null;
      this.add({
        id: meta?.id ?? slug(b.name), kind: "building", name: b.name, category: b.category,
        categories: b.categories ?? [b.category],
        building: b, meta, x: b.center.x, y: -b.center.z,
      });
    }

    // 2. Landmarks that aren't buildings: reuse the map's named open spaces where possible
    for (const meta of PLACES.filter((m) => m.kind === "landmark")) {
      if (this.byIdMap.has(meta.id)) continue;
      const area = map.areas.find((a) => norm(a.name) === norm(meta.mapName));
      if (area) {
        this.add({ id: meta.id, kind: "landmark", name: area.name, category: "Landmarks", area, meta, x: area.center.x, y: -area.center.z });
      } else if (meta.nearName) {
        // e.g. Torgersen Bridge: the point of Torgersen Hall closest to Newman Library
        const host = map.buildings.find((b) => norm(b.name) === norm(meta.mapName));
        const towards = map.buildings.find((b) => norm(b.name) === norm(meta.nearName));
        if (!host || !towards) continue;
        const target = [towards.center.x, -towards.center.z];
        let best = null, bestD = Infinity;
        for (const mesh of host.parts) for (const p of mesh.userData.part.poly.outer) {
          const d = Math.hypot(p[0] - target[0], p[1] - target[1]);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (best) this.add({ id: meta.id, kind: "landmark", name: pickLangName(meta), category: "Landmarks", building: host, meta, x: best[0], y: best[1] });
      }
    }
  }

  add(place) {
    this.places.push(place);
    this.byIdMap.set(place.id, place);
    if (place.building) {
      const list = this.byBuilding.get(place.building) ?? [];
      list.push(place); this.byBuilding.set(place.building, list);
    }
  }

  all() { return this.places; }
  byId(id) { return this.byIdMap.get(id) ?? null; }
  /** The primary place for a map building (used when the user clicks the 3D model). */
  forBuilding(b) { return (this.byBuilding.get(b) ?? []).find((p) => p.kind === "building") ?? null; }
  byName(name) { return this.places.find((p) => norm(p.name) === norm(name)) ?? null; }

  /** Loose name lookup: exact, then "starts with", then "contains", preferring bigger buildings. */
  find(query) {
    const q = norm(query);
    if (!q) return null;
    const ranked = [...this.places].sort((a, b) => (b.building?.area ?? 0) - (a.building?.area ?? 0));
    return ranked.find((p) => norm(p.name) === q)
      ?? ranked.find((p) => norm(p.name).startsWith(q))
      ?? ranked.find((p) => q.length >= 4 && norm(p.name).includes(q))
      ?? ranked.find((p) => q.length >= 6 && q.includes(norm(p.name)))
      ?? null;
  }

  search(text, category = null) {
    const q = norm(text);
    return this.places
      .filter((p) => !category || (p.categories ?? [p.category]).includes(category))
      .filter((p) => !q || norm(p.name).includes(q) || norm(catLabel(p.category)).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /** Closest places to `from`, optionally filtered (dining, study spots, …). */
  near(from, { limit = 4, filter = null, exclude = null, maxDist = Infinity } = {}) {
    return this.places
      .filter((p) => p !== from && p !== exclude && (!filter || filter(p)))
      .map((p) => ({ place: p, dist: this.distance(from, p) }))
      .filter((x) => x.dist <= maxDist)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit);
  }

  /** A point on the building's edge facing `towards` — used as the route's start/end door. */
  door(place, towards = null) {
    const b = place.building;
    if (!b || place.kind === "landmark") return { x: place.x, y: place.y };
    const target = towards ? [towards.x, towards.y] : null;
    let best = null, bestD = Infinity;
    for (const mesh of b.parts) for (const p of mesh.userData.part.poly.outer) {
      const d = target ? Math.hypot(p[0] - target[0], p[1] - target[1]) : 0;
      if (!target) { best = best ?? p; break; }
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) return { x: place.x, y: place.y };
    // Nudge a couple of meters outside the footprint so the route line doesn't start inside a wall
    const dx = best[0] - place.x, dy = best[1] - place.y, len = Math.hypot(dx, dy) || 1;
    return { x: best[0] + dx / len * 2, y: best[1] + dy / len * 2 };
  }

  // ---------- Text ----------
  description(place) {
    const meta = place.meta;
    if (meta) return pickLang(meta.text).description;
    return t(DESCRIPTION_KEY[place.category] ?? "placeDescOther", {
      place: place.name,
      location: t(campusLocationKey(place)),
    });
  }
  purpose(place) { return place.meta ? pickLang(place.meta.text).purpose : null; }
  why(place) { return place.meta ? pickLang(place.meta.text).why : null; }
  departments(place) { return place.meta?.departments ?? []; }
  accessibility(place) {
    return place.meta?.accessibility ?? { stepFree: null, elevator: null, entrance: null };
  }

  // ---------- Linked campus data ----------
  diningAt(place) { return DINING.filter((d) => norm(d.building) === norm(place.name)); }
  studyAt(place) { return STUDY_SPOTS.filter((s) => norm(s.building) === norm(place.name)); }
  resourcesAt(place) { return RESOURCES.filter((r) => norm(r.building) === norm(place.name)); }

  /** Resolve a campus-data record ("building" field) to a place on the map. */
  placeOf(record) { return record ? (this.byName(record.building) ?? this.find(record.building)) : null; }
}

function pickLangName(meta) {
  // Landmarks keep their English proper name; the description carries the translation
  return meta.mapName === "Torgersen Hall" ? "Torgersen Bridge" : meta.mapName;
}
