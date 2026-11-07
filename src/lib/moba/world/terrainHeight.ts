import type * as BABYLON from "@babylonjs/core";

let terrain: BABYLON.GroundMesh | null = null;

/** Registers the heightmap ground so entities can stand on it. Call once its heights are applied. */
export const setTerrain = (ground: BABYLON.Mesh) => {
  terrain = ground as BABYLON.GroundMesh;
};

/** Terrain surface height at (x, z); 0 until the terrain is registered. */
export const getTerrainHeight = (x: number, z: number): number =>
  terrain?.getHeightAtCoordinates?.(x, z) ?? 0;
