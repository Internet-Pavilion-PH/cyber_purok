<script lang="ts">
  import { onMount } from "svelte";
  import * as BABYLON from "@babylonjs/core";
  import * as GUI from "@babylonjs/gui";
  import * as ADDONS from "@babylonjs/addons";
  import "@babylonjs/loaders/glTF";
  import { CustomLoadingScreen } from "$lib/CustomLoadingScreen";
  import { preloadAssets } from "$lib/assetPreloader";
  import { Hero } from "$lib/moba/hero";
  import { Tower } from "$lib/moba/tower";
  import { Creep } from "$lib/moba/creeps";
  import { ArenaBuilder } from "$lib/moba/arenaBuilder";
  import { Fence } from "$lib/moba/fence";
  import { Tree } from "$lib/moba/tree";
  import {PlaceModel} from "$lib/moba/placeModel";
  

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
  let sceneRef: BABYLON.Scene | null = null;
  let gameCamera: BABYLON.ArcRotateCamera | null = null;
  let heroMesh: BABYLON.AbstractMesh | null = null;
  let debugPoint = { x: 0, y: 0 };
  let groundMesh: BABYLON.Mesh | null = null;
  let wallMeshes: BABYLON.Mesh[] = [];
  let gameGroundMaterial: BABYLON.StandardMaterial | null = null;
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
    const wheelEvent = event as WheelEvent;
    wheelEvent.stopPropagation();
  };

  $: if (sceneRef && gameCamera && gameGroundMaterial) {
    if (arenaBuilder) {
      arenaBuilder.updateCameraMode();
    }

    sceneRef.activeCamera = gameCamera;
    if (cameraLight) {
      cameraLight.parent = gameCamera;
      cameraLight.position = new BABYLON.Vector3(0, 10, 0);
      cameraLight.direction = new BABYLON.Vector3(0, -1, 0.35);
    }
    if (groundMesh) {
      groundMesh.material = gameGroundMaterial;
    }
    wallMeshes.forEach((wall) => {
      wall.material = gameGroundMaterial;
    });
    gameCamera.detachControl();
    const gameMouseInput = gameCamera.inputs.attached.mouse as any;
    if (gameMouseInput) {
      gameMouseInput.wheelDeltaPercentage = 0;
      gameMouseInput.wheelPrecision = 0;
    }
    gameCamera.wheelPrecision = 0;
    canvas.addEventListener("wheel", preventGameWheel, { passive: true });
    gameCamera.attachControl(canvas, true);
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
    const loadingScreen = new CustomLoadingScreen("/cyber_purok.png");
    engine.loadingScreen = loadingScreen;
    loadingScreen.displayLoadingUI();

    const createScene = () => {
      const scene = new BABYLON.Scene(engine);
      sceneRef = scene;
      new ADDONS.HtmlMeshRenderer(scene, { enableOverlayRender: true });

      // 1) Ground plane: a large base surface that sits at the world origin.
      const groundWidth = 1000;
      const groundHeight = 1000;
      const groundHalfWidth = groundWidth / 2;
      const groundHalfHeight = groundHeight / 2;

      arenaBuilder = new ArenaBuilder(scene);
      groundMesh = arenaBuilder.ground;
      wallMeshes = arenaBuilder.walls;
      gameGroundMaterial = arenaBuilder.gameGroundMaterial;

      







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
          x: Math.round(point.x),
          y: Math.round(point.z),
        };

        if (event.event.button !== 2) return;
        currentTarget = new BABYLON.Vector3(point.x, 0, point.z);
        spawnDirectionPulse(new BABYLON.Vector3(point.x, 0, point.z));
      });

      //trees
      const treePositions = [
        { x: -110, z: -220, scale: 10, height: 2 },
        { x: -61, z: -322, scale: 12, height: 2.5 },
        { x: -11, z: -298, scale: 8, height: 1.8 },
        { x: -36, z: -407, scale: 8, height: 1.8 },
        { x: 185, z: -394, scale: 8, height: 1.8 },
         { x: -11, z: -170, scale: 8, height: 1.8 },
           { x: 76, z: -300, scale: 20, height: 3 },
      ];

      const trees = treePositions.map(({ x, z, scale, height }) =>
        new Tree(scene, new BABYLON.Vector3(x, 0, z), scale, height),
      );

      if (arenaBuilder?.lights) {
        for (const tree of trees) {
          for (const mesh of tree.rootNode.getChildMeshes()) {
            arenaBuilder.lights.addShadowCaster(mesh);
          }
        }
      }

      //glb

      //
      const fountain = new PlaceModel(scene, "Fountain.glb", new BABYLON.Vector3(-451, 1, -413), {
        scaleFactor: 3,
      });

           const statue = new PlaceModel(scene, "roger.glb", new BABYLON.Vector3(-128, 1, -67), {
        scaleFactor: 4,
        rotation: new BABYLON.Vector3(0, Math.PI /2, 0),
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

        const spawnLaneCreeps = () => {
          // Player-side lane: red base pushes toward blue base.

          // const redLaneCreeps = Creep.spawnGroup(scene, redBasePos, blueBasePos, 3, 10);
          // if (arenaBuilder?.lights) {
          //   for (const creep of redLaneCreeps) {
          //     arenaBuilder.lights.addShadowCaster(creep.mesh);
          //   }
          // }

          // Enemy-side lane: blue base pushes toward red base.
          const blueLaneCreeps = Creep.spawnGroup(scene, blueBasePos, redBasePos, 10, 30);
          if (arenaBuilder?.lights) {
            for (const creep of blueLaneCreeps) {
              arenaBuilder.lights.addShadowCaster(creep.mesh);
            }
          }
        };

        window.setTimeout(spawnLaneCreeps, 20000);

//fence

const fence = new Fence(
  scene,
  [
    { x: -67, z: -406 },
    { x: -100, z: -353 },
    { x: -194, z: -236 },
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
      
const fence2 = new Fence(
  scene,
  [
    { x: -244, z: -190 },
    { x: -290, z: -174 },
    { x: -408, z: -127},
  ],
  30,   // height
  1,  // post radius
  1, // rail radius
  0,    // base Y
);

if (arenaBuilder?.lights) {
  fence2.addShadowCasters(arenaBuilder.lights.shadowGen);
}
fence2.rootNode.position = new BABYLON.Vector3(0, 0, 0);


const heroStartPosition = new BABYLON.Vector3(-380, 0, -380);

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
        if (!gameCamera || !canvas) return;

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

      // 6) Sky: simple atmospheric backdrop.
      scene.clearColor = new BABYLON.Color4(0.04, 0.1, 0.16, 1.0);
      const sky = BABYLON.MeshBuilder.CreateSphere(
        "sky",
        { diameter: 2000, segments: 32 },
        scene,
      );
      sky.position = new BABYLON.Vector3(0, 0, 0);
      sky.infiniteDistance = true;
      sky.isPickable = false;
      sky.setEnabled(true);

      const skyMaterial = new BABYLON.StandardMaterial("skyMaterial", scene);
      skyMaterial.backFaceCulling = false;
      skyMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.95);
      skyMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
      sky.material = skyMaterial;

      scene.onBeforeRenderObservable.add(() => {
        if (sky) {
          sky.setEnabled(true);
        }
        if (arenaBuilder) {
          arenaBuilder.tickTime(engine.getDeltaTime());
        }
      });



      //trees


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

      const preloadTasks = [fountain.load(), hero.load(), statue.load()];

      void preloadAssets(preloadTasks)
        .then(() => {
          heroMesh = hero!.mesh;
          if (arenaBuilder?.lights && heroMesh) {
            arenaBuilder.lights.addShadowCaster(heroMesh);
          }
          heroPosition = hero!.position;
          hero!.playAnimation("Idle");

          resetGameCameraToHero();
          BABYLON.SceneLoader.ShowLoadingScreen = false;
          loadingScreen.hideLoadingUI();
        })
        .catch((error) => {
          console.error("Game assets failed to preload:", error);
          BABYLON.SceneLoader.ShowLoadingScreen = false;
          loadingScreen.hideLoadingUI();
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

	

    scene.activeCamera = gameCamera;
    gameCamera?.attachControl(canvas, true);

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
