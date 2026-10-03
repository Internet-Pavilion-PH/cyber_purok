import * as BABYLON from "@babylonjs/core";

export const defaultGameCameraConfig = {
  // -Math.PI / 2 (-90°) looks straight North (+Z), placing an X=Z lane at a clean diagonal
  alpha: -Math.PI / 2, 
  beta: Math.PI / 3.2, // ~34° pitch above ground level
  radius: 150,
};

/**
 * Locks camera angles and completely disables manual camera movement.
 */
export function configureFixedGameCamera(
  camera: BABYLON.ArcRotateCamera,
  canvas: HTMLCanvasElement,
  settings = defaultGameCameraConfig,
) {
  // 1. Set default angle and distance values
  camera.alpha = settings.alpha;
  camera.beta = settings.beta;
  camera.radius = settings.radius;

  // 2. Lock strict rotation/zoom bounds
  camera.lowerAlphaLimit = settings.alpha;
  camera.upperAlphaLimit = settings.alpha;
  camera.lowerBetaLimit = settings.beta;
  camera.upperBetaLimit = settings.beta;
  camera.lowerRadiusLimit = settings.radius;
  camera.upperRadiusLimit = settings.radius;

  // 3. Disable panning & inertia
  camera.inertia = 0;
  camera.panningSensibility = 0;

  // 4. Strip all default user inputs cleanly
  camera.inputs.clear();
}

/**
 * Mobile variant: keeps the fixed orbit framing but follows the hero position
 * continuously instead of allowing free camera panning.
 */
export function configureMobileFollowCamera(
  camera: BABYLON.ArcRotateCamera,
  target: BABYLON.Vector3,
  settings = defaultGameCameraConfig,
) {
  camera.alpha = settings.alpha;
  camera.beta = settings.beta;
  camera.radius = settings.radius;

  camera.lowerAlphaLimit = settings.alpha;
  camera.upperAlphaLimit = settings.alpha;
  camera.lowerBetaLimit = settings.beta;
  camera.upperBetaLimit = settings.beta;
  camera.lowerRadiusLimit = settings.radius;
  camera.upperRadiusLimit = settings.radius;

  camera.inertia = 0;
  camera.panningSensibility = 0;
  camera.inputs.clear();
  camera.setTarget(target.clone());
  camera.upVector = BABYLON.Vector3.Up();
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
 * Recenters camera target smoothly or instantly.
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

  BABYLON.Animation.CreateAndStartAnimation(
    "cameraPanToHero",
    camera,
    "target",
    60,
    12, // ~0.2s transition
    camera.target.clone(),
    targetPosition.clone(),
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
    new BABYLON.CubicEase(),
  );
}