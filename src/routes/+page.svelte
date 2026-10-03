<script lang="ts">
  import { onMount } from "svelte";
  import * as BABYLON from "@babylonjs/core";
  import * as GUI from "@babylonjs/gui";
  import * as ADDONS from "@babylonjs/addons";
  import "@babylonjs/loaders/glTF";
  import { CustomLoadingScreen } from "$lib/CustomLoadingScreen";
  import { Hero } from "$lib/moba/hero";
  import { Tower } from "$lib/moba/tower";
  import { Creep } from "$lib/moba/creeps";
  import { ArenaBuilder } from "$lib/moba/arenaBuilder";
  import { Fence } from "$lib/moba/fence";
  

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

  let canvas: HTMLCanvasElement;
  let heroPosition: HeroPosition = { x: 0, z: 0 };
  let cameraMode: "debug" | "game" = "game";
  let sceneRef: BABYLON.Scene | null = null;
  let debugCamera: BABYLON.ArcRotateCamera | null = null;
  let gameCamera: BABYLON.ArcRotateCamera | null = null;
  let heroMesh: BABYLON.AbstractMesh | null = null;
  let debugPoint = { x: 0, y: 0 };
  let groundMesh: BABYLON.Mesh | null = null;
  let wallMeshes: BABYLON.Mesh[] = [];
  let gameGroundMaterial: BABYLON.StandardMaterial | null = null;
  let debugGroundMaterial: BABYLON.Material | null = null;
  let arenaBuilder: ArenaBuilder | null = null;
  let currentTarget: BABYLON.Vector3 | null = null;
  let cameraLight: BABYLON.SpotLight | null = null;
  let hero: Hero | null = null;
  let keyboardController: ReturnType<typeof createKeyboardController> | null = null;
  let mobileMoveVector = { x: 0, y: 0 };
  let isCameraEdgePanning = false;

  const isMobile =
    typeof window !== "undefined" &&
    ((typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) ||
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches));

  const resetGameCameraToHero = () => {
    if (!gameCamera || !heroMesh) return;
    resetGameCameraToTarget(gameCamera, heroMesh.position.clone(), defaultGameCameraConfig);
    currentTarget = null;
  };

  const applyMobileMovement = (input: { x: number; y: number }) => {
    mobileMoveVector = input;
  };

  const handleMinimapSelect = (point: { x: number; z: number }) => {
    if (!gameCamera) return;

    const target = new BABYLON.Vector3(point.x, 0, point.z);
    gameCamera.setTarget(target);
    gameCamera.target.copyFrom(target);

    const orbitRadius = gameCamera.radius;
    const horizontal = orbitRadius * Math.cos(gameCamera.beta);
    const offset = new BABYLON.Vector3(
      Math.sin(gameCamera.alpha) * horizontal,
      orbitRadius * Math.sin(gameCamera.beta),
      Math.cos(gameCamera.alpha) * horizontal,
    );
    gameCamera.position = target.add(offset);

    currentTarget = null;
    hero?.setTarget(null);
  };

  const preventGameWheel: EventListener = (event) => {
    if (cameraMode !== "game") return;
    const wheelEvent = event as WheelEvent;
    wheelEvent.stopPropagation();
  };

  $: if (
    sceneRef &&
    debugCamera &&
    gameCamera &&
    gameGroundMaterial &&
    debugGroundMaterial
  ) {
    if (arenaBuilder) {
      arenaBuilder.updateCameraMode(cameraMode);
    }

    sceneRef.activeCamera = cameraMode === "debug" ? debugCamera : gameCamera;
    if (cameraLight) {
      cameraLight.parent = cameraMode === "debug" ? debugCamera : gameCamera;
      cameraLight.position = new BABYLON.Vector3(0, 10, 0);
      cameraLight.direction = new BABYLON.Vector3(0, -1, 0.35);
    }
    const activeGroundMaterial =
      cameraMode === "debug" ? debugGroundMaterial : gameGroundMaterial;
    if (groundMesh) {
      groundMesh.material = activeGroundMaterial;
    }
    wallMeshes.forEach((wall) => {
      wall.material = activeGroundMaterial;
    });
    debugCamera.detachControl();
    gameCamera.detachControl();
    if (cameraMode === "debug") {
      debugCamera.attachControl(canvas, true);
      canvas.removeEventListener("wheel", preventGameWheel);
    } else {
      const gameMouseInput = gameCamera.inputs.attached.mouse as any;
      if (gameMouseInput) {
        gameMouseInput.wheelDeltaPercentage = 0;
        gameMouseInput.wheelPrecision = 0;
      }
      gameCamera.wheelPrecision = 0;
      canvas.addEventListener("wheel", preventGameWheel, { passive: true });
      gameCamera.attachControl(canvas, true);
    }
  }

  onMount(() => {
    keyboardController = createKeyboardController((key, isPressed) => {
      if (!isPressed) return;

      if (key === "1") {
        resetGameCameraToHero();
      }

      if (!hero) return;

      if (key === "a") {
        hero.attack();
        return;
      }

      if (isSkillKey(key)) {
        const skillKey = HERO_SKILL_KEYS[key];
        if (skillKey === "q") hero.castQ();
        if (skillKey === "w") hero.castW();
        if (skillKey === "e") hero.castE();
        if (skillKey === "r") hero.castR();
      }
    });

    const engine = new BABYLON.Engine(canvas, true);
    BABYLON.SceneLoader.ShowLoadingScreen = true;
    engine.loadingScreen = new CustomLoadingScreen("/cyber_purok.png");

    const createScene = () => {
      const scene = new BABYLON.Scene(engine);
      sceneRef = scene;
      new ADDONS.HtmlMeshRenderer(scene, { enableOverlayRender: true });

      // 1) Ground plane: a large base surface that sits at the world origin.
      const groundWidth = 1000;
      const groundHeight = 1000;
      const groundHalfWidth = groundWidth / 2;
      const groundHalfHeight = groundHeight / 2;

      arenaBuilder = new ArenaBuilder(scene, cameraMode);
      groundMesh = arenaBuilder.ground;
      wallMeshes = arenaBuilder.walls;
      gameGroundMaterial = arenaBuilder.gameGroundMaterial;
      debugGroundMaterial = arenaBuilder.debugGroundMaterial;

      







      const cameraBounds = Math.min(groundHalfWidth, groundHalfHeight) - 50;

      const spawnDirectionPulse = (position: BABYLON.Vector3) => {
        const ring = BABYLON.MeshBuilder.CreateTorus(
          `movePulse-${Date.now()}-${Math.random()}`,
          { diameter: 5, thickness: 0.5, tessellation: 32 },
          scene,
        );
        ring.position = new BABYLON.Vector3(position.x, 0, position.z);
        ring.rotation.x = 0;
        ring.rotation.z = 0;
        ring.isPickable = false;

        const ringMaterial = new BABYLON.StandardMaterial(
          `movePulseMat-${Date.now()}-${Math.random()}`,
          scene,
        );
        ringMaterial.diffuseColor = new BABYLON.Color3(0.15, 0.8, 1.0);
        ringMaterial.emissiveColor = new BABYLON.Color3(0.15, 0.8, 1.0);
        ringMaterial.alpha = 0.9;
        ringMaterial.disableLighting = true;
        ring.material = ringMaterial;

        const startScale = 0.6;
        const endScale = 1.75;
        const startTime = performance.now();

        const pulseObserver = scene.onBeforeRenderObservable.add(() => {
          const elapsed = performance.now() - startTime;
          const t = BABYLON.Scalar.Clamp(elapsed / 500, 0, 1);
          const eased = 1 - (1 - t) * (1 - t);
          const scale = BABYLON.Scalar.Lerp(startScale, endScale, eased);
          ring.scaling.set(scale, 1, scale);
          ringMaterial.alpha = 0.9 * (1 - t);

          if (t >= 1) {
            scene.onBeforeRenderObservable.remove(pulseObserver);
            ring.dispose();
            ringMaterial.dispose();
          }
        });
      };

      scene.onPointerObservable.add((event) => {
        if (!groundMesh) return;
        if (event.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;

        const pick = scene.pick(scene.pointerX, scene.pointerY);
        if (!pick || !pick.hit || !pick.pickedPoint) return;
        if (pick.pickedMesh !== groundMesh) return;

        const point = pick.pickedPoint;
        debugPoint = {
          x: Number(point.x.toFixed(2)),
          y: Number(point.z.toFixed(2)),
        };

        if (cameraMode === "game") {
          if (event.event.button !== 2) return;
          currentTarget = new BABYLON.Vector3(point.x, 0, point.z);
          spawnDirectionPulse(new BABYLON.Vector3(point.x, 0, point.z));
        }
      });

      //tower
      const tower = new Tower(scene, new BABYLON.Vector3(-216, -0, -216), 50, 2, 40, Math.PI / 4);
      const tower2 = new Tower(scene, new BABYLON.Vector3(-100, -0, -100), 50, 2, 40, Math.PI / 4);
      const tower3 = new Tower(scene, new BABYLON.Vector3(-437, 0, -123), 50, 2, 40, Math.PI/9);
      const tower4 = new Tower(scene, new BABYLON.Vector3(-71, 0, -440), 50, 2, 40, Math.PI/2);

      if (arenaBuilder?.lights) {
        for (const mesh of tower.rootNode.getChildMeshes()) {
          arenaBuilder.lights.addShadowCaster(mesh);
        }
        for (const mesh of tower2.rootNode.getChildMeshes()) {
          arenaBuilder.lights.addShadowCaster(mesh);
        }
        for (const mesh of tower3.rootNode.getChildMeshes()) {
          arenaBuilder.lights.addShadowCaster(mesh);
        }
        for (const mesh of tower4.rootNode.getChildMeshes()) {
          arenaBuilder.lights.addShadowCaster(mesh);
        }
      }

      //creeps

        const blueBasePos = new BABYLON.Vector3(200, 0, 200);
        const redBasePos = new BABYLON.Vector3(-386, 0, -386);

        // Player-side lane: red base pushes toward blue base.
        const redLaneCreeps = Creep.spawnGroup(scene, redBasePos, blueBasePos, 3, 10);
        if (arenaBuilder?.lights) {
          for (const creep of redLaneCreeps) {
            arenaBuilder.lights.addShadowCaster(creep.mesh);
          }
        }

        // Enemy-side lane: blue base pushes toward red base.
        const blueLaneCreeps = Creep.spawnGroup(scene, blueBasePos, redBasePos, 3, 10);
        if (arenaBuilder?.lights) {
          for (const creep of blueLaneCreeps) {
            arenaBuilder.lights.addShadowCaster(creep.mesh);
          }
        }

//fence

const fence = new Fence(
  scene,
  [
    { x: -67, z: -406 },
    { x: -79, z: -353 },
    { x: -179, z: -227 },
  ],
  30,   // height
  1,  // post radius
  1, // rail radius
  0,    // base Y
);

if (arenaBuilder?.lights) {
  fence.addShadowCasters(arenaBuilder.lights.shadowGen);
}

fence.rootNode.position = new BABYLON.Vector3(0, 0, 0);
      // TOP-DOWN DEBUG CAMERA
      const heroStartPosition = new BABYLON.Vector3(-380, 0, -380);

      debugCamera = new BABYLON.ArcRotateCamera(
        "debugCamera",
        -Math.PI / 2,
        0.001,
        300,
        new BABYLON.Vector3(0, 0, 0),
        scene,
      );

      debugCamera.attachControl(canvas, true);

      debugCamera.panningSensibility = 15;
      debugCamera.wheelPrecision = 1;
      debugCamera.inertia = 0.05;
      debugCamera.lowerBetaLimit = 0.001;
      debugCamera.upperBetaLimit = Math.PI / 2.1;

      // GAME CAMERA SETUP
      gameCamera = new BABYLON.ArcRotateCamera(
        "gameCamera",
        defaultGameCameraConfig.alpha,
        defaultGameCameraConfig.beta,
        defaultGameCameraConfig.radius,
        heroStartPosition,
        scene,
      );
      scene.activeCamera = gameCamera;

      if (isMobile) {
        configureMobileFollowCamera(gameCamera, heroStartPosition);
      } else {
        configureFixedGameCamera(gameCamera, canvas);
      }

      const panSpeed = 50;
      const edgeMargin = 80;
      const clampExtent = cameraBounds;

      scene.onBeforeRenderObservable.add(() => {
        if (cameraMode !== "game" || !gameCamera || !canvas) return;

        if (isMobile) {
          if (heroMesh && !currentTarget) {
            gameCamera.setTarget(heroMesh.position.clone());
          }
          return;
        }

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;
        const width = canvas.width;
        const height = canvas.height;
        let panX = 0;
        let panY = 0;

        if (pointerX < edgeMargin) {
          panX = -((edgeMargin - pointerX) / edgeMargin);
        } else if (pointerX > width - edgeMargin) {
          panX = (pointerX - (width - edgeMargin)) / edgeMargin;
        }

        if (pointerY < edgeMargin) {
          panY = -((edgeMargin - pointerY) / edgeMargin);
        } else if (pointerY > height - edgeMargin) {
          panY = (pointerY - (height - edgeMargin)) / edgeMargin;
        }

        isCameraEdgePanning = panX !== 0 || panY !== 0;

        const dt = engine.getDeltaTime() / 1000;

        if (isCameraEdgePanning) {
          const cosA = Math.cos(gameCamera.alpha);
          const sinA = Math.sin(gameCamera.alpha);
          const forwardX = -cosA;
          const forwardZ = -sinA;
          const rightX = -sinA;
          const rightZ = cosA;

          const moveX = (rightX * panX - forwardX * panY) * panSpeed * dt;
          const moveZ = (rightZ * panX - forwardZ * panY) * panSpeed * dt;

          gameCamera.target.x = BABYLON.Scalar.Clamp(
            gameCamera.target.x + moveX,
            -clampExtent,
            clampExtent,
          );
          gameCamera.target.z = BABYLON.Scalar.Clamp(
            gameCamera.target.z + moveZ,
            -clampExtent,
            clampExtent,
          );
          return;
        }

        if (!heroMesh || currentTarget) return;
      });






	  

	  

		// World lighting is owned by ArenaBuilder; hero-local shadows remain in Hero.
		cameraLight = null;

	  //shadow

      // Keep the sun for general scene lighting, but do not depend on a cascaded shadow map
      // for the hero. A local point-light shadow under the character is much more reliable.

      // 6) Sky: simple atmospheric backdrop, but hidden in debug mode for map clarity.
      scene.clearColor = new BABYLON.Color4(0.04, 0.1, 0.16, 1.0);
      const sky = BABYLON.MeshBuilder.CreateSphere(
        "sky",
        { diameter: 2000, segments: 32 },
        scene,
      );
      sky.position = new BABYLON.Vector3(0, 0, 0);
      sky.infiniteDistance = true;
      sky.isPickable = false;
      sky.setEnabled(cameraMode !== "debug");

      const skyMaterial = new BABYLON.StandardMaterial("skyMaterial", scene);
      skyMaterial.backFaceCulling = false;
      skyMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.95);
      skyMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
      sky.material = skyMaterial;

      scene.onBeforeRenderObservable.add(() => {
        if (sky) {
          sky.setEnabled(cameraMode !== "debug");
        }
        if (arenaBuilder) {
          arenaBuilder.tickTime(engine.getDeltaTime());
        }
      });

      // Load hero character.
      hero = new Hero(scene, {
        id: "player-hero",
        name: "Player Hero",
        moveSpeed: 0.15,
        rotationSpeed: 0.08,
        spawnPosition: new BABYLON.Vector3(-380, 0, -380),
        modelUrl: "",
        fileName: "JFK_2.glb",
        forwardOffset: Math.PI,
        idleAnimationName: "mixamo_gangnam",
        walkAnimationName: "mixamo_catwalk",
        skillAnimations: {
          q: "mixamo_arms hiphop dancing",
          w: "mixamo_arms hiphop dancing.002",
          e: "E",
          r: "R",
        },
      });

      void hero.load().then(() => {
        heroMesh = hero!.mesh;
        if (arenaBuilder?.lights && heroMesh) {
          arenaBuilder.lights.addShadowCaster(heroMesh);
        }
        heroPosition = hero!.position;
        hero!.playAnimation("Idle");

        if (debugCamera) {
          debugCamera.setTarget(hero!.mesh!.position);
        }
        resetGameCameraToHero();
        BABYLON.SceneLoader.ShowLoadingScreen = false;
      }).catch((error) => {
        console.error("Hero failed to load:", error);
        BABYLON.SceneLoader.ShowLoadingScreen = false;
      });

      scene.onBeforeRenderObservable.add(() => {
        if (!hero || !hero.mesh) return;

        if (mobileMoveVector.x !== 0 || mobileMoveVector.y !== 0) {
          const deadZone = 0.12;
          const magnitude = Math.hypot(mobileMoveVector.x, mobileMoveVector.y);
          const eased = magnitude < deadZone ? 0 : (magnitude - deadZone) / (1 - deadZone);

          if (eased > 0) {
            const normalizedX = mobileMoveVector.x / (magnitude || 1);
            const normalizedY = mobileMoveVector.y / (magnitude || 1);
            hero.setMoveDirection(
              new BABYLON.Vector3(normalizedX * eased * 1.8, 0, normalizedY * eased * 1.8),
            );
          } else {
            hero.setMoveDirection(null);
          }
          hero.setTarget(null);
        } else {
          hero.setMoveDirection(null);
          if (currentTarget) {
            hero.setTarget(currentTarget);
          } else {
            hero.setTarget(null);
          }
        }

        hero.update(scene.getEngine().getDeltaTime() / 1000);
        heroPosition = hero.position;
      });

      return scene;
    };

    const scene = createScene();

	

    scene.activeCamera = cameraMode === "debug" ? debugCamera : gameCamera;
    if (cameraMode === "debug") {
      debugCamera?.attachControl(canvas, true);
    } else {
      gameCamera?.attachControl(canvas, true);
    }

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      keyboardController?.dispose();
      scene.dispose();
      engine.dispose();
    };
  });
</script>

<Ui_Moba
  heroPosition={heroPosition}
  cameraMode={cameraMode}
  debugPoint={debugPoint}
  onCameraChange={(mode: "debug" | "game") => (cameraMode = mode)}
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
