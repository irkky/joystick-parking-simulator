<div align="center">

# 🚗 PARKLAB
### Joystick Parking Simulator

**Drive · Avoid · Park · Score**

A hands-on Grade 7 project where a web game meets a real joystick. Drive with your keyboard right away, or connect an ESP32 and steer with hardware.

[▶ Play locally](#-quick-start) · [🎮 How to play](#-controls) · [🔌 Connect the joystick](#-connect-the-esp32) · [⬆️ Upload to GitHub](#-upload-this-project-to-github)

</div>

---

## 🅿️ Welcome to the lot

Can a tiny joystick move a car on a webpage? PARKLAB connects an analog joystick to an ESP32, sends its input over USB serial, and turns it into movement in a browser game. Practice precision, avoid obstacles, and park inside the marked bay.

| 🕹️ Choose your controls | 🛣️ Take on three levels | 🏁 Earn up to 450 points |
|:--:|:--:|:--:|
| Keyboard, touch controls, or an ESP32 joystick | Straight, turning, and reverse parking | Scores reward accurate parking |

## ⚡ Quick start

You can play with the keyboard without installing anything.

1. Download or clone this repository.
2. Keep `index.html`, `style.css`, and `script.js` together.
3. Open `index.html` in a browser.
4. Select **Start game**, then choose a level.

> The game is built with plain HTML, CSS, and JavaScript. It needs no packages, build step, server, internet connection, or hardware for keyboard play. The ESP32 sketch is optional firmware.

## 🎮 Controls

| Keyboard / joystick | Action |
| --- | --- |
| ↑ / `UP` | Drive forward |
| ↓ / `DOWN` | Reverse |
| ← / `LEFT` | Steer left |
| → / `RIGHT` | Steer right |
| Release keys / `CENTER` | Stop and straighten |
| `Space` / `BUTTON` | Start, select, confirm, or park |
| `Esc` / Pause button | Pause or resume |
| On-screen arrows | Hold to drive with touch or mouse |
| On-screen **P** | Confirm parking |

The driving is arcade-style: the car faces upward and steering moves it sideways. Keyboard, joystick, and on-screen controls can be used in the same session. In menus, joystick directions move focus and its button selects; `Tab` and `Enter` also work.

## 🧭 Parking rules and levels

- Fit the **whole car, including its mirrors**, inside the mint parking bay.
- Stop and let the steering straighten, then press `Space`, `P`, or the joystick button. You can also remain still for one second.
- Level 3 requires the last vertical movement into the bay to be **reverse** (`DOWN`).
- Each attempt starts at **100 points**. Successful parking adds **50**.
- Hitting an obstacle costs **20** points; touching a boundary costs **10**. Scores never go below zero, and there is no time penalty.
- A continuous contact counts once. Move away before another contact can cost points.
- The timer pauses when you pause or leave the browser tab, and ends on success or timeout.
- Your best successful result for each level counts once toward the **450-point** total. Progress resets when the page reloads or you reset the challenge.

| Level | Challenge | Time | Route hint |
| --- | --- | ---: | --- |
| 1 | Straight parking | 3 min | Drive straight up into the large bay. |
| 2 | Turning parking | 2 min 30 sec | Follow the left lane, cross right above the barrier, then drive up into the bay. |
| 3 | Reverse / tight parking | 2 min | Cross to the right of the barrier, go below it, then reverse into the small bay. |

All levels are available for practice. The final result unlocks after completing each level; replaying a level does not add it twice.

## 🔌 Connect the ESP32

### Parts and wiring

You need an **original ESP32 DevKit / ESP32-WROOM**, a two-axis analog joystick with a push button, jumper wires, and a USB **data** cable. This pin assignment is for the original ESP32; other variants such as C3 or S3 may need different ADC pins.

| Joystick | ESP32 |
| --- | --- |
| VCC / `+` | **3.3V** |
| GND | GND |
| VRx | GPIO 34 |
| VRy | GPIO 35 |
| SW | GPIO 27 |

Wire with the board disconnected from power. Use 3.3V so the joystick's analog outputs stay suitable for ESP32 inputs.

### Upload and connect

1. Open `esp32/esp32_joystick.ino` in Arduino IDE. If prompted to create a matching sketch folder, accept.
2. Install Espressif ESP32 board support if needed. Select your board and port, then upload the sketch.
3. Keep the joystick centered as the board starts so it can calibrate.
4. Close Arduino Serial Monitor and any other program using the serial port.
5. Open PARKLAB in desktop **Chrome or Edge**. Choose **Connect joystick → Connect ESP32**, then select the board in the browser dialog.
6. Check the live X/Y/direction values. If an axis is reversed, change `INVERT_X` or `INVERT_Y` in the sketch and upload again.
7. Choose **Continue to the lot**. Use **Disconnect** when you finish.

The sketch uses 10-bit analog readings (0–1023), a 15% center dead zone, button debouncing, and a 50 ms send interval. See [Espressif's Arduino ADC reference](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html).

## 📡 Serial messages

The default mode sends one command per line at **115200 baud**:

```text
UP
DOWN
LEFT
RIGHT
CENTER
BUTTON
```

The board repeats its direction every 50 ms; `BUTTON` is sent once per press. The browser stops movement if it receives no fresh command for 350 ms.

For analog input, set `SEND_ANALOG = true` in the sketch. The format is:

```text
X:512,Y:512,B:0
X:1023,Y:512,B:0
X:512,Y:0,B:1
```

X and Y range from 0 to 1023, with 512 at center; low Y means up. `B` is 1 while pressed. Analog values are normalized to −1…1, and values within `DEAD_ZONE = 0.15` count as centered. Change `DEAD_ZONE` near the top of `script.js` to adjust sensitivity; simple command mode uses the sketch's dead zone.

The browser handles LF and CRLF endings, partial or combined USB chunks, blank lines, and invalid input. Bad commands and overlong lines stop serial movement and show a message.

## 🧩 How the system works

```text
Joystick → ESP32 → USB serial → Web Serial API → JavaScript input
                                                   ↓
                                      car → collisions → parking → score
```

The ESP32 sends newline-terminated commands. `readSerialLoop()` rebuilds complete lines, even when USB splits them across chunks. `parseJoystickData()` converts a line into an input object, for example:

```javascript
{ direction: "UP", x: 0, y: -1, button: false }
```

Each animation frame, `moveCar()` reads the current input. `checkCollision()` checks object boundaries, while `checkParking()` checks containment, alignment, a stopped car, and the reverse rule.

## 📁 Project map

```text
joystick-parking-simulator/
├── index.html              # Game screens and page structure
├── style.css               # Parking lot, controls, and responsive layout
├── script.js               # Game logic, input, collisions, and scoring
├── esp32/
│   └── esp32_joystick.ino  # Optional joystick firmware
└── README.md               # Project guide
```

For a classroom demo, play a level with the keyboard, connect the joystick, show its live values, then explain how an `if` condition checks whether the car fits inside a rectangle.

## ⬆️ Upload this project to GitHub

Git is already initialized locally, so you do **not** need to run `git init` again. First create an **empty repository** on [GitHub](https://github.com/new): choose a repository name such as `joystick-parking-simulator`, then leave **Add a README**, `.gitignore`, and license unchecked. That avoids a separate initial commit on GitHub.

Open PowerShell in this project folder and run:

```powershell
git add .
git commit -m "Add joystick parking simulator"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/joystick-parking-simulator.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username, and change the repository name in the URL if you chose another one. Sign in if GitHub prompts you. The `git add .` command stages the whole project folder, including the `esp32` directory.

### If you already added a remote

See which remote is configured:

```powershell
git remote -v
```

If `origin` already points to the right GitHub repository, skip `git remote add origin ...` and push:

```powershell
git push -u origin main
```

If `origin` exists but points to the wrong URL, update it first:

```powershell
git remote set-url origin https://github.com/YOUR-USERNAME/joystick-parking-simulator.git
git push -u origin main
```

After the first push, upload later changes with:

```powershell
git add .
git commit -m "Describe your changes"
git push
```

> Before committing, check `git status` and make sure you have not added private files, passwords, or personal access tokens. GitHub will ask you to authenticate; use its sign-in flow or a configured Git credential manager rather than putting a token in the remote URL.

## 🛠️ Troubleshooting

The game checks for `navigator.serial` and a secure browser context. Web Serial needs a supported browser and may be restricted by device or school policy. Keyboard play still works when serial access is unavailable. See the [official Web Serial guide](https://developer.chrome.com/docs/capabilities/serial).

| Problem | Try this |
| --- | --- |
| Connect button is disabled or no chooser opens | Use desktop Chrome or Edge and check browser or school device-access policies. |
| Board does not appear | Check that the USB cable carries data, the board has power, and its USB driver is installed. |
| Port will not open | Close Arduino Serial Monitor and other tabs/programs using the board, then reconnect. |
| Connected, but no live values | Check that the sketch uploaded and uses 115200 baud; allow a moment for startup calibration. |
| USB disconnects or read fails | Old joystick input is stopped; reconnect or continue with the keyboard. |
| Joystick drifts | Restart with the stick centered or increase the dead zone. |

## ✅ Verification notes

Browser checks cover navigation, keyboard movement, routes, collision penalties, parking, timers, pause/restart, timeout, scoring, and responsive layout. Simulated serial streams cover connection errors, split and invalid data, button presses, disconnect, and cleanup. These checks exercise the browser logic; an actual ESP32 upload, wiring, and physical joystick still need to be verified on your hardware.
