import * as BABYLON from "@babylonjs/core";
import { Hero } from "$lib/moba/entities/hero";
import { HERO_SKILL_KEYS, isSkillKey } from "$lib/moba/input/keyboard";
import { joystickToMoveDirection } from "$lib/moba/input/mobileInput";

export type HeroInputControllerDeps = {
  getHero: () => Hero | null;
  getCurrentTarget: () => BABYLON.Vector3 | null;
  setCurrentTarget: (target: BABYLON.Vector3 | null) => void;
  getMobileMoveVector: () => { x: number; y: number };
  setMobileMoveVector: (input: { x: number; y: number }) => void;
  resetGameCameraToHero: () => void;
  focusCameraOn: (point: { x: number; z: number }) => void;
};

export const createHeroInputController = (deps: HeroInputControllerDeps) => {
  const applyMobileMovement = (input: { x: number; y: number }) => {
    deps.setMobileMoveVector(input);
  };

  const handleHeroKey = (key: string, isPressed: boolean) => {
    if (!isPressed) return;

    if (key === "1") {
      deps.resetGameCameraToHero();
      return;
    }

    const hero = deps.getHero();
    if (!hero) return;

    if (key === "a") {
      hero.attack();
      return;
    }

    if (isSkillKey(key)) {
      const skill = HERO_SKILL_KEYS[key];
      if (skill === "q") hero.castQ();
      if (skill === "w") hero.castW();
      if (skill === "e") hero.castE();
      if (skill === "r") hero.castR();
    }
  };

  const handleMinimapSelect = (point: { x: number; z: number }) => {
    deps.focusCameraOn(point);
    deps.setCurrentTarget(null);
    const hero = deps.getHero();
    hero?.setTarget(null);
  };

  const applyHeroInput = (localHero: Hero) => {
    const mobileMoveVector = deps.getMobileMoveVector();
    const joystickActive = mobileMoveVector.x !== 0 || mobileMoveVector.y !== 0;
    const direction = joystickToMoveDirection(mobileMoveVector);

    if (joystickActive) deps.setCurrentTarget(null);

    localHero.setMoveDirection(direction ? new BABYLON.Vector3(direction.x, 0, direction.z) : null);
    localHero.setTarget(deps.getCurrentTarget());
  };

  return {
    applyMobileMovement,
    handleHeroKey,
    handleMinimapSelect,
    applyHeroInput,
  };
};
