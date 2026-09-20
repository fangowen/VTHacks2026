// "My First Week": the student's class schedule, day by day, with the walking leg before
// each class so they know when to leave and from where.
// Every item carries a placeId so the UI can focus it on the existing map.

import { t, fmtTime } from "./i18n.js";
import { classesOn } from "./profile.js";
import { walkMinutes } from "./routing.js";

export function generateWeek(ctx) {
  const home = ctx.places.byName(ctx.profile.residenceHall) ?? ctx.here;
  const days = [];

  for (let day = 1; day <= 5; day++) {
    const items = [];
    const classes = classesOn(ctx.profile, day);
    let at = home;                                 // walk legs start from the residence hall each morning

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

    items.sort((a, b) => a.start - b.start);
    days.push({ day, items: items.map((i) => ({ ...i, time: fmtTime(i.start) })) });
  }
  return days;
}
