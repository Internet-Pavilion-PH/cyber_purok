import * as BABYLON from "@babylonjs/core";

export const HERO_START = new BABYLON.Vector3(0, 0, 0);
export const GROUND_SIZE = 1000;
export const CAMERA_EDGE_INSET = 50;
export const NETWORK_SEND_INTERVAL_MS = 50;
export const MOBILE_DEAD_ZONE = 0.12;
// Mobile joystick input is intentionally amplified because the hero's base movement
// speed is defined in world units per frame and the touch pad input is normalized.
export const MOBILE_SPEED_MULTIPLIER = 5.5;
