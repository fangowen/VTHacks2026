// Text to speech via ElevenLabs. Speech is best-effort: if it fails or times out the caller
// still returns the text, so captions keep working.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const STT_MODEL = process.env.ELEVENLABS_STT_MODEL_ID || "scribe_v2";
const VOICE = process.env.ELEVENLABS_VOICE_ID || "";
const TIMEOUT_S = Number(process.env.ELEVENLABS_TIMEOUT_MS || 15000) / 1000;
const STT_TIMEOUT_S = Number(process.env.ELEVENLABS_STT_TIMEOUT_MS || 30000) / 1000;
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

let client = null;
function getClient() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  client ??= new ElevenLabsClient({ apiKey });
  return client;
}

export const speechConfigured = () => !!process.env.ELEVENLABS_API_KEY && !!VOICE;

/** The SDK may hand back bytes or a stream depending on version; normalize to a Buffer. */
async function toBuffer(audio) {
  if (!audio) return null;
  if (Buffer.isBuffer(audio)) return audio;
  if (audio instanceof Uint8Array) return Buffer.from(audio);
  if (typeof audio.arrayBuffer === "function") return Buffer.from(await audio.arrayBuffer());
  if (typeof audio[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of audio) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  if (typeof audio.getReader === "function") {        // web ReadableStream
    const reader = audio.getReader(), chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  return null;
}

/**
 * @returns {Promise<{audio: string|null, error: string|null}>} base64 MP3, or null with a reason.
 */
export async function speak(text) {
  const eleven = getClient();
  if (!eleven) return { audio: null, error: "elevenlabs_unconfigured" };
  if (!VOICE) return { audio: null, error: "elevenlabs_no_voice_id" };
  try {
    const audio = await eleven.textToSpeech.convert(
      VOICE,
      { text, modelId: MODEL, outputFormat: OUTPUT_FORMAT },
      { timeoutInSeconds: TIMEOUT_S, maxRetries: 1 },
    );
    const buf = await toBuffer(audio);
    if (!buf?.length) return { audio: null, error: "elevenlabs_empty_audio" };
    return { audio: buf.toString("base64"), error: null };
  } catch (err) {
    console.warn("[speech] ElevenLabs failed:", err?.message || err);
    return { audio: null, error: "elevenlabs_failed" };
  }
}

export const speechModel = () => MODEL;

/**
 * Transcribe a short browser recording with ElevenLabs Scribe.
 * @returns {Promise<{text: string|null, error: string|null}>}
 */
export async function transcribe(audio, { mimeType = "audio/webm", language = "en" } = {}) {
  const eleven = getClient();
  if (!eleven) return { text: null, error: "elevenlabs_unconfigured" };
  try {
    const result = await eleven.speechToText.convert({
      file: {
        data: audio,
        filename: mimeType.includes("mp4") ? "voice.m4a" : "voice.webm",
        contentType: mimeType,
        contentLength: audio.length,
      },
      modelId: STT_MODEL,
      languageCode: language,
      tagAudioEvents: false,
      diarize: false,
    }, { timeoutInSeconds: STT_TIMEOUT_S, maxRetries: 1 });
    const text = String(result?.text || "").trim();
    if (!text) return { text: null, error: "transcription_empty" };
    return { text, error: null };
  } catch (err) {
    console.warn("[transcription] ElevenLabs Scribe failed:", err?.message || err);
    return { text: null, error: "transcription_failed" };
  }
}

export const transcriptionModel = () => STT_MODEL;
