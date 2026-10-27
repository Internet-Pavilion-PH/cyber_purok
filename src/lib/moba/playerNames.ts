const MAX_NAME_LENGTH = 12;
const DEFAULT_NAME = "Hero";

export const generateClientUserId = () => {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return raw.replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase();
};

export const sanitizeName = (name: string | undefined) =>
  (name || DEFAULT_NAME).trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;

const isDefaultName = (name: string) => name.toLowerCase() === DEFAULT_NAME.toLowerCase();

/** Remembers the display name last seen for each player id. */
export class PlayerNameRegistry {
  private names = new Map<string, string>();

  set(playerId: string, name: string) {
    this.names.set(playerId, name);
  }

  /** Resolves a server-provided name, falling back to the remembered or local name. */
  resolve(playerId: string, incomingName: string | undefined, isLocal: boolean, localName: string) {
    const trimmed = (incomingName ?? "").trim();

    if (trimmed && !isDefaultName(trimmed)) {
      const nextName = trimmed.slice(0, MAX_NAME_LENGTH);
      this.names.set(playerId, nextName);
      return nextName;
    }

    const remembered = this.names.get(playerId);
    if (remembered) return remembered;
    return isLocal ? localName : DEFAULT_NAME;
  }
}
