import * as BABYLON from "@babylonjs/core";
import { Tower } from "./entities/tower";
import { Creep } from "./entities/creeps";
import { Fence } from "./world/fence";
import { Tree } from "./world/tree";
import { Stone } from "./world/stone";
import { PlaceModel } from "./world/placeModel";
import type { ArenaBuilder } from "./world/arenaBuilder";

const TREES = [
  { x: -110, z: -220, scale: 10, height: 2 },
  { x: -61, z: -322, scale: 12, height: 2.5 },
  { x: -11, z: -298, scale: 8, height: 1.8 },
  { x: -36, z: -407, scale: 8, height: 1.8 },
  { x: 185, z: -394, scale: 8, height: 1.8 },
  { x: -5, z: -208, scale: 10, height: 2 },
  { x: -44, z: 350, scale: 20, height: 3 },

  { x: 18, z: 191, scale: 8, height: 1.8 },
  { x: 76, z: -300, scale: 10, height: 2 },
  { x: 59, z: 311, scale: 20, height: 3 },
  { x: 468, z: 355, scale: 20, height: 3 },
  { x: 226, z: 101, scale: 10, height: 2 },
];

const TOWERS = [
  { position: new BABYLON.Vector3(-216, 0, -216), angle: Math.PI / 4 },
  { position: new BABYLON.Vector3(-80, 0, -93), angle: Math.PI / 4 },
  { position: new BABYLON.Vector3(-462, 0, -102), angle: Math.PI / 9.5 },
  { position: new BABYLON.Vector3(-71, 0, -440), angle: Math.PI / 2 },

  { position: new BABYLON.Vector3(216, 0, 216), angle: Math.PI / 4 },
  { position: new BABYLON.Vector3(88, 0, 88), angle: Math.PI / 4 },
  { position: new BABYLON.Vector3(460, 0, 111), angle: Math.PI / 9 },
  { position: new BABYLON.Vector3(45, 0, 463), angle: Math.PI / 2.5 },
];

type StoneSpec = { x: number; z: number; height: number; x2?: number; z2?: number };

/** Give x2/z2 to lay a row of stones from (x, z) to (x2, z2); omit them for a single stone. */
const STONES: StoneSpec[] = [
  { x: -144, z: -366, height: 5 },
  { x: -416, z: -302, height: 10 },

  { x: -49, z: 298, height: 10 },
  { x: 306, z: 198, height: 15 },
  { x: 325, z: 210, height: 5},
  { x: 20, z: 173, height: 5 },
  { x: 70, z: 365, height: 15 },

  /*Riverbank Stones - Lower Right Side*/
  { x: -47, z: -136, height: 1 },
  { x: -55, z: -119, height: 10 },
  { x: -39, z: -123, height: 6 },
  { x: -46, z: -128, x2: -16, z2: -150, height: 4 },
  { x: -34, z: -146, height: 5 },
  { x: -18, z: -155, height: 1 },
  { x: -8, z: -157, height: 6 },
  { x: -2, z: -163, x2: 16, z2: -180, height: 2 },
  { x: 5, z: -178, height: 5 },
  { x: 23, z: -190, height: 7 },
  { x: 31, z: -196, x2: 54, z2: -221, height: 3 },
  { x: 36, z: -214, height: 5 },
  { x: 43, z: -217, height: 3 },
  { x: 66, z: -231, height: 10 },
  { x: 75, z: -241, x2: 113, z2: -280, height: 4 },
  { x: 81, z: -259, height: 7 },
  { x: 120, z: -290, height: 8 },
  { x: 125, z: -306, height: 10 },
  { x: 138, z: -313, x2: 160, z2: -328, height: 5 },
  { x: 165, z: -344, height: 10 },
  { x: 180, z: -344, height: 5 },
  { x: 185, z: -350, x2: 190, z2: -372, height: 3 },
  { x: 194, z: -378, height: 5 },
  { x: 198, z: -383, x2: 218, z2: -405, height: 4 },
  { x: 217, z: -415, height: 7 },
  { x: 232, z: -411, height: 10 },

  { x: 282, z: -468, height: 10 },
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
    { x: -429, z: -114 },
  ],
  [
    { x: 56, z: 434 },
    { x: 100, z: 353 },
    { x: 194, z: 236 },
  ],
  [
    { x: 239, z: 196 },
    { x: 290, z: 174 },
    { x: 433, z: 127 },
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
  statue1: { file: "roger.glb", position: [-106, 1, -73], scale: 4, rotationY: Math.PI / 2 },
  statue2: { file: "roger.glb", position: [114, 1, 66], scale: 4, rotationY: Math.PI / -2 },
  cottage1: { file: "cottage.glb", position: [-469, 1, -438], scale: 1.5 },
  conch: { file: "Conch1.glb", position: [-41, 25, -217], scale: 300 },
  conch2: { file: "Conch1.glb", position: [-23, 25, -169], scale: 500},
  conch3: { file: "Conch1.glb", position: [-10, 25, -208], scale: 400},
  basketStore: { file: "Yellowbasketstore.glb", position: [-309, 1, -31], scale: 3 },
  salawaki: { file: "salawaki_swimming-optimized.glb", position: [-221, -50, -41], scale: .75 },
  
  cottage2: { file: "pcbhouse.glb", position: [277, 1, 386], scale: 90, rotationY: Math.PI / -3 },
  
  ghostwhisper: { file: "gw.glb", position: [216, 10, 336], scale: 4, rotationY: Math.PI / -1 },
  
  circuit1: { file: "ffc1.glb", position: [279, 1, 4], scale: 300, rotationY: Math.PI / -1.5 },
  circuit2: { file: "ffc2.glb", position: [12, 20, 258], scale: 300, rotationY: Math.PI / -1.5 },
  
  structure1: { file: "WireStructures.glb", position: [457, 1, 218], scale: 30},
  structure2: { file: "SolidStructure.glb", position: [403, 1, 257], scale: 25},
  
  structure3: { file: "SolidStructure.glb", position: [144, 1, 229], scale: 15},
  structure4: { file: "SolidStructure.glb", position: [124, 1, 181], scale: 5, rotationY: Math.PI / -1},

  structure5: { file: "SolidStructure.glb", position: [-174, 1, 402], scale: 20, rotationY: Math.PI / -1},
  structure6: { file: "WireStructures.glb", position: [-153, 1, 384], scale: 15 },

};

/**  Make creeps emerge from cottages **/
const BLUE_BASE = new BABYLON.Vector3(290, 0, 290);
const RED_BASE = new BABYLON.Vector3(-342, 0, -385);
const CREEP_SPAWN_DELAY_MS = 20000;

/** Adds every mesh of a node to the arena's shadow casters (no-op without lights). */
const castShadows = (arena: ArenaBuilder | null, node: BABYLON.TransformNode) => {
  if (!arena?.lights) return;
  for (const mesh of node.getChildMeshes()) arena.lights.addShadowCaster(mesh);
};

/** Makes every mesh under a node solid so heroes can't walk through it. */
const makeSolid = (node: BABYLON.TransformNode) => {
  for (const mesh of node.getChildMeshes()) mesh.checkCollisions = true;
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
    const tree = new Tree(scene, new BABYLON.Vector3(x, 0, z), scale, height);
    makeSolid(tree.rootNode);
    castShadows(arena, tree.rootNode);
  }

  for (const { x, z, x2, z2, height } of STONES) {
    const start = new BABYLON.Vector3(x, 0, z);
    const position: BABYLON.Vector3 | [BABYLON.Vector3, BABYLON.Vector3] =
      x2 !== undefined && z2 !== undefined ? [start, new BABYLON.Vector3(x2, 0, z2)] : start;
    new Stone(scene, position, height).createStone();
  }

  const models = Object.values(WORLD_MODELS).map(
    ({ file, position, scale, rotationY = 0 }) =>
      new PlaceModel(scene, file, position, {
        scaleFactor: scale,
        rotation: [0, rotationY, 0],
      }),
  );

  for (const { position, angle } of TOWERS) {
    const tower = new Tower(scene, position, 50, 2, 40, angle);
    makeSolid(tower.rootNode);
    castShadows(arena, tower.rootNode);
  }

  for (const points of FENCES) {
    const fence = new Fence(scene, points, 30, 1, 1, 0);
    makeSolid(fence.rootNode);
    if (arena?.lights) fence.addShadowCasters(arena.lights.shadowGen);
    fence.rootNode.position = new BABYLON.Vector3(0, 0, 0);
  }

  // Blue base pushes a creep lane toward the red base after a delay.
  window.setTimeout(() => {
    const creeps = Creep.spawnGroup(scene, BLUE_BASE, RED_BASE, 3, 5);
    if (arena?.lights) {
      const lights = arena.lights;
      for (const creep of creeps) {
        void creep.ready.then(() => creep.meshes.forEach((m) => lights.addShadowCaster(m)));
      }
    }
  }, CREEP_SPAWN_DELAY_MS);

  return { models };
};
