import './joystick.css';

export type InputIntent = Readonly<{ x: number; y: number }>;

export const JOYSTICK_RADIUS_PX = 48;
export const JOYSTICK_DEAD_ZONE = 0.2;

const movementCodes = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

export function clampIntent(intent: InputIntent): InputIntent {
  if (!Number.isFinite(intent.x) || !Number.isFinite(intent.y)) return { x: 0, y: 0 };
  const length = Math.hypot(intent.x, intent.y);
  if (length <= 1) return { x: intent.x, y: intent.y };
  return { x: intent.x / length, y: intent.y / length };
}

export function keyboardIntent(keys: ReadonlySet<string>): InputIntent {
  return clampIntent({
    x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
    y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')),
  });
}

export function joystickIntent(
  deltaX: number,
  deltaY: number,
  radius = JOYSTICK_RADIUS_PX,
  deadZone = JOYSTICK_DEAD_ZONE,
): InputIntent {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || !Number.isFinite(radius)
    || radius <= 0 || !Number.isFinite(deadZone) || deadZone < 0 || deadZone >= 1) return { x: 0, y: 0 };
  const rawLength = Math.hypot(deltaX, deltaY) / radius;
  if (rawLength <= deadZone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (rawLength - deadZone) / (1 - deadZone));
  const direction = Math.hypot(deltaX, deltaY);
  return { x: deltaX / direction * magnitude, y: deltaY / direction * magnitude };
}

export function mergeIntents(keyboard: InputIntent, joystick: InputIntent): InputIntent {
  return clampIntent({ x: keyboard.x + joystick.x, y: keyboard.y + joystick.y });
}

export class InputAdapter {
  readonly #keys = new Set<string>();
  readonly #joystick: HTMLDivElement;
  readonly #thumb: HTMLDivElement;
  #joystickIntent: InputIntent = { x: 0, y: 0 };
  #pointerId: number | undefined;

  readonly #canCapture: () => boolean;

  constructor(parent: HTMLElement, canCapture = () => true) {
    this.#canCapture = canCapture;
    this.#joystick = document.createElement('div');
    this.#joystick.className = 'virtual-joystick';
    this.#joystick.dataset.testid = 'virtual-joystick';
    this.#joystick.setAttribute('aria-label', 'Movement joystick');
    this.#thumb = document.createElement('div');
    this.#thumb.className = 'virtual-joystick-thumb';
    this.#joystick.append(this.#thumb);
    parent.append(this.#joystick);
    if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) {
      this.#joystick.classList.add('virtual-joystick-visible');
    }
    window.addEventListener('keydown', this.#onKeyDown, { capture: true });
    window.addEventListener('keyup', this.#onKeyUp, { capture: true });
    window.addEventListener('blur', this.#clearKeys);
    window.addEventListener('touchstart', this.#revealForTouch, { once: true, passive: true });
    this.#joystick.addEventListener('pointerdown', this.#onPointerDown);
    this.#joystick.addEventListener('pointermove', this.#onPointerMove);
    this.#joystick.addEventListener('pointerup', this.#onPointerEnd);
    this.#joystick.addEventListener('pointercancel', this.#onPointerEnd);
  }

  getIntent(): InputIntent {
    if (!this.#canCapture()) {
      this.#keys.clear();
      this.#resetJoystick();
      return { x: 0, y: 0 };
    }
    return mergeIntents(keyboardIntent(this.#keys), this.#joystickIntent);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.#onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.#onKeyUp, { capture: true });
    window.removeEventListener('blur', this.#clearKeys);
    window.removeEventListener('touchstart', this.#revealForTouch);
    this.#joystick.removeEventListener('pointerdown', this.#onPointerDown);
    this.#joystick.removeEventListener('pointermove', this.#onPointerMove);
    this.#joystick.removeEventListener('pointerup', this.#onPointerEnd);
    this.#joystick.removeEventListener('pointercancel', this.#onPointerEnd);
    this.#joystick.remove();
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (!movementCodes.has(event.code) || !this.#canCapture()) return;
    event.preventDefault();
    this.#keys.add(event.code);
  };

  readonly #onKeyUp = (event: KeyboardEvent): void => {
    if (!movementCodes.has(event.code)) return;
    if (this.#canCapture() && this.#keys.has(event.code)) event.preventDefault();
    this.#keys.delete(event.code);
  };

  readonly #clearKeys = (): void => {
    this.#keys.clear();
  };

  readonly #revealForTouch = (): void => {
    this.#joystick.classList.add('virtual-joystick-visible');
  };

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#pointerId !== undefined || !this.#canCapture()) return;
    this.#pointerId = event.pointerId;
    this.#joystick.classList.add('virtual-joystick-visible');
    if (event.isTrusted) this.#joystick.setPointerCapture(event.pointerId);
    this.#updateJoystick(event);
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.#pointerId) this.#updateJoystick(event);
  };

  readonly #onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) return;
    this.#resetJoystick();
  };

  #resetJoystick(): void {
    this.#pointerId = undefined;
    this.#joystickIntent = { x: 0, y: 0 };
    this.#thumb.style.transform = 'translate(0px, 0px)';
  }

  #updateJoystick(event: PointerEvent): void {
    const bounds = this.#joystick.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > JOYSTICK_RADIUS_PX ? JOYSTICK_RADIUS_PX / length : 1;
    const thumbX = dx * scale;
    const thumbY = dy * scale;
    this.#thumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
    this.#joystickIntent = joystickIntent(dx, dy);
  }
}
