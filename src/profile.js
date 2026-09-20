// Student profile, the demo clock, and schedule lookups.
// The profile is the single object the assistant, itinerary and recommendations read from.

import { MAJORS, RESIDENCE_HALLS } from "./data/campus.js";

const KEY = "hokie.profile.v1";

export const DEFAULT_PROFILE = {
  name: "", major: "Computer Science", residenceHall: "Pritchard Hall",
  interests: [], accessibilityNeeds: [], schedule: [],
  studyPreference: "quiet", diningPreferences: ["quick"], clubsInterest: "yes",
  social: "balanced", language: "en", onboarded: false,
};

// The profile used by the "Use demo profile" button and the judging walkthrough
export const DEMO_PROFILE = {
  ...DEFAULT_PROFILE,
  name: "Alex", major: "Computer Science", residenceHall: "Pritchard Hall",
  interests: ["hackathons", "gaming", "fitness"], accessibilityNeeds: [],
  studyPreference: "quiet", diningPreferences: ["quick", "healthy"], clubsInterest: "yes",
  social: "balanced", language: "en", onboarded: true,
  schedule: scheduleForMajor("Computer Science"),
};

export function scheduleForMajor(major) {
  const m = MAJORS.find((x) => x.name === major) ?? MAJORS[0];
  return m.schedule.map((c) => ({ ...c, days: [...c.days] }));
}
export const majorInfo = (major) => MAJORS.find((x) => x.name === major) ?? MAJORS[0];
export const residenceHalls = () => RESIDENCE_HALLS;

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PROFILE };
}
export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  return p;
}
export function clearProfile() {
  try { localStorage.removeItem(KEY); } catch {}
}

// ---------- Clock ----------
// The demo runs on a simulated Monday morning so "your next class" is always meaningful.
// Switch to real time from Settings.
export const clock = {
  mode: "demo", day: 1, minutes: 510,   // Monday 8:30 AM
  now() {
    if (this.mode === "real") { const d = new Date(); return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() }; }
    return { day: this.day, minutes: this.minutes };
  },
  set(day, minutes) { this.mode = "demo"; this.day = day; this.minutes = minutes; },
  useRealTime() { this.mode = "real"; },
  // Advance the demo clock (e.g. after a simulated walk) without passing midnight
  advance(mins) {
    if (this.mode !== "demo") return;
    this.minutes = Math.min(23 * 60 + 59, this.minutes + mins);
  },
};

// ---------- Schedule lookups ----------
export const classesOn = (profile, day) =>
  profile.schedule.filter((c) => c.days.includes(day)).sort((a, b) => a.start - b.start);

/** The next class at or after `now`, searching forward up to a week. */
export function nextClass(profile, now = clock.now()) {
  for (let step = 0; step < 8; step++) {
    const day = (now.day + step) % 7;
    for (const c of classesOn(profile, day)) {
      if (step === 0 && c.start <= now.minutes) continue;
      return { cls: c, day, minutesUntil: step * 1440 + c.start - now.minutes, isToday: step === 0 };
    }
  }
  return null;
}

/** The class happening right now, if any. */
export function currentClass(profile, now = clock.now()) {
  return classesOn(profile, now.day).find((c) => now.minutes >= c.start && now.minutes <= c.end) ?? null;
}

/** First class of a department (e.g. "CS") in the week, starting from Monday. */
export function firstClassOfDept(profile, dept) {
  const up = String(dept || "").toUpperCase();
  for (let day = 1; day <= 5; day++) {
    const hit = classesOn(profile, day).find((c) => c.course.toUpperCase().startsWith(up));
    if (hit) return { cls: hit, day };
  }
  return null;
}

/** First class on a given day. */
export function firstClassOn(profile, day) {
  const list = classesOn(profile, day);
  return list.length ? { cls: list[0], day } : null;
}

/** The class that starts closest to a given time of day (used for "before my 2 PM class"). */
export function classNearTime(profile, minutes, day = clock.now().day) {
  let best = null, bestGap = Infinity;
  for (let step = 0; step < 7; step++) {
    const d = (day + step) % 7;
    for (const c of classesOn(profile, d)) {
      const gap = Math.abs(c.start - minutes) + step * 1440;
      if (gap < bestGap) { bestGap = gap; best = { cls: c, day: d }; }
    }
    if (best && step === 0 && bestGap <= 120) break;
  }
  return bestGap <= 24 * 60 ? best : null;
}

/** Free time after a class before the next one that day. */
export function gapAfter(profile, cls, day) {
  const later = classesOn(profile, day).filter((c) => c.start >= cls.end);
  const next = later[0];
  return next ? { next, minutes: next.start - cls.end } : { next: null, minutes: 0 };
}

export const needsStepFree = (p) => p.accessibilityNeeds.includes("stepfree");
export const walksSlowly = (p) => p.accessibilityNeeds.includes("stepfree") || p.accessibilityNeeds.includes("limited");
