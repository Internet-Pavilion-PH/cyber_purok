<script lang="ts">
  import { untrack } from "svelte";
  import * as BABYLON from "@babylonjs/core";
  import "@babylonjs/loaders/glTF";
  import { MultiplayerSocket } from "$lib/moba/net/socket";
  import { CustomLoadingScreen } from "$lib/v1/CustomLoadingScreen";
  import { Hero } from "$lib/moba/entities/hero";
  import type { ArenaBuilder } from "$lib/moba/world/arenaBuilder";
  import { createGameScene } from "$lib/moba/gameScene";
  import { RemoteHeroes, toMapMarkers, type MapMarker } from "$lib/moba/entities/remoteHeroes";
  import { createMovementSender } from "$lib/moba/net/movementSender";
  import { readStoredName, writeStoredName } from "$lib/moba/net/storedName";
  import {
    defaultGameCameraConfig,
    focusCameraOn,
    resetGameCameraToTarget,
  } from "$lib/moba/input/cameraController";
  import { detectMobile, joystickToMoveDirection } from "$lib/moba/input/mobileInput";
  import { PlayerNameRegistry, generateClientUserId, sanitizeName } from "$lib/moba/net/playerNames";
  import {
    createKeyboardController,
    HERO_SKILL_KEYS,
    isSkillKey,
  } from "$lib/moba/input/keyboard";
  import Ui_Moba from "$lib/moba/Ui_Moba.svelte";
  import GameIntroScene from "$lib/components/GameIntroScene.svelte";

  type HeroPosition = { x: number; z: number };

  const LAST_HERO_POSITION_KEY = "cyberpurok:last-hero-position";

  const readLastHeroPosition = (): HeroPosition | null => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem(LAST_HERO_POSITION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<HeroPosition>;
      if (typeof parsed.x !== "number" || typeof parsed.z !== "number") return null;
      return { x: parsed.x, z: parsed.z };
    } catch {
      return null;
    }
  };

  const writeLastHeroPosition = (position: HeroPosition) => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(LAST_HERO_POSITION_KEY, JSON.stringify(position));
    } catch {
      // ignore localStorage failures and fall back to server-authoritative state
    }
  };

  const isMobile = detectMobile();

  // --- State ---
  let canvas: HTMLCanvasElement | undefined = $state();
  let hasEnteredGame = $state(false);
  type ChatEntry = { id: string; author: string; text: string };

  let heroPosition = $state<HeroPosition>({ x: 0, z: 0 });
  let debugPoint = $state({ x: 0, y: 0 });
  let fps = $state(0);
  let playerName = $state("Player Hero");
  const knownPlayerNames = new PlayerNameRegistry();
  let remoteMarkers = $state<MapMarker[]>([]);
  let onlinePlayers = $state<Array<{ id: string; name: string }>>([]);
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

  const applyMobileMovement = (input: { x: number; y: number }) => {
    mobileMoveVector = input;
  };

  const handleMinimapSelect = (point: HeroPosition) => {
    if (!gameCamera) return;

    focusCameraOn(gameCamera, point);
    currentTarget = null;
    hero?.setTarget(null);
  };

  const preventGameWheel: EventListener = (event) => {
    event.stopPropagation();
  };

  const isLocalPlayerId = (playerId: string) =>
    playerId === localPlayerId || playerId === clientUserId;

  const resolveOnlinePlayerName = (playerId: string, incomingName?: string) =>
    knownPlayerNames.resolve(playerId, incomingName, isLocalPlayerId(playerId), playerName);

  const applyLocalPlayerName = (name: string) => {
    const nextName = sanitizeName(name);
    playerName = nextName;
    knownPlayerNames.set(clientUserId, nextName);
    hero?.updateDisplayName(nextName);
    return nextName;
  };

  const resolvePlayerName = () => {
    if (typeof window === "undefined") return playerName;

    const storedName = readStoredName();
    const defaultName = storedName || clientUserId || generateClientUserId();
    const entered = window.prompt("Choose your hero name:", defaultName);
    const name = applyLocalPlayerName(entered?.trim() || defaultName);
    writeStoredName(name);
    return name;
  };

  const handleChatSend = (text: string) => {
    const nextText = text.trim();
    if (!nextText) return;

    multiplayerSocket?.sendChat(nextText, playerName, clientUserId);
    chatMessages = [
      ...chatMessages,
      {
        id: `chat-${Date.now()}-${clientUserId}`,
        author: playerName,
        text: nextText,
      },
    ].slice(-5);
  };

  const handleHeroKey = (key: string, isPressed: boolean) => {
    if (!isPressed) return;

    if (key === "1") {
      resetGameCameraToHero();
      return;
    }

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
  const syncLocalHeroVisibility = (visible: boolean) => {
    if (heroMesh) heroMesh.setEnabled(visible);
    if (hero) hero.mesh?.setEnabled(visible);
  };

  const resetLocalHeroToSpawn = (spawnX = 0, spawnZ = 0) => {
    if (!hero) return;

    const nextPosition = { x: spawnX, z: spawnZ };
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

  const connectMultiplayer = () => {
    clientUserId = clientUserId || generateClientUserId();
    multiplayerSocket?.close();

    const lastSavedPosition = readLastHeroPosition() ?? { x: 0, z: 0 };
    onlinePlayers = [{ id: clientUserId, name: playerName }];
    isServerConnected = false;
    syncLocalHeroVisibility(false);
    resetLocalHeroToSpawn(lastSavedPosition.x, lastSavedPosition.z);

    multiplayerSocket = new MultiplayerSocket();
    multiplayerSocket.connect({
      userId: clientUserId,
      name: playerName,
      getPosition: () => (hero?.mesh ? hero.position : readLastHeroPosition()),
      onWelcome: (message) => {
        localPlayerId = message.you;
        knownPlayerNames.set(message.you, playerName);
        if (hero) hero.config.id = message.you;
        const spawnX = message.spawnX ?? lastSavedPosition.x ?? 0;
        const spawnZ = message.spawnZ ?? lastSavedPosition.z ?? 0;
        resetLocalHeroToSpawn(spawnX, spawnZ);
        isServerConnected = true;
        guavaHuntInstance?.setServerMode(true);
        syncLocalHeroVisibility(true);
      },
      onState: (message) => {
        const players = message.players.map((player) => ({
          ...player,
          name: resolveOnlinePlayerName(player.id, player.name),
        }));
        remoteHeroes.sync(players, localPlayerId);
        remoteMarkers = toMapMarkers(players, localPlayerId);
        onlinePlayers = players.map((player) => {
          if (isLocalPlayerId(player.id)) applyLocalPlayerName(player.name);
          return { id: player.id, name: player.name };
        });
      },
      onPresence: (message) => {
        const nextOnlinePlayers = [...new Set(message.ids)].map((id) => ({
          id,
          name: resolveOnlinePlayerName(id, undefined),
        }));
        onlinePlayers = nextOnlinePlayers;
      },
      onChat: (message) => {
        // own messages are already appended locally in handleChatSend
        if (message.senderId === clientUserId) return;
        chatMessages = [
          ...chatMessages,
          {
            id: `chat-${message.ts}-${message.senderId}`,
            author: message.senderName,
            text: message.text,
          },
        ].slice(-5);
      },
      onGuava: (message) => {
        guavaHuntInstance?.syncFromServer(message);
      },
      onClose: () => {
        guavaHuntInstance?.setLocalFallbackMode();
        isServerConnected = false;
        localPlayerId = null;
        remoteHeroes.clear();
        remoteMarkers = [];
        onlinePlayers = [];
        const fallbackPosition = readLastHeroPosition() ?? { x: 0, z: 0 };
        if (hero) {
          hero.setMoveDirection(null);
          hero.setTarget(null);
          if (hero.mesh) {
            hero.mesh.position.set(fallbackPosition.x, 0, fallbackPosition.z);
            hero.mesh.rotation.y = 0;
          }
        }
        heroPosition = fallbackPosition;
        syncLocalHeroVisibility(true);
      },
      onError: (event) => {
        isServerConnected = false;
        console.error("multiplayer socket error", event);
      },
    });
  };

  const sendMovement = createMovementSender(() => multiplayerSocket);
  const sendHeroMovement = (localHero: Hero & { mesh: BABYLON.AbstractMesh }) =>
    sendMovement(localHero.position, localHero.mesh.rotation.y);

  // --- Per-frame hero control ---
const applyHeroInput = (localHero: Hero) => {
  const joystickActive = mobileMoveVector.x !== 0 || mobileMoveVector.y !== 0;
  const direction = joystickToMoveDirection(mobileMoveVector);

  if (joystickActive) currentTarget = null;

  localHero.setMoveDirection(direction ? new BABYLON.Vector3(direction.x, 0, direction.z) : null);
  localHero.setTarget(currentTarget);
};

  // --- Scene setup ---
  const createScene = (engine: BABYLON.Engine, loadingScreen: CustomLoadingScreen, gameCanvas: HTMLCanvasElement) => {
    const game = createGameScene({
      engine,
      canvas: gameCanvas,
      loadingScreen,
      isMobile,
      playerName,
      remoteHeroes,
      getHeroMesh: () => heroMesh,
      getMoveTarget: () => currentTarget,
      onMoveTarget: (target) => (currentTarget = target),
      onGroundClick: ({ x, z }) => (debugPoint = { x, y: z }),
      onBeforeHeroUpdate: applyHeroInput,
      onAfterHeroUpdate: (localHero) => {
        heroPosition = localHero.position;
        writeLastHeroPosition(localHero.position);
        sendHeroMovement(localHero as Hero & { mesh: BABYLON.AbstractMesh });
      },
      onHeroLoaded: (localHero) => {
        heroMesh = localHero.mesh;
        heroPosition = localHero.position;
        if (!isServerConnected) {
          guavaHuntInstance?.setLocalFallbackMode();
        }
        syncLocalHeroVisibility(isServerConnected);
        resetGameCameraToHero();
      },
      isGameLive: () => isServerConnected,
    });

    sceneRef = game.scene;
    gameCamera = game.camera;
    arenaBuilder = game.arena;
    groundMesh = game.arena.ground;
    wallMeshes = game.arena.walls;
    gameGroundMaterial = game.arena.gameGroundMaterial;
    hero = game.hero;
    guavaHuntInstance = game.guavaHunt;
    guavaHuntRef = game.guavaHunt;

    return game.scene;
  };

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

  const startGame = () => {
    if (hasEnteredGame) return;

    unlockAudioEngine();
    hasEnteredGame = true;
  };

  // Only hasEnteredGame and canvas may trigger this effect; the boot body is untracked
  // so state written during setup cannot re-run it and fire the cleanup (closing the socket).
  $effect(() => {
    if (!hasEnteredGame || !canvas) return;

    const gameCanvas = canvas;
    return untrack(() => bootGame(gameCanvas));
  });

  const bootGame = (gameCanvas: HTMLCanvasElement) => {
    unlockAudioEngine();
    clientUserId = clientUserId || generateClientUserId();
    playerName = resolvePlayerName();
    connectMultiplayer();
    keyboardController = createKeyboardController(handleHeroKey);

    const engine = new BABYLON.Engine(gameCanvas, true, { audioEngine: true });
    BABYLON.SceneLoader.ShowLoadingScreen = true;
    const loadingScreen = new CustomLoadingScreen("/images/cyber_purok.png");
    engine.loadingScreen = loadingScreen;
    loadingScreen.displayLoadingUI();

    const scene = createScene(engine, loadingScreen, gameCanvas);
    scene.activeCamera = gameCamera;
    gameCamera?.attachControl(gameCanvas, true);

    engine.runRenderLoop(() => {
      scene.render();
      fps = Math.round(engine.getFps?.() ?? 0);
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      gameCanvas.removeEventListener("wheel", preventGameWheel);
      keyboardController?.dispose();
      multiplayerSocket?.close();
      remoteHeroes.setLocalHero(null);
      remoteHeroes.disposeAll();
      scene.dispose();
      engine.dispose();
    };
  };
</script>

{#if !hasEnteredGame}
  <GameIntroScene onEnter={startGame} />
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
    playerName={playerName}
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
