// All DOM for the orientation layer. The 3D map underneath is untouched: this module only
// adds panels around it and calls back into app.js (`ctl`) for anything that changes state.

import { t, LANGS, getLang, setLang, catLabel, fmtTime, translateDom } from "./i18n.js";
import { INTERESTS, MAJORS } from "./data/campus.js";
import { buildingImageFor } from "./data/building-images.js";
import { residenceHalls, scheduleForMajor } from "./profile.js";
import { suggestionKeys } from "./ai.js";
import { voiceState } from "./voice.js";

export const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid);
  return n;
};
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const fromHHMM = (s) => { const [h, m] = String(s).split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export function createUI(ctl) {
  const ui = {};
  let tab = "explore", lastTab = "explore", exploreFilter = "", exploreCat = null;

  // ---------- Shell ----------
  const tabs = ["explore", "myWeek", "recs", "profile"];
  const tabBtns = tabs.map((id) =>
    el("button", { type: "button", class: "hk-tab", dataset: { tab: id }, onclick: () => ui.setTab(id) }, el("span", { "data-i18n": tabKey(id) })));

  const langSelect = el("select", { class: "hk-select hk-language-select", id: "hkGuideLanguage", "data-i18n-label": "language", onchange: (e) => ctl.setLanguage(e.target.value) },
    ...Object.entries(LANGS).map(([code, { label }]) => el("option", { value: code, text: label })));

  const accessBtn = el("button", { type: "button", class: "hk-icon", "data-i18n-label": "accessMode", "data-i18n-title": "accessMode", onclick: () => ctl.toggleStepFree() }, "♿");
  const voiceBtn = el("button", { type: "button", class: "hk-icon", "data-i18n-label": "voice", "data-i18n-title": "voice", onclick: () => toggleSettings() }, "🔊");

  const top = el("div", { class: "hk-top" },
    el("div", { class: "hk-brand" }, el("b", { text: "WHERE THE HOKIE AM I?" }), el("span", { "data-i18n": "tagline" })),
    el("nav", { class: "hk-tabs", "data-i18n-label": "primaryNavigation" }, ...tabBtns),
    el("div", { class: "hk-tools" }, accessBtn, voiceBtn));

  const panelTitle = el("h2", { class: "hk-panel-title" });
  const panelBody = el("div", { class: "hk-panel-body" });
  const panelBack = el("button", { type: "button", class: "hk-text-btn", "data-i18n": "back", onclick: () => ui.setTab(lastTab) });
  const panel = el("aside", { class: "hk-panel", id: "hkPanel" },
    el("header", { class: "hk-panel-head" }, panelBack, panelTitle,
      el("button", { type: "button", class: "hk-icon", "data-i18n-label": "close", onclick: () => ui.closePanel() }, "✕")),
    panelBody);

  // Travel panel
  const hudTitle = el("h2", { class: "hk-hud-title", "data-i18n": "travel" });
  const hudStart = el("b");
  const hudDestination = el("b");
  const hudRoute = el("div", { class: "hk-route-points" },
    el("div", {}, el("span", { "data-i18n": "startLabel" }), hudStart),
    el("div", {}, el("span", { "data-i18n": "destinationLabel" }), hudDestination));
  const hudText = el("div", { class: "hk-hud-text" });
  const hudLeft = el("div", { class: "hk-note" });
  const hudBar = el("div", { class: "hk-bar" }, el("i"));
  const hudPause = el("button", { type: "button", class: "hk-hud-btn", onclick: () => ctl.nav.toggle() });
  // Travel speed: distance-based, so moving the slider mid-trip changes pace without a jump
  const speedLabel = el("label", { class: "hk-speed-label", for: "hkSpeed" });
  const speedInput = el("input", {
    class: "hk-speed", id: "hkSpeed", type: "range", min: "0.5", max: "3", step: "0.1", value: "1",
    oninput: (e) => { ctl.nav.setSpeed(e.target.value); syncSpeed(); },
  });
  const syncSpeed = () => {
    const v = Number(speedInput.value).toFixed(1).replace(/\.0$/, "");
    speedLabel.textContent = t("speed", { n: v });
    speedInput.setAttribute("aria-valuetext", t("speedValue", { n: v }));
  };
  const speedRow = el("div", { class: "hk-speed-row" }, speedLabel, speedInput);
  // Bird's-eye toggle: only meaningful while travelling, so it lives in the HUD
  const viewBtn = el("button", { type: "button", class: "hk-hud-btn", "aria-pressed": "false", onclick: () => ctl.nav.toggleView() });
  const syncView = (view) => {
    const on = view === "overview";
    viewBtn.setAttribute("aria-pressed", String(on));
    viewBtn.textContent = on ? t("followBird") : t("birdsEye");
    viewBtn.setAttribute("aria-label", on ? t("followBirdLabel") : t("birdsEyeLabel"));
  };
  ui.setTravelView = syncView;
  const hud = el("section", { class: "hk-hud", hidden: true, "aria-labelledby": "hkTravelTitle" },
    hudTitle, hudRoute, hudText, hudLeft, hudBar, speedRow,
    el("div", { class: "hk-hud-btns" },
      hudPause,
      el("button", { type: "button", class: "hk-hud-btn", "data-i18n": "skip", onclick: () => ctl.nav.skip() }),
      el("button", { type: "button", class: "hk-hud-btn", "data-i18n": "endRoute", onclick: () => ctl.nav.stop() })),
    el("div", { class: "hk-hud-btns" }, viewBtn));

  const tip = el("div", { class: "hk-tip", hidden: true });

  // Chat
  const msgs = el("div", { class: "hk-msgs" });
  const sugs = el("div", { class: "hk-sugs" });
  hudTitle.id = "hkTravelTitle";
  const input = el("input", { class: "hk-input", type: "text", "data-i18n-placeholder": "askPlaceholder", "data-i18n-label": "guideMessage", autocomplete: "off" });
  const micGlyph = el("span", { class: "hk-mic-glyph", "aria-hidden": "true", text: "🎙" });
  const micLabel = el("span", { class: "hk-mic-label", "data-i18n": "mic" });
  const micBtn = el("button", { type: "button", class: "hk-icon hk-mic", "data-i18n-label": "mic", "data-i18n-title": "mic", onclick: () => ctl.startVoiceInput() }, micGlyph, micLabel);
  const chatForm = el("form", { class: "hk-chat-form", onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; input.value = ""; ctl.send(v); } },
    input, micBtn, el("button", { type: "submit", class: "hk-send", "data-i18n": "send" }));
  // Always present so the guide controls don't jump; enabled only while audio is playing.
  const stopAudioBtn = el("button", {
    type: "button", class: "hk-secondary hk-stop-audio", disabled: true,
    "data-i18n": "stopAudio", "data-i18n-label": "stopAudio",
    onclick: () => ctl.stopAudio(),
  });
  const chatTitle = el("b", { id: "hkGuideTitle", "data-i18n": "guide" });
  const guideControls = el("div", { class: "hk-guide-controls" },
    el("label", { class: "hk-language-field", for: "hkGuideLanguage" },
      el("span", { "data-i18n": "language" }), langSelect),
    stopAudioBtn);
  const captionsLabel = el("div", { class: "hk-captions-label", id: "hkCaptionsLabel", "data-i18n": "captions" });
  msgs.setAttribute("role", "log");
  msgs.setAttribute("aria-live", "polite");
  msgs.setAttribute("aria-labelledby", "hkCaptionsLabel");
  const chat = el("section", { class: "hk-chat", hidden: true, "aria-labelledby": "hkGuideTitle" },
    el("header", { class: "hk-chat-head" },
      chatTitle,
      el("button", { type: "button", class: "hk-icon", "data-i18n-label": "collapse", onclick: () => ui.setChat(false) }, "▾")),
    guideControls, captionsLabel, msgs, sugs, chatForm);
  const fab = el("button", {
    type: "button", class: "hk-fab", "data-i18n-label": "openGuide", "data-i18n-title": "openGuide",
    onclick: () => ui.setChat(true),
  },
  el("span", { class: "hk-fab-prompt" },
    el("span", { class: "hk-fab-prompt-text", "data-i18n": "askMeQuestions" })),
  el("img", { class: "hk-fab-bird", src: "./hokie.png", alt: "", draggable: "false" }));

  // Settings popover
  const settings = el("div", { class: "hk-settings", hidden: true });
  const modal = el("div", { class: "hk-modal", hidden: true });

  // Subtle camera nudges at the map viewport edges. Each is a real button (rather than a
  // decorative overlay), so the controls work with keyboard navigation and assistive tech too.
  const edgeButton = (direction, x, y, glyph) => el("button", {
    type: "button", class: `hk-edge-pan hk-edge-pan-${direction}`,
    "data-i18n-label": `pan${direction[0].toUpperCase()}${direction.slice(1)}`,
    "data-i18n-title": `pan${direction[0].toUpperCase()}${direction.slice(1)}`,
    onclick: () => ctl.panCamera(x, y),
  }, el("span", { class: "hk-edge-chevron", "aria-hidden": "true", text: glyph }));
  const edgePans = el("div", { class: "hk-edge-pans", role: "group", "data-i18n-label": "cameraPanning" },
    edgeButton("up", 0, 1, "⌃"),
    edgeButton("down", 0, -1, "⌄"),
    edgeButton("left", -1, 0, "‹"),
    edgeButton("right", 1, 0, "›"));

  const zoomButton = (direction, glyph, label) => el("button", {
    type: "button", class: "hk-zoom-btn", "data-i18n-label": label, "data-i18n-title": label,
    onclick: () => ctl.zoomCamera(direction),
  }, el("span", { "aria-hidden": "true", text: glyph }));
  const zoomControls = el("div", { class: "hk-zoom-controls", role: "group", "data-i18n-label": "cameraZoom" },
    zoomButton(1, "+", "zoomIn"),
    zoomButton(-1, "−", "zoomOut"));

  document.body.append(top, panel, hud, tip, chat, fab, settings, modal, edgePans, zoomControls);

  // The top bar wraps on narrow screens, so everything below it follows its measured height.
  // Keep a reference to the observer: an unreferenced one can be collected before it fires.
  const syncTopHeight = () => document.documentElement.style.setProperty("--top-h", `${top.offsetHeight}px`);
  ui.topObserver = new ResizeObserver(syncTopHeight);
  ui.topObserver.observe(top);
  addEventListener("resize", syncTopHeight);
  document.fonts?.ready.then(syncTopHeight);
  syncTopHeight();

  function tabKey(id) { return { explore: "explore", myWeek: "myWeek", recs: "recs", profile: "profile" }[id]; }

  // ---------- Panel / tabs ----------
  ui.setTab = (id) => {
    const changed = id !== tab;
    if (id !== "place") lastTab = id;
    tab = id;
    document.body.classList.add("hk-panel-open");
    panel.classList.add("open");
    panelBack.hidden = id !== "place";
    for (const b of tabBtns) b.setAttribute("aria-current", String(b.dataset.tab === id));
    render();
    if (changed) panelBody.scrollTop = 0;
  };
  ui.closePanel = () => { panel.classList.remove("open"); document.body.classList.remove("hk-panel-open"); };
  ui.isOpen = () => panel.classList.contains("open");

  let shownPlace = null;
  ui.showPlace = (place, { open = true } = {}) => {
    shownPlace = place;
    if (open) ui.setTab("place");
    else if (tab === "place") render();
  };

  function render() {
    panelBody.replaceChildren();
    if (tab === "explore") { panelTitle.textContent = t("explore"); renderExplore(); }
    else if (tab === "myWeek") { panelTitle.textContent = t("weekTitle"); renderWeek(); }
    else if (tab === "recs") { panelTitle.textContent = t("recsTitle"); renderRecs(); }
    else if (tab === "profile") { panelTitle.textContent = t("profileTitle"); renderProfile(); }
    else if (tab === "place") { panelTitle.textContent = shownPlace?.name ?? ""; renderPlace(); }
    translateDom(panelBody);
  }
  ui.refresh = () => { if (ui.isOpen()) render(); };

  // ---------- Explore ----------
  function renderExplore() {
    const search = el("input", { class: "hk-search", type: "search", "data-i18n-placeholder": "search", "data-i18n-label": "search", value: exploreFilter,
      oninput: (e) => { exploreFilter = e.target.value; renderList(); } });
    const cats = [null, ...ctl.categories()];
    const chips = el("div", { class: "hk-chips" }, ...cats.map((c) =>
      el("button", { type: "button", class: "hk-chip" + (exploreCat === c ? " on" : ""), text: c ? catLabel(c) : t("all"),
        onclick: () => { exploreCat = c; renderExplore(); } })));
    const list = el("div", { class: "hk-list" });
    panelBody.replaceChildren(search, chips, list);

    function renderList() {
      const items = ctl.places.search(exploreFilter, exploreCat);
      list.replaceChildren();
      if (!items.length) { list.append(el("p", { class: "hk-empty", text: t("noMatch", { q: exploreFilter }) })); return; }
      for (const p of items.slice(0, 200)) {
        list.append(el("button", { type: "button", class: "hk-row", onclick: () => ctl.selectPlace(p) },
          el("span", { class: "hk-row-name", text: p.name }),
          el("span", { class: "hk-row-sub", text: catLabel(p.category) })));
      }
    }
    renderList();
    translateDom(panelBody);
  }

  // ---------- Place info ----------
  function renderPlace() {
    const p = shownPlace;
    if (!p) return;
    const acc = ctl.places.accessibility(p);
    const walk = ctl.walkEstimate(p);
    const photo = buildingImageFor(p.name);
    const photoFigure = photo && el("figure", { class: "hk-place-photo" },
      el("img", {
        src: photo.file, alt: photo.alt, loading: "lazy", decoding: "async",
        referrerpolicy: "no-referrer",
      }),
      el("figcaption", {},
        "Photo: ", el("a", { href: photo.source, target: "_blank", rel: "noopener noreferrer", text: photo.author }),
        " · ", el("a", { href: photo.licenseUrl, target: "_blank", rel: "noopener noreferrer", text: photo.license })));
    const body = [
      el("div", { class: "hk-badges" },
        el("span", { class: "hk-badge", text: catLabel(p.category) }),
        walk && el("span", { class: "hk-badge alt", text: t("walkFrom", { min: walk.minutes, from: walk.from }) })),
      photoFigure,
      el("p", { class: "hk-desc", text: ctl.places.description(p) }),
      section("travel",
        el("div", { class: "hk-route-points compact" },
          el("div", {}, el("span", { "data-i18n": "startLabel" }), el("b", { text: ctl.startName() })),
          el("div", {}, el("span", { "data-i18n": "destinationLabel" }), el("b", { text: p.name }))),
        el("div", { class: "hk-actions" },
          el("button", { type: "button", class: "hk-primary", "data-i18n": "travel", disabled: ctl.isStart(p), onclick: () => ctl.navigateTo(p) }),
          // Sets the route's origin; disabled when this place is already the start
          el("button", {
            type: "button", class: "hk-secondary", text: t("startHere"),
            "aria-label": t("startHereLabel", { place: p.name }),
            disabled: ctl.isStart(p), "aria-disabled": String(ctl.isStart(p)),
            onclick: () => ctl.setStart(p),
          }))),
      el("div", { class: "hk-actions" },
        el("button", { type: "button", class: "hk-secondary", "data-i18n": "listen", onclick: () => ctl.speak(placeSpeech(p)) })),
    ];
    const purpose = ctl.places.purpose(p), why = ctl.places.why(p), depts = ctl.places.departments(p);
    if (purpose) body.push(section("purpose", el("p", { class: "hk-desc", text: purpose })));
    if (depts.length) body.push(section("departments", el("ul", { class: "hk-ul" }, ...depts.map((d) => el("li", { text: d })))));
    if (why) body.push(section("whyVisit", el("p", { class: "hk-desc", text: why })));

    const accLines = [];
    if (acc.stepFree !== null) accLines.push(el("li", { text: t("acc_stepfree") + (acc.stepFree ? " ✓" : " —") }));
    if (acc.elevator !== null) accLines.push(el("li", { text: acc.elevator ? t("elevatorYes") : t("elevatorNo") }));
    if (acc.entrance) accLines.push(el("li", { text: t("entranceAt", { dir: t(acc.entrance) }) }));
    if (accLines.length) body.push(section("accessibility", el("ul", { class: "hk-ul" }, ...accLines)));

    const dining = ctl.places.diningAt(p), study = ctl.places.studyAt(p), res = ctl.places.resourcesAt(p);
    const here = [...dining.map((d) => `${d.name} · ${t(`food_${d.food}`)} · ${fmtTime(d.hours[0])}–${fmtTime(d.hours[1])}`),
                  ...study.map((s) => s.name), ...res.map((r) => r.name)];
    if (here.length) body.push(section("departments", el("ul", { class: "hk-ul" }, ...here.map((x) => el("li", { text: x })))));

    const near = ctl.places.near(p, { limit: 4, maxDist: 400 });
    if (near.length) body.push(section("nearby", el("div", { class: "hk-list" }, ...near.map(({ place, dist }) =>
      el("button", { type: "button", class: "hk-row", onclick: () => ctl.selectPlace(place) },
        el("span", { class: "hk-row-name", text: place.name }),
        el("span", { class: "hk-row-sub", text: `${Math.round(dist)} m · ${catLabel(place.category)}` }))))));

    if (p.meta) body.push(el("p", { class: "hk-note", "data-i18n": "demoData" }));
    panelBody.replaceChildren(...body.filter(Boolean));
  }

  const section = (key, ...content) => el("div", { class: "hk-section" }, el("h3", { "data-i18n": key }), ...content);
  const placeSpeech = (p) => [p.name, ctl.places.description(p), ctl.places.why(p)].filter(Boolean).join(". ");

  // ---------- My Week ----------
  function renderWeek() {
    panelBody.append(el("p", { class: "hk-note", "data-i18n": "weekIntro" }));
    for (const day of ctl.itinerary()) {
      panelBody.append(el("h3", { class: "hk-day", text: t(`day${day.day}`) }));
      if (!day.items.length) panelBody.append(el("p", { class: "hk-note", "data-i18n": "it_noClasses" }));
      for (const item of day.items) {
        const place = item.placeId ? ctl.places.byId(item.placeId) : null;
        panelBody.append(el("button", { type: "button", class: "hk-item", onclick: () => place && ctl.selectPlace(place) },
          el("span", { class: "hk-time", text: item.time }),
          el("span", { class: "hk-item-main" },
            el("span", { class: "hk-item-title", text: item.title }),
            el("span", { class: "hk-item-sub", text: [t(`kind_${item.kind}`), item.sub].filter(Boolean).join(" · ") })),
          place && el("span", { class: "hk-go", role: "button", "data-i18n": "takeMeThere",
            onclick: (e) => { e.stopPropagation(); ctl.navigateTo(place); } })));
      }
    }
  }

  // ---------- Recommendations ----------
  function renderRecs() {
    for (const group of ctl.recommendations()) {
      panelBody.append(el("h3", { class: "hk-day", text: t(group.key) }));
      for (const item of group.items) {
        panelBody.append(el("button", { type: "button", class: "hk-item", onclick: () => ctl.selectPlace(item.place) },
          el("span", { class: "hk-item-main" },
            el("span", { class: "hk-item-title", text: item.title }),
            el("span", { class: "hk-item-sub", text: [item.reason, item.detail].filter(Boolean).join(" · ") })),
          el("span", { class: "hk-go", role: "button", "data-i18n": "takeMeThere",
            onclick: (e) => { e.stopPropagation(); ctl.navigateTo(item.place); } })));
      }
    }
  }

  // ---------- Profile ----------
  function renderProfile() {
    const p = ctl.profile();
    const row = (label, value) => el("div", { class: "hk-kv" }, el("span", { text: label }), el("b", { text: value || t("none") }));
    panelBody.append(
      row(t("ob_name"), p.name),
      row(t("ob_major"), p.major),
      row(t("ob_res"), p.residenceHall),
      row(t("ob_interests"), p.interests.map((i) => t(`int_${i}`)).join(", ")),
      row(t("ob_study"), t(`study_${p.studyPreference}`)),
      row(t("ob_dining"), p.diningPreferences.map((d) => t(`dine_${d}`)).join(", ")),
      row(t("ob_access"), p.accessibilityNeeds.map((a) => t(`acc_${a}`)).join(", ")),
      el("h3", { class: "hk-day", "data-i18n": "scheduleTitle" }));
    for (const c of [...p.schedule].sort((a, b) => a.days[0] - b.days[0] || a.start - b.start)) {
      const place = ctl.places.byName(c.building);
      panelBody.append(el("button", { type: "button", class: "hk-item", onclick: () => place && ctl.selectPlace(place) },
        el("span", { class: "hk-time", text: fmtTime(c.start) }),
        el("span", { class: "hk-item-main" },
          el("span", { class: "hk-item-title", text: c.course }),
          el("span", { class: "hk-item-sub", text: `${c.days.map((d) => t(`day${d}`).slice(0, 3)).join(" ")} · ${c.building}` }))));
    }
    panelBody.append(el("div", { class: "hk-actions" },
      el("button", { type: "button", class: "hk-primary", "data-i18n": "editProfile", onclick: () => ui.openOnboarding(ctl.profile()) }),
      el("button", { type: "button", class: "hk-secondary", "data-i18n": "resetProfile", onclick: () => ctl.resetProfile() })));
  }

  // ---------- Chat ----------
  ui.setChat = (open) => {
    chat.hidden = !open; fab.hidden = open;
    document.body.classList.toggle("hk-guide-open", open);
    if (open) input.focus();
  };
  ui.addMessage = ({ role, text, actions = [], error = false }) => {
    const bubble = el("div", { class: `hk-msg ${role}${error ? " error" : ""}` }, el("p", { text }));
    if (role === "bot") {
      bubble.append(el("button", { type: "button", class: "hk-icon hk-speak", "data-i18n-title": "listen", onclick: () => ctl.speak(text) }, "🔊"));
    }
    if (actions.length) {
      bubble.append(el("div", { class: "hk-msg-actions" }, ...actions.map((a) =>
        el("button", { type: "button", class: "hk-chip on", text: a.label, onclick: a.onClick }))));
    }
    msgs.append(bubble);
    msgs.scrollTop = msgs.scrollHeight;
    translateDom(bubble);
    return bubble;
  };
  ui.setThinking = (on) => {
    msgs.querySelector(".hk-msg.thinking")?.remove();
    if (on) { msgs.append(el("div", { class: "hk-msg bot thinking" }, el("p", { text: "…" }))); msgs.scrollTop = msgs.scrollHeight; }
  };
  ui.setAudioPlaying = (playing) => {
    stopAudioBtn.disabled = !playing;
    stopAudioBtn.title = t("stopAudio");
    stopAudioBtn.setAttribute("aria-label", t("stopAudio"));
  };
  ui.setMicState = (mode) => {
    const key = mode === "recording" ? "micListening"
      : mode === "transcribing" ? "micTranscribing"
      : mode === "starting" ? "micStarting" : "mic";
    micBtn.classList.toggle("on", mode === "recording");
    micBtn.classList.toggle("busy", mode === "starting" || mode === "transcribing");
    micBtn.disabled = mode === "starting" || mode === "transcribing";
    micGlyph.textContent = mode === "recording" ? "■" : mode === "transcribing" ? "…" : "🎙";
    micLabel.textContent = t(key);
    micBtn.title = t(key);
    micBtn.setAttribute("aria-label", t(key));
  };
  ui.renderSuggestions = () => {
    sugs.replaceChildren(...suggestionKeys.map((k) =>
      el("button", { type: "button", class: "hk-chip", text: t(k), onclick: () => ctl.send(t(k)) })));
  };

  // ---------- HUD ----------
  ui.showHud = (fromName, toName) => {
    hud.hidden = false;
    document.body.classList.add("hk-travel-open");
    ui.closePanel();
    if (innerWidth <= 900) ui.setChat(false);       // phone screens show one task panel at a time
    hudStart.textContent = fromName;
    hudDestination.textContent = toName;
    hudText.textContent = t("navTo", { place: toName });
    hudPause.textContent = t("pause");
    speedInput.value = String(ctl.nav.getSpeed());
    syncSpeed();
    syncView(ctl.nav.getView());        // every trip starts in follow mode
  };
  ui.updateHud = ({ remaining, total, minutes, paused }) => {
    const pct = total ? Math.min(100, 100 * (total - remaining) / total) : 0;
    hudBar.firstChild.style.width = `${pct}%`;
    hudPause.textContent = paused ? t("resume") : t("pause");
    hudLeft.textContent = t("remaining", { min: minutes, dist: `${Math.round(remaining)} m` });
  };
  ui.hideHud = () => { hud.hidden = true; document.body.classList.remove("hk-travel-open"); };

  // Insets occupied by UI chrome. Bird's-eye framing uses this to center the route in the
  // genuinely visible part of the canvas instead of underneath a panel.
  ui.mapInsets = () => {
    const vw = innerWidth, vh = innerHeight, gap = 12;
    let left = 0, right = 0, topInset = top.getBoundingClientRect().bottom + gap, bottom = 0;
    const visible = (node) => {
      if (!node || node.hidden) return false;
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none") return false;
      return node.getBoundingClientRect().width > 0;
    };
    const wide = vw > 900;
    // Work out which edge each floating panel occupies from where it actually is, so moving a
    // panel in CSS can't silently feed the camera a wrong inset.
    for (const node of [panel, hud, chat]) {
      if (!visible(node)) continue;
      const r = node.getBoundingClientRect();
      if (wide) {
        if ((r.left + r.right) / 2 < vw / 2) left = Math.max(left, r.right + gap);
        else right = Math.max(right, vw - r.left + gap);
      } else if ((r.top + r.bottom) / 2 < vh / 2) {
        topInset = Math.max(topInset, r.bottom + gap);
      } else {
        bottom = Math.max(bottom, vh - r.top + gap);
      }
    }
    return { left, right, top: topInset, bottom };
  };

  // ---------- Hover tooltip ----------
  ui.showTip = (name, x, y) => { tip.hidden = false; tip.textContent = name; tip.style.left = `${x + 14}px`; tip.style.top = `${y + 16}px`; };
  ui.hideTip = () => { tip.hidden = true; };

  // ---------- Settings ----------
  function toggleSettings() { settings.hidden ? openSettings() : (settings.hidden = true); }
  function openSettings() {
    const v = voiceState();
    const now = ctl.clockState();
    const daySel = el("select", { class: "hk-select", "data-i18n-label": "demoClock" }, ...[1, 2, 3, 4, 5].map((d) => el("option", { value: d, text: t(`day${d}`), selected: d === now.day })));
    const timeInput = el("input", { class: "hk-field", type: "time", value: hhmm(now.minutes), "data-i18n-label": "demoClock" });
    settings.replaceChildren(
      el("h3", { "data-i18n": "settings" }),
      el("label", { class: "hk-check" },
        el("input", { type: "checkbox", checked: v.muted, onchange: (e) => ctl.setVoice({ muted: e.target.checked }) }),
        el("span", { text: t("voiceOff") })),
      el("p", { class: "hk-note", text: `${t("voiceProvider")}: ${v.provider === "off" ? t("voiceOff") : t("voiceElevenLabs")}` }),
      el("label", { class: "hk-lbl", "data-i18n": "demoClock" }),
      el("div", { class: "hk-row-inline" }, daySel, timeInput),
      el("div", { class: "hk-actions" },
        el("button", { type: "button", class: "hk-primary", "data-i18n": "save",
          onclick: () => {
            ctl.setClock(Number(daySel.value), fromHHMM(timeInput.value));
            settings.hidden = true;
          } }),
        el("button", { type: "button", class: "hk-secondary", "data-i18n": "useRealTime", onclick: () => { ctl.useRealTime(); settings.hidden = true; } })));
    translateDom(settings);
    settings.hidden = false;
  }

  // ---------- Onboarding ----------
  ui.openOnboarding = (existing) => {
    const draft = structuredClone(existing);
    if (!draft.schedule.length) draft.schedule = scheduleForMajor(draft.major);
    let step = 0;
    const TOTAL = 5;

    const content = el("div", { class: "hk-modal-body" });
    const backBtn = el("button", { type: "button", class: "hk-secondary", "data-i18n": "ob_back", onclick: () => go(step - 1) });
    const nextBtn = el("button", { type: "button", class: "hk-primary", onclick: () => (step === TOTAL - 1 ? finish() : go(step + 1)) });
    const demoBtn = el("button", { type: "button", class: "hk-text-btn", "data-i18n": "ob_demo", onclick: () => { ctl.useDemoProfile(); close(); } });
    const stepLbl = el("span", { class: "hk-note" });

    const card = el("div", { class: "hk-card" },
      el("h2", { "data-i18n": "ob_title" }),
      el("p", { class: "hk-note", "data-i18n": "ob_intro" }),
      content,
      el("div", { class: "hk-modal-foot" }, stepLbl, el("div", { class: "hk-actions" }, demoBtn, backBtn, nextBtn)));
    modal.replaceChildren(card);
    modal.hidden = false;

    const close = () => { modal.hidden = true; };
    ui.closeOnboarding = close;

    function go(n) {
      step = Math.max(0, Math.min(TOTAL - 1, n));
      stepLbl.textContent = t("ob_step", { n: step + 1, total: TOTAL });
      backBtn.hidden = step === 0;
      nextBtn.textContent = step === TOTAL - 1 ? t("ob_finish") : t("ob_next");
      content.replaceChildren(STEPS[step]());
      translateDom(card);
    }
    function finish() { draft.onboarded = true; ctl.saveOnboarding(draft); close(); }

    const chips = (values, selected, onToggle, labelFor) => el("div", { class: "hk-chips" }, ...values.map((v) =>
      el("button", { type: "button", class: "hk-chip" + (selected.includes(v) ? " on" : ""), text: labelFor(v),
        onclick: (e) => { onToggle(v); e.target.classList.toggle("on"); } })));
    const radios = (values, current, onPick, labelFor) => {
      const wrap = el("div", { class: "hk-chips" });
      wrap.append(...values.map((v) => el("button", { type: "button", class: "hk-chip" + (current() === v ? " on" : ""), text: labelFor(v),
        onclick: () => { onPick(v); for (const b of wrap.children) b.classList.toggle("on", b.textContent === labelFor(v)); } })));
      return wrap;
    };

    const STEPS = [
      () => el("div", {},
        el("label", { class: "hk-lbl", "data-i18n": "ob_lang" }),
        el("select", { class: "hk-select", "data-i18n-label": "ob_lang", onchange: (e) => { draft.language = e.target.value; ctl.setLanguage(e.target.value); go(step); } },
          ...Object.entries(LANGS).map(([code, { label }]) => el("option", { value: code, text: label, selected: code === getLang() }))),
        el("label", { class: "hk-lbl", "data-i18n": "ob_name" }),
        el("input", { class: "hk-field", type: "text", value: draft.name, "data-i18n-label": "ob_name", oninput: (e) => { draft.name = e.target.value; } })),

      () => el("div", {},
        el("label", { class: "hk-lbl", "data-i18n": "ob_major" }),
        el("select", { class: "hk-select", "data-i18n-label": "ob_major", onchange: (e) => { draft.major = e.target.value; draft.schedule = scheduleForMajor(draft.major); } },
          ...MAJORS.map((m) => el("option", { value: m.name, text: m.name, selected: m.name === draft.major }))),
        el("label", { class: "hk-lbl", "data-i18n": "ob_res" }),
        el("select", { class: "hk-select", "data-i18n-label": "ob_res", onchange: (e) => { draft.residenceHall = e.target.value; } },
          ...residenceHalls().filter((h) => ctl.places.byName(h)).map((h) => el("option", { value: h, text: h, selected: h === draft.residenceHall })))),

      () => el("div", {},
        el("label", { class: "hk-lbl", "data-i18n": "ob_interests" }),
        chips(INTERESTS, draft.interests, (v) => toggle(draft.interests, v), (v) => t(`int_${v}`)),
        el("label", { class: "hk-lbl", "data-i18n": "ob_clubs" }),
        radios(["yes", "maybe", "no"], () => draft.clubsInterest, (v) => { draft.clubsInterest = v; }, (v) => t(v)),
        el("label", { class: "hk-lbl", "data-i18n": "ob_social" }),
        radios(["social", "balanced", "quiet"], () => draft.social, (v) => { draft.social = v; }, (v) => t(v))),

      () => el("div", {},
        el("label", { class: "hk-lbl", "data-i18n": "ob_study" }),
        radios(["quiet", "group", "outdoor", "cafe"], () => draft.studyPreference, (v) => { draft.studyPreference = v; }, (v) => t(`study_${v}`)),
        el("label", { class: "hk-lbl", "data-i18n": "ob_dining" }),
        chips(["quick", "healthy", "veg", "intl", "late"], draft.diningPreferences, (v) => toggle(draft.diningPreferences, v), (v) => t(`dine_${v}`)),
        el("label", { class: "hk-lbl", "data-i18n": "ob_access" }),
        chips(["stepfree", "limited", "vision", "hearing"], draft.accessibilityNeeds, (v) => toggle(draft.accessibilityNeeds, v), (v) => t(`acc_${v}`))),

      () => {
        const list = el("div", { class: "hk-sched" });
        const draw = () => {
          list.replaceChildren(...draft.schedule.map((c, i) => el("div", { class: "hk-sched-row" },
            el("input", { class: "hk-field", type: "text", value: c.course, "aria-label": `${t("course")} ${i + 1}`, oninput: (e) => { c.course = e.target.value; } }),
            el("select", { class: "hk-select", "aria-label": `${t("building")} ${i + 1}`, onchange: (e) => { c.building = e.target.value; } },
              ...ctl.places.all().filter((p) => p.kind === "building").map((p) =>
                el("option", { value: p.name, text: p.name, selected: p.name === c.building }))),
            el("div", { class: "hk-days" }, ...[1, 2, 3, 4, 5].map((d) =>
              el("button", { type: "button", class: "hk-chip tiny" + (c.days.includes(d) ? " on" : ""), text: t(`day${d}`).slice(0, 1), "aria-label": `${t(`day${d}`)} — ${c.course || t("course")}`,
                onclick: (e) => { toggle(c.days, d); e.target.classList.toggle("on"); } }))),
            el("input", { class: "hk-field time", type: "time", value: hhmm(c.start), "aria-label": `${t("start")} — ${c.course || t("course")}`, onchange: (e) => { c.start = fromHHMM(e.target.value); } }),
            el("input", { class: "hk-field time", type: "time", value: hhmm(c.end), "aria-label": `${t("end")} — ${c.course || t("course")}`, onchange: (e) => { c.end = fromHHMM(e.target.value); } }),
            el("button", { type: "button", class: "hk-icon", "data-i18n-label": "remove", onclick: () => { draft.schedule.splice(i, 1); draw(); } }, "✕"))));
        };
        draw();
        return el("div", {},
          el("p", { class: "hk-note", "data-i18n": "ob_scheduleHint" }), list,
          el("button", { type: "button", class: "hk-secondary", "data-i18n": "addClass",
            onclick: () => { draft.schedule.push({ course: "", building: draft.residenceHall, days: [1], start: 600, end: 650 }); draw(); } }));
      },
    ];
    go(0);
  };

  const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };

  // ---------- Language ----------
  ui.applyLanguage = () => {
    translateDom(document);
    langSelect.value = getLang();
    ui.renderSuggestions();
    if (ui.isOpen()) render();
  };
  ui.setStepFree = (on) => accessBtn.classList.toggle("on", on);

  ui.renderSuggestions();
  translateDom(document);
  return ui;
}

export { setLang };
