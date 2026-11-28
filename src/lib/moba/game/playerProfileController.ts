import {
  PlayerNameRegistry,
  generateClientUserId,
  sanitizeName,
} from "$lib/moba/net/playerNames";
import { readStoredName, writeStoredName } from "$lib/moba/net/storedName";
import { syncPlayerSave } from "$lib/moba/playerSession";
import { kolownbot } from "$lib/moba/utility/kolownbot";

type PlayerProfileControllerDeps = {
  getPlayerName: () => string;
  setPlayerName: (name: string) => void;
  getClientUserId: () => string;
  setClientUserId: (id: string) => void;
  getLocalPlayerId: () => string | null;
  updateHeroDisplayName: (name: string) => void;
};

export const createPlayerProfileController = (deps: PlayerProfileControllerDeps) => {
  const knownPlayerNames = new PlayerNameRegistry();

  const isLocalPlayerId = (playerId: string) =>
    playerId === deps.getLocalPlayerId() || playerId === deps.getClientUserId();

  const resolveOnlinePlayerName = (playerId: string, incomingName?: string) =>
    knownPlayerNames.resolve(
      playerId,
      incomingName,
      isLocalPlayerId(playerId),
      deps.getPlayerName(),
    );

  const applyLocalPlayerName = (name: string) => {
    const nextName = sanitizeName(name);
    deps.setPlayerName(nextName);
    knownPlayerNames.set(deps.getClientUserId(), nextName);
    deps.updateHeroDisplayName(nextName);
    writeStoredName(nextName);
    syncPlayerSave(nextName);
    return nextName;
  };

  const resolvePlayerName = () => {
    const fallbackName = deps.getClientUserId() || generateClientUserId();
    const name = applyLocalPlayerName(readStoredName() || fallbackName);
    void kolownbot(name).catch(() => undefined);
    return name;
  };

  const ensureClientUserId = () => {
    const currentId = deps.getClientUserId();
    const nextId = currentId || generateClientUserId();
    if (!currentId) deps.setClientUserId(nextId);
    return nextId;
  };

  return {
    readStoredName,
    isLocalPlayerId,
    resolveOnlinePlayerName,
    applyLocalPlayerName,
    resolvePlayerName,
    ensureClientUserId,
  };
};
