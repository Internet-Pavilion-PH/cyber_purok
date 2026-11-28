import { sanitizeName } from "$lib/moba/net/playerNames";

export type HeroPosition = { x: number; z: number; yaw?: number };
export type SaveData = { playerId: string; playerName: string; guavaCount: number };

export const LAST_HERO_POSITION_KEY = "cyberpurok:last-hero-position";
export const SAVE_DATA_KEY = "cyberpurok:save";

const resolveStoredName = (): string => {
  if (typeof window === "undefined") return "Player Hero";
  const stored = window.localStorage.getItem("cyberpurok:player-name");
  return stored || "Player Hero";
};

export const readLastHeroPosition = (): HeroPosition | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LAST_HERO_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HeroPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.z !== "number") return null;
    return { x: parsed.x, z: parsed.z, yaw: typeof parsed.yaw === "number" ? parsed.yaw : undefined };
  } catch {
    return null;
  }
};

export const writeLastHeroPosition = (position: HeroPosition) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LAST_HERO_POSITION_KEY, JSON.stringify(position));
  } catch {
    // ignore localStorage failures and fall back to server-authoritative state
  }
};

export const getPlayerSaveData = (): SaveData => {
  if (typeof window === "undefined") return { playerId: "offline", playerName: "Player Hero", guavaCount: 0 };

  try {
    const raw = window.localStorage.getItem(SAVE_DATA_KEY);
    const storedName = sanitizeName(resolveStoredName());
    if (!raw) {
      const initial: SaveData = {
        playerId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `player-${Date.now()}`,
        playerName: storedName,
        guavaCount: 0,
      };
      window.localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const playerId = typeof parsed.playerId === "string" && parsed.playerId.trim() ? parsed.playerId : (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `player-${Date.now()}`);
    const playerName = sanitizeName(typeof parsed.playerName === "string" && parsed.playerName.trim() ? parsed.playerName : storedName);
    const guavaCount = Number.isFinite(parsed.guavaCount) ? Math.max(0, Number(parsed.guavaCount)) : 0;
    const next: SaveData = { playerId, playerName, guavaCount };
    window.localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(next));
    return next;
  } catch {
    const fallback: SaveData = {
      playerId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `player-${Date.now()}`,
      playerName: sanitizeName(resolveStoredName()),
      guavaCount: 0,
    };
    try {
      window.localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(fallback));
    } catch {
      // ignore storage failures
    }
    return fallback;
  }
};

export const syncPlayerSave = (nextName?: string, currentName?: string, currentGuavaCount?: number) => {
  if (typeof window === "undefined") return null;

  const save = getPlayerSaveData();
  const nextSave: SaveData = {
    ...save,
    playerName: sanitizeName(nextName ?? save.playerName ?? currentName ?? "Player Hero"),
    guavaCount: typeof currentGuavaCount === "number" ? currentGuavaCount : save.guavaCount,
  };

  try {
    window.localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(nextSave));
  } catch {
    // ignore localStorage failures and keep the current session state
  }

  return nextSave;
};

export const recordGuavaPickup = (currentName?: string, currentGuavaCount?: number): SaveData | null => {
  if (typeof window === "undefined") return null;

  const save = getPlayerSaveData();
  const nextSave: SaveData = {
    ...save,
    playerName: sanitizeName(currentName || save.playerName || "Player Hero"),
    guavaCount: typeof currentGuavaCount === "number" ? currentGuavaCount : save.guavaCount + 1,
  };

  try {
    window.localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(nextSave));
  } catch {
    // ignore localStorage failures and keep the current session state
  }

  return nextSave;
};
