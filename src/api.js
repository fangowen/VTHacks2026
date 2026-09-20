// Backend API client.
//
// The frontend holds no provider keys: the Hokie Guide server (see /server) owns them and calls
// Gemini and ElevenLabs on our behalf.

/**
 * Single place to point the frontend at the backend. A deployment can set
 * `window.HOKIE_GUIDE_API_URL` before this module loads. In local development we mirror the
 * page hostname, avoiding the easy-to-miss localhost vs 127.0.0.1 mismatch.
 */
const configuredBase = globalThis.HOKIE_GUIDE_API_URL;
const pageHost = globalThis.location?.hostname || "localhost";
const pageProtocol = globalThis.location?.protocol === "https:" ? "https:" : "http:";
export const API_BASE_URL = typeof configuredBase === "string"
  ? configuredBase.replace(/\/$/, "")
  : `${pageProtocol}//${pageHost}:8787`;

const REQUEST_TIMEOUT_MS = 40000;   // must outlast the server's Gemini timeout (30s)

export const apiAvailable = () => !!API_BASE_URL;

async function postJSON(path, body) {
  if (!API_BASE_URL) return null;                 // not configured: callers fall back quietly
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // The server always answers with { error } — surface that wording to the user
      const detail = data?.error || `Request failed (${res.status})`;
      throw Object.assign(new Error(`The guide service returned an error: ${detail}`), { status: res.status, kind: "service" });
    }
    if (!data || typeof data !== "object") {
      throw Object.assign(new Error("The guide service returned an invalid response."), { status: res.status, kind: "service" });
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw Object.assign(new Error("The guide took too long to answer."), { kind: "timeout" });
    // fetch() rejects with a TypeError when it never reached the server at all: it's down,
    // on a different port, or the browser blocked the request (CORS).
    if (err instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(err.message)) {
      throw Object.assign(
        new Error(`Can't reach the guide server at ${API_BASE_URL}. Start it with “cd server && npm start”, then check that /api/health loads and ALLOWED_ORIGINS includes ${globalThis.location?.origin || "this page's origin"}.`),
        { kind: "unreachable" });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the Hokie Guide. The server is stateless, so we send the recent turns with each message.
 *
 * POST /api/guide
 *   request:  { message, language, history: [{ role: "user"|"assistant", text }], context }
 *   response: { text, audio (base64 mp3 or null), speechError }
 *
 * @returns {Promise<{text: string, audio: string|null}|null>} null when no backend is configured.
 */
export async function askGuide({ message, language = "en", history = [], context = "" }) {
  const data = await postJSON("/api/guide", { message, language, history, context });
  if (!data?.text) return null;
  return { text: data.text, audio: data.audio ?? null, speechError: data.speechError ?? null };
}

/** Convert any app text to speech through the server's configured ElevenLabs voice. */
export async function synthesizeSpeech(text, language = "en") {
  const data = await postJSON("/api/speech", { text, language });
  if (!data?.audio) {
    throw Object.assign(new Error("The speech service returned no audio."), { kind: "service" });
  }
  return data.audio;
}

/** Upload a short microphone recording for ElevenLabs Scribe transcription. */
export async function transcribeAudio(audio, language = "en") {
  if (!API_BASE_URL) throw Object.assign(new Error("The voice service is not configured."), { kind: "unreachable" });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const mimeType = audio?.type || "application/octet-stream";
    const res = await fetch(`${API_BASE_URL}/api/transcribe?language=${encodeURIComponent(language)}`, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: audio,
      signal: abort.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.error || `Request failed (${res.status})`;
      throw Object.assign(new Error(`The voice service returned an error: ${detail}`), { status: res.status, kind: "service" });
    }
    if (!data?.text) throw Object.assign(new Error("The voice service returned no transcript."), { kind: "service" });
    return data.text;
  } catch (err) {
    if (err.name === "AbortError") throw Object.assign(new Error("Voice transcription took too long."), { kind: "timeout" });
    if (err instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(err.message)) {
      throw Object.assign(new Error(`Can't reach the voice server at ${API_BASE_URL}.`), { kind: "unreachable" });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth() {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

/**
 * One-time cleanup: earlier builds let students paste provider keys into the browser.
 * Those are no longer used, so drop anything left in this browser's storage.
 */
export function purgeLegacyKeys() {
  for (const k of ["hokie.elevenlabs.key", "hokie.claude.key"]) {
    try { localStorage.removeItem(k); } catch {}
  }
}
