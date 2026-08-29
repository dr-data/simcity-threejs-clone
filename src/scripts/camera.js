import * as THREE from 'three';

const DEG2RAD = Math.PI / 180.0;
const RIGHT_MOUSE_BUTTON = 2;

const CAMERA_SIZE = 5;
const MIN_CAMERA_RADIUS = 0.1;
const MAX_CAMERA_RADIUS = 8;
const MIN_CAMERA_ELEVATION = 10;
const MAX_CAMERA_ELEVATION = 89;

const AZIMUTH_SENSITIVITY = 0.2;
const ELEVATION_SENSITIVITY = 0.2;
const ZOOM_SENSITIVITY = 0.002;
const PAN_SENSITIVITY = -0.01;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

const VIEW_PRESETS = {
  top: { elevation: 89, radius: 0.8, azimuth: 0 },
  isometric: { elevation: 45, radius: 0.5, azimuth: 225 },
  street: { elevation: 15, radius: 0.15, azimuth: 180 },
  orbit: { elevation: 35, radius: 0.6, azimuth: 45, autoOrbit: true },
};

export class CameraManager {
  constructor() {
    const aspect = window.ui.gameWindow.clientWidth / window.ui.gameWindow.clientHeight;

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

    this.updateCameraPosition();

    window.ui.gameWindow.addEventListener('wheel', this.onMouseScroll.bind(this), false);
    window.ui.gameWindow.addEventListener('mousedown', this.onMouseMove.bind(this), false);
    window.ui.gameWindow.addEventListener('mousemove', this.onMouseMove.bind(this), false);

    // Touch support
    this._touchStart = null;
    window.ui.gameWindow.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    window.ui.gameWindow.addEventListener('touchmove', this.onTouchMove.bind(this), false);
    window.ui.gameWindow.addEventListener('touchend', () => {
      this._touchStart = null;
    });
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
    if (event.buttons & RIGHT_MOUSE_BUTTON && !event.ctrlKey) {
      this.autoOrbit = false;
      this.cameraAzimuth += -(event.movementX * AZIMUTH_SENSITIVITY);
      this.cameraElevation += event.movementY * ELEVATION_SENSITIVITY;
      this.cameraElevation = Math.min(MAX_CAMERA_ELEVATION, Math.max(MIN_CAMERA_ELEVATION, this.cameraElevation));
    }
    if (event.buttons & RIGHT_MOUSE_BUTTON && event.ctrlKey) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, this.cameraAzimuth * DEG2RAD);
      const left = new THREE.Vector3(1, 0, 0).applyAxisAngle(Y_AXIS, this.cameraAzimuth * DEG2RAD);
      this.cameraOrigin.add(forward.multiplyScalar(PAN_SENSITIVITY * event.movementY));
      this.cameraOrigin.add(left.multiplyScalar(PAN_SENSITIVITY * event.movementX));
    }
    this.updateCameraPosition();
  }

  onMouseScroll(event) {
    this.cameraRadius *= 1 - event.deltaY * ZOOM_SENSITIVITY;
    this.cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, this.cameraRadius));
    this.updateCameraPosition();
  }

  onTouchStart(event) {
    if (event.touches.length === 1) {
      this._touchStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  }

  onTouchMove(event) {
    if (!this._touchStart || event.touches.length !== 1) return;
    event.preventDefault();
    const dx = event.touches[0].clientX - this._touchStart.x;
    const dy = event.touches[0].clientY - this._touchStart.y;
    this.autoOrbit = false;
    this.cameraAzimuth -= dx * 0.3;
    this.cameraElevation += dy * 0.3;
    this.cameraElevation = Math.min(MAX_CAMERA_ELEVATION, Math.max(MIN_CAMERA_ELEVATION, this.cameraElevation));
    this._touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    this.updateCameraPosition();
  }

  resize() {
    const aspect = window.ui.gameWindow.clientWidth / window.ui.gameWindow.clientHeight;
    this.camera.left = (CAMERA_SIZE * aspect) / -2;
    this.camera.right = (CAMERA_SIZE * aspect) / 2;
    this.camera.updateProjectionMatrix();
  }
}
