export type ArenaPlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  guavaCount?: number;
};

export type WelcomeMessage = {
  type: "welcome";
  you: string;
  spawnX?: number;
  spawnZ?: number;
};

export type StateMessage = {
  type: "state";
  players: ArenaPlayer[];
};

export type PresenceMessage = {
  type: "presence";
  count: number;
  ids: string[];
  you: string;
};

export type PingMessage = {
  type: "ping";
};

export type PongMessage = {
  type: "pong";
};

export type ChatMessage = {
  type: "chat";
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
};

export type GuavaStateMessage = {
  type: "guava";
  seq: number;
  active: boolean;
  x: number;
  z: number;
  respawnAt?: number;
  pickedBy?: string;
};

export type GuavaPickupMessage = {
  type: "guava_pickup";
  seq: number;
  playerId?: string;
  x?: number;
  z?: number;
  active?: boolean;
};

export type SocketMessage =
  | WelcomeMessage
  | StateMessage
  | PresenceMessage
  | PingMessage
  | PongMessage
  | ChatMessage
  | GuavaStateMessage
  | GuavaPickupMessage;

export type InputMessage = {
  type: "input";
  moveX?: number;
  moveY?: number;
  yaw?: number;
};

export type JoinMessage = {
  type: "join";
  userId?: string;
  name?: string;
  guavaCount?: number;
  x?: number;
  z?: number;
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseArenaPlayer(value: unknown): ArenaPlayer | null {
  if (!isObject(value)) return null;

  const { id, name, x, y, z, yaw, hp, guavaCount } = value;
  if (typeof id !== "string" || typeof name !== "string") return null;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z) || !isFiniteNumber(yaw) || !isFiniteNumber(hp)) {
    return null;
  }

  return {
    id,
    name,
    x,
    y,
    z,
    yaw,
    hp,
    guavaCount: typeof guavaCount === "number" && Number.isFinite(guavaCount) ? Math.max(0, guavaCount) : undefined,
  };
}

export function parseSocketMessage(raw: string): SocketMessage | null {
  try {
    const data = JSON.parse(raw);
    if (!isObject(data)) return null;

    const type = data.type;
    if (type === "welcome" && typeof data.you === "string") {
      return {
        type: "welcome",
        you: data.you,
        spawnX: typeof data.spawnX === "number" ? data.spawnX : undefined,
        spawnZ: typeof data.spawnZ === "number" ? data.spawnZ : undefined,
      };
    }

    if (type === "state" && Array.isArray(data.players)) {
      const players = data.players.map(parseArenaPlayer).filter((value): value is ArenaPlayer => value !== null);
      if (players.length === data.players.length) {
        return { type: "state", players };
      }
      return null;
    }

    if (type === "presence" && typeof data.count === "number" && Array.isArray(data.ids) && typeof data.you === "string") {
      const ids = data.ids.filter((value): value is string => typeof value === "string");
      if (ids.length === data.ids.length) {
        return { type: "presence", count: data.count, ids, you: data.you };
      }
      return null;
    }

    if (type === "ping") {
      return { type: "ping" };
    }

    if (type === "pong") {
      return { type: "pong" };
    }

    if (
      type === "chat" &&
      typeof data.senderId === "string" &&
      typeof data.senderName === "string" &&
      typeof data.text === "string" &&
      typeof data.ts === "number"
    ) {
      return {
        type: "chat",
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        ts: data.ts,
      };
    }

    if (
      type === "guava" &&
      typeof data.seq === "number" &&
      typeof data.active === "boolean" &&
      isFiniteNumber(data.x) &&
      isFiniteNumber(data.z)
    ) {
      return {
        type: "guava",
        seq: data.seq,
        active: data.active,
        x: data.x,
        z: data.z,
        respawnAt: typeof data.respawnAt === "number" ? data.respawnAt : undefined,
        pickedBy: typeof data.pickedBy === "string" ? data.pickedBy : undefined,
      };
    }

    if (
      type === "guava_pickup" &&
      (typeof data.seq === "number" || typeof data.seq === "undefined") &&
      (typeof data.playerId === "string" || data.playerId === undefined)
    ) {
      return {
        type: "guava_pickup",
        seq: typeof data.seq === "number" ? data.seq : 0,
        playerId: typeof data.playerId === "string" ? data.playerId : undefined,
        x: typeof data.x === "number" ? data.x : undefined,
        z: typeof data.z === "number" ? data.z : undefined,
        active: typeof data.active === "boolean" ? data.active : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to parse multiplayer socket message:", error);
    return null;
  }
}
