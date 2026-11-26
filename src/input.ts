import type { InputState, SerialCommand } from "./types";

export class InputController {
  private readonly keys = new Set<string>();
  private serial: SerialCommand = { x: 0, y: 0, button: false, direction: "CENTER" };
  private serialUpdatedAt = 0;

  constructor() {
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        this.keys.add(event.code);
      }
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  setSerial(command: SerialCommand): void {
    this.serial = command;
    this.serialUpdatedAt = performance.now();
  }

  resetSerial(): void {
    this.serial = { x: 0, y: 0, button: false, direction: "CENTER" };
    this.serialUpdatedAt = 0;
  }

  clear(): void {
    this.keys.clear();
    this.resetSerial();
  }

  read(): InputState {
    const keyboardThrottle = Number(this.keys.has("ArrowUp")) - Number(this.keys.has("ArrowDown"));
    const keyboardSteering = Number(this.keys.has("ArrowRight")) - Number(this.keys.has("ArrowLeft"));
    if (keyboardThrottle || keyboardSteering) {
      return { throttle: keyboardThrottle, steering: keyboardSteering };
    }
    if (performance.now() - this.serialUpdatedAt < 350) {
      // Direction-only firmware sends one axis at a time. A sideways push
      // therefore needs forward throttle as well as steering to turn the car.
      // Explicit forward/reverse input still takes priority for analog packets.
      const throttle = this.serial.y !== 0 ? -this.serial.y : Math.abs(this.serial.x);
      return { throttle, steering: this.serial.x };
    }
    return { throttle: 0, steering: 0 };
  }
}
