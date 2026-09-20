// Orchestrator: connects the existing 3D map to the orientation features.
// The map (index.html) knows nothing about this file beyond calling startApp(mapApi, data).

import { t, setLang, getLang, onLangChange, fmtDistance, catLabel } from "./i18n.js";
import { PlaceIndex } from "./places.js";
import { buildGraph, walkMinutes } from "./routing.js";
import { createNavigator } from "./navigation.js";
import { createUI } from "./ui.js";
import { handleMessage, arrivalMessage } from "./ai.js";
import { generateWeek } from "./itinerary.js";
import { recommendAll } from "./recommendations.js";
import { speakText, configureVoice, voiceState, createVoiceCapture, playSpokenReply, stopSpeaking, onSpeakingChange } from "./voice.js";
import { purgeLegacyKeys } from "./api.js";
import { loadProfile, saveProfile, clearProfile, clock, DEMO_PROFILE, walksSlowly, needsStepFree, nextClass } from "./profile.js";

export function startApp(map, data) {
  const places = new PlaceIndex(map);
  const graph = buildGraph(data.elements, map.toXY);
  let profile = loadProfile();
  let here = places.byName(profile.residenceHall) ?? places.byId("drillfield") ?? places.all()[0];
  let selected = null, lastSuggested = null, pendingClass = null, week = null;
  let destination = null;        // last place we routed to, so a new start can re-plan the same trip
  const history = [];            // recent chat turns sent to the stateless guide backend
  let voiceCapture = null;

  setLang(profile.language || "en");

  // ---------- Routing helpers ----------
  const stepFree = () => needsStepFree(profile);

  function planRoute(from, to) {
    if (!from || !to) return null;
    const a = places.door(from, to), b = places.door(to, from);
    const opts = { avoidStairs: stepFree() };
    const route = graph.route(a, b, opts);
    if (!route) return null;
    // With step-free routing on, compare against the normal route so we can explain the difference
    let comparison = null;
    if (stepFree()) {
      const plain = graph.route(a, b, { avoidStairs: false });
      if (plain) comparison = {
        stairsAvoided: Math.max(0, plain.stairs - route.stairs),
        remaining: route.stairs,                       // some entrances have no step-free approach at all
        extra: Math.max(0, route.distance - plain.distance),
      };
    }
    return { ...route, comparison, minutes: walkMinutes(route.distance, walksSlowly(profile)) };
  }

  function estimate(from, to) {
    if (!from || !to) return { minutes: 0, distanceText: "", route: null };
    const route = planRoute(from, to);
    if (route) return { minutes: route.minutes, distanceText: fmtDistance(route.distance), route };
    const d = places.distance(from, to) * 1.25;      // no path found: straight-line estimate
    return { minutes: walkMinutes(d, walksSlowly(profile)), distanceText: fmtDistance(d), route: null };
  }

  const ctx = () => ({
    places, profile, clock, here, selected, lastSuggested, estimate, history: history.slice(-10),
    slowWalk: walksSlowly(profile),
    nextClassPlace: (() => {
      const n = nextClass(profile, clock.now());
      return n ? places.byName(n.cls.building) : null;
    })(),
  });

  // ---------- Voice ----------
  const speak = (text) => speakText(text, getLang());
  const narrate = (text) => { if (!voiceState().muted) speak(text); };

  // ---------- Navigation ----------
  let ui;
  const nav = createNavigator(map, {
    getInsets: () => ui?.mapInsets?.() ?? { left: 0, right: 0, top: 0, bottom: 0 },
    onViewChange: (view) => ui.setTravelView?.(view),
    onProgress: ({ remaining, total, paused }) => {
      ui.updateHud({ remaining, total, paused, minutes: walkMinutes(remaining, walksSlowly(profile)) });
    },
    onArrive: (place, minutes) => {
      here = place;
      ui.hideHud();
      if (place.building) map.focusBuilding(place.building, null, { fly: true, emit: false });
      ui.showPlace(place);
      clock.advance(minutes);
      const { text, suggest } = arrivalMessage(ctx(), place, pendingClass);
      pendingClass = null;
      lastSuggested = suggest ?? lastSuggested;
      ui.addMessage({
        role: "bot", text,
        actions: suggest ? [{ label: `${t("takeMeThere")}: ${suggest.name}`, onClick: () => navigateTo(suggest) }] : [],
      });
      narrate(text);
    },
  });

  function navigateTo(place, forClass = null) {
    if (!place) return;
    if (place === here) { selectPlace(place); return; }
    const route = planRoute(here, place);
    pendingClass = forClass;
    selected = place;
    if (place.building) map.focusBuilding(place.building, null, { fly: false, emit: false });
    if (!route) {                                    // no walkable path found: fall back to a fly-over
      ui.addMessage({ role: "bot", text: t("a_navStart", { place: place.name, ...estimateText(place) }) });
      if (place.building) map.focusBuilding(place.building);
      here = place;
      nav.placeBird(place);
      return;
    }
    destination = place;
    ui.showHud(here.name, place.name);
    nav.start({ route, from: here, to: place, minutes: route.minutes });

    if (route.comparison) {
      const c = route.comparison;
      const parts = [];
      if (c.stairsAvoided > 0) parts.push(t("a_accessRoute", { n: c.stairsAvoided, extra: c.extra > 15 ? t("a_accessLonger", { m: Math.round(c.extra) }) : "" }));
      if (c.remaining > 0) parts.push(t("a_stairsOnly"));
      if (parts.length) { const line = parts.join(" "); ui.addMessage({ role: "bot", text: line }); narrate(line); }
    }
  }
  const estimateText = (place) => { const e = estimate(here, place); return { min: e.minutes, dist: e.distanceText }; };

  // ---------- Selection ----------
  function selectPlace(place, { fly = true } = {}) {
    if (!place) return;
    selected = place;
    lastSuggested = place;
    if (place.building) map.focusBuilding(place.building, null, { fly, emit: false });
    ui.showPlace(place);
    map.announce(`${place.name}. ${places.description(place)}`);
  }

  /**
   * "Start here": the bird moves to this building straight away — no route, no travel.
   * Any trip in progress is abandoned and the drawn route cleared; the next destination
   * the student picks will be routed from here.
   */
  function setStart(place) {
    if (!place) return;
    if (nav.active) ui.hideHud();          // placeBird abandons the trip itself
    here = place;
    destination = null;                    // nothing queued: wait for the student to choose
    pendingClass = null;
    nav.placeBird(place);                  // teleport + centre the camera, facing campus centre
    ui.hideHud();
    ui.refresh();
    document.documentElement.dataset.travelState = JSON.stringify({
      here: here.name, destination: null, ...nav.debugState(),
    });
    map.announce(t("startSet", { place: place.name }));
    ui.addMessage({ role: "bot", text: t("startSet", { place: place.name }) });
  }

  // ---------- Assistant ----------
  async function send(text) {
    ui.setChat(true);
    stopSpeaking();                       // a new question cuts off whatever is still playing
    ui.addMessage({ role: "me", text });
    ui.setThinking(true);                 // loading state until the guide answers
    let res;
    try {
      res = await handleMessage(text, ctx());
    } catch (err) {
      console.error("Assistant error:", err);
      res = { text: t("a_help") };
    }
    ui.setThinking(false);
    if (!res) return;
    // Recorded after the call: the backend gets prior turns in `history` and this one as `message`
    history.push({ role: "user", text }, { role: "assistant", text: res.text });
    if (history.length > 10) history.splice(0, history.length - 10);
    if (res.focusClass) pendingClass = res.focusClass;
    const target = res.action ? places.byId(res.action.placeId) : null;
    if (res.suggest) lastSuggested = res.suggest;

    const actions = [];
    if (target && res.action.type === "focus") {
      actions.push({ label: t("takeMeThere"), onClick: () => navigateTo(target, res.focusClass ?? null) });
    }
    ui.addMessage({ role: "bot", text: res.text, actions, error: res.isError });
    // The backend returns its reply already spoken; local replies use the browser voice
    if (res.audio) { if (!voiceState().muted) await playSpokenReply(res.audio); }
    else if (!res.isError) narrate(res.text);

    if (target && res.action.type === "navigate") navigateTo(target, res.focusClass ?? null);
    else if (target) selectPlace(target);
  }

  // ---------- UI wiring ----------
  ui = createUI({
    places,
    categories: () => [...map.CATEGORIES, "Landmarks"].filter((c) => places.all().some((p) => (p.categories ?? [p.category]).includes(c))),
    profile: () => profile,
    itinerary: () => (week ??= generateWeek(ctx())),
    recommendations: () => recommendAll(ctx()),
    walkEstimate: (place) => (here && here !== place ? { ...estimate(here, place), from: here.name } : null),
    selectPlace,
    navigateTo,
    setStart,
    isStart: (place) => place === here,
    startName: () => here?.name ?? "",
    send,
    speak,
    nav: {
      toggle: () => nav.toggle(), skip: () => nav.skip(),
      stop: () => { nav.stop(); ui.hideHud(); },
      setSpeed: (factor) => nav.setSpeed(factor),
      getSpeed: () => nav.getSpeed(),
      toggleView: () => nav.toggleView(),
      getView: () => nav.view,
    },
    panCamera: (x, y) => map.panCamera(x, y),
    zoomCamera: (direction) => map.zoomCamera(direction),
    setLanguage(lang) {
      setLang(lang);
      profile = saveProfile({ ...profile, language: lang });
    },
    toggleStepFree() {
      const on = !needsStepFree(profile);
      const needs = new Set(profile.accessibilityNeeds);
      on ? needs.add("stepfree") : needs.delete("stepfree");
      profile = saveProfile({ ...profile, accessibilityNeeds: [...needs] });
      ui.setStepFree(on);
      week = null; ui.refresh();
    },
    setVoice: (opts) => configureVoice(opts),
    stopAudio: () => stopSpeaking(),
    clockState: () => clock.now(),
    setClock(day, minutes) { clock.set(day, minutes); week = null; ui.refresh(); },
    useRealTime() { clock.useRealTime(); ui.refresh(); },
    async startVoiceInput() {
      if (voiceCapture?.recording) { voiceCapture.stop(); return; }
      if (voiceCapture) return;                  // permission prompt or transcription in progress

      stopSpeaking();                            // prevent the guide's voice feeding the microphone
      let capture;
      capture = createVoiceCapture(getLang(), {
        onStart: () => ui.setMicState("recording"),
        onTranscribing: () => ui.setMicState("transcribing"),
        onResult: (text) => send(text),
        onError: (err) => {
          const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
          const unsupported = err?.message === "voice_capture_unsupported";
          ui.addMessage({ role: "bot", text: t(denied ? "micDenied" : unsupported ? "micUnsupported" : "micError"), error: true });
        },
        onEnd: () => {
          if (voiceCapture === capture) voiceCapture = null;
          ui.setMicState(false);
        },
      });
      voiceCapture = capture;
      ui.setMicState("starting");
      const started = await capture.start();
      if (!started && voiceCapture === capture) voiceCapture = null;
    },
    useDemoProfile() {
      profile = saveProfile({ ...DEMO_PROFILE, language: getLang() });
      afterProfileChange();
    },
    saveOnboarding(draft) {
      profile = saveProfile(draft);
      afterProfileChange();
    },
    resetProfile() {
      clearProfile();
      profile = loadProfile();
      week = null;
      ui.openOnboarding(profile);
    },
  });

  function afterProfileChange() {
    week = null;
    here = places.byName(profile.residenceHall) ?? here;
    nav.placeBird(here, { center: false });
    ui.setStepFree(needsStepFree(profile));
    ui.setTab("myWeek");
    const hello = profile.name ? t("a_hello", { name: profile.name }) : t("a_helloAnon");
    ui.addMessage({ role: "bot", text: hello });
    narrate(hello);
  }

  // Map events: clicking or hovering a building in the 3D scene
  map.events.addEventListener("select", (e) => {
    const place = places.forBuilding(e.detail);
    if (place) { selected = place; lastSuggested = place; ui.showPlace(place); }
  });
  map.events.addEventListener("hover", (e) => {
    if (!e.detail) { ui.hideTip(); return; }
    const place = places.forBuilding(e.detail.building);
    ui.showTip(place?.name ?? e.detail.building.name, e.detail.x, e.detail.y);
  });
  map.events.addEventListener("overview", () => { selected = null; ui.hideTip(); });

  onLangChange(() => { week = null; ui.applyLanguage(); });

  // ---------- Go ----------
  onSpeakingChange((playing) => ui.setAudioPlaying(playing));   // shows the stop button
  purgeLegacyKeys();     // provider keys used to live in this browser; they're no longer used
  nav.placeBird(here, { center: false });        // the bird starts at the student's residence hall
  ui.setStepFree(needsStepFree(profile));
  ui.addMessage({ role: "bot", text: profile.name ? t("a_hello", { name: profile.name }) : t("a_helloAnon") });
  if (!profile.onboarded) ui.openOnboarding(profile);
  else { ui.setChat(true); ui.setTab("explore"); }

  // Public API for the console, demos and any external voice/agent integration
  window.hokie = {
    ask: (text) => send(text),
    goTo: (name) => { const p = places.find(name); if (p) navigateTo(p); return p ? `Walking to ${p.name}.` : `No match for "${name}".`; },
    show: (name) => { const p = places.find(name); if (p) selectPlace(p); return p?.name ?? null; },
    speak: (text) => speak(text),
    setLanguage: (lang) => setLang(lang),
    profile: () => profile,
    itinerary: () => (week ??= generateWeek(ctx())),
    recommendations: () => recommendAll(ctx()),
    places: () => places.all().map((p) => ({ id: p.id, name: p.name, category: catLabel(p.category) })),
    route: (fromName, toName) => planRoute(places.find(fromName), places.find(toName)),
    graphSize: graph.nodeCount,
    travelState: () => nav.debugState(),
    setSpeed: (f) => nav.setSpeed(f),
    here: () => here?.name,
    setStart: (name) => { const p = places.find(name); if (p) setStart(p); return p?.name ?? null; },
    destination: () => destination?.name ?? null,
  };
  console.log(`WHERE THE HOKIE AM I? is ready — ${places.all().length} places, ${graph.nodeCount} path nodes. Try window.hokie.ask("take me to my next class").`);
}
