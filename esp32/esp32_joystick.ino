// Joystick Parking Simulator — separate hardware bridge, not website code.
// For an original ESP32 DevKit / ESP32-WROOM board.
// Joystick VCC -> 3.3V, GND -> GND, VRx -> 34, VRy -> 35, SW -> 27.
const int X_PIN = 34;
const int Y_PIN = 35;
const int BUTTON_PIN = 27;
const bool INVERT_X = false; // Change if left and right are reversed.
const bool INVERT_Y = false; // Change if up and down are reversed.
const bool SEND_ANALOG = false; // false: UP/DOWN/etc. true: X:512,Y:512,B:0
const int DEAD_ZONE = 77; // About 15% of the distance from center to an edge.

int centerX = 512;
int centerY = 512;
int previousReading = HIGH;
int stableButton = HIGH;
unsigned long buttonChangedAt = 0;
unsigned long lastSendAt = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(10); // Values from 0 to 1023, matching the browser parser.
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  // Leave the stick centered during startup. Average readings to learn its center.
  delay(500);
  long sumX = 0;
  long sumY = 0;
  for (int sample = 0; sample < 30; sample++) {
    sumX += analogRead(X_PIN);
    sumY += analogRead(Y_PIN);
    delay(10);
  }
  centerX = sumX / 30;
  centerY = sumY / 30;
}

int normalizeAxis(int raw, int center, bool invert) {
  // Convert the calibrated center to 512 while keeping both end points.
  center = constrain(center, 1, 1022);
  int value = raw < center ? map(raw, 0, center, 0, 512) : map(raw, center, 1023, 512, 1023);
  value = constrain(value, 0, 1023);
  return invert ? 1023 - value : value;
}

void loop() {
  unsigned long now = millis();
  int reading = digitalRead(BUTTON_PIN);
  if (reading != previousReading) buttonChangedAt = now;
  previousReading = reading;

  // Debounce: only accept a button change after it is stable for 35 milliseconds.
  bool justPressed = false;
  if (now - buttonChangedAt >= 35 && reading != stableButton) {
    stableButton = reading;
    justPressed = stableButton == LOW;
  }
  if (!SEND_ANALOG && justPressed) Serial.println("BUTTON");
  if (now - lastSendAt < 50) return;
  lastSendAt = now;

  int x = normalizeAxis(analogRead(X_PIN), centerX, INVERT_X);
  int y = normalizeAxis(analogRead(Y_PIN), centerY, INVERT_Y);
  if (SEND_ANALOG) {
    Serial.print("X:"); Serial.print(x);
    Serial.print(",Y:"); Serial.print(y);
    Serial.print(",B:"); Serial.println(stableButton == LOW ? 1 : 0);
    return;
  }

  int dx = x - 512;
  int dy = y - 512;
  if (abs(dx) < DEAD_ZONE && abs(dy) < DEAD_ZONE) Serial.println("CENTER");
  else if (abs(dx) > abs(dy)) Serial.println(dx < 0 ? "LEFT" : "RIGHT");
  else Serial.println(dy < 0 ? "UP" : "DOWN");
}
