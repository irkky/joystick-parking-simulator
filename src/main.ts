import "./styles.css";
import { EngineAudio } from "./audio";
import { InputController } from "./input";
import { CAR_DEPTH, CAR_WIDTH, LOT_DEPTH, LOT_WIDTH, levels } from "./levels";
import { SerialBridge } from "./serial";
import type { CarState, GamePhase, LevelResult, Rectangle } from "./types";
import { ParkingWorld } from "./world";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
};

const formatTime = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

const normalizeAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

const carCorners = (state: CarState): Array<[number, number]> => {
  const right: [number, number] = [Math.cos(state.heading), Math.sin(state.heading)];
  const forward: [number, number] = [Math.sin(state.heading), -Math.cos(state.heading)];
  const halfWidth = CAR_WIDTH / 2;
  const halfDepth = CAR_DEPTH / 2;
  return [
    [state.x + right[0] * halfWidth + forward[0] * halfDepth, state.z + right[1] * halfWidth + forward[1] * halfDepth],
    [state.x - right[0] * halfWidth + forward[0] * halfDepth, state.z - right[1] * halfWidth + forward[1] * halfDepth],
    [state.x - right[0] * halfWidth - forward[0] * halfDepth, state.z - right[1] * halfWidth - forward[1] * halfDepth],
    [state.x + right[0] * halfWidth - forward[0] * halfDepth, state.z + right[1] * halfWidth - forward[1] * halfDepth]
  ];
};

const rectangleCorners = (rectangle: Rectangle): Array<[number, number]> => {
  const halfWidth = rectangle.width / 2;
  const halfDepth = rectangle.depth / 2;
  return [
    [rectangle.x - halfWidth, rectangle.z - halfDepth],
    [rectangle.x + halfWidth, rectangle.z - halfDepth],
    [rectangle.x + halfWidth, rectangle.z + halfDepth],
    [rectangle.x - halfWidth, rectangle.z + halfDepth]
  ];
};

const polygonsOverlap = (car: CarState, rectangle: Rectangle): boolean => {
  const carPoints = carCorners(car);
  const rectanglePoints = rectangleCorners(rectangle);
  const axes: Array<[number, number]> = [
    [1, 0], [0, 1],
    [Math.cos(car.heading), Math.sin(car.heading)],
    [Math.sin(car.heading), -Math.cos(car.heading)]
  ];
  return axes.every(([axisX, axisZ]) => {
    const project = (points: Array<[number, number]>): [number, number] => {
      const values = points.map(([x, z]) => x * axisX + z * axisZ);
      return [Math.min(...values), Math.max(...values)];
    };
    const [carMin, carMax] = project(carPoints);
    const [rectangleMin, rectangleMax] = project(rectanglePoints);
    return carMax > rectangleMin && rectangleMax > carMin;
  });
};

const sceneRoot = byId<HTMLDivElement>("scene-root");
const world = new ParkingWorld(sceneRoot);
const input = new InputController();
const audio = new EngineAudio();

let phase: GamePhase = "menu";
let currentLevel = 0;
let score = 100;
let elapsed = 0;
let collisions = 0;
let parkingHold = 0;
let collisionCooldown = 0;
let lastFrame = performance.now();
let results: Array<LevelResult | null> = [null, null, null];
let car: CarState = { x: 0, z: 21, heading: 0, speed: 0, steering: 0, lastMotion: "forward" };

const menuOverlay = byId<HTMLDivElement>("menu-overlay");
const resultOverlay = byId<HTMLDivElement>("result-overlay");
const pauseOverlay = byId<HTMLDivElement>("pause-overlay");
const levelGrid = byId<HTMLDivElement>("level-grid");
const toast = byId<HTMLDivElement>("toast");
const connectButton = byId<HTMLButtonElement>("connect-button");
const serialLabel = byId<HTMLSpanElement>("serial-label");
const cameraButton = byId<HTMLButtonElement>("camera-button");
const soundButton = byId<HTMLButtonElement>("sound-button");
const pauseButton = byId<HTMLButtonElement>("pause-button");

const serial = new SerialBridge({
  onCommand(command) {
    input.setSerial(command);
    byId<HTMLElement>("axis-readout").textContent = `${command.x.toFixed(2)} / ${command.y.toFixed(2)}`;
  },
  onStatus(connected, message) {
    serialLabel.textContent = message;
    connectButton.textContent = connected ? "Disconnect ESP32" : "Connect ESP32";
    connectButton.classList.toggle("is-connected", connected);
  },
  onButton() {
    if (phase === "playing") confirmParking();
    else if (phase === "paused") resumeGame();
  }
});

function showToast(message: string, kind: "neutral" | "danger" | "success" = "neutral"): void {
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.classList.add("is-visible");
  window.clearTimeout(Number(toast.dataset.timer));
  toast.dataset.timer = String(window.setTimeout(() => toast.classList.remove("is-visible"), 1800));
}

function renderLevelCards(): void {
  levelGrid.replaceChildren();
  levels.forEach((level, index) => {
    const result = results[index];
    const button = document.createElement("button");
    button.className = "level-card";
    button.innerHTML = `
      <span class="level-card__number">0${index + 1}</span>
      <span class="level-card__body"><small>${level.kicker.split(" · ")[1]}</small><strong>${level.name}</strong><span>${level.description}</span></span>
      <span class="level-card__status">${result ? `${result.score} PTS` : "DRIVE"}</span>`;
    button.addEventListener("click", () => startLevel(index));
    levelGrid.append(button);
  });
}

function startLevel(index: number): void {
  if (!Number.isInteger(index) || !levels[index]) return;
  input.clear();
  currentLevel = index;
  const level = levels[index];
  score = 100;
  elapsed = 0;
  collisions = 0;
  parkingHold = 0;
  collisionCooldown = 0;
  car = {
    x: level.start.x,
    z: level.start.z,
    heading: level.start.heading,
    speed: 0,
    steering: 0,
    lastMotion: "forward"
  };
  world.loadLevel(level);
  world.updateCar(car);
  world.updateCamera(car, 0, true);
  world.setTargetReady(false);
  byId<HTMLElement>("level-kicker").textContent = level.kicker;
  byId<HTMLElement>("mission-title").textContent = level.mission;
  byId<HTMLElement>("mission-copy").textContent = level.description;
  menuOverlay.classList.add("is-hidden");
  resultOverlay.classList.add("is-hidden");
  pauseOverlay.classList.add("is-hidden");
  phase = "playing";
  void audio.start();
  updateHud();
  showToast("Ignition on · drive when ready");
}

function returnToMenu(): void {
  input.clear();
  phase = "menu";
  car.speed = 0;
  menuOverlay.classList.remove("is-hidden");
  resultOverlay.classList.add("is-hidden");
  pauseOverlay.classList.add("is-hidden");
  renderLevelCards();
}

function pauseGame(): void {
  if (phase !== "playing") return;
  input.clear();
  phase = "paused";
  car.speed = 0;
  pauseOverlay.classList.remove("is-hidden");
}

function resumeGame(): void {
  if (phase !== "paused") return;
  input.clear();
  phase = "playing";
  pauseOverlay.classList.add("is-hidden");
  lastFrame = performance.now();
}

function collides(candidate: CarState): "boundary" | "obstacle" | null {
  const corners = carCorners(candidate);
  const outside = corners.some(([x, z]) => Math.abs(x) > LOT_WIDTH / 2 - 0.7 || Math.abs(z) > LOT_DEPTH / 2 - 0.7);
  if (outside) return "boundary";
  if (levels[currentLevel].obstacles.some((obstacle) => polygonsOverlap(candidate, obstacle))) return "obstacle";
  return null;
}

function isParked(): boolean {
  const zone = levels[currentLevel].zone;
  const cos = Math.cos(-zone.heading);
  const sin = Math.sin(-zone.heading);
  const inside = carCorners(car).every(([x, z]) => {
    const localX = (x - zone.x) * cos - (z - zone.z) * sin;
    const localZ = (x - zone.x) * sin + (z - zone.z) * cos;
    return Math.abs(localX) <= zone.width / 2 && Math.abs(localZ) <= zone.depth / 2;
  });
  const aligned = Math.abs(normalizeAngle(car.heading - zone.heading)) < 0.16;
  const stopped = Math.abs(car.speed) < 0.18;
  const reverseOkay = !zone.reverseRequired || car.lastMotion === "reverse";
  return inside && aligned && stopped && reverseOkay;
}

function updatePhysics(delta: number): void {
  const controls = input.read();
  const previous = { ...car };
  const acceleration = controls.throttle >= 0 ? 11.5 : 8.5;
  const wantsOpposite = controls.throttle !== 0 && Math.sign(controls.throttle) !== Math.sign(car.speed) && Math.abs(car.speed) > 0.2;
  if (controls.throttle !== 0) car.speed += controls.throttle * acceleration * (wantsOpposite ? 1.9 : 1) * delta;
  else car.speed *= Math.exp(-2.25 * delta);
  if (Math.abs(car.speed) < 0.035) car.speed = 0;
  car.speed = Math.max(-7, Math.min(15, car.speed));
  const steeringBlend = 1 - Math.exp(-delta * 9);
  car.steering += (controls.steering - car.steering) * steeringBlend;
  if (Math.abs(car.speed) > 0.12) {
    car.heading += car.steering * (car.speed / 15) * 1.55 * delta;
    car.heading = normalizeAngle(car.heading);
  }
  const forwardX = Math.sin(car.heading);
  const forwardZ = -Math.cos(car.heading);
  car.x += forwardX * car.speed * delta;
  car.z += forwardZ * car.speed * delta;
  if (car.speed > 0.2) car.lastMotion = "forward";
  if (car.speed < -0.2) car.lastMotion = "reverse";

  const collision = collides(car);
  if (collision) {
    car.x = previous.x;
    car.z = previous.z;
    car.heading = previous.heading;
    car.speed = -previous.speed * 0.12;
    if (collisionCooldown <= 0) {
      const penalty = collision === "boundary" ? 10 : 20;
      score = Math.max(0, score - penalty);
      collisions += 1;
      collisionCooldown = 1;
      audio.collision();
      showToast(`${collision === "boundary" ? "Curb touched" : "Collision"} · −${penalty} points`, "danger");
    }
  }
  collisionCooldown = Math.max(0, collisionCooldown - delta);
  world.updateCar(car);
  world.updateCamera(car, delta);
  audio.update(car.speed);

  const parked = isParked();
  world.setTargetReady(parked);
  parkingHold = parked ? parkingHold + delta : 0;
  if (parkingHold >= 1) finishLevel();
}

function confirmParking(): void {
  if (phase !== "playing") return;
  if (isParked()) finishLevel();
  else showToast("Center the whole car, straighten the wheels, and stop", "danger");
}

function finishLevel(): void {
  if (phase !== "playing") return;
  phase = "success";
  car.speed = 0;
  score += 50;
  const previousResult = results[currentLevel];
  if (!previousResult || score > previousResult.score || (score === previousResult.score && elapsed < previousResult.elapsed)) {
    results[currentLevel] = { score, elapsed, collisions };
  }
  audio.success();
  const resultTitle = byId<HTMLElement>("result-title");
  const resultCopy = byId<HTMLElement>("result-copy");
  const resultStats = byId<HTMLDivElement>("result-stats");
  const resultActions = byId<HTMLDivElement>("result-actions");
  resultTitle.textContent = "Parking complete";
  resultCopy.textContent = "A controlled approach, a clean stop, and the car fully inside the bay.";
  resultStats.innerHTML = `<div><strong>${score}</strong><span>Score</span></div><div><strong>${formatTime(elapsed)}</strong><span>Time</span></div><div><strong>${collisions}</strong><span>Impacts</span></div>`;
  resultActions.replaceChildren();
  const next = document.createElement("button");
  next.className = "button button--primary";
  next.textContent = currentLevel < levels.length - 1 ? "Next challenge" : "Challenge summary";
  next.addEventListener("click", () => currentLevel < levels.length - 1 ? startLevel(currentLevel + 1) : showSummary());
  const retry = document.createElement("button");
  retry.className = "button button--secondary";
  retry.textContent = "Drive again";
  retry.addEventListener("click", () => startLevel(currentLevel));
  resultActions.append(next, retry);
  resultOverlay.classList.remove("is-hidden");
}

function showTimeout(): void {
  phase = "timeout";
  car.speed = 0;
  byId<HTMLElement>("result-title").textContent = "Time expired";
  byId<HTMLElement>("result-copy").textContent = "Reset your line, use gentler steering, and try the challenge again.";
  byId<HTMLDivElement>("result-stats").innerHTML = `<div><strong>${score}</strong><span>Score</span></div><div><strong>${formatTime(elapsed)}</strong><span>Time</span></div><div><strong>${collisions}</strong><span>Impacts</span></div>`;
  const actions = byId<HTMLDivElement>("result-actions");
  actions.replaceChildren();
  const retry = document.createElement("button");
  retry.className = "button button--primary";
  retry.textContent = "Retry challenge";
  retry.addEventListener("click", () => startLevel(currentLevel));
  actions.append(retry);
  resultOverlay.classList.remove("is-hidden");
}

function showSummary(): void {
  if (results.some((result) => result === null)) {
    returnToMenu();
    showToast("Complete all three challenges to see your summary");
    return;
  }
  const completed = results.filter((result): result is LevelResult => result !== null);
  const totalScore = completed.reduce((sum, result) => sum + result.score, 0);
  const totalTime = completed.reduce((sum, result) => sum + result.elapsed, 0);
  const totalCollisions = completed.reduce((sum, result) => sum + result.collisions, 0);
  byId<HTMLElement>("result-title").textContent = "Parking certification complete";
  byId<HTMLElement>("result-copy").textContent = "Three different approaches completed in a true 3D driving environment.";
  byId<HTMLDivElement>("result-stats").innerHTML = `<div><strong>${totalScore} / 450</strong><span>Total score</span></div><div><strong>${formatTime(totalTime)}</strong><span>Total time</span></div><div><strong>${totalCollisions}</strong><span>Impacts</span></div>`;
  const actions = byId<HTMLDivElement>("result-actions");
  actions.replaceChildren();
  const menu = document.createElement("button");
  menu.className = "button button--primary";
  menu.textContent = "Choose a challenge";
  menu.addEventListener("click", returnToMenu);
  actions.append(menu);
}

function updateHud(): void {
  const level = levels[currentLevel];
  byId<HTMLElement>("score-value").textContent = String(score);
  byId<HTMLElement>("speed-value").textContent = String(Math.round(Math.abs(car.speed) * 6.2));
  byId<HTMLElement>("time-value").textContent = formatTime(level.limit - elapsed);
  byId<HTMLElement>("collision-value").textContent = String(collisions);
  byId<HTMLElement>("gear-value").textContent = car.speed < -0.15 ? "R" : car.speed > 0.15 ? "D" : "N";
  byId<HTMLDivElement>("parking-progress").style.setProperty("--progress", `${Math.min(100, parkingHold * 100)}%`);
}

function animate(time: number): void {
  const delta = Math.min(0.05, Math.max(0, (time - lastFrame) / 1000));
  lastFrame = time;
  if (phase === "playing") {
    elapsed += delta;
    if (elapsed >= levels[currentLevel].limit) showTimeout();
    else updatePhysics(delta);
    updateHud();
  } else {
    audio.update(0);
    world.updateCamera(car, delta);
  }
  world.render();
  requestAnimationFrame(animate);
}

connectButton.addEventListener("click", () => serial.connected ? void serial.disconnect() : void serial.connect());
cameraButton.addEventListener("click", () => {
  const overhead = world.toggleCamera();
  cameraButton.textContent = overhead ? "Chase camera" : "Overhead camera";
  byId<HTMLElement>("camera-chip").textContent = overhead ? "OVERHEAD CAM" : "CHASE CAM";
  showToast(overhead ? "Overhead camera" : "Chase camera");
});
soundButton.addEventListener("click", () => {
  const muted = audio.toggle();
  soundButton.textContent = muted ? "Sound off" : "Sound on";
});
pauseButton.addEventListener("click", pauseGame);
byId<HTMLButtonElement>("resume-button").addEventListener("click", resumeGame);
byId<HTMLButtonElement>("restart-button").addEventListener("click", () => startLevel(currentLevel));
byId<HTMLButtonElement>("pause-menu-button").addEventListener("click", returnToMenu);
byId<HTMLButtonElement>("result-menu-button").addEventListener("click", returnToMenu);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) confirmParking();
  }
  if (event.code === "Escape" && !event.repeat) {
    if (phase === "playing") pauseGame();
    else if (phase === "paused") resumeGame();
  }
  if (event.code === "KeyC" && !event.repeat) cameraButton.click();
  if (event.code === "KeyM" && !event.repeat) soundButton.click();
});

if (!serial.supported) {
  connectButton.disabled = true;
  serialLabel.textContent = "Web Serial unavailable · keyboard driving active";
}

window.addEventListener("blur", pauseGame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

world.loadLevel(levels[0]);
world.updateCar(car);
world.updateCamera(car, 0, true);
renderLevelCards();
updateHud();
requestAnimationFrame(animate);

declare global {
  interface Window {
    __PARKLAB__: {
      startLevel(index: number): void;
      getState(): { phase: GamePhase; level: number; car: CarState; score: number; collisions: number };
      isParked(): boolean;
    };
  }
}

window.__PARKLAB__ = {
  startLevel,
  getState: () => ({ phase, level: currentLevel, car: { ...car }, score, collisions }),
  isParked
};
