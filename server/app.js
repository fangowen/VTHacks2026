import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { askGemini, geminiConfigured, geminiModel } from "./lib/gemini.js";
import { speak, transcribe, speechConfigured, speechModel, transcriptionModel } from "./lib/speech.js";
import { resolveBuilding } from "./lib/building-resolver.js";

const PORT = Number(process.env.PORT || 8787);
const MAX_MESSAGE_CHARS = Number(process.env.MAX_MESSAGE_CHARS || 1000);
const MAX_HISTORY_TURNS = Number(process.env.MAX_HISTORY_TURNS || 10);
const MAX_CONTEXT_CHARS = 120;
const MAX_BUILDINGS = 500;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);               // correct client IPs for rate limiting behind a proxy

// CORS: only our frontend's origin(s). ALLOWED_ORIGINS is a comma-separated list.
// The default covers the dev servers people usually reach for (python http.server, serve, vite).
const DEFAULT_ORIGINS = "http://localhost:8000,http://localhost:3000,http://localhost:5173,http://localhost:5500";
const configuredOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
  .split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

// localhost, 127.0.0.1 and ::1 are the same machine, so accept all three for a configured port
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];
function withLoopbackAliases(origin) {
  try {
    const u = new URL(origin);
    if (!LOOPBACK.includes(u.hostname) && u.hostname !== "::1") return [origin];
    return LOOPBACK.map((host) => `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}`);
  } catch { return [origin]; }
}
const allowed = [...new Set(configuredOrigins.flatMap(withLoopbackAliases))];

// In development any loopback origin is accepted, whatever port the dev server picked — a page on
// localhost can only be served from this machine. Set CORS_STRICT=true (do this in production)
// to enforce the ALLOWED_ORIGINS list exactly.
const STRICT = String(process.env.CORS_STRICT || "").toLowerCase() === "true";
function isLoopback(origin) {
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:")
      && ["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"].includes(u.hostname);
  } catch { return false; }
}

app.use(cors({
  origin(origin, done) {
    if (!origin) return done(null, true);          // curl / same-origin requests have no Origin
    if (allowed.includes(origin.replace(/\/$/, ""))) return done(null, true);
    if (!STRICT && isLoopback(origin)) return done(null, true);   // any local dev server port
    // Say exactly what was rejected and how to fix it — this is almost always a port mismatch
    const hint = origin === "null"
      ? "The page was opened from the file system. Serve it over http:// instead."
      : `Add it to ALLOWED_ORIGINS in server/.env, e.g. ALLOWED_ORIGINS=${origin}`;
    console.warn(`[cors_denied] ${origin} is not allowed. Allowed: ${allowed.join(", ")}. ${hint}`);
    return done(Object.assign(new Error(`Origin ${origin} is not allowed by this server. ${hint}`),
      { status: 403, code: "cors_denied" }));
  },
  methods: ["GET", "POST"],
}));

app.use(express.json({ limit: "32kb" }));

app.use("/api/", rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  limit: Number(process.env.RATE_LIMIT_MAX || 20),   // per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
}));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    gemini: geminiConfigured() ? geminiModel() : null,
    speech: speechConfigured() ? speechModel() : null,
    transcription: process.env.ELEVENLABS_API_KEY ? transcriptionModel() : null,
    allowedOrigins: allowed,
    loopbackAllowed: !STRICT,
  });
});

/** Validate and normalize the request body; throws a 400 with a readable message. */
function parseGuideRequest(body) {
  const fail = (msg) => { throw Object.assign(new Error(msg), { status: 400, code: "bad_request" }); };
  if (!body || typeof body !== "object") fail("Request body must be JSON.");

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) fail("A non-empty 'message' string is required.");
  if (message.length > MAX_MESSAGE_CHARS) fail(`'message' must be ${MAX_MESSAGE_CHARS} characters or fewer.`);

  const language = typeof body.language === "string" && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(body.language)
    ? body.language.slice(0, 2).toLowerCase() : "en";

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .filter((turn) => turn && typeof turn.text === "string" && turn.text.trim())
    .slice(-MAX_HISTORY_TURNS)                       // keep only the most recent turns
    .map((turn) => ({
      role: turn.role === "assistant" || turn.role === "bot" || turn.role === "model" ? "assistant" : "user",
      text: turn.text.trim().slice(0, MAX_MESSAGE_CHARS),
    }));

  const context = typeof body.context === "string" ? body.context.trim().slice(0, MAX_CONTEXT_CHARS) : "";
  const buildings = [...new Set((Array.isArray(body.buildings) ? body.buildings : [])
    .filter((name) => typeof name === "string")
    .map((name) => name.trim().slice(0, MAX_CONTEXT_CHARS))
    .filter(Boolean)
    .slice(0, MAX_BUILDINGS))];
  return { message, language, history, context, buildings };
}

function locationFailure(language, requested, candidates = null) {
  const lang = String(language || "en").slice(0, 2).toLowerCase();
  const choices = candidates?.join(", ");
  const ambiguous = {
    en: `I found several close matches. Which one did you mean: ${choices}?`,
    es: `Encontré varias coincidencias cercanas. ¿Cuál quisiste decir: ${choices}?`,
    zh: `我找到了几个相近的地点。你指的是哪一个：${choices}？`,
    hi: `मुझे मिलते-जुलते कई भवन मिले। आपका मतलब इनमें से किससे है: ${choices}?`,
    ko: `비슷한 건물이 여러 개 있어요. 어느 곳을 말한 건가요: ${choices}?`,
  };
  const missing = {
    en: `I couldn't find “${requested}” in the campus map, so I left the camera where it was.`,
    es: `No pude encontrar “${requested}” en el mapa del campus, así que dejé la cámara donde estaba.`,
    zh: `我在校园地图上找不到“${requested}”，所以相机保持在原位。`,
    hi: `मुझे कैंपस मानचित्र पर “${requested}” नहीं मिला, इसलिए कैमरा वहीं रखा है।`,
    ko: `캠퍼스 지도에서 “${requested}”을(를) 찾지 못해서 카메라는 그대로 두었어요.`,
  };
  return candidates?.length ? (ambiguous[lang] ?? ambiguous.en) : (missing[lang] ?? missing.en);
}

function parseSpeechRequest(body) {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) throw Object.assign(new Error("A non-empty 'text' string is required."), { status: 400, code: "bad_request" });
  if (text.length > MAX_MESSAGE_CHARS) {
    throw Object.assign(new Error(`'text' must be ${MAX_MESSAGE_CHARS} characters or fewer.`), { status: 400, code: "bad_request" });
  }
  return text;
}

app.post("/api/guide", async (req, res, next) => {
  try {
    const { message, language, history, context, buildings } = parseGuideRequest(req.body);
    const reply = await askGemini({ message, language, history, context, buildings });
    let text = reply.text;
    let action = null;
    if (reply.action.type === "flyTo") {
      const resolved = resolveBuilding(reply.action.building, buildings);
      if (resolved.status === "match") {
        action = { type: "flyTo", building: resolved.name };
      } else if (resolved.status === "ambiguous") {
        text = locationFailure(language, reply.action.building, resolved.candidates);
      } else {
        text = locationFailure(language, reply.action.building || message);
      }
    }
    const { audio, error: speechError } = await speak(text);   // best effort: text still returns
    if (speechError) console.warn(`[speech] Audio unavailable: ${speechError}`);
    res.json({ text, action, audio, speechError });
  } catch (err) {
    next(err);
  }
});

// One speech path for the whole app: Listen buttons, local guide replies, navigation prompts,
// arrival announcements and the public hokie.speak() API all call this ElevenLabs endpoint.
app.post("/api/speech", async (req, res, next) => {
  try {
    const text = parseSpeechRequest(req.body);
    const { audio, error } = await speak(text);
    if (error || !audio) {
      const unavailable = error === "elevenlabs_unconfigured" || error === "elevenlabs_no_voice_id";
      throw Object.assign(new Error(error || "elevenlabs_empty_audio"), {
        status: unavailable ? 503 : 502,
        code: error || "elevenlabs_empty_audio",
      });
    }
    res.json({ audio });
  } catch (err) {
    next(err);
  }
});

// Browser MediaRecorder sends its encoded audio directly. Keeping this as a raw body avoids
// base64 inflation and prevents provider credentials from ever reaching the frontend.
app.post("/api/transcribe", express.raw({
  type: ["audio/*", "video/webm", "application/octet-stream"],
  limit: "8mb",
}), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) {
      throw Object.assign(new Error("A non-empty audio recording is required."), { status: 400, code: "bad_request" });
    }
    const rawLanguage = typeof req.query.language === "string" ? req.query.language : "en";
    const language = /^[a-z]{2,3}$/i.test(rawLanguage) ? rawLanguage.toLowerCase() : "en";
    const mimeType = String(req.headers["content-type"] || "audio/webm").split(";")[0];
    const { text, error } = await transcribe(req.body, { mimeType, language });
    if (error || !text) {
      const unavailable = error === "elevenlabs_unconfigured";
      throw Object.assign(new Error(error || "transcription_empty"), {
        status: unavailable ? 503 : 502,
        code: error || "transcription_empty",
      });
    }
    res.json({ text });
  } catch (err) {
    next(err);
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// Everything reaches the client as JSON { error }, never a stack trace.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  // Known conditions (misconfiguration, timeouts) log one line; only surprises get a stack.
  // CORS denials already logged themselves with the allowlist, so don't repeat them.
  if (err.code && err.code !== "cors_denied") console.warn(`[${err.code}] ${err.message}`);
  else if (status >= 500) console.error("[error]", err);
  const messages = {
    gemini_unconfigured: "The guide isn't configured on the server yet.",
    gemini_timeout: "The guide took too long to answer. Please try again.",
    gemini_empty: "The guide couldn't come up with an answer. Please try again.",
    gemini_invalid: "The guide returned a response the server couldn't understand. Please try again.",
    gemini_bad_model: `The configured Gemini model (${geminiModel()}) is not available.`,
    gemini_bad_key: "The Gemini API key was rejected by the provider.",
    gemini_failed: "Gemini returned an error. Check the guide server log for details.",
    elevenlabs_unconfigured: "ElevenLabs is not configured on the server.",
    elevenlabs_no_voice_id: "The ElevenLabs voice ID is missing on the server.",
    elevenlabs_empty_audio: "ElevenLabs returned no audio.",
    elevenlabs_failed: "ElevenLabs could not generate speech. Check the guide server log for details.",
    transcription_empty: "No speech was detected in that recording.",
    transcription_failed: "ElevenLabs could not transcribe the recording. Check the guide server log for details.",
  };
  res.status(status).json({ error: messages[err.code] ?? (status < 500 ? err.message : "Something went wrong on the guide server.") });
});

// Express 5 reports listen failures to the callback instead of emitting an
// unhandled `error` event. Check that argument before announcing success so a
// busy/forbidden port cannot look like a server that started and then quit.
app.listen(PORT, (error) => {
  if (error) {
    const address = `http://localhost:${PORT}`;
    if (error.code === "EADDRINUSE") {
      console.error(`Cannot start Hokie Guide: port ${PORT} is already in use (${address}).`);
      console.error(`Another guide server may already be running. Check ${address}/api/health`);
    } else if (error.code === "EACCES" || error.code === "EPERM") {
      console.error(`Cannot start Hokie Guide on ${address}: ${error.code} (${error.message}).`);
    } else {
      console.error("Failed to start the Hokie Guide server:", error);
    }
    process.exitCode = 1;
    return;
  }

  const geminiTimeout = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
  if (geminiTimeout < 20000) {
    console.warn(`  ⚠ GEMINI_TIMEOUT_MS is ${geminiTimeout}ms. Replies often take 7-15s (longer for`);
    console.warn(`    non-Latin scripts), so raise it to 30000 in .env or requests will 504.`);
  }
  console.log(`Hokie Guide server listening on http://localhost:${PORT}`);
  console.log(`  CORS origins : ${allowed.join(", ")}${STRICT ? " (strict)" : " + any localhost port (dev; set CORS_STRICT=true to lock down)"}`);
  console.log(`  Gemini       : ${geminiConfigured() ? geminiModel() : "NOT CONFIGURED (set GEMINI_API_KEY)"}`);
  console.log(`  ElevenLabs   : ${speechConfigured() ? speechModel() : "NOT CONFIGURED (set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID)"}`);
});
