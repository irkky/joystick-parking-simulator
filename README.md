<div align="center">

# PARKLAB 3D
### Desktop Parking Simulator

**Accelerate · Steer · Brake · Park**

A true WebGL parking environment built with TypeScript, Three.js, and Vite. Drive with a keyboard or connect an ESP32 analog joystick through Web Serial.

</div>

## What changed in version 2

PARKLAB is no longer a CSS perspective illustration. The parking lot, cars, obstacles, lights, shadows, camera, and environment are real 3D scene objects rendered by Three.js.

| Rendering | Driving | Hardware |
| --- | --- | --- |
| WebGL 2, PBR-style materials, fog, tone mapping, dynamic shadows | Acceleration, braking, reverse, steering, collision response, chase and overhead cameras | ESP32 joystick at 115200 baud through Web Serial |

Additional features include procedural asphalt, working headlights, streetlights, engine audio, three challenges, live telemetry, parking validation, scoring, collision penalties, pause/restart, and a driver report.

## Desktop requirements

- A desktop or laptop display at least 960 pixels wide
- A current Chrome, Edge, Firefox, or Safari browser with WebGL 2
- Chrome or Edge on a secure origin for optional Web Serial hardware
- Node.js and npm for local development

This version intentionally targets desktop play. Small screens show a desktop-required notice rather than a compressed game.

## Quick start

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:4173`.

Production checks and build:

```powershell
npm run typecheck
npm run build
npm run preview
```

The production site is generated in `dist/`.

## Controls

| Input | Action |
| --- | --- |
| `↑` | Accelerate forward |
| `↓` | Brake, then reverse |
| `←` / `→` | Steer the front wheels |
| `Space` / joystick button | Confirm parking |
| `C` | Toggle chase and overhead cameras |
| `M` | Toggle engine audio |
| `Esc` | Pause or resume |

Release the throttle to slow down. To finish, place the complete car inside the illuminated bay, straighten it, and stop. Holding still for one second also confirms the park. Level 3 requires reversing into the bay.

With the ESP32 joystick, pushing left or right also applies forward throttle so the car moves through the turn without holding the stick upward. Up drives forward, down brakes/reverses, and center releases the throttle. Analog diagonal inputs retain their forward or reverse direction while steering. Keyboard steering continues to use the up/down keys for throttle.

## Scoring

- Each level starts at **100 points**.
- Successful parking adds **50 points**.
- An obstacle impact costs **20 points**.
- Touching the outer curb costs **10 points**.
- The complete three-level challenge is worth up to **450 points**.

## ESP32 joystick

This mapping targets an original ESP32 DevKit / ESP32-WROOM board.

| Joystick | ESP32 |
| --- | --- |
| VCC / `+` | **3.3V** |
| GND | GND |
| VRx | GPIO 35 |
| VRy | GPIO 34 |
| SW | GPIO 27 |

Open `esp32/esp32_joystick/esp32_joystick.ino` in Arduino IDE, select the correct ESP32 board and port, and upload it. Keep the stick centered while the board starts so the firmware can calibrate it.

Close Arduino Serial Monitor before clicking **Connect ESP32** in PARKLAB. Web Serial needs the port exclusively.

### Serial formats

The included firmware sends simple commands by default:

```text
UP
LEFT
CENTER
BUTTON
```

The TypeScript parser also supports analog packets:

```text
X:512,Y:240,B:0
```

`X` and `Y` range from 0 to 1023. Values are normalized to −1…1 with a 15% center dead zone.

## Architecture

```text
joystick-parking-simulator/
├── index.html                 # Desktop simulator shell and overlays
├── package.json               # Vite, TypeScript, and Three.js scripts
├── tsconfig.json              # Strict TypeScript configuration
├── vite.config.ts             # Development and production build settings
├── src/
│   ├── main.ts                # Game state, physics, scoring, and UI
│   ├── world.ts               # Three.js scene, meshes, lighting, and cameras
│   ├── levels.ts              # Three challenge layouts
│   ├── input.ts               # Keyboard and serial input combination
│   ├── serial.ts              # Web Serial connection and packet parser
│   ├── audio.ts               # Procedural engine and feedback audio
│   ├── styles.css             # Desktop HUD, menus, and visual system
│   └── types.ts               # Shared game types
└── esp32/
    └── esp32_joystick/
        └── esp32_joystick.ino # Optional hardware firmware
```

The 3D world uses `x` for left/right, `y` for height, and `z` for forward/back movement. Parking and collisions use typed two-dimensional footprints while Three.js renders their full 3D representations.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Blank or low-performance scene | Update graphics drivers and enable browser hardware acceleration. |
| Connect button is disabled | Use desktop Chrome or Edge on `localhost` or HTTPS. |
| ESP32 chooser does not appear | Use a USB data cable and close Arduino Serial Monitor. |
| Steering is reversed | Change `INVERT_X` in the ESP32 sketch. |
| Forward and reverse are swapped | Change `INVERT_Y` in the ESP32 sketch. |
| Car keeps moving after disconnect | Reconnect or press a keyboard control; stale serial input automatically expires. |

## Technology

- **TypeScript** for strict, maintainable game logic
- **Three.js** for real-time WebGL 3D rendering
- **Vite** for development and optimized production builds
- **Web Serial API** for the optional ESP32 controller
- **Web Audio API** for generated engine and feedback sounds

No downloaded 3D models or image textures are required. Cars, obstacles, parking markings, buildings, trees, asphalt, and lighting are generated in code.
