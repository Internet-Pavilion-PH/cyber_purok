import * as BABYLON from "@babylonjs/core";

export type DistanceActivatableModel = {
  position: BABYLON.Vector3;
  isLoaded: boolean;
  ensureLoaded: () => Promise<unknown>;
  setEnabled: (enabled: boolean) => void;
};

export const WORLD_MODEL_LOAD_RADIUS = 250;
export const WORLD_MODEL_UNLOAD_RADIUS = 300;

export const updateWorldModelStreaming = (
  models: DistanceActivatableModel[],
  heroPosition: BABYLON.Vector3,
  loadRadius = WORLD_MODEL_LOAD_RADIUS,
  unloadRadius = WORLD_MODEL_UNLOAD_RADIUS,
) => {
  for (const model of models) {
    const distance = BABYLON.Vector3.Distance(model.position, heroPosition);
    const shouldLoad = distance <= loadRadius;
    const shouldUnload = distance >= unloadRadius;

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
  loadRadius = WORLD_MODEL_LOAD_RADIUS,
) => {
  for (const model of models) {
    const distance = BABYLON.Vector3.Distance(model.position, heroPosition);
    if (distance <= loadRadius) {
      void model.ensureLoaded();
    }
  }
};
