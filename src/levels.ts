import type { Level } from "./types";

export const LOT_WIDTH = 80;
export const LOT_DEPTH = 58;
export const CAR_WIDTH = 2.2;
export const CAR_DEPTH = 4.5;

export const levels: Level[] = [
  {
    name: "Precision arrival",
    kicker: "LEVEL 01 · CONTROL",
    mission: "Park cleanly in the illuminated bay.",
    description: "Build speed gently, stay between the barriers, then brake inside the wide bay.",
    limit: 180,
    start: { x: 0, z: 21, heading: 0 },
    zone: { x: 0, z: -20, width: 8.5, depth: 11, heading: 0 },
    obstacles: [
      { x: -20, z: -19, width: 3.3, depth: 6, kind: "parked-car", color: 0x788d91 },
      { x: 20, z: -19, width: 3.3, depth: 6, kind: "parked-car", color: 0xb99b72 },
      { x: -17, z: 1, width: 12, depth: 2.3, kind: "barrier" },
      { x: 17, z: 1, width: 12, depth: 2.3, kind: "barrier" }
    ]
  },
  {
    name: "Cross-lot approach",
    kicker: "LEVEL 02 · ROUTE",
    mission: "Read the lot and find the open lane.",
    description: "Drive around the central barrier, line up on the right, and enter the bay under control.",
    limit: 150,
    start: { x: -28, z: 21, heading: 0 },
    zone: { x: 28, z: -20, width: 8, depth: 10.5, heading: 0 },
    obstacles: [
      { x: 2, z: 0, width: 40, depth: 2.6, kind: "barrier" },
      { x: -7, z: -20, width: 3.3, depth: 6, kind: "parked-car", color: 0x496c84 },
      { x: 1, z: -20, width: 3.3, depth: 6, kind: "parked-car", color: 0x9e665b },
      { x: -7, z: 17, width: 15, depth: 5, kind: "planter" }
    ]
  },
  {
    name: "Reverse bay finish",
    kicker: "LEVEL 03 · REVERSE",
    mission: "Reverse between the parked cars.",
    description: "Use the open lane to line up, face north, and reverse slowly into the southern bay.",
    limit: 150,
    start: { x: -27, z: -20, heading: 0 },
    zone: { x: 0, z: 21, width: 7.5, depth: 10, heading: 0, reverseRequired: true },
    obstacles: [
      { x: 0, z: 0, width: 34, depth: 2.6, kind: "barrier" },
      { x: -7, z: 21, width: 3.3, depth: 6, kind: "parked-car", color: 0x687e93 },
      { x: 7, z: 21, width: 3.3, depth: 6, kind: "parked-car", color: 0xa37662 },
      { x: -29, z: 8, width: 9, depth: 5, kind: "planter" },
      { x: 29, z: 14, width: 3.3, depth: 6, kind: "parked-car", color: 0x6e7f73 },
      { x: 10, z: -20, width: 3.3, depth: 6, kind: "parked-car", color: 0xc4b17d }
    ]
  }
];
