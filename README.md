# WHERE THE HOKIE AM I? — personalized campus orientation

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
| `src/navigation.js` | Route ribbon, walking guide bird, follow camera, bird's-eye view, speed (0.5×–3×), pause/resume/skip. |
| `src/ai.js` | Sends guide questions and live campus context to Gemini, then applies validated building actions. |
| `src/api.js` | Client for our backend (`POST /api/guide` and `POST /api/speech`). Uses the page hostname on port 8787, with an optional `window.HOKIE_GUIDE_API_URL` override. |
| `src/voice.js` | Records click-to-talk audio, sends it to ElevenLabs Scribe, and plays all spoken replies from ElevenLabs. |
| `server/` | Express backend: Gemini reply + ElevenLabs speech. Holds the API keys. |
| `src/itinerary.js` | "My First Week": the student's class schedule with the walking leg before each class. |
| `src/recommendations.js` | Clubs, events, dining, study spots, resources — each with a reason. |
| `src/profile.js` | Student profile, the demo clock, and schedule lookups. Persisted to `localStorage`. |
| `src/data/building-images.js` | Photo manifest: file, alt text, author, license and source per building. |
| `src/i18n.js` | Every string in English, Spanish, Mandarin, Hindi and Korean. |
| `src/ui.js`, `src/app.css` | Panels, assistant, HUD, onboarding. |

The map is the source of truth for geometry. Campus metadata links to it by `mapObjectId`
(the OSM element id of a building's largest part, e.g. `relation/1074686`), never by duplicating
coordinates.

## Building photos

26 buildings have a photo in the info panel, served from `images/buildings/` — nothing is hotlinked.
Every photo is public domain or a Creative Commons licence, and `src/data/building-images.js`
carries the author, licence, licence URL and Commons source for each one. The panel renders a
credit line linking to both the source page and the licence.

Adding one: download the file into `images/buildings/`, add an entry keyed by the **exact map
building name**, and write alt text describing what the photo shows. Open the image and confirm it
really is that building before writing alt text — Commons filenames are unreliable, and several
candidates turned out to be construction sites, distant skylines or the wrong building. A building
with no verified free photo simply has no photo; that is the intended state, not a gap to fill.

## Backend (AI features)

The frontend holds no provider keys. WHERE THE HOKIE AM I? server in [`server/`](server/README.md)
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
| `POST /api/guide` | `{ message, language, history, buildings, currentLocation, studentContext }` | `{ text, action, audio, speechError }` |
| `POST /api/speech` | `{ text, language }` | `{ audio (base64 mp3) }` |
| `POST /api/transcribe?language=en` | Raw browser audio | `{ text }` |
| `GET /api/health` | — | `{ ok, gemini, speech, transcription, allowedOrigins, loopbackAllowed }` |

WHERE THE HOKIE AM I? gives Gemini validated tools for current location, student context, building search,
nearest-building ranking, and camera fly-to. The server loads the reviewable classification snapshot,
resolves every building against the live map directory, and returns only validated actions. Spoken
replies go through ElevenLabs. If the backend is down, captions explain that the service is unreachable
while the rest of the map keeps working.

To refresh the saved multi-category building data after changing the OSM snapshot or curated
descriptions, run `cd server && npm run classify:buildings`. The script sends each on-campus
building's name, tags, and description to Gemini, preserves entries marked `manualOverride: true`,
and rewrites `server/data/building-classifications.json` for review.

## Console API

```js
hokie.ask("take me to my next class")   // full assistant pipeline
hokie.goTo("Newman Library")            // walk there
hokie.show("Burruss Hall")              // highlight + info panel
hokie.setLanguage("es")                 // en | es | zh | hi | ko
hokie.itinerary()                       // generated first week
hokie.route("Pritchard Hall", "McBryde Hall")
```

The map API lives on `window`: `flyTo(name, note)`, `overview()`, `listBuildings()`,
`downloadCampusData()`, `debugBuildings()`, `debugBuilding(name)`, plus the diorama and camera
diagnostics `debugCamera()`, `debugTableFrame()` and `debugMarkerSpots([names])`.


## Data caveat

Descriptions, hours, clubs, events and accessibility details are prototype data written for the
demo. Building names, footprints and walking paths come from OpenStreetMap.
