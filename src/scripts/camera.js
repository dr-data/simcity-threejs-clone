import * as THREE from 'three';
import {
  applyOrbit,
  applyPinchZoom,
  isTap,
  panOrigin,
  touchDistance,
  touchMidpoint,
  MIN_CAMERA_RADIUS,
  MAX_CAMERA_RADIUS,
  MIN_CAMERA_ELEVATION,
  MAX_CAMERA_ELEVATION,
  TAP_MOVE_PX,
} from './camera/gestures.js';

const DEG2RAD = Math.PI / 180.0;
const RIGHT_MOUSE_BUTTON = 2;

const CAMERA_SIZE = 5;
const AZIMUTH_SENSITIVITY = 0.2;
const ELEVATION_SENSITIVITY = 0.2;
const ZOOM_SENSITIVITY = 0.002;
const MOUSE_PAN_SENSITIVITY = -0.01;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

const VIEW_PRESETS = {
  top: { elevation: 89, radius: 0.8, azimuth: 0 },
  isometric: { elevation: 45, radius: 0.5, azimuth: 225 },
  street: { elevation: 15, radius: 0.15, azimuth: 180 },
  orbit: { elevation: 35, radius: 0.6, azimuth: 45, autoOrbit: true },
};

function pointFromTouch(touch) {
  return { id: touch.identifier, x: touch.clientX, y: touch.clientY };
}

export class CameraManager {
  constructor(gameWindow) {
    const el = gameWindow || window.ui.gameWindow;
    this._el = el;
    const aspect = el.clientWidth / el.clientHeight;

    this.camera = new THREE.OrthographicCamera(
      (CAMERA_SIZE * aspect) / -2,
      (CAMERA_SIZE * aspect) / 2,
      CAMERA_SIZE / 2,
      CAMERA_SIZE / -2,
      1,
      1000
    );
    this.camera.layers.enable(1);

    this.cameraOrigin = new THREE.Vector3(8, 0, 8);
    this.cameraRadius = 0.5;
    this.cameraAzimuth = 225;
    this.cameraElevation = 45;
    this.autoOrbit = false;
    this._transitioning = false;
    this._transitionTarget = null;
    this._transitionStart = null;

    this.isGesturing = false;
    this._pointers = new Map();
    this._lastPts = null;
    this._movedDistance = 0;
    this._wasPinch = false;
    this._lastPinchDist = null;
    this._lastPinchMid = null;
    this._usingPointer = false;

    this.updateCameraPosition();
    this._bind(el);
  }

  attachCanvas(canvas) {
    if (!canvas) return;
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
  }

  _bind(el) {
    el.style.touchAction = 'none';
    el.addEventListener('wheel', this.onMouseScroll.bind(this), { passive: false });
    el.addEventListener('mousedown', this.onMouseMove.bind(this), false);
    el.addEventListener('mousemove', this.onMouseMove.bind(this), false);

    el.addEventListener('pointerdown', this.onPointerDown.bind(this), { passive: false });
    el.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
    el.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
    el.addEventListener('pointercancel', this.onPointerUp.bind(this), { passive: false });

    el.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    el.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
  }

  fitToCity(size) {
    const n = Number(size) || 16;
    this.cameraOrigin.set(n / 2 - 0.5, 0, n / 2 - 0.5);
    this.cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, 8 / n));
    this._transitioning = false;
    this.updateCameraPosition();
  }

  setView(viewId) {
    const preset = VIEW_PRESETS[viewId];
    if (!preset) return;
    this.autoOrbit = preset.autoOrbit || false;
    this._transitionTarget = { ...preset };
    this._transitionStart = {
      elevation: this.cameraElevation,
      radius: this.cameraRadius,
      azimuth: this.cameraAzimuth,
      time: Date.now(),
    };
    this._transitioning = true;
  }

  updateTransition() {
    if (!this._transitioning || !this._transitionTarget) return;
    const elapsed = Date.now() - this._transitionStart.time;
    const duration = 800;
    const t = Math.min(1, elapsed / duration);
    const ease = t * (2 - t);
    this.cameraElevation =
      this._transitionStart.elevation +
      (this._transitionTarget.elevation - this._transitionStart.elevation) * ease;
    this.cameraRadius =
      this._transitionStart.radius +
      (this._transitionTarget.radius - this._transitionStart.radius) * ease;
    this.cameraAzimuth =
      this._transitionStart.azimuth +
      (this._transitionTarget.azimuth - this._transitionStart.azimuth) * ease;
    if (t >= 1) this._transitioning = false;
    this.updateCameraPosition();
  }

  updateOrbit() {
    if (this.autoOrbit) {
      this.cameraAzimuth += 0.15;
      this.updateCameraPosition();
    }
  }

  updateCameraPosition() {
    this.camera.zoom = this.cameraRadius;
    this.camera.position.x =
      100 * Math.sin(this.cameraAzimuth * DEG2RAD) * Math.cos(this.cameraElevation * DEG2RAD);
    this.camera.position.y = 100 * Math.sin(this.cameraElevation * DEG2RAD);
    this.camera.position.z =
      100 * Math.cos(this.cameraAzimuth * DEG2RAD) * Math.cos(this.cameraElevation * DEG2RAD);
    this.camera.position.add(this.cameraOrigin);
    this.camera.lookAt(this.cameraOrigin);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  onMouseMove(event) {
    if (this.isGesturing) return;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
    if (event.buttons & RIGHT_MOUSE_BUTTON && !event.ctrlKey) {
      this.autoOrbit = false;
      this.cameraAzimuth += -(event.movementX * AZIMUTH_SENSITIVITY);
      this.cameraElevation += event.movementY * ELEVATION_SENSITIVITY;
      this.cameraElevation = Math.min(
        MAX_CAMERA_ELEVATION,
        Math.max(MIN_CAMERA_ELEVATION, this.cameraElevation)
      );
    }
    if (event.buttons & RIGHT_MOUSE_BUTTON && event.ctrlKey) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, this.cameraAzimuth * DEG2RAD);
      const left = new THREE.Vector3(1, 0, 0).applyAxisAngle(Y_AXIS, this.cameraAzimuth * DEG2RAD);
      this.cameraOrigin.add(forward.multiplyScalar(MOUSE_PAN_SENSITIVITY * event.movementY));
      this.cameraOrigin.add(left.multiplyScalar(MOUSE_PAN_SENSITIVITY * event.movementX));
    }
    this.updateCameraPosition();
  }

  onMouseScroll(event) {
    event.preventDefault();
    this.cameraRadius *= 1 - event.deltaY * ZOOM_SENSITIVITY;
    this.cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, this.cameraRadius));
    this.updateCameraPosition();
  }

  onPointerDown(event) {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    this._usingPointer = true;
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is optional */
    }
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this._beginFingers();
  }

  onPointerMove(event) {
    if (event.pointerType === 'mouse') return;
    if (!this._pointers.has(event.pointerId)) return;
    event.preventDefault();
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this._moveFingers([...this._pointers.values()]);
  }

  onPointerUp(event) {
    if (event.pointerType === 'mouse') return;
    if (!this._pointers.has(event.pointerId) && this._pointers.size === 0) return;
    event.preventDefault();
    this._pointers.delete(event.pointerId);
    this._endFingers(event.clientX, event.clientY);
    if (this._pointers.size === 0) {
      window.setTimeout(() => {
        if (this._pointers.size === 0) this._usingPointer = false;
      }, 400);
    }
  }

  onTouchStart(event) {
    if (this._usingPointer) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    this._syncTouches(event.touches);
    this._beginFingers();
  }

  onTouchMove(event) {
    if (this._usingPointer) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    this._syncTouches(event.touches);
    this._moveFingers([...this._pointers.values()]);
  }

  onTouchEnd(event) {
    if (this._usingPointer) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const last = event.changedTouches?.[0];
    this._syncTouches(event.touches);
    this._endFingers(last?.clientX, last?.clientY);
  }

  _syncTouches(touchList) {
    this._pointers.clear();
    for (let i = 0; i < touchList.length; i++) {
      const p = pointFromTouch(touchList[i]);
      this._pointers.set(p.id, { x: p.x, y: p.y });
    }
  }

  _beginFingers() {
    const count = this._pointers.size;
    this.isGesturing = count >= 1;
    if (count >= 2) this._wasPinch = true;
    if (count <= 1 && !this._wasPinch) this._movedDistance = 0;
    this._lastPinchDist = null;
    this._lastPinchMid = null;
    this._lastPts = [...this._pointers.values()].map((p) => ({ ...p }));
  }

  _moveFingers(pts) {
    if (pts.length === 1 && this._lastPts?.length === 1) {
      const dx = pts[0].x - this._lastPts[0].x;
      const dy = pts[0].y - this._lastPts[0].y;
      this._movedDistance += Math.hypot(dx, dy);
      if (this._movedDistance > TAP_MOVE_PX) {
        this.autoOrbit = false;
        const next = applyOrbit(this.cameraAzimuth, this.cameraElevation, dx, dy);
        this.cameraAzimuth = next.azimuth;
        this.cameraElevation = next.elevation;
        this.updateCameraPosition();
      }
    } else if (pts.length >= 2) {
      this._wasPinch = true;
      this.autoOrbit = false;
      const dist = touchDistance(pts[0], pts[1]);
      const mid = touchMidpoint(pts[0], pts[1]);
      if (this._lastPinchDist) {
        this.cameraRadius = applyPinchZoom(this.cameraRadius, this._lastPinchDist, dist);
      }
      if (this._lastPinchMid) {
        const origin = panOrigin(
          this.cameraOrigin,
          this.cameraAzimuth,
          mid.x - this._lastPinchMid.x,
          mid.y - this._lastPinchMid.y
        );
        this.cameraOrigin.set(origin.x, origin.y, origin.z);
      }
      this._lastPinchDist = dist;
      this._lastPinchMid = mid;
      this.updateCameraPosition();
    }
    this._lastPts = pts.map((p) => ({ ...p }));
  }

  _endFingers(clientX, clientY) {
    if (this._pointers.size > 0) {
      this._lastPinchDist = null;
      this._lastPinchMid = null;
      this._lastPts = [...this._pointers.values()].map((p) => ({ ...p }));
      return;
    }

    const wasTap = !this._wasPinch && isTap(this._movedDistance);
    this.isGesturing = false;
    this._lastPinchDist = null;
    this._lastPinchMid = null;
    this._lastPts = null;
    this._movedDistance = 0;
    this._wasPinch = false;

    if (wasTap && window.game && clientX != null) {
      window.game.inputManager.mouse.x = clientX;
      window.game.inputManager.mouse.y = clientY;
      window.game.updateFocusedObject();
      window.game.useTool();
    }
  }

  resize() {
    const aspect = window.ui.gameWindow.clientWidth / window.ui.gameWindow.clientHeight;
    this.camera.left = (CAMERA_SIZE * aspect) / -2;
    this.camera.right = (CAMERA_SIZE * aspect) / 2;
    this.camera.updateProjectionMatrix();
  }
}
