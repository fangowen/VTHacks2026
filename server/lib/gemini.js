// Gemini text generation via the Interactions API (@google/genai).
// Stateless: the client sends the recent turns, we replay them as input steps and never store.

import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "./prompt.js";

// flash-lite answers these short guide questions in ~5s; the bigger flash models are tuned for
// long-horizon agentic work and averaged ~9-30s here, which is too slow for a spoken reply.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);   // flash models take ~7-15s for a short reply

let client = null;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

const step = (role, text) => ({
  type: role === "assistant" || role === "bot" || role === "model" ? "model_output" : "user_input",
  content: [{ type: "text", text }],
});

/**
 * @param {{message: string, language?: string, history?: {role: string, text: string}[], context?: string}} req
 * @returns {Promise<string>} the guide's reply text
 */
export async function askGemini({ message, language = "en", history = [], context = "" }) {
  const ai = getClient();
  if (!ai) throw Object.assign(new Error("Gemini is not configured on this server"), { status: 503, code: "gemini_unconfigured" });

  const input = [...history.map((turn) => step(turn.role, turn.text)), step("user", message)];

  // The SDK has no per-call timeout, so race it and surface a clean 504 instead of hanging.
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(Object.assign(new Error("Gemini timed out"), { status: 504, code: "gemini_timeout" })), TIMEOUT_MS);
  });

  let interaction;
  try {
    interaction = await Promise.race([
      ai.interactions.create({
        model: MODEL,
        system_instruction: buildSystemPrompt({ language, context }),
        store: false,                     // stateless: nothing is kept on Google's side
        input,
        generation_config: { temperature: 0.7, thinking_level: "low" },
      }),
      timeout,
    ]);
  } catch (err) {
    if (err.code === "gemini_timeout") throw err;
    // Log what Gemini actually said — status, message and body are all useful when debugging
    const status = err?.status ?? err?.code ?? "unknown";
    console.error(`[gemini] request failed (model=${MODEL}, status=${status}): ${err?.message || err}`);
    if (err?.response) console.error("[gemini] response:", JSON.stringify(err.response).slice(0, 500));
    const badModel = /not found|unsupported|invalid.*model|404/i.test(String(err?.message));
    const badKey = /api key|unauthenticated|permission|401|403/i.test(String(err?.message));
    throw Object.assign(new Error(err?.message || "Gemini request failed"), {
      status: badKey ? 502 : badModel ? 502 : 502,
      code: badModel ? "gemini_bad_model" : badKey ? "gemini_bad_key" : "gemini_failed",
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = (interaction?.output_text ?? "").trim();
  if (!text) throw Object.assign(new Error("Gemini returned an empty reply"), { status: 502, code: "gemini_empty" });
  return text;
}

export const geminiModel = () => MODEL;
