import type { SerialCommand } from "./types";

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};

type SerialApi = {
  requestPort(): Promise<SerialPortLike>;
};

type SerialNavigator = Navigator & { serial?: SerialApi };

export type SerialCallbacks = {
  onCommand(command: SerialCommand): void;
  onStatus(connected: boolean, message: string): void;
  onButton(): void;
};

const centeredCommand = (): SerialCommand => ({ x: 0, y: 0, button: false, direction: "CENTER" });

export function parseSerialLine(value: string): SerialCommand | null {
  const text = value.trim().toUpperCase();
  const vectors: Record<string, [number, number]> = {
    UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0], CENTER: [0, 0]
  };
  if (vectors[text]) {
    const [x, y] = vectors[text];
    return { x, y, button: false, direction: text };
  }
  if (text === "BUTTON") return { ...centeredCommand(), button: true };
  const match = /^X:(\d{1,4}),\s*Y:(\d{1,4}),\s*B:([01])$/.exec(text);
  if (!match) return null;
  const rawX = Number(match[1]);
  const rawY = Number(match[2]);
  if (rawX > 1023 || rawY > 1023) return null;
  let x = (rawX - 512) / 511;
  let y = (rawY - 512) / 511;
  if (Math.abs(x) < 0.15) x = 0;
  if (Math.abs(y) < 0.15) y = 0;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  const direction = x === 0 && y === 0 ? "CENTER" : Math.abs(x) > Math.abs(y) ? (x < 0 ? "LEFT" : "RIGHT") : (y < 0 ? "UP" : "DOWN");
  return { x, y, button: match[3] === "1", direction };
}

export class SerialBridge {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private reading = false;
  private connecting = false;
  private readTask: Promise<void> | null = null;

  constructor(private readonly callbacks: SerialCallbacks) {}

  get supported(): boolean {
    return Boolean((navigator as SerialNavigator).serial) && window.isSecureContext;
  }

  get connected(): boolean {
    return this.port !== null;
  }

  async connect(): Promise<void> {
    const serial = (navigator as SerialNavigator).serial;
    if (!serial || this.port || this.connecting || this.readTask) return;
    this.connecting = true;
    try {
      const selected = await serial.requestPort();
      await selected.open({ baudRate: 115200 });
      this.port = selected;
      this.reading = true;
      this.callbacks.onStatus(true, "ESP32 connected · receiving at 115200 baud");
      this.readTask = this.readLoop(selected).finally(() => { this.readTask = null; });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "NotFoundError";
      this.callbacks.onStatus(false, cancelled ? "No serial port selected" : "Connection failed · check the cable and Serial Monitor");
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    this.reading = false;
    if (this.reader) await this.reader.cancel().catch(() => undefined);
    await this.readTask;
    this.reader = null;
    this.port = null;
    this.callbacks.onCommand(centeredCommand());
    this.callbacks.onStatus(false, "Keyboard driving active");
  }

  private async readLoop(activePort: SerialPortLike): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";
    let buttonDown = false;
    try {
      if (!activePort.readable) throw new Error("Serial stream unavailable");
      this.reader = activePort.readable.getReader();
      while (this.reading) {
        const packet = await this.reader.read();
        if (packet.done) break;
        buffer += decoder.decode(packet.value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const command = parseSerialLine(line);
          if (!command) {
            if (line.trim()) this.callbacks.onCommand(centeredCommand());
            continue;
          }
          this.callbacks.onCommand(command);
          if (command.button && !buttonDown) this.callbacks.onButton();
          buttonDown = command.button;
        }
        if (buffer.length > 120) buffer = "";
      }
    } catch {
      this.callbacks.onStatus(false, "Joystick disconnected · keyboard driving active");
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
      if (this.port === activePort) {
        await activePort.close().catch(() => undefined);
        this.port = null;
      }
      this.callbacks.onCommand(centeredCommand());
      this.callbacks.onStatus(false, "Joystick disconnected · keyboard driving active");
    }
  }
}
