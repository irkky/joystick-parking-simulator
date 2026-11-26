export type GamePhase = "menu" | "playing" | "paused" | "success" | "timeout";

export type Rectangle = {
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type ObstacleKind = "parked-car" | "barrier" | "planter";

export type Obstacle = Rectangle & {
  kind: ObstacleKind;
  color?: number;
  rotation?: number;
};

export type ParkingZone = Rectangle & {
  heading: number;
  reverseRequired?: boolean;
};

export type Level = {
  name: string;
  kicker: string;
  mission: string;
  description: string;
  limit: number;
  start: { x: number; z: number; heading: number };
  zone: ParkingZone;
  obstacles: Obstacle[];
};

export type CarState = {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steering: number;
  lastMotion: "forward" | "reverse";
};

export type LevelResult = {
  score: number;
  elapsed: number;
  collisions: number;
};

export type InputState = {
  throttle: number;
  steering: number;
};

export type SerialCommand = {
  x: number;
  y: number;
  button: boolean;
  direction: string;
};
