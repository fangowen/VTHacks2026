// The campus assistant.
//
// Map and schedule questions are answered locally: instant, offline, and always consistent with
// what's on the board. Anything that doesn't match a known intent is sent to our backend
// (see api.js); if no backend is configured the assistant says what it can do instead.
//
// Personal schedule and recommendation questions are answered locally. Building-location
// requests go to Gemini, which can recognize the student's language and returns a structured
// map action resolved by the server against the complete live building directory.

import { t, fmtTime, fmtDuration, joinList, dayName, getLang } from "./i18n.js";
import { nextClass, firstClassOfDept, firstClassOn, classNearTime, gapAfter } from "./profile.js";
import { bestDining, bestStudy, upcomingEvents, matchingClubs, gapSuggestion } from "./recommendations.js";
import { askGuide, apiAvailable } from "./api.js";
import { majorInfo } from "./profile.js";

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const has = (s, re) => re.test(s);

// Words that mean "walk me there", in every supported language
const GO = /take me|walk me|bring me|navigate|directions|how do i get|get to|lead me|show me the way|llévame|llevame|vamos|ir a|cómo llego|como llego|带我|怎么走|怎么去|去往|ले चलो|ले चलिए|कैसे जाऊ|पहुँच|데려|안내|가는 길|가자|가고 싶/i;

const INTENTS = {
  home: /take me home|go home|my dorm|my (residence )?hall|back home|a casa|mi residencia|回宿舍|回家|宿舍|घर ले|छात्रावास|기숙사|집으로/i,
  nextClass: /next class|my next|where do i (need to )?go next|próxima clase|proxima clase|siguiente clase|下一节课|下节课|下一堂|अगली (क्लास|कक्षा)|다음 수업/i,
  firstClass: /first .{0,12}class|primera clase|第一节课|第一堂|पहली (क्लास|कक्षा)|첫 수업|첫번째 수업/i,
  tomorrow: /tomorrow|mañana|manana|明天|कल|내일/i,
  leave: /how early|when should i leave|what time should i leave|when do i leave|cuándo.{0,12}salir|cuando.{0,12}salir|几点出发|什么时候出发|कब निकल|언제 출발|몇 시에 출발/i,
  eat: /eat|food|hungry|lunch|dinner|breakfast|dining|meal|coffee|comer|comida|almuerzo|cena|desayuno|hambre|吃|饭|餐|咖啡|खाना|भूख|नाश्ता|लंच|먹|식사|밥|점심|저녁|커피/i,
  study: /study|studying|quiet place|quiet spot|library seat|estudiar|estudio|自习|学习|安静|पढ़ाई|पढ़ने|공부|스터디|조용한/i,
  tonight: /tonight|this evening|what can i do|events?|esta noche|evento|今晚|今天晚上|活动|आज रात|कार्यक्रम|오늘 밤|오늘 저녁|행사|이벤트/i,
  clubs: /clubs?|organizations?|societ|clubes|organizaciones|社团|俱乐部|क्लब|संगठन|동아리|클럽/i,
  near: /near my next class|what.{0,10}near|around my next|cerca de mi próxima|cerca de|附近|周围|के पास|के आसपास|근처|주변/i,
  there: /take me there|go there|let's go|lets go|yes please|llévame allí|llevame alli|vamos allá|vamos alla|带我去那|去那里|就去那|वहाँ ले चलो|वहां ले चलो|거기로|그곳으로|데려다/i,
  greet: /^(hi|hello|hey|yo|help|hola|buenas|你好|您好|नमस्ते|हेलो|안녕|도움말)\b/i,
};

const nav = (place) => ({ type: "navigate", placeId: place.id });
const focus = (place) => ({ type: "focus", placeId: place.id });

function walkLine(ctx, to, from = ctx.here) {
  const est = ctx.estimate(from, to);
  return { min: est.minutes, dist: est.distanceText, from };
}

/** Main entry point. Returns { text, action, suggest, spoken } — the UI does the rest. */
export async function handleMessage(message, ctx) {
  const msg = norm(message);
  if (!msg) return null;
  const wantsGo = has(msg, GO) || has(msg, INTENTS.there);

  // "Take me there" refers to the last suggestion; named destinations are handled by Gemini.
  if (has(msg, INTENTS.there)) {
    const target = ctx.lastSuggested ?? ctx.selected;
    if (!target) return { text: t("a_takeWhere") };
    return goTo(ctx, target);
  }

  if (has(msg, INTENTS.home)) {
    const home = ctx.places.byName(ctx.profile.residenceHall);
    if (home) return { ...goTo(ctx, home), text: t("a_home", { place: home.name }) + " " + goText(ctx, home) };
  }

  if (has(msg, INTENTS.leave)) return leaveAdvice(ctx);

  if (has(msg, INTENTS.nextClass) && !has(msg, INTENTS.near)) return nextClassReply(ctx, wantsGo);

  if (has(msg, INTENTS.firstClass)) return firstClassReply(ctx, msg, wantsGo);

  if (has(msg, INTENTS.tomorrow) && /class|clase|课|क्लास|कक्षा|수업/i.test(msg)) {
    const now = ctx.clock.now();
    const found = firstClassOn(ctx.profile, (now.day + 1) % 7);
    if (found) return classReply(ctx, found.cls, found.day, wantsGo);
  }

  if (has(msg, INTENTS.near) && has(msg, INTENTS.nextClass)) return nearNextReply(ctx);

  if (has(msg, INTENTS.eat)) return eatReply(ctx, msg, wantsGo);

  if (has(msg, INTENTS.study)) return studyReply(ctx, msg, null, wantsGo);

  if (has(msg, INTENTS.tonight)) return tonightReply(ctx);

  if (has(msg, INTENTS.clubs)) return clubsReply(ctx);

  if (has(msg, INTENTS.greet)) {
    return { text: ctx.profile.name ? t("a_hello", { name: ctx.profile.name }) : t("a_helloAnon") };
  }

  // Nothing matched: ask the Hokie Guide backend (Gemini + ElevenLabs), else explain what I can do
  if (apiAvailable()) {
    try {
      const out = await askGuide({
        message,
        language: getLang(),
        history: ctx.history ?? [],
        context: ctx.selected?.name ?? "",
        buildings: ctx.places.all().filter((place) => place.kind === "building").map((place) => place.name),
      });
      if (out?.text) {
        const target = out.action?.type === "flyTo" ? ctx.places.byName(out.action.building) : null;
        return {
          text: out.text,
          audio: out.audio,
          action: target ? focus(target) : null,
          suggest: target ?? null,
        };
      }
    } catch (err) {
      console.warn("Guide backend unavailable:", err);
      return { text: err.message || t("a_backendError"), isError: true };
    }
  }
  return { text: t("a_help") };
}

// ---------- Intent replies ----------

function goText(ctx, place) {
  const { min, dist } = walkLine(ctx, place);
  return t("a_navStart", { place: place.name, min, dist });
}
function goTo(ctx, place) {
  return { text: goText(ctx, place), action: nav(place), suggest: place };
}

function classReply(ctx, cls, day, wantsGo, key = "a_nextClass") {
  const place = ctx.places.byName(cls.building) ?? ctx.places.find(cls.building);
  if (!place) return { text: t("a_notFound") };
  const { min } = walkLine(ctx, place);
  const text = t(key, {
    course: cls.course, time: fmtTime(cls.start), place: place.name,
    min, from: ctx.here?.name ?? ctx.profile.residenceHall, day: dayName(day),
  });
  if (wantsGo) return { ...goTo(ctx, place), text: `${text} ${goText(ctx, place)}`, focusClass: cls };
  return { text: `${text} ${t("a_offer")}`, action: focus(place), suggest: place, focusClass: cls };
}

function nextClassReply(ctx, wantsGo) {
  if (!ctx.profile.schedule.length) return { text: t("a_noSchedule") };
  const now = ctx.clock.now();
  const found = nextClass(ctx.profile, now);
  if (!found) return { text: t("a_noSchedule") };
  return classReply(ctx, found.cls, found.day, wantsGo, found.isToday ? "a_nextClass" : "a_nextClassLater");
}

function firstClassReply(ctx, msg, wantsGo) {
  if (!ctx.profile.schedule.length) return { text: t("a_noSchedule") };
  // "my first CS class" — pull a department code out of the message, else use the student's major
  const codes = [...new Set(ctx.profile.schedule.map((c) => c.course.split(/\s+/)[0]))];
  let dept = codes.find((c) => new RegExp(`\\b${c}\\b`, "i").test(msg));
  if (!dept && /computer science|计算机|컴퓨터|कंप्यूटर|informática|informatica/i.test(msg)) dept = "CS";
  dept = dept ?? majorInfo(ctx.profile.major).dept;
  const found = firstClassOfDept(ctx.profile, dept) ?? firstClassOn(ctx.profile, 1);
  if (!found) return { text: t("a_noSchedule") };
  const place = ctx.places.byName(found.cls.building) ?? ctx.places.find(found.cls.building);
  if (!place) return { text: t("a_notFound") };
  const { min } = walkLine(ctx, place);
  const text = t("a_firstClass", {
    dept, course: found.cls.course, day: dayName(found.day), time: fmtTime(found.cls.start),
    place: place.name, min, from: ctx.here?.name ?? ctx.profile.residenceHall,
  });
  if (wantsGo) return { text: `${text} ${goText(ctx, place)}`, action: nav(place), suggest: place, focusClass: found.cls };
  return { text: `${text} ${t("a_offer")}`, action: focus(place), suggest: place, focusClass: found.cls };
}

function leaveAdvice(ctx) {
  const found = nextClass(ctx.profile, ctx.clock.now());
  if (!found) return { text: t("a_noSchedule") };
  const place = ctx.places.byName(found.cls.building) ?? ctx.places.find(found.cls.building);
  if (!place) return { text: t("a_notFound") };
  const { min } = walkLine(ctx, place);
  return {
    text: t("a_leave", { leave: fmtTime(Math.max(0, found.cls.start - min - 5)), place: place.name, course: found.cls.course, time: fmtTime(found.cls.start), min }),
    action: focus(place), suggest: place,
  };
}

function eatReply(ctx, msg, wantsGo) {
  // "before my 2 pm class" → plan around that class
  const when = parseTime(msg);
  const cls = when != null ? classNearTime(ctx.profile, when) : null;
  const nearPlace = cls ? (ctx.places.byName(cls.cls.building) ?? ctx.here) : ctx.here;
  const pick = bestDining(ctx, { near: nearPlace, at: when ?? ctx.clock.now().minutes, limit: 1 })[0];
  if (!pick) return { text: t("a_help") };
  const text = t("a_eat", {
    name: pick.title, place: pick.place.name, food: t(`food_${pick.record.food}`), min: pick.min,
    when: cls ? t("a_eatBefore", { time: fmtTime(cls.cls.start) }) : "",
    hours: `${fmtTime(pick.record.hours[0])}–${fmtTime(pick.record.hours[1])}`,
  });
  if (wantsGo) return { text: `${text} ${goText(ctx, pick.place)}`, action: nav(pick.place), suggest: pick.place };
  return { text: `${text} ${t("a_offer")}`, action: focus(pick.place), suggest: pick.place };
}

function studyReply(ctx, msg, place, wantsGo) {
  const near = place ?? ctx.here;
  const pick = bestStudy(ctx, { near, limit: 1 })[0];
  if (!pick) return { text: t("a_help") };
  const pref = t(`study_${ctx.profile.studyPreference === "group" ? "group" : ctx.profile.studyPreference}`).toLowerCase();
  const text = t("a_study", { name: pick.title, pref, min: pick.min, from: near?.name ?? ctx.profile.residenceHall });
  if (wantsGo) return { text: `${text} ${goText(ctx, pick.place)}`, action: nav(pick.place), suggest: pick.place };
  return { text: `${text} ${t("a_offer")}`, action: focus(pick.place), suggest: pick.place };
}

function tonightReply(ctx) {
  const now = ctx.clock.now();
  const pick = upcomingEvents(ctx, { day: now.day, evening: true, limit: 1 })[0] ?? upcomingEvents(ctx, { evening: true, limit: 1 })[0];
  if (!pick) {
    const sq = ctx.places.byId("squires");
    return { text: t("a_noTonight", { place: sq?.name ?? "Squires Student Center" }), action: sq ? focus(sq) : null, suggest: sq };
  }
  return {
    text: t("a_tonight", { event: pick.title, time: fmtTime(pick.record.start), place: pick.place.name, why: pick.reason }),
    action: focus(pick.place), suggest: pick.place,
  };
}

function clubsReply(ctx) {
  const picks = matchingClubs(ctx, { limit: 3 });
  if (!picks.length) return { text: t("a_help") };
  const first = picks[0];
  return {
    text: t("a_clubs", { list: joinList(picks.map((c) => `${c.title} (${c.place.name})`)) }),
    action: focus(first.place), suggest: first.place,
  };
}

function nearNextReply(ctx) {
  const found = nextClass(ctx.profile, ctx.clock.now());
  if (!found) return { text: t("a_noSchedule") };
  const place = ctx.places.byName(found.cls.building);
  if (!place) return { text: t("a_notFound") };
  const dining = bestDining(ctx, { near: place, limit: 1 })[0];
  const study = bestStudy(ctx, { near: place, limit: 1 })[0];
  const list = [dining && `${dining.title} (${dining.min} ${t("min")})`, study && `${study.title} (${study.min} ${t("min")})`].filter(Boolean);
  return { text: t("a_nearNext", { place: place.name, list: joinList(list) }), action: focus(place), suggest: dining?.place ?? place };
}

/** Message shown when the student arrives somewhere, plus a study suggestion if a gap follows. */
export function arrivalMessage(ctx, place, forClass) {
  const desc = ctx.places.description(place);
  let text = t("a_arrived", { place: place.name, desc });
  let suggest = null;
  if (forClass) {
    const { next, minutes } = gapAfter(ctx.profile, forClass, ctx.clock.now().day);
    if (next) {
      const rec = gapSuggestion(ctx, { after: next, gapMinutes: minutes, atPlace: place });
      if (rec) { text += " " + rec.text; suggest = rec.spot.place; }
    }
  }
  const acc = ctx.places.accessibility(place);
  if (ctx.profile.accessibilityNeeds?.length && acc.elevator) {
    text += " " + t("a_elevator", { place: place.name, entrance: t("entranceAt", { dir: t(acc.entrance ?? "n") }) });
  }
  return { text, suggest };
}

function parseTime(msg) {
  const m = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] ?? "0", 10);
  const mer = (m[3] ?? "").toLowerCase();
  if (mer.startsWith("p") && h < 12) h += 12;
  if (mer.startsWith("a") && h === 12) h = 0;
  if (!mer && h <= 7) h += 12;              // "my 2 class" means the afternoon
  return h * 60 + min;
}

export const suggestionKeys = ["sug_next", "sug_eat", "sug_study", "sug_clubs", "sug_tonight", "sug_home"];
export const fmtGap = (mins) => fmtDuration(mins);
