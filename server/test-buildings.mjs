import assert from "node:assert/strict";
import { resolveBuilding } from "./lib/building-resolver.js";
import { buildCatalog, executeGuideTool } from "./lib/guide-tools.js";

const buildings = [
  "Goodwin Hall",
  "New Classroom Building",
  "Newman Hall",
  "Newman House",
  "Newman Library",
  "Pritchard Hall",
  "Squires Student Center",
  "Torgersen Hall",
];

const match = (query) => resolveBuilding(query, buildings);
assert.deepEqual(match("GOODWIN-HALL"), { status: "match", name: "Goodwin Hall" });
assert.deepEqual(match("Goodwn Hall"), { status: "match", name: "Goodwin Hall" });
assert.deepEqual(match("N.C.B."), { status: "match", name: "New Classroom Building" });
assert.deepEqual(match("la biblioteca"), { status: "match", name: "Newman Library" });
assert.deepEqual(match("Squires"), { status: "match", name: "Squires Student Center" });
assert.deepEqual(match("Pritchard"), { status: "match", name: "Pritchard Hall" });
assert.deepEqual(match("Newman"), {
  status: "ambiguous",
  candidates: ["Newman Hall", "Newman House", "Newman Library"],
});
assert.deepEqual(match("Imaginary Observatory"), { status: "none" });

const catalog = buildCatalog([
  { name: "Dietrick Hall", x: 0, y: 0, description: "Campus dining" },
  { name: "Lavery Hall", x: 100, y: 0, description: "Academic building with Turner Place dining" },
  { name: "Squires Student Center", x: 210, y: 0, description: "Student center with food court" },
  { name: "Newman Library", x: 220, y: 20, description: "Quiet study library" },
]);
const state = { catalog, currentLocation: { name: "Newman Library", x: 220, y: 20 }, studentContext: {}, action: null };
const dining = executeGuideTool({ name: "find_buildings", arguments: { category: "dining", limit: 10 } }, state);
assert.deepEqual(dining.matches.map((item) => item.name).sort(), ["Dietrick Hall", "Lavery Hall", "Squires Student Center"]);
const nearestDining = executeGuideTool({ name: "nearest", arguments: { category: "dining", limit: 2 } }, state);
assert.equal(nearestDining.matches[0].name, "Squires Student Center");
assert.equal(nearestDining.distanceType, "straight-line");
assert.deepEqual(executeGuideTool({ name: "fly_to", arguments: { building: "Squires" } }, state), {
  ok: true,
  building: "Squires Student Center",
  instruction: "The frontend will fly to and flag this building after your reply.",
});
assert.deepEqual(state.action, { type: "flyTo", building: "Squires Student Center" });

console.log("Building resolver and validated guide-tool tests passed.");
