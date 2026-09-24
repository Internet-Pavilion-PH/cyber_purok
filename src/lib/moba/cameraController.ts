import * as BABYLON from "@babylonjs/core";

export const defaultGameCameraConfig = {
  alpha: -Math.PI / 4, // Fixed isometric angle (-45 degrees)
  beta: Math.PI / 3.6,  // Fixed pitch / downward tilt angle
  radius: 120,          // Fixed distance from hero
};

/**
 * Locks camera angles and prevents user input from changing alpha, beta, or zoom.
 */
export function configureFixedGameCamera(
  camera: BABYLON.ArcRotateCamera,
  canvas: HTMLCanvasElement,
  settings = defaultGameCameraConfig,
) {
  // 1. Enforce default angle and distance values
  camera.alpha = settings.alpha;
  camera.beta = settings.beta;
  camera.radius = settings.radius;

  // 2. Strict limits to prevent any rotation/zoom shifts
  camera.lowerAlphaLimit = settings.alpha;
  camera.upperAlphaLimit = settings.alpha;
  camera.lowerBetaLimit = settings.beta;
  camera.upperBetaLimit = settings.beta;
  camera.lowerRadiusLimit = settings.radius;
  camera.upperRadiusLimit = settings.radius;

  // 3. Disable panning & inertia
  camera.inertia = 0;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, false);

  // 4. Strip pointer/mouse wheel controls
  const mouseInput = camera.inputs.attached.mouse as any;
  const pointerInput = camera.inputs.attached.pointers as any;

  if (mouseInput) {
    mouseInput.buttons = [];
    mouseInput.wheelDeltaPercentage = 0;
    mouseInput.wheelPrecision = 0;
  }

  if (pointerInput) {
    pointerInput.buttons = [];
  }
}

/**
 * Resets camera target position while keeping fixed orientation locked.
 */
export function resetGameCameraToTarget(
  camera: BABYLON.ArcRotateCamera,
  target: BABYLON.Vector3,
  settings = defaultGameCameraConfig,
) {
  camera.inertia = 0;
  camera.alpha = settings.alpha;
  camera.beta = settings.beta;
  camera.radius = settings.radius;
  camera.setTarget(target.clone());
  camera.upVector = BABYLON.Vector3.Up();
}

/**
 * Recenters camera target on target (e.g. key '1' press).
 */
export function centerCameraOnTarget(
  camera: BABYLON.ArcRotateCamera,
  targetPosition: BABYLON.Vector3,
  smooth = false,
  scene?: BABYLON.Scene,
) {
  if (!smooth || !scene) {
    camera.setTarget(targetPosition.clone());
    return;
  }

  // Smooth pan to hero position
  BABYLON.Animation.CreateAndStartAnimation(
    "cameraPanToHero",
    camera,
    "target",
    60,
    12, // ~0.2s pan time
    camera.target.clone(),
    targetPosition.clone(),
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
    new BABYLON.CubicEase(),
  );
}