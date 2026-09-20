# Hokie War Table — personalized campus orientation

A 3D diorama of Virginia Tech's campus with a multilingual AI guide that answers questions,
walks you to buildings along real campus paths, and builds a personalized first week.

## Run it

ES modules need to be served over HTTP (opening `index.html` from the file system will load the
map but not the orientation layer). The map runs with no backend; the AI guide needs the
server in `server/` (Node 18+):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

`vt-campus.json` is a saved OpenStreetMap snapshot of campus, so the app works offline and doesn't
depend on Overpass being up during judging. To refresh it, delete the file, reload (the page falls
back to a live Overpass query), then run `downloadCampusData()` in the console and save the result
next to `index.html`.

## What's where

| File | Responsibility |
| --- | --- |
| `index.html` | The existing 3D map: OSM parsing, building grouping, camera, tilt-shift. Exposes a `mapApi` and calls `startApp()`. |
| `src/app.js` | Orchestrator. Owns state (profile, location, selection) and wires everything together. |
| `src/places.js` | Joins map building records to campus metadata; lookup, proximity, door points. |
| `src/data/campus.js` | Building info, dining, clubs, events, resources, majors and schedules. |
| `src/routing.js` | Walking graph from the map's OSM paths, A\*, step-free routing. |
| `src/navigation.js` | Route ribbon, walking guide marker, follow camera, pause/resume/skip/recenter. |
| `src/ai.js` | Local schedule/recommendation intents plus Gemini's structured building actions. |
| `src/api.js` | Client for our backend (`POST /api/guide` and `POST /api/speech`). Uses the page hostname on port 8787, with an optional `window.HOKIE_GUIDE_API_URL` override. |
| `src/voice.js` | Records click-to-talk audio, sends it to ElevenLabs Scribe, and plays all spoken replies from ElevenLabs. |
| `server/` | Express backend: Gemini reply + ElevenLabs speech. Holds the API keys. |
| `src/itinerary.js` | "My First Week" generator. |
| `src/recommendations.js` | Clubs, events, dining, study spots, resources — each with a reason. |
| `src/i18n.js` | Every string in English, Spanish, Mandarin, Hindi and Korean. |
| `src/ui.js`, `src/app.css` | Panels, assistant, HUD, onboarding. |

The map is the source of truth for geometry. Campus metadata links to it by `mapObjectId`
(the OSM element id of a building's largest part, e.g. `relation/1074686`), never by duplicating
coordinates.

## Backend (AI features)

The frontend holds no provider keys. The Hokie Guide server in [`server/`](server/README.md)
owns them: it sends the student's message to **Gemini**, speaks the reply with **ElevenLabs**,
and returns both. See `server/README.md` for setup; the short version:

```bash
cd server && npm install && cp .env.example .env   # then fill in the two API keys
npm start                                          # http://localhost:8787

# in another terminal, from the repo root:
python3 -m http.server 8000                        # http://localhost:8000
```

In local development the frontend mirrors its own hostname on port 8787 (`localhost` stays
`localhost`, and `127.0.0.1` stays `127.0.0.1`). A deployment can set
`window.HOKIE_GUIDE_API_URL` before `src/api.js` loads.

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /api/guide` | `{ message, language, history, context, buildings }` | `{ text, action, audio, speechError }` |
| `POST /api/speech` | `{ text, language }` | `{ audio (base64 mp3) }` |
| `POST /api/transcribe?language=en` | Raw browser audio | `{ text }` |
| `GET /api/health` | — | `{ ok, gemini, speech }` |

Schedule, dining, study, club and event recommendations can be answered locally. Building-location
requests use Gemini's multilingual structured action, which the server resolves against the exact
directory sent by the live map before the frontend flies to it. Spoken replies go through
ElevenLabs. If the backend is down or unconfigured, captions and the rest of the map keep working.

## Console API

```js
hokie.ask("take me to my next class")   // full assistant pipeline
hokie.goTo("Newman Library")            // walk there
hokie.show("Burruss Hall")              // highlight + info panel
hokie.setLanguage("es")                 // en | es | zh | hi | ko
hokie.itinerary()                       // generated first week
hokie.route("Pritchard Hall", "McBryde Hall")
```

The original map API is unchanged: `flyTo(name, note)`, `overview()`, `listBuildings()`,
`downloadCampusData()`, `debugBuildings()`, `debugBuilding(name)`.

## Demo script

1. Open the page → onboarding appears → **Use demo profile** (CS major, Pritchard Hall,
   hackathons/gaming/fitness). **Start here** on any building moves the route's origin
   instantly, clears any active route, and waits for a new destination. The selected destination
   keeps the single maroon flag; there is no separate location pointer.
2. **My Week** fills in with a schedule-aware first week.
3. Ask *"Where is my first CS class?"* → McBryde Hall, with walk time.
4. **Take me there** → the route draws, the camera eases onto the guide bird, and the bird walks
   the route head-first while the camera keeps it centered (orbit and zoom stay yours).
   The **Speed** slider (0.5×–3×) changes pace mid-trip, and **Bird's-eye view** pulls out to
   frame the whole route while the bird keeps walking.
5. On arrival the building panel opens and the guide notices the gap before the next class and
   suggests Newman Library.
6. *"Take me there"* → it walks you to the library.
7. Switch the language to 中文 or Español and repeat — replies and building descriptions
   all change.
8. Turn on ♿ step-free routing and walk somewhere with stairs — the route changes and the guide
   explains the difference.

## Data caveat

Descriptions, hours, clubs, events and accessibility details are prototype data written for the
demo. Building names, footprints and walking paths come from OpenStreetMap. Verify anything
student-facing against Virginia Tech's official sources before real use.
