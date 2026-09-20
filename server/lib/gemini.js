import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "./prompt.js";
import { GUIDE_TOOLS, buildCatalog, executeGuideTool } from "./guide-tools.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
const MAX_TOOL_ROUNDS = 8;

let client = null;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

function historyForChat(history) {
  return history.map((turn) => ({
    role: turn.role === "assistant" || turn.role === "bot" || turn.role === "model" ? "model" : "user",
    parts: [{ text: turn.text }],
  }));
}

function deadline(promise, started) {
  const remaining = Math.max(1, TIMEOUT_MS - (Date.now() - started));
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("Gemini timed out"), { status: 504, code: "gemini_timeout" })), remaining);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function providerError(err) {
  if (err.code === "gemini_timeout" || err.code === "gemini_empty" || err.code === "gemini_tool_limit" || err.code === "bad_request") return err;
  const status = err?.status ?? err?.code ?? "unknown";
  console.error(`[gemini] request failed (model=${MODEL}, status=${status}): ${err?.message || err}`);
  if (err?.response) console.error("[gemini] response:", JSON.stringify(err.response).slice(0, 1000));
  const badModel = /not found|unsupported|invalid.*model|404/i.test(String(err?.message));
  const badKey = /api key|unauthenticated|permission|401|403/i.test(String(err?.message));
  return Object.assign(new Error(err?.message || "Gemini request failed"), {
    status: 502,
    code: badModel ? "gemini_bad_model" : badKey ? "gemini_bad_key" : "gemini_failed",
  });
}

/** Run one stateless guide request with a server-validated Gemini tool loop. */
export async function askGemini({ message, language = "en", history = [], buildings = [], currentLocation = null, studentContext = {} }) {
  const ai = getClient();
  if (!ai) throw Object.assign(new Error("Gemini is not configured on this server"), { status: 503, code: "gemini_unconfigured" });

  const state = { catalog: buildCatalog(buildings), currentLocation, studentContext, action: null };
  if (!state.catalog.length) throw Object.assign(new Error("The live building directory is empty"), { status: 400, code: "bad_request" });

  const functionDeclarations = GUIDE_TOOLS.map(({ type: _type, parameters, ...tool }) => ({
    ...tool,
    parametersJsonSchema: parameters,
  }));
  const chat = ai.chats.create({
    model: MODEL,
    history: historyForChat(history),
    config: {
      systemInstruction: buildSystemPrompt({ language }),
      tools: [{ functionDeclarations }],
      temperature: 0.2,
    },
  });

  const started = Date.now();
  try {
    let response = await deadline(chat.sendMessage({ message }), started);
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const calls = response.functionCalls ?? [];
      if (!calls.length) {
        const text = String(response.text ?? "").trim();
        if (!text) throw Object.assign(new Error("Gemini returned an empty reply"), { status: 502, code: "gemini_empty" });
        return { text, action: state.action };
      }

      const functionResponses = calls.map((call) => {
        const result = executeGuideTool({ name: call.name, arguments: call.args }, state);
        console.info(`[guide_tool] ${call.name} ${JSON.stringify(call.args ?? {})} -> ${JSON.stringify(result).slice(0, 600)}`);
        return {
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name: call.name,
            response: result?.error ? { error: result } : { output: result },
          },
        };
      });
      response = await deadline(chat.sendMessage({ message: functionResponses }), started);
    }
    throw Object.assign(new Error("Gemini exceeded the tool-call limit"), { status: 502, code: "gemini_tool_limit" });
  } catch (err) {
    throw providerError(err);
  }
}

export const geminiModel = () => MODEL;
