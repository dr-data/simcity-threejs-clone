/**
 * Manages mouse and keyboard input
 */
export class InputManager {
  /**
   * Last mouse position
   * @type {x: number, y: number}
   */
  mouse = { x: 0, y: 0 };
  /**
   * True if left mouse button is currently down
   * @type {boolean}
   */
  isLeftMouseDown = false;
  /**
   * True if the middle mouse button is currently down
   * @type {boolean}
   */
  isMiddleMouseDown = false;
  /**
   * True if the right mouse button is currently down
   * @type {boolean}
   */
  isRightMouseDown = false;

  lastTouchAt = 0;

  constructor(gameWindow) {
    const el = gameWindow || window.ui.gameWindow;
    el.addEventListener('mousedown', this.#onMouseDown.bind(this), false);
    el.addEventListener('mouseup', this.#onMouseUp.bind(this), false);
    el.addEventListener('mousemove', this.#onMouseMove.bind(this), false);
    el.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    el.addEventListener(
      'touchstart',
      (event) => {
        this.lastTouchAt = Date.now();
        const t = event.touches[0];
        if (t) {
          this.mouse.x = t.clientX;
          this.mouse.y = t.clientY;
        }
      },
      { passive: true }
    );
    el.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          this.lastTouchAt = Date.now();
          this.mouse.x = event.clientX;
          this.mouse.y = event.clientY;
        }
      },
      { passive: true }
    );
  }

  #isTouchDerived(event) {
    if (event.sourceCapabilities?.firesTouchEvents) return true;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') return true;
    return Date.now() - this.lastTouchAt < 700;
  }

  /**
   * Event handler for `mousedown` event
   * @param {MouseEvent} event
   */
  #onMouseDown(event) {
    if (this.#isTouchDerived(event)) return;
    if (event.button === 0) {
      this.isLeftMouseDown = true;
    }
    if (event.button === 1) {
      this.isMiddleMouseDown = true;
    }
    if (event.button === 2) {
      this.isRightMouseDown = true;
    }
  }

  /**
   * Event handler for `mouseup` event
   * @param {MouseEvent} event
   */
  #onMouseUp(event) {
    if (this.#isTouchDerived(event)) {
      this.isLeftMouseDown = false;
      return;
    }
    if (event.button === 0) {
      this.isLeftMouseDown = false;
    }
    if (event.button === 1) {
      this.isMiddleMouseDown = false;
    }
    if (event.button === 2) {
      this.isRightMouseDown = false;
    }
  }

  /**
   * Event handler for 'mousemove' event
   * @param {MouseEvent} event
   */
  #onMouseMove(event) {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    if (this.#isTouchDerived(event)) {
      this.isLeftMouseDown = false;
      return;
    }
    this.isLeftMouseDown = event.buttons & 1;
    this.isRightMouseDown = event.buttons & 2;
    this.isMiddleMouseDown = event.buttons & 4;
  }
}
