import * as BABYLON from "@babylonjs/core";

/** Brief expanding ring shown where the player right-clicked to move. */
export const spawnDirectionPulse = (scene: BABYLON.Scene, position: BABYLON.Vector3) => {
  const id = `${Date.now()}-${Math.random()}`;
  const ring = BABYLON.MeshBuilder.CreateTorus(
    `movePulse-${id}`,
    { diameter: 5, thickness: 0.5, tessellation: 32 },
    scene,
  );
  ring.position = new BABYLON.Vector3(position.x, 0, position.z);
  ring.isPickable = false;

  const material = new BABYLON.StandardMaterial(`movePulseMat-${id}`, scene);
  material.diffuseColor = new BABYLON.Color3(0.15, 0.8, 1.0);
  material.emissiveColor = new BABYLON.Color3(0.15, 0.8, 1.0);
  material.alpha = 0.9;
  material.disableLighting = true;
  ring.material = material;

  const startScale = 0.6;
  const endScale = 1.75;
  const durationMs = 500;
  const startTime = performance.now();

  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = BABYLON.Scalar.Clamp((performance.now() - startTime) / durationMs, 0, 1);
    const eased = 1 - (1 - t) * (1 - t);
    const scale = BABYLON.Scalar.Lerp(startScale, endScale, eased);
    ring.scaling.set(scale, 1, scale);
    material.alpha = 0.9 * (1 - t);

    if (t >= 1) {
      scene.onBeforeRenderObservable.remove(observer);
      ring.dispose();
      material.dispose();
    }
  });
};
