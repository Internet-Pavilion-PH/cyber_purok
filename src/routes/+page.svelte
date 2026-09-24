<script lang="ts">
  import { onMount } from "svelte";
  import * as BABYLON from "@babylonjs/core";
  import * as GUI from "@babylonjs/gui";
  import "@babylonjs/loaders/glTF";
  import { CustomLoadingScreen } from "$lib/CustomLoadingScreen";
  import { GridMaterial } from "@babylonjs/materials";
  import { GrassProceduralTexture } from "@babylonjs/procedural-textures";
  import { Hero } from "$lib/moba/hero";
  import {
    configureFixedGameCamera,
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
  let currentTarget: BABYLON.Vector3 | null = null;
  let cameraLight: BABYLON.SpotLight | null = null;
  let hero: Hero | null = null;
  let keyboardController: ReturnType<typeof createKeyboardController> | null = null;
  let mobileMoveVector = { x: 0, y: 0 };

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

  const preventGameWheel: EventListener = (event) => {
    if (cameraMode !== "game") return;
    const wheelEvent = event as WheelEvent;
    wheelEvent.preventDefault();
    wheelEvent.stopPropagation();
  };

  $: if (
    sceneRef &&
    debugCamera &&
    gameCamera &&
    gameGroundMaterial &&
    debugGroundMaterial
  ) {
    sceneRef.activeCamera = cameraMode === "debug" ? debugCamera : gameCamera;
    if (cameraLight) {
      cameraLight.parent = cameraMode === "debug" ? debugCamera : gameCamera;
      cameraLight.position = new BABYLON.Vector3(0, 10, 0);
      cameraLight.direction = new BABYLON.Vector3(0, -1, 0.35);
    }
    const activeGroundMaterial =
      cameraMode === "debug" ? debugGroundMaterial : gameGroundMaterial;
    groundMesh!.material = activeGroundMaterial;
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
      canvas.addEventListener("wheel", preventGameWheel, false);
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

      // 1) Ground plane: a large base surface that sits at the world origin.
      const groundWidth = 1000;
      const groundHeight = 1000;
      const groundHalfWidth = groundWidth / 2;
      const groundHalfHeight = groundHeight / 2;

      const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { height: groundHeight, width: groundWidth, subdivisions: 4 },
        scene,
      );
      ground.position.y = 0;
      groundMesh = ground;

      







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

      // 2) Ground material: keep the grass look in game mode, but use a flat debug material when inspecting the plane.
      const grassMat = new BABYLON.StandardMaterial("grassMat", scene);
      const grassTex = new GrassProceduralTexture("grassTex", 1024, scene);
      grassTex.uScale = 6;
      grassTex.vScale = 6;
      grassTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      grassTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      grassTex.anisotropicFilteringLevel = 8;
      grassMat.diffuseTexture = grassTex;
      grassMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
      grassMat.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.25);

      const mapTex = new BABYLON.Texture("/map.png", scene);
      mapTex.uScale = 1;
      mapTex.vScale = 1;
      mapTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      mapTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      grassMat.ambientTexture = mapTex;

      const debugGrid = new GridMaterial("debugGrid", scene);
      debugGrid.mainColor = new BABYLON.Color3(0.7, 0.7, 0.75);
      debugGrid.lineColor = new BABYLON.Color3(0.3, 0.35, 0.45);
      debugGrid.gridRatio = 1;
      debugGrid.majorUnitFrequency = 10;
      debugGrid.minorUnitVisibility = 0.6;
      debugGrid.opacity = 1;

      const debugMapMaterial = new BABYLON.StandardMaterial("debugMapMaterial", scene);
      debugMapMaterial.diffuseTexture = mapTex;
      debugMapMaterial.diffuseTexture.hasAlpha = false;
      debugMapMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      debugMapMaterial.alpha = 0.45;
      debugMapMaterial.backFaceCulling = false;

      const debugMapOverlay = BABYLON.MeshBuilder.CreateGround(
        "debugMapOverlay",
        { width: groundWidth, height: groundHeight, subdivisions: 1 },
        scene,
      );
      debugMapOverlay.position.y = 0.03;
      debugMapOverlay.material = debugMapMaterial;
      debugMapOverlay.isPickable = false;
      debugMapOverlay.setEnabled(cameraMode === "debug");

      gameGroundMaterial = grassMat;
      debugGroundMaterial = debugGrid;
      ground.material = cameraMode === "debug" ? debugGrid : grassMat;
      ground.receiveShadows = true;

      const updateDebugOverlay = () => {
        const isDebug = cameraMode === "debug";
        debugMapOverlay.setEnabled(isDebug);
        debugMapMaterial.alpha = isDebug ? 0.45 : 0;
      };

      updateDebugOverlay();
      scene.onBeforeRenderObservable.add(() => {
        updateDebugOverlay();
      });




	  //walls
	  
      const wallHeight = 50;
      const wallThickness = 1;
      const wallPositions = [
        {
          name: "wallNorth",
          width: groundWidth,
          depth: wallThickness,
          x: 0,
          z: -groundHalfHeight,
          y: wallHeight / 2,
        },
        {
          name: "wallSouth",
          width: groundWidth,
          depth: wallThickness,
          x: 0,
          z: groundHalfHeight,
          y: wallHeight / 2,
        },
        {
          name: "wallEast",
          width: wallThickness,
          depth: groundHeight,
          x: groundHalfWidth,
          z: 0,
          y: wallHeight / 2,
        },
        {
          name: "wallWest",
          width: wallThickness,
          depth: groundHeight,
          x: -groundHalfWidth,
          z: 0,
          y: wallHeight / 2,
        },
      ];

      wallMeshes = wallPositions.map(({ name, width, depth, x, z, y }) => {
        const wall = BABYLON.MeshBuilder.CreateBox(
          name,
          { width, height: wallHeight, depth },
          scene,
        );
        wall.position = new BABYLON.Vector3(x, y, z);
        wall.material = cameraMode === "debug" ? debugGrid : grassMat;
        wall.isPickable = false;
        return wall;
      });

    

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

      configureFixedGameCamera(gameCamera, canvas);

      const panSpeed = 50;
      const edgeMargin = 80;
      const clampExtent = cameraBounds;

      scene.onBeforeRenderObservable.add(() => {
        if (cameraMode !== "game" || !gameCamera || !canvas || isMobile) return;

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

        if (panX === 0 && panY === 0) return;

        const dt = engine.getDeltaTime() / 1000;

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
      });






	  

	  

		// 5) Light: a sun-style directional light gives the field a stronger outdoor shadow.
			const hemi = new BABYLON.HemisphericLight(
		"hemi",
		new BABYLON.Vector3(0, 1, 0),
		scene,
		);
		hemi.intensity = 0.1; // Lower ambient keeps map edges moody
		// hemi.groundColor = new BABYLON.Color3(0.2, 0.25, 0.15); // Warm grass bounce

		const sun = new BABYLON.DirectionalLight(
		"sun",
		new BABYLON.Vector3(-0.4, -1, -0.3), // Angled sun direction for long MOBA shadows
		scene,
		);
		sun.position = new BABYLON.Vector3(0, 300, 0);
		sun.intensity = 0.3;
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

        if (cameraMode === "game" && gameCamera && heroMesh) {
          const heroPos = heroMesh.position.clone();
          gameCamera.target.x = BABYLON.Scalar.Lerp(gameCamera.target.x, heroPos.x, 0.08);
          gameCamera.target.z = BABYLON.Scalar.Lerp(gameCamera.target.z, heroPos.z, 0.08);
        }

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
