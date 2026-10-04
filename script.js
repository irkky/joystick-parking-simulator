"use strict";

// All positions use the same 900 × 560 map, even on a small screen.
const MAP_WIDTH = 900;
const MAP_HEIGHT = 560;
const CAR_WIDTH = 48; // Includes the mirrors.
const CAR_HEIGHT = 68;
const MOVE_SPEED = 150; // Map pixels per second.
const DEAD_ZONE = 0.15;
const SERIAL_BAUD = 115200;
const SERIAL_TIMEOUT = 350; // Stop if the board stops sending movement.

// Each rectangle has x, y, width and height. Students can edit their own lots here.
const levels = [
  {
    name: "Straight parking", mission: "Keep it straight.",
    description: "Drive forward into the roomy bay. Release the controls, then press P or Space to park.",
    limit: 180, start: { x: 450, y: 455 },
    zone: { x: 378, y: 45, width: 144, height: 125 },
    obstacles: [
      { x: 145, y: 60, width: 66, height: 110, type: "parked-car" },
      { x: 690, y: 60, width: 66, height: 110, type: "parked-car" },
      { x: 190, y: 295, width: 125, height: 32, type: "barrier" },
      { x: 590, y: 295, width: 125, height: 32, type: "barrier" }
    ]
  },
  {
    name: "Turning parking", mission: "Find the open route.",
    description: "Go up the left lane, move right above the long barrier, then ease into the top-right bay.",
    limit: 150, start: { x: 150, y: 455 },
    zone: { x: 705, y: 45, width: 110, height: 110 },
    obstacles: [
      { x: 260, y: 270, width: 470, height: 40, type: "barrier" },
      { x: 350, y: 55, width: 68, height: 112, type: "parked-car" },
      { x: 485, y: 55, width: 68, height: 112, type: "parked-car" },
      { x: 390, y: 410, width: 200, height: 65, type: "planter" }
    ]
  },
  {
    name: "Reverse & tight parking", mission: "Back it in. Nice and slow.",
    description: "Ease down to the lane above the barrier, then cross right. Reverse down the right lane, move left below the barrier, and back into the bay.",
    limit: 120, start: { x: 150, y: 105 },
    zone: { x: 408, y: 421, width: 84, height: 105 },
    obstacles: [
      { x: 255, y: 210, width: 390, height: 40, type: "barrier" },
      { x: 315, y: 415, width: 60, height: 115, type: "parked-car" },
      { x: 525, y: 415, width: 60, height: 115, type: "parked-car" },
      { x: 45, y: 300, width: 120, height: 65, type: "planter" },
      { x: 775, y: 385, width: 65, height: 120, type: "parked-car" },
      { x: 440, y: 40, width: 65, height: 85, type: "parked-car" }
    ]
  }
];

const state = {
  screen: "home", level: 0, running: false, paused: false,
  score: 100, elapsed: 0, collisions: 0, parkedTime: 0,
  results: [null, null, null], contact: false, feedbackTime: 0,
  car: { x: 450, y: 455, angle: 0, speed: 0, direction: "CENTER", lastVertical: "UP" }
};
const keys = new Set();
let touchDirection = "CENTER";
let previousFrame = 0;
let port = null;
let serialReader = null;
let serialTask = null;
let serialClosing = false;
let serialBusy = false;
let joystick = { x: 0, y: 0, direction: "CENTER", button: false };
let lastSerialTime = 0;
let lastButtonTime = -1000;
let lastNavigationTime = -1000;

function $(id) { return document.getElementById(id); }
function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return String(Math.floor(whole / 60)).padStart(2, "0") + ":" + String(whole % 60).padStart(2, "0");
}

// Screens are normal HTML sections. Only the current section is visible.
function showScreen(name) {
  state.screen = name;
  keys.clear();
  touchDirection = "CENTER";
  if (name !== "game") state.running = false;
  document.querySelectorAll(".screen").forEach(function (screen) {
    screen.classList.toggle("hidden", screen.id !== name);
    screen.classList.toggle("active", screen.id === name);
  });
  document.querySelectorAll("nav button").forEach(function (button) {
    button.classList.toggle("active", button.dataset.screen === name);
  });
  if (name === "levels") updateLevelSelection();
  const heading = $(name).querySelector("h1");
  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function updateLevelSelection() {
  $("level-selection").innerHTML = $("home-levels").innerHTML;
  document.querySelectorAll("#level-selection [data-level]").forEach(function (card) {
    const result = state.results[Number(card.dataset.level)];
    if (result) {
      card.classList.add("completed");
      card.querySelector(".difficulty").textContent = "✓ COMPLETE · " + result.score + " POINTS";
    }
  });
  $("session-progress").textContent = state.results.filter(Boolean).length + " of 3 levels complete";
}

function placeRectangle(element, rectangle) {
  element.style.left = rectangle.x / MAP_WIDTH * 100 + "%";
  element.style.top = rectangle.y / MAP_HEIGHT * 100 + "%";
  element.style.width = rectangle.width / MAP_WIDTH * 100 + "%";
  element.style.height = rectangle.height / MAP_HEIGHT * 100 + "%";
}

function startGame(levelNumber) { loadLevel(levelNumber); }
function loadLevel(levelNumber) {
  state.level = levelNumber;
  const level = levels[levelNumber];
  state.score = 100;
  state.elapsed = 0;
  state.collisions = 0;
  state.parkedTime = 0;
  state.contact = false;
  state.feedbackTime = 0;
  state.paused = false;
  state.car = { x: level.start.x, y: level.start.y, angle: 0, speed: 0, direction: "CENTER", lastVertical: "UP" };
  $("game").classList.remove("paused", "collision", "success");
  $("collision-flash").classList.add("hidden");
  $("level-eyebrow").textContent = "LEVEL 0" + (levelNumber + 1) + " / 03";
  $("game-title").textContent = level.name;
  $("mission-title").textContent = level.mission;
  $("mission-description").textContent = level.description;
  $("game-message").textContent = "Head for the marked parking space.";
  placeRectangle($("parking-zone"), level.zone);
  $("obstacles").replaceChildren();
  level.obstacles.forEach(function (obstacle) {
    const element = document.createElement("div");
    element.className = "obstacle " + obstacle.type;
    placeRectangle(element, obstacle);
    $("obstacles").appendChild(element);
  });
  $("start-marker").style.left = (level.start.x - 34) / MAP_WIDTH * 100 + "%";
  $("start-marker").style.top = (level.start.y + 47) / MAP_HEIGHT * 100 + "%";
  showScreen("game");
  state.running = true;
  renderCar();
  updateUI();
}

function pauseGame() {
  if (!state.running || state.paused) return;
  state.paused = true;
  keys.clear();
  touchDirection = "CENTER";
  state.car.speed = 0;
  $("game").classList.add("paused");
  $("pause-dialog").showModal();
  $("resume-button").focus();
}
function closePause() {
  $("pause-dialog").close();
  $("game").classList.remove("paused");
  state.paused = false;
  keys.clear();
  touchDirection = "CENTER";
}
function resumeGame() { closePause(); }
function restartLevel() { closePause(); loadLevel(state.level); }
function resetGame() { state.results = [null, null, null]; showScreen("levels"); }

function directionVector(direction) {
  const vectors = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0], CENTER: [0, 0] };
  const vector = vectors[direction];
  return { x: vector[0], y: vector[1], direction: direction, button: false };
}

function readJoystick() {
  // Keyboard works even while connected, so serial errors never block a test drive.
  let x = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  let y = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
  if (x || y) {
    const length = Math.hypot(x, y); // Diagonal movement should not be faster.
    return { x: x / length, y: y / length };
  }
  if (touchDirection !== "CENTER") return directionVector(touchDirection);
  if (port && performance.now() - lastSerialTime < SERIAL_TIMEOUT) return joystick;
  return { x: 0, y: 0 };
}

// A slightly larger rectangle accounts for the car's visible steering tilt.
function carBounds(x, y, angle) {
  const radians = Math.abs(angle) * Math.PI / 180;
  const width = CAR_WIDTH * Math.cos(radians) + CAR_HEIGHT * Math.sin(radians);
  const height = CAR_HEIGHT * Math.cos(radians) + CAR_WIDTH * Math.sin(radians);
  return { x: x - width / 2, y: y - height / 2, width: width, height: height };
}
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function checkCollision(x, y, angle) {
  const box = carBounds(x, y, angle);
  if (box.x < 12 || box.y < 12 || box.x + box.width > MAP_WIDTH - 12 || box.y + box.height > MAP_HEIGHT - 12) return "boundary";
  if (levels[state.level].obstacles.some(function (obstacle) { return overlaps(box, obstacle); })) return "obstacle";
  return null;
}
function registerCollision(kind) {
  if (state.contact) return; // One penalty per contact; holding a key is not many crashes.
  const penalty = kind === "boundary" ? 10 : 20;
  state.collisions += 1;
  state.score = Math.max(0, state.score - penalty);
  state.feedbackTime = 1.1;
  $("game-message").textContent = (kind === "boundary" ? "Boundary touched" : "Collision!") + " −" + penalty + " points. Back up and try again.";
  $("collision-flash").textContent = kind === "boundary" ? "BOUNDARY · −10" : "COLLISION · −20";
  $("collision-flash").classList.remove("hidden");
  $("game").classList.add("collision");
}

function moveCar(seconds) {
  const input = readJoystick();
  const car = state.car;
  const targetAngle = input.x * 8;
  const angle = car.angle + (targetAngle - car.angle) * Math.min(1, seconds * 12);
  const nextX = car.x + input.x * MOVE_SPEED * seconds;
  const nextY = car.y + input.y * MOVE_SPEED * seconds;
  const collision = checkCollision(nextX, nextY, angle);
  const moving = Math.abs(input.x) + Math.abs(input.y) > 0;
  car.direction = input.y < 0 ? "UP" : input.y > 0 ? "DOWN" : input.x < 0 ? "LEFT" : input.x > 0 ? "RIGHT" : "CENTER";
  if (collision) {
    if (moving) registerCollision(collision);
    state.contact = true;
    car.speed = 0;
  } else {
    car.x = nextX;
    car.y = nextY;
    car.angle = angle;
    car.speed = Math.hypot(input.x, input.y) * MOVE_SPEED;
    if (input.y !== 0) car.lastVertical = input.y > 0 ? "DOWN" : "UP";
    if (moving) state.contact = false;
  }
  renderCar();
}

function renderCar() {
  const scale = document.querySelector(".lot-surface").clientWidth / MAP_WIDTH;
  const car = $("player-car");
  car.style.left = state.car.x / MAP_WIDTH * 100 + "%";
  car.style.top = state.car.y / MAP_HEIGHT * 100 + "%";
  car.style.transform = "translate(-50%, -50%) rotate(" + state.car.angle + "deg) scale(" + scale + ")";
}

function checkParking() {
  const zone = levels[state.level].zone;
  const car = state.car;
  const box = carBounds(car.x, car.y, car.angle);
  const inside = box.x >= zone.x && box.y >= zone.y && box.x + box.width <= zone.x + zone.width && box.y + box.height <= zone.y + zone.height;
  const input = readJoystick();
  const centered = Math.abs(input.x) + Math.abs(input.y) === 0;
  const reverseOkay = state.level !== 2 || car.lastVertical === "DOWN";
  return inside && Math.abs(car.angle) < 3 && car.speed < 1 && centered && reverseOkay;
}

function updateGame(seconds) {
  if (!state.running || state.paused) return;
  state.elapsed += seconds;
  if (state.elapsed >= levels[state.level].limit) {
    state.elapsed = levels[state.level].limit;
    showGameOver();
    return;
  }
  moveCar(seconds);
  state.feedbackTime = Math.max(0, state.feedbackTime - seconds);
  if (state.feedbackTime === 0) {
    $("game").classList.remove("collision");
    $("collision-flash").classList.add("hidden");
  }
  const ready = checkParking();
  state.parkedTime = ready ? state.parkedTime + seconds : 0;
  $("parking-zone").classList.toggle("ready", ready);
  if (ready) $("game-message").textContent = "Looking good! Stay still or press Space / P to park.";
  else if (state.feedbackTime === 0) $("game-message").textContent = "Move fully into the bay, then release the controls.";
  if (state.parkedTime >= 1) finishLevel();
  updateUI();
}

function updateUI() {
  $("score-value").textContent = state.score;
  $("time-value").textContent = formatTime(state.elapsed);
  $("remaining-value").textContent = formatTime(Math.ceil(levels[state.level].limit - state.elapsed));
  $("collision-value").textContent = state.collisions;
  $("parking-progress-fill").style.width = Math.min(100, state.parkedTime * 100) + "%";
}

function resultStats(items) {
  $("result-stats").replaceChildren();
  items.forEach(function (item) {
    const div = document.createElement("div");
    const strong = document.createElement("strong");
    const label = document.createElement("span");
    strong.textContent = item[0];
    label.textContent = item[1];
    div.append(strong, label);
    $("result-stats").appendChild(div);
  });
}
function resultButton(label, callback, primary) {
  const button = document.createElement("button");
  button.className = "button " + (primary ? "primary" : "secondary");
  button.textContent = label;
  button.addEventListener("click", callback);
  $("result-actions").appendChild(button);
}
function prepareResult(title, description, eyebrow, icon) {
  state.running = false;
  $("result-title").textContent = title;
  $("result-description").textContent = description;
  $("result-eyebrow").textContent = eyebrow;
  $("result-icon").textContent = icon;
  $("result-actions").replaceChildren();
  showScreen("result");
}
function finishLevel() {
  if (!state.running || state.paused) return;
  state.score += 50;
  state.results[state.level] = { score: state.score, time: state.elapsed, collisions: state.collisions };
  $("game").classList.add("success");
  showSuccess();
}
function showSuccess() {
  prepareResult("Parking successful!", "Great parking! A little focus, a perfect finish.", "LEVEL " + (state.level + 1) + " COMPLETE · +50 POINTS", "✓");
  resultStats([[state.score, "Score"], [formatTime(state.elapsed), "Time"], [state.level + 1, "Level"], [state.collisions, "Collisions"]]);
  const next = state.results.findIndex(function (result) { return result === null; });
  resultButton(next === -1 ? "Final result →" : "Next level →", function () { if (next === -1) showFinalResult(); else loadLevel(next); }, true);
  resultButton("Play again", function () { loadLevel(state.level); });
  resultButton("Main menu", function () { showScreen("home"); });
}
function showGameOver() {
  prepareResult("Time for another try.", "The timer ran out. Take what you learned and give it another go!", "TIME'S UP · PRACTICE MAKES PROGRESS", "↻");
  resultStats([[state.score, "Score"], [formatTime(state.elapsed), "Time"], [state.level + 1, "Level"], [state.collisions, "Collisions"]]);
  resultButton("Try again →", function () { loadLevel(state.level); }, true);
  resultButton("Choose a level", function () { showScreen("levels"); });
  resultButton("Main menu", function () { showScreen("home"); });
}
function showFinalResult() {
  if (state.results.some(function (result) { return result === null; })) { showScreen("levels"); return; }
  let totalScore = 0;
  let totalTime = 0;
  let totalCollisions = 0;
  state.results.forEach(function (result) {
    totalScore += result.score;
    totalTime += result.time;
    totalCollisions += result.collisions;
  });
  const percent = totalScore / 450 * 100;
  const message = percent >= 90 ? "Excellent parking!" : percent >= 70 ? "Great job!" : "Keep practicing!";
  prepareResult("Parking challenge complete!", message + " You've completed all three levels.", "THREE LEVELS. ONE SMOOTH DRIVER.", "★");
  resultStats([[totalScore + " / 450", "Final score"], ["3 / 3", "Levels complete"], [totalCollisions, "Total collisions"], [formatTime(totalTime), "Total time"]]);
  resultButton("Play again →", resetGame, true);
  resultButton("Main menu", function () { showScreen("home"); });
}

function confirmAction() {
  if (state.paused) {
    const focused = document.activeElement;
    if (focused.tagName === "BUTTON" && $("pause-dialog").contains(focused)) focused.click();
    else resumeGame();
  } else if (state.screen === "game") {
    if (checkParking()) finishLevel();
    else {
      $("game-message").textContent = "Not quite yet! Fit fully in the bay and stop" + (state.level === 2 ? " after reversing." : ".");
      state.feedbackTime = 1.5;
    }
  } else {
    const focused = document.activeElement;
    if (focused.tagName === "BUTTON") { focused.click(); return; }
    const defaults = { home: "#home [data-screen='levels']", instructions: "#instructions [data-screen='levels']", connection: "#connection [data-screen='levels']", levels: "#level-selection button", result: "#result-actions button" };
    document.querySelector(defaults[state.screen]).click();
  }
}

// Serial parser: both simple text and 10-bit analog packets use one game input shape.
function parseJoystickData(data) {
  const text = data.trim().toUpperCase();
  if (["UP", "DOWN", "LEFT", "RIGHT", "CENTER"].includes(text)) return directionVector(text);
  if (text === "BUTTON") return { direction: "CENTER", x: 0, y: 0, button: true };
  const match = /^X:(\d{1,4}),\s*Y:(\d{1,4}),\s*B:([01])$/.exec(text);
  if (!match) return null;
  const rawX = Number(match[1]);
  const rawY = Number(match[2]);
  if (rawX > 1023 || rawY > 1023) return null;
  let x = Math.max(-1, Math.min(1, (rawX - 512) / 511));
  let y = Math.max(-1, Math.min(1, (rawY - 512) / 511));
  if (Math.abs(x) < DEAD_ZONE) x = 0;
  if (Math.abs(y) < DEAD_ZONE) y = 0;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  const direction = x === 0 && y === 0 ? "CENTER" : Math.abs(x) > Math.abs(y) ? (x < 0 ? "LEFT" : "RIGHT") : (y < 0 ? "UP" : "DOWN");
  return { direction: direction, x: x, y: y, button: match[3] === "1" };
}

function navigateWithJoystick(direction) {
  if (direction === "CENTER" || performance.now() - lastNavigationTime < 300) return;
  lastNavigationTime = performance.now();
  const container = state.paused ? $("pause-dialog") : $(state.screen);
  const buttons = Array.from(container.querySelectorAll("button:not(:disabled)"));
  if (!buttons.length) return;
  const index = buttons.indexOf(document.activeElement);
  const step = direction === "UP" || direction === "LEFT" ? -1 : 1;
  buttons[(index + step + buttons.length) % buttons.length].focus();
}
function handleJoystickCommand(line) {
  const command = parseJoystickData(line);
  if (!command) {
    joystick = directionVector("CENTER");
    updateTelemetry();
    $("serial-message").textContent = "Unrecognized joystick data ignored. Check the sketch and 115200 baud setting.";
    return;
  }
  const wasPressed = joystick.button;
  joystick = command;
  lastSerialTime = performance.now();
  updateTelemetry();
  $("serial-message").textContent = "Receiving joystick data. You're ready to drive.";
  if (command.button && !wasPressed && lastSerialTime - lastButtonTime > 300) {
    lastButtonTime = lastSerialTime;
    confirmAction();
  }
  if (state.screen !== "game" || state.paused) navigateWithJoystick(command.direction);
}
function updateTelemetry() {
  $("axis-x").textContent = joystick.x.toFixed(2);
  $("axis-y").textContent = joystick.y.toFixed(2);
  $("axis-direction").textContent = joystick.direction;
}
function updateConnection() {
  const connected = Boolean(port) && !serialClosing;
  $("serial-status").textContent = connected ? "● CONNECTED" : "● DISCONNECTED";
  $("serial-status").classList.toggle("connected", connected);
  $("serial-status").classList.toggle("disconnected", !connected);
  document.querySelector(".connection-pill").classList.toggle("connected", connected);
  $("header-connection").textContent = connected ? "Joystick connected" : "Keyboard mode";
  $("game-input-label").textContent = connected ? "⌁ Joystick + keyboard controls active" : "⌨ Keyboard Controls Active";
  $("connection-type").textContent = connected ? "USB SERIAL" : "Not connected";
  $("connect-button").disabled = connected || serialBusy || serialClosing || !navigator.serial || !window.isSecureContext;
  $("disconnect-button").disabled = !connected || serialBusy;
}
async function connectSerial() {
  if (!navigator.serial || !window.isSecureContext || port || serialBusy || serialClosing) return;
  serialBusy = true;
  updateConnection();
  let selectedPort = null;
  try {
    selectedPort = await navigator.serial.requestPort();
    await selectedPort.open({ baudRate: SERIAL_BAUD });
    port = selectedPort;
    serialClosing = false;
    joystick = directionVector("CENTER");
    lastSerialTime = performance.now();
    $("serial-message").textContent = "Connected! Waiting for your joystick. Some boards take a moment to restart.";
    serialTask = readSerialLoop(selectedPort);
  } catch (error) {
    $("serial-message").textContent = error.name === "NotFoundError" ? "No port selected. You can keep playing with the keyboard." : "Couldn't connect. Check the USB data cable, allow serial access, and close the Serial Monitor. Keyboard controls still work.";
    port = null;
  } finally {
    serialBusy = false;
    updateConnection();
  }
}

async function readSerialLoop(activePort) {
  const decoder = new TextDecoder();
  let buffer = "";
  let droppingLine = false;
  let readFailed = false;
  try {
    serialReader = activePort.readable.getReader();
    while (!serialClosing) {
      const packet = await serialReader.read();
      if (packet.done) break;
      const text = decoder.decode(packet.value, { stream: true });
      // USB chunks can split a command or contain several commands at once.
      for (const character of text) {
        if (character === "\n") {
          if (!droppingLine && buffer.trim()) handleJoystickCommand(buffer);
          buffer = "";
          droppingLine = false;
        } else if (!droppingLine) {
          buffer += character;
          if (buffer.length > 100) {
            buffer = "";
            droppingLine = true;
            handleJoystickCommand("INVALID");
          }
        }
      }
    }
  } catch (error) {
    readFailed = true;
    if (!serialClosing) $("serial-message").textContent = "The serial connection was interrupted. Reconnect the ESP32, or keep using your keyboard.";
  } finally {
    if (serialReader) { serialReader.releaseLock(); serialReader = null; }
    try { await activePort.close(); } catch (error) { /* Unplugged ports may already be closed. */ }
    if (!serialClosing && !readFailed) $("serial-message").textContent = "Joystick disconnected. Keyboard controls are ready.";
    port = null;
    joystick = directionVector("CENTER");
    updateTelemetry();
    updateConnection();
  }
}
async function disconnectSerial() {
  if (!port || serialClosing) return;
  serialClosing = true;
  joystick = directionVector("CENTER");
  updateConnection();
  try {
    if (serialReader) await serialReader.cancel();
    if (serialTask) await serialTask;
  } catch (error) { /* Removing a USB cable can also cancel the reader. */ }
  finally {
    serialClosing = false;
    serialTask = null;
    $("serial-message").textContent = "Joystick disconnected. Keyboard controls are ready.";
    updateConnection();
  }
}

function initGame() {
  document.addEventListener("click", function (event) {
    const screenButton = event.target.closest("[data-screen]");
    const levelButton = event.target.closest("[data-level]");
    if (screenButton) showScreen(screenButton.dataset.screen);
    if (levelButton) startGame(Number(levelButton.dataset.level));
  });
  $("pause-button").addEventListener("click", pauseGame);
  $("resume-button").addEventListener("click", resumeGame);
  $("restart-button").addEventListener("click", restartLevel);
  $("pause-menu-button").addEventListener("click", function () { closePause(); showScreen("home"); });
  $("pause-dialog").addEventListener("cancel", function (event) { event.preventDefault(); resumeGame(); });
  $("park-button").addEventListener("click", confirmAction);
  $("reset-progress").addEventListener("click", resetGame);
  $("connect-button").addEventListener("click", connectSerial);
  $("disconnect-button").addEventListener("click", disconnectSerial);
  document.addEventListener("keydown", function (event) {
    if (event.code === "Escape" && state.screen === "game") {
      event.preventDefault();
      if (!event.repeat) { if (state.paused) resumeGame(); else pauseGame(); }
    }
    if (event.code.startsWith("Arrow") && state.screen === "game" && !state.paused) { event.preventDefault(); keys.add(event.code); }
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) confirmAction();
    }
  });
  document.addEventListener("keyup", function (event) { keys.delete(event.code); });
  document.querySelectorAll("[data-drive]").forEach(function (button) {
    button.addEventListener("pointerdown", function (event) {
      if (!state.running || state.paused) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touchDirection = button.dataset.drive;
      button.classList.add("active");
    });
    function release() { touchDirection = "CENTER"; button.classList.remove("active"); }
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    // Enter can also operate the on-screen direction buttons for one small step.
    button.addEventListener("click", function (event) {
      if (event.detail === 0 && state.running && !state.paused) {
        touchDirection = button.dataset.drive;
        moveCar(0.08);
        touchDirection = "CENTER";
      }
    });
  });
  window.addEventListener("blur", function () { keys.clear(); touchDirection = "CENTER"; pauseGame(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pauseGame(); });
  window.addEventListener("resize", renderCar);
  if (navigator.serial) navigator.serial.addEventListener("disconnect", function (event) { if (event.target === port || event.port === port) disconnectSerial(); });
  if (!navigator.serial || !window.isSecureContext) $("serial-message").textContent = "Web Serial isn't available here. Try desktop Chrome or Edge in a secure context. Keyboard and touch controls work without it.";
  updateConnection();
  updateLevelSelection();
  requestAnimationFrame(frame);
}
function frame(time) {
  // Small steps prevent tunnelling through a barrier after a slow frame.
  const seconds = previousFrame ? Math.min((time - previousFrame) / 1000, 0.05) : 0;
  previousFrame = time;
  updateGame(seconds);
  if (port && joystick.direction !== "CENTER" && time - lastSerialTime > SERIAL_TIMEOUT) {
    joystick = directionVector("CENTER");
    updateTelemetry();
    $("serial-message").textContent = "Waiting for fresh joystick data. Car stopped; keyboard controls still work.";
  }
  requestAnimationFrame(frame);
}
initGame();
