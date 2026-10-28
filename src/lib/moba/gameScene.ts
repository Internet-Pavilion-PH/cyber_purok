import * as BABYLON from "@babylonjs/core";
import * as ADDONS from "@babylonjs/addons";
import { preloadAssets } from "$lib/assetPreloader";
import type { CustomLoadingScreen } from "$lib/CustomLoadingScreen";
import { Hero } from "$lib/moba/hero";
import { createHeroConfig } from "$lib/moba/heroConfig";
import { ArenaBuilder } from "$lib/moba/arenaBuilder";
import type { RemoteHeroes } from "$lib/moba/remoteHeroes";
import { buildWorldDecor, createSky } from "$lib/moba/worldDecor";
import { spawnDirectionPulse } from "$lib/moba/movePulse";
import { attachEdgePan } from "$lib/moba/edgePan";
import {
  configureFixedGameCamera,
  configureMobileFollowCamera,
  defaultGameCameraConfig,
} from "$lib/moba/cameraController";
import { CAMERA_EDGE_INSET, GROUND_SIZE, HERO_START } from "$lib/moba/constants";

export type GameSceneOptions = {
  engine: BABYLON.Engine;
  canvas: HTMLCanvasElement;
  loadingScreen: CustomLoadingScreen;
  isMobile: boolean;
  playerName: string;
  remoteHeroes: RemoteHeroes;
  /** The local hero's mesh once loaded; the mobile camera follows it. */
  getHeroMesh: () => BABYLON.AbstractMesh | null;
  /** The current right-click move target; the mobile camera stops following while one is set. */
  getMoveTarget: () => BABYLON.Vector3 | null;
  onMoveTarget: (target: BABYLON.Vector3) => void;
  /** Called with the rounded ground point of every click, for the debug readout. */
  onGroundClick: (point: { x: number; z: number }) => void;
  /** Called every frame once the hero mesh exists, before and after `hero.update`. */
  onBeforeHeroUpdate: (hero: Hero) => void;
  onAfterHeroUpdate: (hero: Hero) => void;
  onHeroLoaded: (hero: Hero) => void;
};

const setupGameCamera = (scene: BABYLON.Scene, options: GameSceneOptions) => {
  const { canvas, isMobile, getHeroMesh, getMoveTarget } = options;
  const camera = new BABYLON.ArcRotateCamera(
    "gameCamera",
    defaultGameCameraConfig.alpha,
    defaultGameCameraConfig.beta,
    defaultGameCameraConfig.radius,
    HERO_START,
    scene,
  );
  scene.activeCamera = camera;

  if (isMobile) {
    configureMobileFollowCamera(camera, HERO_START);
    scene.onBeforeRenderObservable.add(() => {
      const heroMesh = getHeroMesh();
      if (heroMesh && !getMoveTarget()) camera.setTarget(heroMesh.position.clone());
    });
  } else {
    configureFixedGameCamera(camera, canvas);
    attachEdgePan({
      scene,
      camera,
      canvas,
      clampExtent: GROUND_SIZE / 2 - CAMERA_EDGE_INSET,
    });
  }

  return camera;
};

const setupRightClickMove = (
  scene: BABYLON.Scene,
  ground: BABYLON.Mesh,
  options: GameSceneOptions,
) => {
  scene.onPointerObservable.add((event) => {
    if (event.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;

    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (!pick?.hit || !pick.pickedPoint || pick.pickedMesh !== ground) return;

    const point = pick.pickedPoint;
    options.onGroundClick({ x: Math.round(point.x), z: Math.round(point.z) });

    if (event.event.button !== 2) return;
    const target = new BABYLON.Vector3(point.x, 0, point.z);
    options.onMoveTarget(target);
    spawnDirectionPulse(scene, target);
  });
};

/** Builds the arena, camera, world decor and local hero, and wires the per-frame hero update. */
export const createGameScene = (options: GameSceneOptions) => {
  const { engine, loadingScreen, playerName, remoteHeroes } = options;
  const scene = new BABYLON.Scene(engine);
  new ADDONS.HtmlMeshRenderer(scene, { enableOverlayRender: true });

  // World lighting is owned by ArenaBuilder; hero-local shadows remain in Hero.
  const arena = new ArenaBuilder(scene);
  const camera = setupGameCamera(scene, options);
  setupRightClickMove(scene, arena.ground, options);
  createSky(scene);
  const { models } = buildWorldDecor(scene, arena);

  scene.onBeforeRenderObservable.add(() => arena.tickTime(engine.getDeltaTime()));

  const hero = new Hero(scene, createHeroConfig("player-hero", playerName, HERO_START.clone()));
  hero.updateDisplayName(playerName);
  remoteHeroes.setLocalHero(hero);

  void preloadAssets([...models.map((model) => model.load()), hero.load()])
    .then(() => {
      if (arena.lights && hero.mesh) arena.lights.addShadowCaster(hero.mesh);
      hero.playAnimation("Idle");
      options.onHeroLoaded(hero);
    })
    .catch((error) => console.error("Game assets failed to preload:", error))
    .finally(() => {
      BABYLON.SceneLoader.ShowLoadingScreen = false;
      loadingScreen.hideLoadingUI();
    });

  scene.onBeforeRenderObservable.add(() => {
    if (!hero.mesh) return;
    options.onBeforeHeroUpdate(hero);
    hero.update(engine.getDeltaTime() / 1000);
    options.onAfterHeroUpdate(hero);
  });

  return { scene, camera, arena, hero };
};
