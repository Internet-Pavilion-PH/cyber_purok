import * as BABYLON from "@babylonjs/core";
import type { HeroConfig } from "$lib/moba/hero";

/** Shared hero model/animation setup used by both local and remote heroes. */
export const createHeroConfig = (
  id: string,
  name: string,
  spawnPosition: BABYLON.Vector3,
): HeroConfig => ({
  id,
  name,
  moveSpeed: 0.15,
  rotationSpeed: 0.08,
  spawnPosition,
  modelUrl: "",
  fileName: "JFK_2.glb",
  forwardOffset: Math.PI,
  idleAnimationName: "mixamo_gangnam",
  walkAnimationName: "mixamo_catwalk",
  skillAnimations: {
    q: "mixamo_arms hiphop dancing",
    w: "mixamo_arms hiphop dancing.002",
    e: "E",
    r: "R",
  },
});
