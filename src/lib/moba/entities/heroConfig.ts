import * as BABYLON from "@babylonjs/core";
import type { HeroConfig } from "./hero";
import heroCatalog from "../heroes.json";

export type HeroPresetName = keyof typeof heroCatalog;

export const HERO_PRESETS = heroCatalog as Record<
  HeroPresetName,
  {
    modelUrl: string;
    fileName: string;
    modelScale: number;
    headOffsetY?: number;
    idleAnimationName: string;
    walkAnimationName: string;
    skillAnimations: {
      q: string;
      w: string;
      e: string;
      r: string;
    };
  }
>;

/** Shared hero model/animation setup used by both local and remote heroes. */
export const createHeroConfig = (
  id: string,
  name: string,
  spawnPosition: BABYLON.Vector3,
  preset: HeroPresetName = "chef",
): HeroConfig => ({
  id,
  name,
  moveSpeed: 0.20,
  rotationSpeed: 0.08,
  spawnPosition,
  modelScale: HERO_PRESETS[preset].modelScale,
  modelUrl: HERO_PRESETS[preset].modelUrl,
  fileName: HERO_PRESETS[preset].fileName,
  forwardOffset: Math.PI,
  headOffsetY: HERO_PRESETS[preset].headOffsetY,
  idleAnimationName: HERO_PRESETS[preset].idleAnimationName,
  walkAnimationName: HERO_PRESETS[preset].walkAnimationName,
  skillAnimations: HERO_PRESETS[preset].skillAnimations,
});
