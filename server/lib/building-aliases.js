// Common campus shorthand that may not be obvious from the official map label.
//
// Keep aliases lowercase and point them at the exact building name used by the map. The
// resolver ignores case, punctuation and accents, so entries do not need variants such as
// "N.C.B." or "the library" unless the words themselves are different.
export const BUILDING_ALIASES = {
  ncb: "New Classroom Building",
  library: "Newman Library",
  "the library": "Newman Library",
  biblioteca: "Newman Library",
  "la biblioteca": "Newman Library",
  "图书馆": "Newman Library",
  "पुस्तकालय": "Newman Library",
  "도서관": "Newman Library",
  squires: "Squires Student Center",
  torg: "Torgersen Hall",
  torgersen: "Torgersen Hall",
  goodwin: "Goodwin Hall",
  pritchard: "Pritchard Hall",
  burruss: "Burruss Hall",
  mcbryde: "McBryde Hall",
  mccomas: "McComas Hall",
};
