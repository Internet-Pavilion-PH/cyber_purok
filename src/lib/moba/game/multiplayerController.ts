import * as BABYLON from "@babylonjs/core";
import { MultiplayerSocket } from "$lib/moba/net/socket";
import { toMapMarkers, type MapMarker, type RemotePlayer } from "$lib/moba/entities/remoteHeroes";
import type { Hero } from "$lib/moba/entities/hero";

export type MultiplayerPlayer = Partial<RemotePlayer> & { id: string; name: string; guavaCount?: number };
export type MultiplayerConnectionState = "preparing" | "connecting" | "connected" | "disconnected";
export type ChatEntry = { id: string; author: string; text: string };

export type MultiplayerControllerDeps = {
  playerName: () => string;
  getPlayerGuavaCount: () => number;
  setPlayerGuavaCount: (value: number) => void;
  setOnlinePlayers: (players: MultiplayerPlayer[]) => void;
  setRemoteMarkers: (markers: MapMarker[]) => void;
  getLocalPlayerId: () => string | null;
  setSocket: (socket: MultiplayerSocket | null) => void;
  setLocalPlayerId: (id: string | null) => void;
  setClientUserId: (id: string) => void;
  setServerConnected: (value: boolean) => void;
  setServerConnectionState: (state: MultiplayerConnectionState) => void;
  setChatMessages: (messages: ChatEntry[]) => void;
  updateRemoteHeroes: (players: MultiplayerPlayer[], localPlayerId: string | null) => void;
  resolveOnlinePlayerName: (playerId: string, incomingName?: string) => string;
  isLocalPlayerId: (playerId: string) => boolean;
  applyLocalPlayerName: (name: string) => string;
  syncLocalHeroVisibility: (visible: boolean) => void;
  resetLocalHeroToSpawn: (spawnX?: number, spawnZ?: number) => void;
  showAnnouncement: (text: string, durationMs?: number) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onGuavaUpdate: (message: { type?: string; playerId?: string; seq?: number }) => void;
  persistGuavaPickup: (currentName?: string, currentGuavaCount?: number) => { guavaCount: number } | null;
  readLastHeroPosition: () => { x: number; z: number; yaw?: number } | null;
  getHero: () => Hero | null;
  getHeroMesh: () => BABYLON.AbstractMesh | null;
  getLastAnnouncedGuavaSeq: () => number;
  setLastAnnouncedGuavaSeq: (value: number) => void;
  getLastCountedGuavaSeq: () => number;
  setLastCountedGuavaSeq: (value: number) => void;
};

export const createMultiplayerController = (deps: MultiplayerControllerDeps) => {
  let socket: MultiplayerSocket | null = null;
  let currentPlayers: MultiplayerPlayer[] = [];
  let currentChatMessages: ChatEntry[] = [];

  const syncPlayers = (players: MultiplayerPlayer[]) => {
    currentPlayers = players;
    deps.setOnlinePlayers(players);
  };

  const syncChat = (messages: ChatEntry[]) => {
    currentChatMessages = messages;
    deps.setChatMessages(messages);
  };

  const connect = () => {
    deps.setServerConnectionState("connecting");
    const clientUserId = crypto.randomUUID ? crypto.randomUUID() : `player-${Date.now()}`;
    deps.setClientUserId(clientUserId);
    socket?.close();

    const lastSavedPosition = deps.readLastHeroPosition() ?? { x: 0, z: 0 };
    const playerGuavaCount = deps.getPlayerGuavaCount();
    syncPlayers([{ id: clientUserId, name: deps.playerName(), guavaCount: playerGuavaCount }]);
    deps.setServerConnected(false);
    deps.setServerConnectionState("connecting");
    deps.syncLocalHeroVisibility(true);
    deps.resetLocalHeroToSpawn(lastSavedPosition.x, lastSavedPosition.z);

    socket = new MultiplayerSocket();
    deps.setSocket(socket);
    socket.connect({
      userId: clientUserId,
      name: deps.playerName(),
      guavaCount: playerGuavaCount,
      getPosition: () => (deps.getHero()?.mesh ? deps.getHero()!.position : deps.readLastHeroPosition()),
      onWelcome: (message) => {
        deps.setLocalPlayerId(message.you);
        if (deps.getHero()) deps.getHero()!.config.id = message.you;
        const spawnX = message.spawnX ?? lastSavedPosition.x ?? 0;
        const spawnZ = message.spawnZ ?? lastSavedPosition.z ?? 0;
        deps.resetLocalHeroToSpawn(spawnX, spawnZ);
        deps.setServerConnected(true);
        deps.setServerConnectionState("connected");
        deps.onConnected();
        deps.syncLocalHeroVisibility(true);
      },
      onState: (message) => {
        const players = message.players.map((player) => ({
          ...player,
          name: deps.resolveOnlinePlayerName(player.id, player.name),
          guavaCount: typeof player.guavaCount === "number" ? player.guavaCount : deps.isLocalPlayerId(player.id) ? deps.getPlayerGuavaCount() : 0,
        }));
        deps.updateRemoteHeroes(players, deps.getLocalPlayerId());
        deps.setRemoteMarkers(toMapMarkers(players as any, deps.getLocalPlayerId()));
        syncPlayers(players.map((player) => {
          if (deps.isLocalPlayerId(player.id)) deps.applyLocalPlayerName(player.name);
          return {
            id: player.id,
            name: player.name,
            guavaCount: typeof player.guavaCount === "number" ? player.guavaCount : deps.isLocalPlayerId(player.id) ? deps.getPlayerGuavaCount() : 0,
          };
        }));
      },
      onPresence: (message) => {
        const nextOnlinePlayers = [...new Set(message.ids)].map((id) => ({
          id,
          name: deps.resolveOnlinePlayerName(id, undefined),
          guavaCount: deps.isLocalPlayerId(id) ? deps.getPlayerGuavaCount() : 0,
        }));
        syncPlayers(nextOnlinePlayers);
      },
      onChat: (message) => {
        if (message.senderId === clientUserId) return;
        const nextMessages = [
          ...currentChatMessages,
          { id: `chat-${message.ts}-${message.senderId}`, author: message.senderName, text: message.text },
        ].slice(-5);
        syncChat(nextMessages);
      },
      onGuava: (message) => {
        if (message.type === "guava_pickup" && message.playerId && message.seq !== deps.getLastAnnouncedGuavaSeq()) {
          deps.setLastAnnouncedGuavaSeq(message.seq);
          const pickerName = deps.isLocalPlayerId(message.playerId) ? deps.playerName() : deps.resolveOnlinePlayerName(message.playerId, undefined);
          deps.showAnnouncement(`${pickerName} picked up the guava`);
        }

        if (message.type === "guava_pickup" && message.playerId && deps.isLocalPlayerId(message.playerId) && message.seq !== deps.getLastCountedGuavaSeq()) {
          deps.setLastCountedGuavaSeq(message.seq);
          const nextSave = deps.persistGuavaPickup(deps.playerName(), deps.getPlayerGuavaCount() + 1);
          if (nextSave) {
            deps.setPlayerGuavaCount(nextSave.guavaCount);
            syncPlayers(currentPlayers.map((entry) =>
              entry.id === clientUserId ? { ...entry, guavaCount: nextSave.guavaCount } : entry,
            ));
          }
        }
        deps.onGuavaUpdate(message);
      },
      onClose: () => {
        deps.setSocket(null);
        deps.onDisconnected();
        deps.setServerConnected(false);
        deps.setServerConnectionState("disconnected");
        deps.setLocalPlayerId(null);
        deps.updateRemoteHeroes([], null);
        deps.setRemoteMarkers([]);
        syncPlayers([]);
        const fallbackPosition = deps.readLastHeroPosition() ?? { x: 0, z: 0 };
        const hero = deps.getHero();
        if (hero) {
          hero.setMoveDirection(null);
          hero.setTarget(null);
          if (hero.mesh) {
            hero.mesh.position.set(fallbackPosition.x, 0, fallbackPosition.z);
            hero.mesh.rotation.y = 0;
          }
        }
        deps.syncLocalHeroVisibility(true);
      },
      onError: (event) => {
        deps.setSocket(null);
        deps.onDisconnected();
        deps.setServerConnected(false);
        deps.setServerConnectionState("disconnected");
        console.error("multiplayer socket error", event);
      },
    });
  };

  const close = () => {
    socket?.close();
  };

  const sendChat = (text: string, playerName: string, clientUserId: string) => {
    socket?.sendChat(text, playerName, clientUserId);
  };

  return { connect, close, sendChat };
};
