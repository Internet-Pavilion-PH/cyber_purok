import * as BABYLON from "@babylonjs/core";
import { CustomLoadingScreen } from "$lib/v1/CustomLoadingScreen";
import type { Hero } from "$lib/moba/entities/hero";
import type { HeroPresetName } from "$lib/moba/entities/heroConfig";
import type { RemoteHeroes } from "$lib/moba/entities/remoteHeroes";
import { createGameScene } from "$lib/moba/gameScene";

export type GameRuntimeDeps = {
  canvas: HTMLCanvasElement;
  isMobile: boolean;
  playerName: string;
  heroPreset?: HeroPresetName;
  remoteHeroes: RemoteHeroes;
  getHeroMesh: () => BABYLON.AbstractMesh | null;
  getMoveTarget: () => BABYLON.Vector3 | null;
  onMoveTarget: (target: BABYLON.Vector3) => void;
  onGroundClick: (point: { x: number; z: number }) => void;
  onBeforeHeroUpdate: (hero: Hero) => void;
  onAfterHeroUpdate: (hero: Hero) => void;
  onHeroLoaded: (hero: Hero) => void;
  onGuavaCollected?: () => void;
  isGameLive?: () => boolean;
  onSceneReady: (runtime: {
    scene: BABYLON.Scene;
    camera: BABYLON.ArcRotateCamera;
    arena: any;
    hero: Hero;
    guavaHunt: any;
  }) => void;
  onFpsUpdate?: (fps: number) => void;
  onResize?: () => void;
  onWheelCapture?: (event: Event) => void;
};

export const bootGameRuntime = (deps: GameRuntimeDeps) => {
  const {
    canvas,
    isMobile,
    playerName,
    heroPreset = "jfk2",
    remoteHeroes,
    getHeroMesh,
    getMoveTarget,
    onMoveTarget,
    onGroundClick,
    onBeforeHeroUpdate,
    onAfterHeroUpdate,
    onHeroLoaded,
    onGuavaCollected,
    isGameLive,
    onSceneReady,
    onFpsUpdate,
    onResize,
    onWheelCapture,
  } = deps;

  const engine = new BABYLON.Engine(canvas, true, { audioEngine: true });
  BABYLON.SceneLoader.ShowLoadingScreen = true;
  const loadingScreen = new CustomLoadingScreen("/images/cyber_purok2.png");
  engine.loadingScreen = loadingScreen;
  loadingScreen.displayLoadingUI();

  const scene = createGameScene({
    engine,
    canvas,
    loadingScreen,
    isMobile,
    playerName,
    heroPreset,
    remoteHeroes,
    getHeroMesh,
    getMoveTarget,
    onMoveTarget,
    onGroundClick,
    onBeforeHeroUpdate,
    onAfterHeroUpdate,
    onHeroLoaded,
    onGuavaCollected,
    isGameLive,
  });

  onSceneReady(scene);
  scene.scene.activeCamera = scene.camera;
  scene.camera.attachControl(canvas, true);

  engine.runRenderLoop(() => {
    scene.scene.render();
    const fps = Math.round(engine.getFps?.() ?? 0);
    onFpsUpdate?.(fps);
  });

  const handleResize = () => {
    engine.resize();
    onResize?.();
  };

  const handleWheel = (event: Event) => {
    event.stopPropagation();
    onWheelCapture?.(event);
  };

  window.addEventListener("resize", handleResize);
  canvas.addEventListener("wheel", handleWheel, { passive: true });

  return () => {
    window.removeEventListener("resize", handleResize);
    canvas.removeEventListener("wheel", handleWheel);
    remoteHeroes.setLocalHero(null);
    remoteHeroes.disposeAll();
    scene.scene.dispose();
    engine.dispose();
  };
};
