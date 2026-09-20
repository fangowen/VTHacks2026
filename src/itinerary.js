// "My First Week": a day-by-day orientation plan built from the student's schedule,
// interests, dining preferences and accessibility needs.
// Every item carries a placeId so the UI can focus it on the existing map.

import { t, fmtTime } from "./i18n.js";
import { classesOn } from "./profile.js";
import { walkMinutes } from "./routing.js";
import { bestDining, bestStudy, upcomingEvents, matchingClubs, usefulResources } from "./recommendations.js";
import { RESOURCES } from "./data/campus.js";

const TASKS_BY_DAY = {
  1: ["passport"], 2: ["library-help"], 3: ["advising"], 4: ["career"], 5: [],
};

export function generateWeek(ctx) {
  const home = ctx.places.byName(ctx.profile.residenceHall) ?? ctx.here;
  const days = [];

  for (let day = 1; day <= 5; day++) {
    const items = [];
    const classes = classesOn(ctx.profile, day);
    let at = home;

    for (const cls of classes) {
      const place = ctx.places.byName(cls.building) ?? ctx.places.find(cls.building);
      if (place && at && place !== at) {
        const min = walkMinutes(ctx.places.distance(at, place), ctx.slowWalk);
        items.push({
          start: cls.start - min - 5, kind: "walk", placeId: place.id,
          title: t("it_walkTo", { from: at.name, to: place.name, min }),
        });
      }
      items.push({ start: cls.start, end: cls.end, kind: "class", placeId: place?.id ?? null, title: cls.course, sub: place?.name });
      if (place) at = place;
    }

    // Fill the long gaps: lunch first, then a study block
    const gaps = findGaps(classes);
    let lunched = false;
    for (const gap of gaps) {
      const isLunch = !lunched && gap.start <= 810 && gap.end >= 690 && gap.minutes >= 40;
      if (isLunch) {
        const pick = bestDining(ctx, { near: at, at: Math.max(gap.start + 5, 690), limit: 1 })[0];
        if (pick) {
          items.push({ start: Math.max(gap.start + 5, 690), kind: "meal", placeId: pick.place.id,
                       title: t("it_lunch", { name: pick.title }), sub: pick.reason });
          lunched = true; at = pick.place;
          continue;
        }
      }
      if (gap.minutes >= 60) {
        const spot = bestStudy(ctx, { near: at, limit: 1 })[0];
        if (spot) {
          items.push({ start: gap.start + 10, kind: "study", placeId: spot.place.id,
                       title: t("it_study", { name: spot.title }), sub: spot.reason });
          at = spot.place;
        }
      }
    }

    // A first-week errand, scheduled into the afternoon
    for (const id of TASKS_BY_DAY[day] ?? []) {
      const res = RESOURCES.find((r) => r.id === id);
      const place = res && ctx.places.placeOf(res);
      if (!place) continue;
      items.push({ start: lastEnd(classes, 900) + 30, kind: "task", placeId: place.id,
                   title: res.taskKey ? t(res.taskKey) : res.name, sub: place.name });
    }
    // Accessibility: make registering with SSD an early-week task
    if (day === 1 && ctx.profile.accessibilityNeeds?.length) {
      const ssd = usefulResources(ctx, { limit: 1 })[0];
      if (ssd) items.push({ start: 960, kind: "task", placeId: ssd.place.id, title: t("task_access"), sub: ssd.place.name });
    }

    // Something social: a matching event, else a club to look up
    const event = upcomingEvents(ctx, { day, limit: 1 })[0];
    if (event) {
      items.push({ start: event.record.start, kind: "event", placeId: event.place.id, title: event.title, sub: event.reason });
    } else if (day === 2 && ctx.profile.clubsInterest !== "no") {
      const club = matchingClubs(ctx, { limit: 1 })[0];
      if (club) items.push({ start: 1140, kind: "club", placeId: club.place.id, title: club.title, sub: club.reason });
    }

    // Explore the campus landmarks on the first day
    if (day === 1) {
      const drill = ctx.places.byId("drillfield");
      if (drill) items.push({ start: 1080, kind: "explore", placeId: drill.id, title: t("task_drillfield"), sub: drill.name });
    }
    if (day === 3) {
      const sq = ctx.places.byId("squires");
      if (sq) items.push({ start: 1080, kind: "explore", placeId: sq.id, title: t("task_squires"), sub: sq.name });
    }

    items.sort((a, b) => a.start - b.start);
    days.push({ day, items: items.map((i) => ({ ...i, time: fmtTime(i.start) })) });
  }
  return days;
}

function findGaps(classes) {
  const gaps = [];
  for (let i = 1; i < classes.length; i++) {
    const minutes = classes[i].start - classes[i - 1].end;
    if (minutes >= 40) gaps.push({ start: classes[i - 1].end, end: classes[i].start, minutes });
  }
  return gaps;
}

const lastEnd = (classes, fallback) => (classes.length ? classes[classes.length - 1].end : fallback);
