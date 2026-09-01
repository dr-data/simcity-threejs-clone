export const MIN_CAMERA_RADIUS = 0.1;
export const MAX_CAMERA_RADIUS = 8;
export const MIN_CAMERA_ELEVATION = 10;
export const MAX_CAMERA_ELEVATION = 89;
export const TAP_MOVE_PX = 12;
export const ORBIT_SENSITIVITY = 0.35;
export const PAN_SENSITIVITY = -0.02;

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function applyOrbit(azimuth, elevation, dx, dy, sensitivity = ORBIT_SENSITIVITY) {
  return {
    azimuth: azimuth - dx * sensitivity,
    elevation: clamp(
      elevation + dy * sensitivity,
      MIN_CAMERA_ELEVATION,
      MAX_CAMERA_ELEVATION
    ),
  };
}

export function applyPinchZoom(radius, prevDistance, nextDistance) {
  if (!prevDistance || prevDistance <= 0 || !nextDistance) return radius;
  return clamp(radius * (nextDistance / prevDistance), MIN_CAMERA_RADIUS, MAX_CAMERA_RADIUS);
}

export function touchDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function touchMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function panOrigin(origin, azimuthDeg, dx, dy, sensitivity = PAN_SENSITIVITY) {
  const rad = (azimuthDeg * Math.PI) / 180;
  const forwardX = Math.sin(rad);
  const forwardZ = Math.cos(rad);
  const leftX = Math.cos(rad);
  const leftZ = -Math.sin(rad);
  return {
    x: origin.x + forwardX * sensitivity * dy + leftX * sensitivity * dx,
    y: origin.y,
    z: origin.z + forwardZ * sensitivity * dy + leftZ * sensitivity * dx,
  };
}

export function isTap(totalMovePx, threshold = TAP_MOVE_PX) {
  return totalMovePx < threshold;
}
