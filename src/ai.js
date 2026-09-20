// WHERE THE HOKIE AM I? assistant. Every user message goes to Gemini; the browser supplies the live
// building directory and current student/map state, while the server validates all tool calls.

import { t, getLang } from "./i18n.js";
import { gapAfter } from "./profile.js";
import { gapSuggestion } from "./recommendations.js";
import { askGuide } from "./api.js";

function guideBuildings(ctx) {
  return ctx.places.all()
    .filter((place) => place.kind === "building")
    .map((place) => ({
      name: place.name,
      x: place.x,
      y: place.y,
      description: ctx.places.description(place),
      tags: place.building?.tags ?? {},
    }));
}

/** Main entry point. Gemini decides which validated data tools to call and whether to fly. */
export async function handleMessage(message, ctx) {
  if (!String(message ?? "").trim()) return null;
  try {
    const out = await askGuide({
      message,
      language: getLang(),
      history: ctx.history ?? [],
      buildings: guideBuildings(ctx),
      currentLocation: ctx.here ? { name: ctx.here.name, x: ctx.here.x, y: ctx.here.y } : null,
      studentContext: {
        profile: {
          name: ctx.profile.name,
          major: ctx.profile.major,
          residenceHall: ctx.profile.residenceHall,
          interests: ctx.profile.interests,
          diningPreferences: ctx.profile.diningPreferences,
          studyPreference: ctx.profile.studyPreference,
          accessibilityNeeds: ctx.profile.accessibilityNeeds,
          schedule: ctx.profile.schedule,
        },
        currentTime: ctx.clock.now(),
        selectedBuilding: ctx.selected?.name ?? null,
        lastSuggestedPlace: ctx.lastSuggested?.name ?? null,
      },
    });
    if (!out?.text) return null;
    const target = out.action?.type === "flyTo" ? ctx.places.byName(out.action.building) : null;
    return {
      text: out.text,
      audio: out.audio,
      action: target ? { type: "focus", placeId: target.id } : null,
      suggest: target ?? null,
    };
  } catch (error) {
    console.warn("WHERE THE HOKIE AM I? backend is unavailable:", error);
    return { text: error.message || t("a_backendError"), isError: true };
  }
}

/** Message shown when the student arrives somewhere; this is navigation state, not intent logic. */
export function arrivalMessage(ctx, place, forClass) {
  const desc = ctx.places.description(place);
  let text = t("a_arrived", { place: place.name, desc });
  let suggest = null;
  if (forClass) {
    const { next, minutes } = gapAfter(ctx.profile, forClass, ctx.clock.now().day);
    if (next) {
      const rec = gapSuggestion(ctx, { after: next, gapMinutes: minutes, atPlace: place });
      if (rec) { text += ` ${rec.text}`; suggest = rec.spot.place; }
    }
  }
  const acc = ctx.places.accessibility(place);
  if (ctx.profile.accessibilityNeeds?.length && acc.elevator) {
    text += ` ${t("a_elevator", { place: place.name, entrance: t("entranceAt", { dir: t(acc.entrance ?? "n") }) })}`;
  }
  return { text, suggest };
}

export const suggestionKeys = ["sug_next", "sug_eat", "sug_study", "sug_clubs", "sug_tonight", "sug_home"];
