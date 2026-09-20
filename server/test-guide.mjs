// Smoke test for the guide endpoint in several languages.
//   node test-guide.mjs                  (against http://localhost:8787)
//   BASE=http://localhost:8787 node test-guide.mjs
//
// Prints the reply text and whether audio came back. Exits non-zero if a request fails.

const BASE = process.env.BASE || "http://localhost:8787";

const CASES = [
  { language: "en", message: "What is a Hokie, and what are office hours?" },
  { language: "es", message: "¿Qué puedo comer cerca de aquí?", context: "Dietrick Hall" },
  { language: "zh", message: "新生应该先去图书馆做什么？", context: "Newman Library" },
];

const line = "-".repeat(72);
let failures = 0;

const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch((e) => ({ error: e.message }));
console.log(`${line}\nHealth: ${JSON.stringify(health)}\n${line}`);

for (const body of CASES) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/api/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: [], ...body }),
    });
    const data = await res.json();
    const ms = Date.now() - started;
    if (!res.ok) {
      failures++;
      console.log(`[${body.language}] HTTP ${res.status} in ${ms}ms → ${data.error}`);
    } else {
      const audio = data.audio ? `${Math.round(data.audio.length * 0.75 / 1024)} KB mp3` : `none (${data.speechError ?? "no reason given"})`;
      console.log(`[${body.language}] ${ms}ms\n  Q: ${body.message}${body.context ? `  (context: ${body.context})` : ""}\n  A: ${data.text}\n  audio: ${audio}`);
    }
  } catch (err) {
    failures++;
    console.log(`[${body.language}] request failed: ${err.message}`);
  }
  console.log(line);
}

console.log(failures ? `${failures} case(s) failed.` : "All cases returned a reply.");
process.exit(failures ? 1 : 0);
