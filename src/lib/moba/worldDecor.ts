import * as BABYLON from "@babylonjs/core";
import { Tower } from "$lib/moba/tower";
import { Creep } from "$lib/moba/creeps";
import { Fence } from "$lib/moba/fence";
import { Tree } from "$lib/moba/tree";
import { PlaceModel } from "$lib/moba/placeModel";
import type { ArenaBuilder } from "$lib/moba/arenaBuilder";

const TREES = [
  { x: -110, z: -220, scale: 10, height: 2 },
  { x: -61, z: -322, scale: 12, height: 2.5 },
  { x: -11, z: -298, scale: 8, height: 1.8 },
  { x: -36, z: -407, scale: 8, height: 1.8 },
  { x: 185, z: -394, scale: 8, height: 1.8 },
  { x: -11, z: -170, scale: 8, height: 1.8 },
  { x: 76, z: -300, scale: 20, height: 3 },
];

const TOWERS = [
  { position: new BABYLON.Vector3(-216, 0, -216), angle: Math.PI / 4 },
  { position: new BABYLON.Vector3(-100, 0, -100), angle: Math.PI / 4 },
  { position: new BABYLON.Vector3(-437, 0, -123), angle: Math.PI / 9 },
  { position: new BABYLON.Vector3(-71, 0, -440), angle: Math.PI / 2 },
];

const FENCES = [
  [
    { x: -67, z: -406 },
    { x: -100, z: -353 },
    { x: -194, z: -236 },
  ],
  [
    { x: -244, z: -190 },
    { x: -290, z: -174 },
    { x: -408, z: -127 },
  ],
];

type WorldModel = {
  file: string;
  position: [number, number, number];
  scale: number;
  rotationY?: number;
};

/** Static .glb scenery. Add a line here to place a new model; the 5 below are placeholders. */
const WORLD_MODELS: Record<string, WorldModel> = {
  fountain: { file: "Fountain.glb", position: [-342, 1, -385], scale: 3 },
  statue: { file: "roger.glb", position: [-128, 1, -67], scale: 4, rotationY: Math.PI / 2 },
  cottage: { file: "cottage.glb", position: [-469, -20, -438], scale: 1 },
  conch: { file: "Conch1.glb", position: [-41, 25, -217], scale: 300 },
  basketStore: { file: "Yellowbasketstore.glb", position: [-309, 1, -31], scale: 3 },
  ledScreen: { file: "led.glb", position: [100, 1, -250], scale: 4, rotationY: -Math.PI / 4 },
  gateway: { file: "gw.glb", position: [-344, 1, -185], scale: 4 },
  salawaki: { file: "salawaki_swimming-optimized.glb", position: [-221, -50, -41], scale: .75 },
};

const BLUE_BASE = new BABYLON.Vector3(200, 0, 200);
const RED_BASE = new BABYLON.Vector3(-386, 0, -386);
const CREEP_SPAWN_DELAY_MS = 20000;

/** Adds every mesh of a node to the arena's shadow casters (no-op without lights). */
const castShadows = (arena: ArenaBuilder | null, node: BABYLON.TransformNode) => {
  if (!arena?.lights) return;
  for (const mesh of node.getChildMeshes()) arena.lights.addShadowCaster(mesh);
};

export const createSky = (scene: BABYLON.Scene) => {
  scene.clearColor = new BABYLON.Color4(0.04, 0.1, 0.16, 1.0);

  const sky = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 2000, segments: 32 }, scene);
  sky.infiniteDistance = true;
  sky.isPickable = false;

  const material = new BABYLON.StandardMaterial("skyMaterial", scene);
  material.backFaceCulling = false;
  material.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.95);
  material.specularColor = new BABYLON.Color3(0, 0, 0);
  sky.material = material;
};

/** Places static scenery and returns the models the caller must `load()` during preload. */
export const buildWorldDecor = (scene: BABYLON.Scene, arena: ArenaBuilder | null) => {
  for (const { x, z, scale, height } of TREES) {
    castShadows(arena, new Tree(scene, new BABYLON.Vector3(x, 0, z), scale, height).rootNode);
  }

  const models = Object.values(WORLD_MODELS).map(
    ({ file, position, scale, rotationY = 0 }) =>
      new PlaceModel(scene, file, position, {
        scaleFactor: scale,
        rotation: [0, rotationY, 0],
      }),
  );

  for (const { position, angle } of TOWERS) {
    castShadows(arena, new Tower(scene, position, 50, 2, 40, angle).rootNode);
  }

  for (const points of FENCES) {
    const fence = new Fence(scene, points, 30, 1, 1, 0);
    if (arena?.lights) fence.addShadowCasters(arena.lights.shadowGen);
    fence.rootNode.position = new BABYLON.Vector3(0, 0, 0);
  }

  // Blue base pushes a creep lane toward the red base after a delay.
  window.setTimeout(() => {
    const creeps = Creep.spawnGroup(scene, BLUE_BASE, RED_BASE, 10, 30);
    if (arena?.lights) {
      for (const creep of creeps) arena.lights.addShadowCaster(creep.mesh);
    }
  }, CREEP_SPAWN_DELAY_MS);

  return { models };
};
