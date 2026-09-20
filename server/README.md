# WHERE THE HOKIE AM I? server

Backend for WHERE THE HOKIE AM I?. It asks **Gemini** for open-ended replies and routes every app
text-to-speech request—including Listen buttons and navigation prompts—through **ElevenLabs**.

API keys live only in `server/.env` and never reach the browser.

## Setup

Requires **Node 18 or newer** (`node -v`).

```bash
cd server
npm install
cp .env.example .env      # copy, don't move — keep the template
```

Fill in `.env`:

| Variable | Required | What it is |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Key from <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | no | Default `gemini-3.5-flash-lite` (~5.6s per reply). `gemini-3.6-flash` ~8.8s; `gemini-3.8-flash` ~30s — it's built for long-horizon agentic work, too slow for speech |
| `GEMINI_TIMEOUT_MS` | no | Default `30000`. Flash replies take roughly 7–15s (longer for non-Latin scripts), so don't set this below ~20000 |
| `ELEVENLABS_API_KEY` | for audio | Key from <https://elevenlabs.io/app/settings/api-keys> |
| `ELEVENLABS_VOICE_ID` | for audio | Voice ID from the ElevenLabs voice library |
| `ELEVENLABS_MODEL_ID` | no | Default `eleven_multilingual_v2` (speaks every language we support) |
| `ELEVENLABS_STT_MODEL_ID` | no | Default `scribe_v2`, used for click-to-talk transcription |
| `ELEVENLABS_STT_TIMEOUT_MS` | no | Default `30000` |
| `ALLOWED_ORIGINS` | no | Comma-separated frontend origins. **Must match the port you serve the frontend on** (`python3 -m http.server 8000` → `http://localhost:8000`; `npx serve` → `http://localhost:3000`). `localhost`, `127.0.0.1` and `[::1]` on a listed port are all accepted. Default covers ports 8000, 3000, 5173 and 5500 |
| `PORT` | no | Default `8787` |
| `MAX_MESSAGE_CHARS`, `MAX_HISTORY_TURNS` | no | Input caps (1000 chars, 10 turns) |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | no | Per-IP rate limit (20 requests/minute) |

Without `GEMINI_API_KEY` the endpoint returns a clean `503`. Without the ElevenLabs
variables replies still come back as text with `audio: null`, so captions keep working.

## Run

```bash
cd server && npm start          # http://localhost:8787
```

Frontend and backend together, from two terminals:

```bash
# terminal 1 — backend
cd server && npm start

# terminal 2 — frontend (repo root)
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The frontend mirrors the page hostname on port 8787, so a page
served from `127.0.0.1` calls `127.0.0.1:8787` and a page served from `localhost` calls
`localhost:8787`. Set `window.HOKIE_GUIDE_API_URL` before `src/api.js` loads for a deployed backend.

If `node -v` is below 18, select a newer installed runtime before starting the server:

```bash
nvm use 22
# or, once per machine:
nvm install 22 && nvm alias default 22
```

`server/index.js` also detects newer installed Node versions and re-launches the server with one,
but changing the shell default keeps `node`, `npm`, and editor terminals consistent.

## API

### `GET /api/health`

```json
{
  "ok": true,
  "gemini": "gemini-3.5-flash-lite",
  "speech": "eleven_multilingual_v2",
  "transcription": "scribe_v2",
  "allowedOrigins": ["http://localhost:8000"],
  "loopbackAllowed": false
}
```

`gemini` / `speech` / `transcription` are `null` when that provider isn't configured.
`allowedOrigins` and `loopbackAllowed` echo the CORS setup, which is the quickest way to diagnose
a `403` from the browser.

### `POST /api/guide`

```jsonc
{
  "message": "Where should I eat before my 2pm class?",  // required, ≤1000 chars
  "language": "es",                                       // optional, default "en"
  "history": [                                            // optional, last ≤10 turns
    { "role": "user", "text": "Hi" },
    { "role": "assistant", "text": "Hi! How can I help?" }
  ],
  "currentLocation": { "name": "Burruss Hall", "x": 22.4, "y": -84.1 },
  "studentContext": { "selectedBuilding": "Burruss Hall", "profile": { "major": "Computer Science" } },
  "buildings": [                                           // exact live map directory
    { "name": "Burruss Hall", "x": 22.4, "y": -84.1, "description": "…", "tags": {} },
    { "name": "Newman Library", "x": 105.2, "y": -34.9, "description": "…", "tags": {} }
  ]
}
```

Response:

```jsonc
{
  "text": "Dietrick Hall is right next door …",  // captions
  "action": { "type": "flyTo", "building": "Dietrick Hall" },
  "audio": "SUQzBAAAA…",                          // base64 MP3, or null if speech failed
  "speechError": null                             // why audio is null, when it is
}
```

### `POST /api/speech`

Used by Listen buttons, locally generated guide messages, navigation prompts, arrival
announcements, and `window.hokie.speak()`.

```jsonc
{ "text": "Burruss Hall houses university administration.", "language": "en" }
```

Response: `{ "audio": "<base64 MP3>" }`. Missing ElevenLabs configuration returns `503`;
provider failures return `502` and are logged by the server.

### `POST /api/transcribe?language=en`

Accepts a raw short browser recording (`audio/webm`, `audio/mp4`, or another `audio/*` type,
up to 8 MB) and returns `{ "text": "Take me to Newman Library" }`. The frontend records for
at most 30 seconds and sends audio only after the user presses Stop and send.

Errors are always JSON: `{ "error": "…" }` with `400` (bad input), `403` (origin not allowed),
`429` (rate limited), `502` (speech provider failure), `503` (provider not configured),
`504` (Gemini timed out), or `500` (otherwise).

## Testing

```bash
npm run test:guide     # Tool-driven dining, study, location and non-movement cases
npm run test:buildings # exact, alias, fuzzy, ambiguous and missing-name resolution
npm run classify:buildings # refresh the reviewable Gemini category snapshot
```

To hear the audio from a curl response:

```bash
curl -s localhost:8787/api/guide -H 'Content-Type: application/json' \
  -d '{"message":"Say hello to a new student","language":"en"}' \
  | python3 -c 'import sys,json,base64; a=json.load(sys.stdin)["audio"]; open("reply.mp3","wb").write(base64.b64decode(a))'
open reply.mp3
```

## How it works

- `index.js` — launcher only: checks the Node version and, if `node` is too old, re-launches
  `app.js` with a newer installed runtime. It holds no routes.
- `app.js` — the Express app: CORS allowlist, JSON body cap, per-IP rate limit, validation, routes.
  This is the process that binds the port, so it is the one to look for in `lsof -ti:8787`.
- `lib/prompt.js` — the guide's persona and rules for language, tool use, camera movement,
  American campus context, and grounded answers. It names the guide ("your Hokie guide") and the
  app ("Where the Hokie Am I?") explicitly so replies never drift onto an older name.
  `npm start` reads this once at boot — **restart the server after editing it**, or the running
  process keeps serving the old prompt.
- `lib/guide-tools.js` — validated current-location, student-context, building search, proximity,
  and fly-to tools backed by the live frontend directory.
- `data/building-classifications.json` — reviewable, hand-correctable multi-category snapshot.
- `scripts/classify-buildings.mjs` — one-time Gemini classifier using OSM tags and curated descriptions.
- `lib/building-resolver.js` and `lib/building-aliases.js` — resolve Gemini's requested place
  against the exact live directory supplied by the frontend, without a second building list.
- `lib/gemini.js` — stateless Gemini function-calling loop; only validated `fly_to` calls become actions.
- `lib/buildings.js` — grounding facts read straight from the frontend's `src/data/campus.js`, so
  the guide can never describe a building differently from the map.
- `lib/building-classifications.js` — loads and serves the classification snapshot to the tools.
- `lib/speech.js` — ElevenLabs text-to-speech and Scribe transcription; returns base64 MP3 or
  `null` on failure, so a speech outage never blocks the text reply.
