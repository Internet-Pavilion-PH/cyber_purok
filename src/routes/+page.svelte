<script lang="ts">
  import { onMount } from "svelte";
  import * as BABYLON from "@babylonjs/core";
  import * as ADDONS from "@babylonjs/addons";
  import "@babylonjs/loaders/glTF";
  import { MultiplayerSocket } from "$lib/socket";
  import { CustomLoadingScreen } from "$lib/CustomLoadingScreen";
  import { preloadAssets } from "$lib/assetPreloader";
  import { Hero } from "$lib/moba/hero";
  import { createHeroConfig } from "$lib/moba/heroConfig";
  import { ArenaBuilder } from "$lib/moba/arenaBuilder";
  import { RemoteHeroes, SERVER_STEP, toMapMarkers, type MapMarker } from "$lib/moba/remoteHeroes";
  import { buildWorldDecor, createSky } from "$lib/moba/worldDecor";
  import { spawnDirectionPulse } from "$lib/moba/movePulse";
  import { attachEdgePan } from "$lib/moba/edgePan";
  import {
    configureFixedGameCamera,
    configureMobileFollowCamera,
    defaultGameCameraConfig,
    resetGameCameraToTarget,
  } from "$lib/moba/cameraController";
  import {
    createKeyboardController,
    HERO_SKILL_KEYS,
    isSkillKey,
  } from "$lib/moba/keyboard";
  import Ui_Moba from "$lib/moba/Ui_Moba.svelte";

  type HeroPosition = { x: number; z: number };

  const HERO_START = new BABYLON.Vector3(-380, 0, -380);
  const GROUND_SIZE = 1000;
  const CAMERA_EDGE_INSET = 50;
  const NETWORK_SEND_INTERVAL_MS = 50;
  const MOBILE_DEAD_ZONE = 0.12;
  const MOBILE_SPEED_MULTIPLIER = 1.8;

  const isMobile =
    typeof window !== "undefined" &&
    ((typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) ||
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches));

  // --- State ---
  let canvas: HTMLCanvasElement;
  let heroPosition: HeroPosition = { x: 0, z: 0 };
  let debugPoint = { x: 0, y: 0 };
  let playerName = "Player Hero";
  let remoteMarkers: MapMarker[] = [];

  let sceneRef: BABYLON.Scene | null = null;
  let gameCamera: BABYLON.ArcRotateCamera | null = null;
  let arenaBuilder: ArenaBuilder | null = null;
  let groundMesh: BABYLON.Mesh | null = null;
  let wallMeshes: BABYLON.Mesh[] = [];
  let gameGroundMaterial: BABYLON.StandardMaterial | null = null;

  let hero: Hero | null = null;
  let heroMesh: BABYLON.AbstractMesh | null = null;
  let currentTarget: BABYLON.Vector3 | null = null;
  let mobileMoveVector = { x: 0, y: 0 };

  let multiplayerSocket: MultiplayerSocket | null = null;
  let localPlayerId: string | null = null;
  let keyboardController: ReturnType<typeof createKeyboardController> | null = null;
  let lastSentAt = 0;
  let lastSentPos: HeroPosition | null = null;
  let lastSentYaw = 0;

  const remoteHeroes = new RemoteHeroes({
    getScene: () => sceneRef,
    getArena: () => arenaBuilder,
    getLocalPlayerId: () => localPlayerId,
  });

  // --- Handlers ---
  const resetGameCameraToHero = () => {
    if (!gameCamera || !heroMesh) return;
    resetGameCameraToTarget(gameCamera, heroMesh.position.clone(), defaultGameCameraConfig);
    currentTarget = null;
  };

  const applyMobileMovement = (input: { x: number; y: number }) => {
    mobileMoveVector = input;
  };

  const handleMinimapSelect = (point: HeroPosition) => {
    if (!gameCamera) return;

    const target = new BABYLON.Vector3(point.x, 0, point.z);
    gameCamera.setTarget(target);
    gameCamera.target.copyFrom(target);

    const orbitRadius = gameCamera.radius;
    const horizontal = orbitRadius * Math.cos(gameCamera.beta);
    gameCamera.position = target.add(
      new BABYLON.Vector3(
        Math.sin(gameCamera.alpha) * horizontal,
        orbitRadius * Math.sin(gameCamera.beta),
        Math.cos(gameCamera.alpha) * horizontal,
      ),
    );

    currentTarget = null;
    hero?.setTarget(null);
  };

  const preventGameWheel: EventListener = (event) => {
    event.stopPropagation();
  };

  const resolvePlayerName = () => {
    if (typeof window === "undefined") return playerName;

    const entered = window.prompt("Choose your hero name:", playerName);
    return entered?.trim() || playerName;
  };

  const handleHeroKey = (key: string, isPressed: boolean) => {
    if (!isPressed) return;

    if (key === "1") resetGameCameraToHero();
    if (!hero) return;

    if (key === "a") {
      hero.attack();
      return;
    }

    if (isSkillKey(key)) {
      const skill = HERO_SKILL_KEYS[key];
      if (skill === "q") hero.castQ();
      if (skill === "w") hero.castW();
      if (skill === "e") hero.castE();
      if (skill === "r") hero.castR();
    }
  };

  // --- Multiplayer ---
  const connectMultiplayer = () => {
    multiplayerSocket = new MultiplayerSocket();
    multiplayerSocket.connect({
      userId: "local-player",
      name: playerName,
      onWelcome: (message) => {
        localPlayerId = message.you;
        if (hero) hero.config.id = message.you;
      },
      onState: (message) => {
        remoteHeroes.sync(message.players);
        remoteMarkers = toMapMarkers(message.players, localPlayerId);
      },
      onPresence: (message) => console.log("presence", message),
      onError: (event) => console.error("multiplayer socket error", event),
    });
  };

  /** Sends movement deltas (in server steps) at most every NETWORK_SEND_INTERVAL_MS. */
  const sendHeroMovement = (localHero: Hero & { mesh: BABYLON.AbstractMesh }) => {
    const now = performance.now();
    if (!multiplayerSocket?.connected || now - lastSentAt <= NETWORK_SEND_INTERVAL_MS) return;

    const pos = localHero.position;
    const yaw = localHero.mesh.rotation.y;
    const prev = lastSentPos ?? pos;
    const dx = pos.x - prev.x;
    const dz = pos.z - prev.z;

    if (dx !== 0 || dz !== 0 || yaw !== lastSentYaw) {
      multiplayerSocket.sendMove(dx / SERVER_STEP, dz / SERVER_STEP, yaw);
    }
    lastSentPos = { x: pos.x, z: pos.z };
    lastSentYaw = yaw;
    lastSentAt = now;
  };

  // --- Per-frame hero control ---
  const applyHeroInput = (localHero: Hero) => {
    const magnitude = Math.hypot(mobileMoveVector.x, mobileMoveVector.y);

    if (magnitude === 0) {
      localHero.setMoveDirection(null);
      localHero.setTarget(currentTarget);
      return;
    }

    const eased = magnitude < MOBILE_DEAD_ZONE ? 0 : (magnitude - MOBILE_DEAD_ZONE) / (1 - MOBILE_DEAD_ZONE);
    if (eased > 0) {
      const scale = (eased * MOBILE_SPEED_MULTIPLIER) / magnitude;
      localHero.setMoveDirection(
        new BABYLON.Vector3(mobileMoveVector.x * scale, 0, mobileMoveVector.y * scale),
      );
    } else {
      localHero.setMoveDirection(null);
    }
    localHero.setTarget(null);
  };

  // --- Scene setup ---
  const setupGameCamera = (scene: BABYLON.Scene) => {
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
        if (heroMesh && !currentTarget) camera.setTarget(heroMesh.position.clone());
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

  const setupRightClickMove = (scene: BABYLON.Scene) => {
    scene.onPointerObservable.add((event) => {
      if (!groundMesh || event.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;

      const pick = scene.pick(scene.pointerX, scene.pointerY);
      if (!pick?.hit || !pick.pickedPoint || pick.pickedMesh !== groundMesh) return;

      const point = pick.pickedPoint;
      debugPoint = { x: Math.round(point.x), y: Math.round(point.z) };

      if (event.event.button !== 2) return;
      currentTarget = new BABYLON.Vector3(point.x, 0, point.z);
      spawnDirectionPulse(scene, currentTarget);
    });
  };

  const createScene = (engine: BABYLON.Engine, loadingScreen: CustomLoadingScreen) => {
    const scene = new BABYLON.Scene(engine);
    sceneRef = scene;
    new ADDONS.HtmlMeshRenderer(scene, { enableOverlayRender: true });

    // World lighting is owned by ArenaBuilder; hero-local shadows remain in Hero.
    arenaBuilder = new ArenaBuilder(scene);
    groundMesh = arenaBuilder.ground;
    wallMeshes = arenaBuilder.walls;
    gameGroundMaterial = arenaBuilder.gameGroundMaterial;

    gameCamera = setupGameCamera(scene);
    setupRightClickMove(scene);
    createSky(scene);
    const { fountain, statue } = buildWorldDecor(scene, arenaBuilder);

    scene.onBeforeRenderObservable.add(() => {
      arenaBuilder?.tickTime(engine.getDeltaTime());
    });

    hero = new Hero(scene, createHeroConfig("player-hero", playerName, HERO_START.clone()));

    void preloadAssets([fountain.load(), hero.load(), statue.load()])
      .then(() => {
        heroMesh = hero!.mesh;
        if (arenaBuilder?.lights && heroMesh) arenaBuilder.lights.addShadowCaster(heroMesh);
        heroPosition = hero!.position;
        hero!.playAnimation("Idle");
        resetGameCameraToHero();
      })
      .catch((error) => console.error("Game assets failed to preload:", error))
      .finally(() => {
        BABYLON.SceneLoader.ShowLoadingScreen = false;
        loadingScreen.hideLoadingUI();
      });

    scene.onBeforeRenderObservable.add(() => {
      if (!hero?.mesh) return;

      applyHeroInput(hero);
      hero.update(engine.getDeltaTime() / 1000);
      heroPosition = hero.position;
      sendHeroMovement(hero as Hero & { mesh: BABYLON.AbstractMesh });
    });

    return scene;
  };

  // Applies the game ground material and camera input rules once the scene is ready.
  $: if (sceneRef && gameCamera && gameGroundMaterial) {
    arenaBuilder?.updateCameraMode();

    sceneRef.activeCamera = gameCamera;
    if (groundMesh) groundMesh.material = gameGroundMaterial;
    wallMeshes.forEach((wall) => (wall.material = gameGroundMaterial));

    gameCamera.detachControl();
    const mouseInput = gameCamera.inputs.attached.mouse as any;
    if (mouseInput) {
      mouseInput.wheelDeltaPercentage = 0;
      mouseInput.wheelPrecision = 0;
    }
    gameCamera.wheelPrecision = 0;
    canvas.addEventListener("wheel", preventGameWheel, { passive: true });
    gameCamera.attachControl(canvas, true);
  }

  onMount(() => {
    playerName = resolvePlayerName();
    connectMultiplayer();
    keyboardController = createKeyboardController(handleHeroKey);

    const engine = new BABYLON.Engine(canvas, true);
    BABYLON.SceneLoader.ShowLoadingScreen = true;
    const loadingScreen = new CustomLoadingScreen("/cyber_purok.png");
    engine.loadingScreen = loadingScreen;
    loadingScreen.displayLoadingUI();

    const scene = createScene(engine, loadingScreen);
    scene.activeCamera = gameCamera;
    gameCamera?.attachControl(canvas, true);

    engine.runRenderLoop(() => scene.render());

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("wheel", preventGameWheel);
      keyboardController?.dispose();
      multiplayerSocket?.close();
      remoteHeroes.disposeAll();
      scene.dispose();
      engine.dispose();
    };
  });
</script>

<Ui_Moba
  heroPosition={heroPosition}
  {remoteMarkers}
  debugPoint={debugPoint}
  onMoveInput={applyMobileMovement}
  onMinimapSelect={handleMinimapSelect}
/>

<canvas bind:this={canvas} class="babylon-canvas"></canvas>

<style>
  :global(body) {
    margin: 0;
  }

  .babylon-canvas {
    display: block;
    width: 100vw;
    height: 100vh;
  }
</style>
