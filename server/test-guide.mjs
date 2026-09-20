// Live smoke test for Gemini's campus tools and ElevenLabs reply audio.
//   node test-guide.mjs                  (against http://localhost:8787)
//   BASE=http://localhost:8787 node test-guide.mjs
//
// Prints the reply text and whether audio came back. Exits non-zero if a request fails.

const BASE = process.env.BASE || "http://localhost:8787";

const buildings = [
  { name: "Dietrick Hall", x: 202.15, y: -107.02, description: "A residence dining hall." },
  { name: "Goodwin Hall", x: -214.88, y: 753.8, description: "An academic engineering building." },
  { name: "Hitt Hall", x: -237.87, y: 434.38, description: "An academic building with dining." },
  { name: "Lavery Hall", x: 52.15, y: 625.62, description: "An academic building with dining." },
  { name: "Newman Library", x: 375.4, y: 363.42, description: "Virginia Tech's main library and a quiet study destination." },
  { name: "Owens Hall", x: 399.64, y: 133.31, description: "A campus dining hall." },
  { name: "Pritchard Hall", x: 331.37, y: -137.88, description: "A residence hall." },
  { name: "Squires Student Center", x: 483.17, y: 454.23, description: "A student center with dining and arts spaces." },
  { name: "Torgersen Hall", x: 295.97, y: 468.36, description: "An academic hall next to the library." },
  { name: "West End Market", x: 124.08, y: -246.91, description: "A campus dining venue." },
];

const CASES = [
  { language: "en", message: "Where's the closest dining hall?", current: "Pritchard Hall", expectAction: true },
  { language: "en", message: "Where's the closest dining hall?", current: "Torgersen Hall", expectAction: true },
  { language: "es", message: "¿Dónde está el comedor más cercano?", current: "Goodwin Hall", expectAction: true },
  { language: "en", message: "Find me somewhere quiet to study near me.", current: "Pritchard Hall", expectAction: true },
  { language: "en", message: "Which building is Torgersen?", current: "Newman Library", expectBuilding: "Torgersen Hall" },
  { language: "en", message: "What do students study in Torgersen Hall?", current: "Newman Library", expectAction: false },
];

const line = "-".repeat(72);
let failures = 0;

const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch((e) => ({ error: e.message }));
console.log(`${line}\nHealth: ${JSON.stringify(health)}\n${line}`);

for (const body of CASES) {
  const started = Date.now();
  try {
    const currentLocation = buildings.find((building) => building.name === body.current);
    const res = await fetch(`${BASE}/api/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], language: body.language, message: body.message,
        buildings, currentLocation, studentContext: {},
      }),
    });
    const data = await res.json();
    const ms = Date.now() - started;
    if (!res.ok) {
      failures++;
      console.log(`[${body.language}] HTTP ${res.status} in ${ms}ms → ${data.error}`);
    } else {
      const audio = data.audio ? `${Math.round(data.audio.length * 0.75 / 1024)} KB mp3` : `none (${data.speechError ?? "no reason given"})`;
      const shouldMove = body.expectAction !== false;
      const moved = data.action?.type === "flyTo";
      if ((shouldMove && !moved) || (!shouldMove && moved)
        || (body.expectBuilding && data.action?.building !== body.expectBuilding)) failures++;
      console.log(`[${body.language}] ${ms}ms\n  Q: ${body.message}  (from: ${body.current})\n  A: ${data.text}\n  action: ${JSON.stringify(data.action)}\n  audio: ${audio}`);
    }
  } catch (err) {
    failures++;
    console.log(`[${body.language}] request failed: ${err.message}`);
  }
  console.log(line);
}

console.log(failures ? `${failures} case(s) failed.` : "All cases returned a reply.");
process.exit(failures ? 1 : 0);
