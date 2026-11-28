import * as BABYLON from "@babylonjs/core";

export type DistanceActivatableModel = {
  position: BABYLON.Vector3;
  isLoaded: boolean;
  ensureLoaded: () => Promise<unknown>;
  setEnabled: (enabled: boolean) => void;
};

export const WORLD_MODEL_LOAD_RADIUS = 120;
export const WORLD_MODEL_UNLOAD_RADIUS = 150;

export const updateWorldModelStreaming = (
  models: DistanceActivatableModel[],
  heroPosition: BABYLON.Vector3,
) => {
  for (const model of models) {
    const distance = BABYLON.Vector3.Distance(model.position, heroPosition);
    const shouldLoad = distance <= WORLD_MODEL_LOAD_RADIUS;
    const shouldUnload = distance >= WORLD_MODEL_UNLOAD_RADIUS;

    if (!model.isLoaded && shouldLoad) {
      void model.ensureLoaded();
      continue;
    }

    if (model.isLoaded) {
      model.setEnabled(!shouldUnload);
    }
  }
};

export const activateNearbyWorldModels = (
  models: DistanceActivatableModel[],
  heroPosition: BABYLON.Vector3,
) => {
  for (const model of models) {
    const distance = BABYLON.Vector3.Distance(model.position, heroPosition);
    if (distance <= WORLD_MODEL_LOAD_RADIUS) {
      void model.ensureLoaded();
    }
  }
};
