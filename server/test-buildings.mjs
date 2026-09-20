import assert from "node:assert/strict";
import { resolveBuilding } from "./lib/building-resolver.js";

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

console.log("Building resolver tests passed.");
