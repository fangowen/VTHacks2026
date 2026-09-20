// Locally served campus photographs with their required attribution metadata.
// Add new entries by exact map building name; do not add an image without a verified free license.
export const BUILDING_IMAGES = Object.freeze({
  "Burruss Hall": {
    file: "./images/buildings/burruss-hall.jpg",
    alt: "Burruss Hall's stone facade and clock-tower entrance viewed across the Drillfield.",
    author: "Buridan",
    license: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/File:Virginiatech-burrusshall-fromdrillfield.JPG#Licensing",
    source: "https://commons.wikimedia.org/wiki/File:Virginiatech-burrusshall-fromdrillfield.JPG",
  },
  "Newman Library": {
    file: "./images/buildings/newman-library.jpg",
    alt: "Newman Library's long stone and brick exterior seen from the Virginia Tech Drillfield.",
    author: "Buridan",
    license: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/File:Virginiatech-newmanlibrary-fromdrillfield.JPG#Licensing",
    source: "https://commons.wikimedia.org/wiki/File:Virginiatech-newmanlibrary-fromdrillfield.JPG",
  },
  "Torgersen Hall": {
    file: "./images/buildings/torgersen-hall.jpg",
    alt: "The glass-enclosed Torgersen Bridge spanning Alumni Mall between Torgersen Hall and Newman Library.",
    author: "PumpkinSky",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:VaTechTorgersenHallBridge.jpg",
  },
  "Squires Student Center": {
    file: "./images/buildings/squires-student-center.jpg",
    alt: "The stone entrance and plaza of Squires Student Center on the Virginia Tech campus.",
    author: "Eric T Gunther",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Squires_Student_Center.JPG",
  },
  "McBryde Hall": {
    file: "./images/buildings/mcbryde-hall.jpg",
    alt: "The multi-story stone exterior and recessed entrance of McBryde Hall.",
    author: "Eric T Gunther",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:McBryde_Hall_Virginia_Tech.JPG",
  },
  "War Memorial Hall": {
    file: "./images/buildings/war-memorial-hall.jpg",
    alt: "The Hokie-stone exterior and tall windows of Virginia Tech's War Memorial Hall, formerly War Memorial Gym.",
    author: "Eric T Gunther",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:War_Memorial_Gym_Virginia_Tech.JPG",
  },
  "Lane Stadium": {
    file: "./images/buildings/lane-stadium.jpg",
    alt: "Lane Stadium's exterior grandstands viewed from the Hokies' practice field.",
    author: "EpicV27",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:LANE_STADIUM_HOKIES.JPG",
  },
  "Cassell Coliseum": {
    file: "./images/buildings/cassell-coliseum.jpg",
    alt: "A wide exterior view of Virginia Tech's Cassell Coliseum and its arched roof.",
    author: "User:B",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Cassell_Coliseum_wide_shot.jpg",
  },
});

export const buildingImageFor = (name) => BUILDING_IMAGES[name] ?? null;
