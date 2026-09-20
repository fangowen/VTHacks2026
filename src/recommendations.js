// Personalized recommendations. Every result carries a `reason` (already translated) and a
// `placeId`, so the UI can explain the pick and jump to it on the map.

import { CLUBS, DINING, EVENTS, STUDY_SPOTS, RESOURCES, PLACES } from "./data/campus.js";
import { t, fmtTime, fmtDuration } from "./i18n.js";
import { walkMinutes } from "./routing.js";

const openAt = (rec, minutes) => minutes >= rec.hours[0] && minutes <= rec.hours[1];

function withPlace(ctx, record) {
  const place = ctx.places.placeOf(record);
  return place ? { record, place } : null;
}

const minutesFrom = (ctx, from, place) =>
  from && place ? walkMinutes(ctx.places.distance(from, place), ctx.slowWalk) : null;

/** Dining picks: preference match first, then how close it is, then whether it's open. */
export function bestDining(ctx, { near = null, at = null, limit = 3 } = {}) {
  const from = near ?? ctx.here;
  const prefs = ctx.profile.diningPreferences ?? [];
  const time = at ?? ctx.clock.now().minutes;
  return DINING.map((d) => withPlace(ctx, d)).filter(Boolean)
    .map(({ record, place }) => {
      const min = minutesFrom(ctx, from, place) ?? 99;
      const matches = record.prefs.filter((p) => prefs.includes(p));
      const veg = prefs.includes("veg") && record.dietary.includes("veg");
      const score = matches.length * 3 + (veg ? 2 : 0) + (openAt(record, time) ? 3 : -4) - min * 0.25;
      const reason = matches.length ? t("why_diet", { pref: t(`dine_${matches[0]}`) })
        : from ? t("why_near", { min, place: from.name }) : t("why_firstyear");
      return { id: record.id, title: record.name, place, min, score, reason, record,
               detail: `${t(`food_${record.food}`)} · ${t("hoursLabel")} ${fmtTime(record.hours[0])}–${fmtTime(record.hours[1])}` };
    })
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Study spots matching the student's preferred environment. */
export function bestStudy(ctx, { near = null, limit = 3 } = {}) {
  const from = near ?? ctx.here;
  const pref = ctx.profile.studyPreference ?? "quiet";
  return STUDY_SPOTS.map((s) => withPlace(ctx, s)).filter(Boolean)
    .map(({ record, place }) => {
      const min = minutesFrom(ctx, from, place) ?? 99;
      const match = record.style === pref;
      // A library is the canonical quiet spot, so it outranks a merely closer corner
      const score = (match ? 6 : 0) + (record.style === "quiet" ? 1 : 0) + (place.category === "Libraries" ? 2 : 0) - min * 0.3;
      const reason = match ? (pref === "quiet" ? t("why_quiet") : t("why_group"))
        : from ? t("why_near", { min, place: from.name }) : t("why_firstyear");
      return { id: record.id, title: record.name, place, min, score, reason, record,
               detail: `${t(`study_${record.style === "group" ? "group" : record.style === "outdoor" ? "outdoor" : record.style === "cafe" ? "cafe" : "quiet"}`)}` };
    })
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Events, optionally limited to a day and/or the evening. */
export function upcomingEvents(ctx, { day = null, evening = false, limit = 3 } = {}) {
  const now = ctx.clock.now();
  const interests = ctx.profile.interests ?? [];
  return EVENTS.map((e) => withPlace(ctx, e)).filter(Boolean)
    .filter(({ record }) => (day == null || record.day === day) && (!evening || record.start >= 1020))
    .map(({ record, place }) => {
      const overlap = record.interests.filter((i) => interests.includes(i));
      const soon = record.day === now.day ? 3 : 0;
      const reason = overlap.length ? t("why_interest", { interest: t(`int_${overlap[0]}`) }) : t("why_firstyear");
      return { id: record.id, title: record.name, place, record, reason,
               score: overlap.length * 4 + soon - Math.abs(record.day - now.day),
               detail: `${t(`day${record.day}`)} · ${fmtTime(record.start)}` };
    })
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Clubs matching major and interests. */
export function matchingClubs(ctx, { limit = 4 } = {}) {
  const { major, interests = [] } = ctx.profile;
  return CLUBS.map((c) => withPlace(ctx, c)).filter(Boolean)
    .map(({ record, place }) => {
      const majorHit = record.majors.includes(major);
      const overlap = record.interests.filter((i) => interests.includes(i));
      const reason = majorHit ? t("why_major", { major })
        : overlap.length ? t("why_interest", { interest: t(`int_${overlap[0]}`) }) : t("why_firstyear");
      return { id: record.id, title: record.name, place, record, reason,
               score: (majorHit ? 5 : 0) + overlap.length * 4, detail: place.name };
    })
    .filter((c) => c.score > 0 || ctx.profile.clubsInterest !== "no")
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Campus resources, prioritizing anything matching stated accessibility needs. */
export function usefulResources(ctx, { limit = 4 } = {}) {
  const needs = ctx.profile.accessibilityNeeds ?? [];
  return RESOURCES.map((r) => withPlace(ctx, r)).filter(Boolean)
    .map(({ record, place }) => {
      const needed = record.needs.some((n) => needs.includes(n));
      return { id: record.id, title: record.name, place, record,
               reason: needed ? t("why_access") : t("why_firstyear"),
               score: needed ? 10 : 1, detail: place.name };
    })
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Landmarks and featured buildings worth seeing in week one. */
export function placesToExplore(ctx, { limit = 4 } = {}) {
  const wanted = ["drillfield", "torgersen-bridge", "lane-stadium", "squires", "newman", "burruss"];
  return wanted.map((id) => ctx.places.byId(id)).filter(Boolean)
    .filter((p) => p !== ctx.here)
    .slice(0, limit)
    .map((place) => ({
      id: place.id, title: place.name, place,
      reason: t("why_firstyear"), detail: ctx.places.description(place).split(/[.。]/)[0],
    }));
}

/** Everything the "For You" tab shows. */
export function recommendAll(ctx) {
  const next = ctx.nextClassPlace ?? null;
  return [
    { key: "rec_clubs", items: matchingClubs(ctx) },
    { key: "rec_events", items: upcomingEvents(ctx, { limit: 3 }) },
    { key: "rec_dining", items: bestDining(ctx, { near: next ?? ctx.here, limit: 3 }) },
    { key: "rec_study", items: bestStudy(ctx, { near: next ?? ctx.here, limit: 3 }) },
    { key: "rec_resources", items: usefulResources(ctx) },
    { key: "rec_explore", items: placesToExplore(ctx) },
  ].filter((g) => g.items.length);
}

/** "You have 90 minutes near McBryde — Newman Library is a good study option." */
export function gapSuggestion(ctx, { after, gapMinutes, atPlace }) {
  if (gapMinutes < 40) return null;
  const spot = bestStudy(ctx, { near: atPlace, limit: 1 })[0];
  if (!spot) return null;
  return {
    spot,
    text: t("a_gap", {
      gap: fmtDuration(gapMinutes), course: after.course, time: fmtTime(after.start),
      spot: spot.title, min: spot.min, pref: t(`study_${ctx.profile.studyPreference === "group" ? "group" : ctx.profile.studyPreference}`).toLowerCase(),
    }),
  };
}

export const featuredIds = PLACES.map((p) => p.id);
