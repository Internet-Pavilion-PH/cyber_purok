import * as BABYLON from "@babylonjs/core";
import worldDecorData from "../worldDecorData.json";
import { Tower } from "../entities/tower";
import { Creep } from "../entities/creeps";
import { Fence } from "./fence";
import { TreeSprites } from "./treeSprites";
import { Stone } from "./stone";
import { PlaceModel } from "./placeModel";
import type { ArenaBuilder } from "./arenaBuilder";

type TreeSpec = { x: number; z: number; scale: number; height: number };
type TowerSpec = { position: [number, number, number]; angle: number | string };
type StoneSpec = { x: number; z: number; height: number; x2?: number; z2?: number };

const worldDecor = worldDecorData as unknown as {
  worldModels: Record<string, WorldModel>;
  trees: TreeSpec[];
  towers: TowerSpec[];
  stones: StoneSpec[];
};

const TREES = worldDecor.trees;
const TOWERS = worldDecor.towers.map(({ position, angle }) => {
  const resolvedAngle = typeof angle === "string" ? Function(`"use strict"; return (${angle});`)() : angle;
  return {
    position: new BABYLON.Vector3(position[0], position[1], position[2]),
    angle: resolvedAngle,
  };
});
const STONES: StoneSpec[] = worldDecor.stones;

const FENCES = [
  [
    { x: -67, z: -406 },
    { x: -100, z: -353 },
    { x: -194, z: -236 },
  ],
  [
    { x: -238, z: -195 },
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
  position: number[];
  scale: number;
  rotationY?: number | string;
  collidable?: boolean;
  soundTitle?: string;
};

const WORLD_MODELS = worldDecor.worldModels as Record<string, WorldModel>;

/**  Make creeps emerge from cottages **/
const BLUE_BASE = new BABYLON.Vector3(290, 0, 290);
const RED_BASE = new BABYLON.Vector3(-342, 0, -385);
const CREEP_SPAWN_DELAY_MS = 20000;

/** Adds every mesh of a node to the arena's shadow casters (no-op without lights). */
const castShadows = (arena: ArenaBuilder | null, node: BABYLON.TransformNode) => {
  if (!arena?.lights) return;
  for (const mesh of node.getChildMeshes()) arena.lights.addWorldShadowCaster(mesh);
};

/** Makes an explicit barrier solid so heroes can't walk through it. */
const makeSolidBarrier = (node: BABYLON.TransformNode) => {
  for (const mesh of node.getChildMeshes()) {
    mesh.checkCollisions = true;
    mesh.isPickable = true;
  }
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
  const treeSprites = new TreeSprites(scene, "/images/texture/artwork_tree.png", TREES.length + 32, { width: 1117, height: 1117 });
  for (const { x, z, scale } of TREES) {
    const spriteSize = Math.max(22, scale * 7);
    treeSprites.addTree(new BABYLON.Vector3(x, 0, z), spriteSize);
  }

  for (const { x, z, x2, z2, height } of STONES) {
    const start = new BABYLON.Vector3(x, 0, z);
    const position: BABYLON.Vector3 | [BABYLON.Vector3, BABYLON.Vector3] =
      x2 !== undefined && z2 !== undefined ? [start, new BABYLON.Vector3(x2, 0, z2)] : start;
    new Stone(scene, position, height).createStone();
  }

  const models = Object.values(WORLD_MODELS).map(
    ({ file, position, scale, rotationY = 0, collidable = false, soundTitle }) => {
      const resolvedRotationY = typeof rotationY === "string" ? Function(`"use strict"; return (${rotationY});`)() : rotationY;
      return new PlaceModel(scene, file, position, {
        scaleFactor: scale,
        rotation: [0, resolvedRotationY, 0],
        mergeMeshes: true,
        fadeIn: true,
        collidable,
        soundTitle,
      });
    },
  );

  for (const { position, angle } of TOWERS) {
    const tower = new Tower(scene, position, 50, 2, 40, angle);
    castShadows(arena, tower.rootNode);
  }

  for (const points of FENCES) {
    const fence = new Fence(scene, points, 30, 1, 1, 0);
    makeSolidBarrier(fence.rootNode);
    if (arena?.lights) {
      for (const mesh of fence.meshes) arena.lights.addWorldShadowCaster(mesh);
    }
    fence.rootNode.position = new BABYLON.Vector3(0, 0, 0);
  }

  // Blue base pushes a creep lane toward the red base after a delay, with each creep staggering by 10s.
  window.setTimeout(() => {
    const creeps = Creep.spawnGroup(scene, BLUE_BASE, RED_BASE, 3, 5, 10000);
    if (arena?.lights) {
      const lights = arena.lights;
      for (const creep of creeps) {
        void creep.ready.then(() => creep.meshes.forEach((m) => lights.addShadowCaster(m)));
      }
    }
  }, CREEP_SPAWN_DELAY_MS);

  return { models };
};
