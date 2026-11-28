<script lang="ts">
  import { onMount, untrack } from "svelte";
  import * as BABYLON from "@babylonjs/core";
  import "@babylonjs/loaders/glTF";
  import { MultiplayerSocket } from "$lib/moba/net/socket";
  import { createMultiplayerController } from "$lib/moba/game/multiplayerController";
  import { createHeroInputController } from "$lib/moba/game/inputController";
  import { createPlayerProfileController } from "$lib/moba/game/playerProfileController";
  import { Hero } from "$lib/moba/entities/hero";
  import type { ArenaBuilder } from "$lib/moba/world/arenaBuilder";
  import { bootGameRuntime } from "$lib/moba/gameRuntime";
  import { RemoteHeroes, type MapMarker } from "$lib/moba/entities/remoteHeroes";
  import { createMovementSender } from "$lib/moba/net/movementSender";
  import {
    getPlayerSaveData,
    readLastHeroPosition,
    writeLastHeroPosition,
    type HeroPosition,
    recordGuavaPickup as persistGuavaPickup,
  } from "$lib/moba/playerSession";
  import {
    defaultGameCameraConfig,
    focusCameraOn,
    resetGameCameraToTarget,
  } from "$lib/moba/input/cameraController";
  import { detectMobile } from "$lib/moba/input/mobileInput";
  import { createKeyboardController } from "$lib/moba/input/keyboard";
  import Ui_Moba from "$lib/moba/Ui_Moba.svelte";
  import GameIntroScene from "$lib/components/GameIntroScene.svelte";


  const isMobile = detectMobile();

  // --- State ---
  let canvas: HTMLCanvasElement | undefined = $state();
  let hasEnteredGame = $state(false);
  type ChatEntry = { id: string; author: string; text: string };

  let heroPosition = $state<HeroPosition>({ x: 0, z: 0 });
  let debugPoint = $state({ x: 0, y: 0 });
  let fps = $state(0);
  let playerName = $state("Player Hero");
  let playerGuavaCount = $state(0);
  onMount(() => {
    playerGuavaCount = getPlayerSaveData().guavaCount;
  });
  let lastCountedGuavaSeq = -1;
  let lastAnnouncedGuavaSeq = -1;
  let announcement = $state("");
  let announcementTimer: ReturnType<typeof setTimeout> | null = null;

  const showAnnouncement = (text: string, durationMs = 3500) => {
    announcement = text;
    if (announcementTimer) clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => {
      announcement = "";
      announcementTimer = null;
    }, durationMs);
  };
  let remoteMarkers = $state<MapMarker[]>([]);
  let onlinePlayers = $state<Array<{ id: string; name: string; guavaCount?: number }>>([]);
  let chatMessages = $state<ChatEntry[]>([]);
  let minimapMarkers = $derived.by(() => {
    const markers = [...remoteMarkers];
    if (guavaHuntRef && !guavaHuntRef.isPicked && guavaHuntRef.location) {
      markers.push({
        id: "guava",
        name: "Guava",
        x: guavaHuntRef.location.x,
        z: guavaHuntRef.location.z,
        color: "#ffd400",
        pulse: true,
      });
    }
    return markers;
  });

  let sceneRef = $state<BABYLON.Scene | null>(null);
  let gameCamera = $state<BABYLON.ArcRotateCamera | null>(null);
  let arenaBuilder = $state<ArenaBuilder | null>(null);
  let groundMesh = $state<BABYLON.Mesh | null>(null);
  let wallMeshes = $state<BABYLON.Mesh[]>([]);
  let gameGroundMaterial = $state<BABYLON.StandardMaterial | null>(null);

  let hero = $state<Hero | null>(null);
  let heroMesh = $state<BABYLON.AbstractMesh | null>(null);
  let guavaHuntInstance = $state<{ location: BABYLON.Vector3; isPicked: boolean; syncFromServer: (message: { active?: boolean; x?: number; z?: number }) => void; setLocalFallbackMode: () => void; setServerMode: (enabled: boolean) => void } | null>(null);
  let guavaHuntRef = $state<{ location: BABYLON.Vector3; isPicked: boolean } | null>(null);
  let currentTarget = $state<BABYLON.Vector3 | null>(null);
  let mobileMoveVector = $state({ x: 0, y: 0 });

  let multiplayerSocket = $state<MultiplayerSocket | null>(null);
  let localPlayerId = $state<string | null>(null);
  let clientUserId = $state("");
  let isServerConnected = $state(false);
  let serverConnectionState = $state<"preparing" | "connecting" | "connected" | "disconnected">("preparing");
  let keyboardController = $state<ReturnType<typeof createKeyboardController> | null>(null);

  const remoteHeroes = new RemoteHeroes({
    getScene: () => sceneRef,
    getArena: () => arenaBuilder,
    getLocalPlayerId: () => localPlayerId,
  });

  // --- Handlers ---
  const resetGameCameraToHero = () => {
    if (!gameCamera || !heroMesh) return;
    resetGameCameraToTarget(gameCamera, heroMesh.position.clone(), defaultGameCameraConfig);
  };

  const preventGameWheel: EventListener = (event) => {
    event.stopPropagation();
  };

  const playerProfileController = createPlayerProfileController({
    getPlayerName: () => playerName,
    setPlayerName: (name) => (playerName = name),
    getClientUserId: () => clientUserId,
    setClientUserId: (id) => (clientUserId = id),
    getLocalPlayerId: () => localPlayerId,
    updateHeroDisplayName: (name) => hero?.updateDisplayName(name),
  });

  const readStoredName = playerProfileController.readStoredName;
  const isLocalPlayerId = playerProfileController.isLocalPlayerId;
  const resolveOnlinePlayerName = playerProfileController.resolveOnlinePlayerName;
  const applyLocalPlayerName = playerProfileController.applyLocalPlayerName;

  const handleChatSend = (text: string) => {
    const nextText = text.trim();
    if (!nextText) return;

    multiplayerController.sendChat(nextText, playerName, clientUserId);
    chatMessages = [
      ...chatMessages,
      {
        id: `chat-${Date.now()}-${clientUserId}`,
        author: playerName,
        text: nextText,
      },
    ].slice(-5);
  };

  const inputController = createHeroInputController({
    getHero: () => hero,
    getCurrentTarget: () => currentTarget,
    setCurrentTarget: (target) => (currentTarget = target),
    getMobileMoveVector: () => mobileMoveVector,
    setMobileMoveVector: (input) => (mobileMoveVector = input),
    resetGameCameraToHero,
    focusCameraOn: (point) => {
      if (!gameCamera) return;
      focusCameraOn(gameCamera, point);
    },
  });

  const applyMobileMovement = inputController.applyMobileMovement;
  const handleMinimapSelect = inputController.handleMinimapSelect;
  const handleHeroKey = inputController.handleHeroKey;

  // --- Multiplayer ---
  const syncLocalHeroVisibility = (visible: boolean) => {
    if (heroMesh) heroMesh.setEnabled(visible);
    if (hero) hero.mesh?.setEnabled(visible);
  };

  const resetLocalHeroToSpawn = (spawnX = 0, spawnZ = 0) => {
    if (!hero) return;

    const nextPosition = { x: spawnX, z: spawnZ, yaw: 0 };
    hero.config.spawnPosition = new BABYLON.Vector3(spawnX, 0, spawnZ);

    if (heroMesh) {
      heroMesh.position.set(spawnX, 0, spawnZ);
      heroMesh.rotation.y = 0;
    }

    hero.setMoveDirection(null);
    hero.setTarget(null);
    heroPosition = nextPosition;
    writeLastHeroPosition(nextPosition);
    currentTarget = null;
  };

  const multiplayerController = createMultiplayerController({
    playerName: () => playerName,
    getPlayerGuavaCount: () => playerGuavaCount,
    setPlayerGuavaCount: (value) => (playerGuavaCount = value),
    setOnlinePlayers: (players) => (onlinePlayers = players),
    setRemoteMarkers: (markers) => (remoteMarkers = markers),
    setSocket: (socket) => (multiplayerSocket = socket),
    getLocalPlayerId: () => localPlayerId,
    setLocalPlayerId: (id) => (localPlayerId = id),
    setClientUserId: (id) => (clientUserId = id),
    setServerConnected: (value) => (isServerConnected = value),
    setServerConnectionState: (state) => (serverConnectionState = state),
    setChatMessages: (messages) => (chatMessages = messages),
    updateRemoteHeroes: (players, localPlayerIdValue) => remoteHeroes.sync(players as any, localPlayerIdValue),
    resolveOnlinePlayerName,
    isLocalPlayerId,
    applyLocalPlayerName,
    syncLocalHeroVisibility,
    resetLocalHeroToSpawn,
    showAnnouncement,
    onConnected: () => {
      guavaHuntInstance?.setServerMode(true);
    },
    onDisconnected: () => {
      guavaHuntInstance?.setLocalFallbackMode();
    },
    onGuavaUpdate: (message) => {
      guavaHuntInstance?.syncFromServer(message as any);
    },
    persistGuavaPickup,
    readLastHeroPosition,
    getHero: () => hero,
    getHeroMesh: () => heroMesh,
    getLastAnnouncedGuavaSeq: () => lastAnnouncedGuavaSeq,
    setLastAnnouncedGuavaSeq: (value) => (lastAnnouncedGuavaSeq = value),
    getLastCountedGuavaSeq: () => lastCountedGuavaSeq,
    setLastCountedGuavaSeq: (value) => (lastCountedGuavaSeq = value),
  });

  const connectMultiplayer = () => {
    multiplayerController.connect();
  };

  const sendMovement = createMovementSender(() => multiplayerSocket);
  const sendHeroMovement = (localHero: Hero & { mesh: BABYLON.AbstractMesh }) =>
    sendMovement(localHero.position, localHero.mesh.rotation.y);

  // --- Per-frame hero control ---
  const applyHeroInput = inputController.applyHeroInput;

  // --- Scene setup ---
  // Applies the game ground material and camera input rules once the scene is ready.
  $effect(() => {
    if (!sceneRef || !gameCamera || !gameGroundMaterial || !canvas) return;

    arenaBuilder?.updateCameraMode();

    sceneRef.activeCamera = gameCamera;
    if (groundMesh) groundMesh.material = gameGroundMaterial;
    wallMeshes.forEach((wall) => (wall.material = arenaBuilder?.wallMaterial ?? gameGroundMaterial));

    gameCamera.detachControl();
    const mouseInput = gameCamera.inputs.attached.mouse as any;
    if (mouseInput) {
      mouseInput.wheelDeltaPercentage = 0;
      mouseInput.wheelPrecision = 0;
    }
    gameCamera.wheelPrecision = 0;
    canvas.addEventListener("wheel", preventGameWheel, { passive: true });
    gameCamera.attachControl(canvas, true);
  });

  const unlockAudioEngine = () => {
    if (typeof BABYLON !== "undefined" && BABYLON.Engine.audioEngine) {
      BABYLON.Engine.audioEngine.unlock();
    }
  };

  const startGame = (enteredName: string) => {
    if (hasEnteredGame) return;

    applyLocalPlayerName(enteredName || readStoredName() || "Player Hero");
    serverConnectionState = "preparing";
    unlockAudioEngine();
    hasEnteredGame = true;
  };

  // Only hasEnteredGame and canvas may trigger this effect; the boot body is untracked
  // so state written during setup cannot re-run it and fire the cleanup (closing the socket).
  $effect(() => {
    if (!hasEnteredGame || !canvas) return;

    const gameCanvas = canvas;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        cleanup = untrack(() => bootGame(gameCanvas));
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      cleanup?.();
    };
  });

  const bootGame = (gameCanvas: HTMLCanvasElement) => {
    unlockAudioEngine();
    playerProfileController.ensureClientUserId();
    const save = getPlayerSaveData();
    playerGuavaCount = save.guavaCount;
    playerName = playerProfileController.resolvePlayerName();
    keyboardController = createKeyboardController(handleHeroKey);

    const cleanupRuntime = bootGameRuntime({
      canvas: gameCanvas,
      isMobile,
      playerName,
      remoteHeroes,
      getHeroMesh: () => heroMesh,
      getMoveTarget: () => currentTarget,
      onMoveTarget: (target) => (currentTarget = target),
      onGroundClick: ({ x, z }) => (debugPoint = { x, y: z }),
      onBeforeHeroUpdate: applyHeroInput,
      onAfterHeroUpdate: (localHero) => {
        heroPosition = { x: localHero.position.x, z: localHero.position.z, yaw: localHero.mesh?.rotation?.y ?? 0 };
        writeLastHeroPosition(heroPosition);
        sendHeroMovement(localHero as Hero & { mesh: BABYLON.AbstractMesh });
      },
      onGuavaCollected: () => {
        const nextSave = persistGuavaPickup(playerName, playerGuavaCount + 1);
        if (nextSave) {
          playerGuavaCount = nextSave.guavaCount;
          onlinePlayers = onlinePlayers.map((entry) =>
            entry.id === clientUserId || entry.id === localPlayerId
              ? { ...entry, guavaCount: nextSave.guavaCount }
              : entry,
          );
        }
        showAnnouncement(`${playerName} picked up the guava`);
      },
      onHeroLoaded: (localHero) => {
        heroMesh = localHero.mesh;
        heroPosition = { x: localHero.position.x, z: localHero.position.z, yaw: localHero.mesh?.rotation?.y ?? 0 };
        connectMultiplayer();
        if (!isServerConnected) {
          guavaHuntInstance?.setLocalFallbackMode();
        }
        syncLocalHeroVisibility(isServerConnected);
        resetGameCameraToHero();
      },
      isGameLive: () => isServerConnected,
      onSceneReady: (runtime) => {
        sceneRef = runtime.scene;
        gameCamera = runtime.camera;
        arenaBuilder = runtime.arena;
        groundMesh = runtime.arena.ground;
        wallMeshes = runtime.arena.walls;
        gameGroundMaterial = runtime.arena.gameGroundMaterial;
        hero = runtime.hero;
        guavaHuntInstance = runtime.guavaHunt;
        guavaHuntRef = runtime.guavaHunt;
      },
      onFpsUpdate: (fpsValue) => {
        fps = fpsValue;
      },
      onWheelCapture: preventGameWheel,
    });

    return () => {
      cleanupRuntime();
      keyboardController?.dispose();
      multiplayerController.close();
      remoteHeroes.setLocalHero(null);
      remoteHeroes.disposeAll();
    };
  };
</script>

{#if !hasEnteredGame}
  <GameIntroScene
    defaultName={readStoredName() || "Player Hero"}
    guavaCount={playerGuavaCount}
    onEnter={startGame}
  />
{/if}

{#if hasEnteredGame}
  <Ui_Moba
    heroPosition={heroPosition}
    remoteMarkers={minimapMarkers}
    {onlinePlayers}
    {chatMessages}
    debugPoint={debugPoint}
    fps={fps}
    serverConnected={isServerConnected}
    serverConnectionState={serverConnectionState}
    playerName={playerName}
    announcement={announcement}
    onMoveInput={applyMobileMovement}
    onMinimapSelect={handleMinimapSelect}
    onReconnect={connectMultiplayer}
    onChatSend={handleChatSend}
  />

  <canvas bind:this={canvas} class="babylon-canvas"></canvas>
{/if}

<style>
  :global(html) {
    height: 100%;
  }

  :global(body) {
    margin: 0;
    min-height: 100dvh;
    background: #04070d;
    font-family: Inter, "Segoe UI", sans-serif;
    color: #edf7ff;
    -webkit-text-size-adjust: 100%;
  }

  .babylon-canvas {
    display: block;
    width: 100vw;
    height: 100dvh;
    min-height: 100dvh;
    touch-action: none;
    user-select: none;
  }
</style>
