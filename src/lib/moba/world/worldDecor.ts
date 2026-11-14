import * as BABYLON from "@babylonjs/core";
import worldDecorData from "../worldDecorData.json";
import { Tower } from "../entities/tower";
import { Creep } from "../entities/creeps";
import { Fence } from "./fence";
import { TreeSprites } from "./treeSprites";
import { Stone } from "./stone";
import { PlaceModel } from "./placeModel";
import { BoardUp } from "./boardUp";
import type { ArenaBuilder } from "./arenaBuilder";

type TreeSpec = { x: number; z: number; scale: number; height: number };
type TowerSpec = { position: [number, number, number]; angle: number | string };
type StoneSpec = { x: number; z: number; height: number; x2?: number; z2?: number };

const worldDecor = worldDecorData as unknown as {
  worldModels: Record<string, WorldModel>;
  trees: TreeSpec[];
  towers: TowerSpec[];
  stones: StoneSpec[];
  fences?: Array<Array<{ x: number; z: number }>>;
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
const FENCES = worldDecor.fences ?? [];

type WorldModel = {
  file: string;
  position: number[];
  scale: number;
  rotationY?: number | string;
  collidable?: boolean;
  soundTitle?: string;
};

type BoardUpSpec = {
  texture: string;
  start: [number, number, number];
  end: [number, number, number];
  height?: number;
  thickness?: number;
  name?: string;
  emissiveColor?: string;
  alpha?: number;
};

const WORLD_MODELS = worldDecor.worldModels as Record<string, WorldModel>;
const BOARDUPS = (worldDecor as { boardUp?: BoardUpSpec[]; billboards?: BoardUpSpec[] }).boardUp ?? (worldDecor as { billboards?: BoardUpSpec[] }).billboards ?? [];

/**  Make creeps emerge from cottages **/
const BLUE_BASE = new BABYLON.Vector3(290, 0, 290);
const RED_BASE = new BABYLON.Vector3(-342, 0, -385);
const CREEP_SPAWN_DELAY_MS = 20000;

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

  for (const boardUpSpec of BOARDUPS) {
    const {
      texture,
      start,
      end,
      height = 2,
      thickness = 0.2,
      name,
      emissiveColor,
      alpha,
    } = boardUpSpec;

    BoardUp.create(scene, {
      texture,
      start: new BABYLON.Vector3(start[0], start[1], start[2]),
      end: new BABYLON.Vector3(end[0], end[1], end[2]),
      height,
      thickness,
      name,
      emissiveColor,
      alpha,
    });
  }

  for (const { position, angle } of TOWERS) {
    new Tower(scene, position, 50, 2, 40, angle);
  }

  for (const points of FENCES) {
    const fence = new Fence(scene, points, 30, 1, 1, 0);
    makeSolidBarrier(fence.rootNode);
    fence.rootNode.position = new BABYLON.Vector3(0, 0, 0);
  }

  // Blue base pushes a creep lane toward the red base after a delay, with each creep staggering by 10s.
  window.setTimeout(() => {
    Creep.spawnGroup(scene, BLUE_BASE, RED_BASE, 3, 5, 10000);
  }, CREEP_SPAWN_DELAY_MS);

  return { models };
};
