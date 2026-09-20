// Voice in/out. Every spoken line uses the server's configured ElevenLabs voice; the browser's
// speech-recognition API remains responsible only for microphone input.

import { synthesizeSpeech, transcribeAudio } from "./api.js";

const state = { muted: false, lastError: null };
let currentAudio = null, playbackGeneration = 0;
const playingListeners = new Set();

/** Notified with true/false as audio starts and stops, so the UI can show a stop button. */
export function onSpeakingChange(fn) { playingListeners.add(fn); return () => playingListeners.delete(fn); }
const setPlaying = (on) => { for (const fn of playingListeners) fn(on); };

export function configureVoice({ muted } = {}) {
  if (muted !== undefined) { state.muted = muted; if (muted) stopSpeaking(); }
  return voiceState();
}

export function voiceState() {
  return { muted: state.muted, provider: state.muted ? "off" : "elevenlabs", lastError: state.lastError };
}

export function stopSpeaking() {
  playbackGeneration += 1;                 // also invalidates speech requests still in flight
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
  setPlaying(false);
}

/** Play the MP3 the guide server returned. Interrupts anything already speaking. */
export async function playSpokenReply(base64Mp3) {
  if (!base64Mp3 || state.muted) return false;
  stopSpeaking();
  const generation = playbackGeneration;
  try {
    const audio = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
    currentAudio = audio;
    audio.onended = audio.onerror = () => { if (currentAudio === audio) { currentAudio = null; setPlaying(false); } };
    await audio.play();
    if (generation !== playbackGeneration) { audio.pause(); return false; }
    state.lastError = null;
    setPlaying(true);
    return true;
  } catch (err) {
    state.lastError = String(err.message || err);
    console.warn("Could not play the guide's audio:", err);
    setPlaying(false);
    return false;
  }
}

/** Ask ElevenLabs to speak a line. Later calls interrupt or invalidate earlier ones. */
export async function speakText(text, lang = "en") {
  if (!text || state.muted) return false;
  stopSpeaking();
  const generation = playbackGeneration;
  try {
    const audio = await synthesizeSpeech(text, lang);
    if (generation !== playbackGeneration || state.muted) return false;
    return playSpokenReply(audio);
  } catch (err) {
    if (generation !== playbackGeneration) return false;
    state.lastError = String(err.message || err);
    console.warn("ElevenLabs speech unavailable:", err);
    setPlaying(false);
    return false;
  }
}

/**
 * Click-to-talk capture for the guide. Audio stays in memory, is capped at 30 seconds, and is
 * sent to our backend for ElevenLabs Scribe transcription only after the user stops recording.
 */
export function createVoiceCapture(lang, { onStart, onTranscribing, onResult, onError, onEnd } = {}) {
  let recorder = null, stream = null, timer = null, cancelled = false;
  const chunks = [];

  const cleanup = () => {
    clearTimeout(timer);
    for (const track of stream?.getTracks?.() ?? []) track.stop();
    stream = null;
  };

  return {
    async start() {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
        onError?.(new Error("voice_capture_unsupported"));
        onEnd?.();
        return false;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) { cleanup(); onEnd?.(); return false; }
        const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
          .find((type) => MediaRecorder.isTypeSupported?.(type));
        recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.onerror = (event) => {
          onError?.(event.error || new Error("voice_capture_failed"));
          if (recorder?.state === "recording") recorder.stop();
        };
        recorder.onstop = async () => {
          cleanup();
          if (cancelled || !chunks.length) { onEnd?.(); return; }
          onTranscribing?.();
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0].type || "audio/webm" });
            const text = await transcribeAudio(blob, lang);
            onResult?.(text);
          } catch (err) {
            onError?.(err);
          } finally {
            onEnd?.();
          }
        };
        recorder.start(250);
        timer = setTimeout(() => this.stop(), 30_000);
        onStart?.();
        return true;
      } catch (err) {
        cleanup();
        onError?.(err);
        onEnd?.();
        return false;
      }
    },
    stop() {
      if (recorder?.state === "recording") recorder.stop();
      else { cancelled = true; cleanup(); }
    },
    get recording() { return recorder?.state === "recording"; },
  };
}
