import type { ArenaPlayer, InputMessage } from "./protocol";

// Tracks the client-side movement/snapshot state we need to keep the multiplayer loop stable.
// This is intentionally small and transport-agnostic; the raw WebSocket still lives in socket.ts.
export type ClientSyncState = {
  localPlayerId: string | null;
  lastSnapshotAt: number;
  lastInputAt: number;
  inputRateMs: number;
  lastServerSequence: number;
};

export class ClientSyncController {
  // Keep a lightweight state model so we can later add prediction, interpolation, and reconnect resync.
  private state: ClientSyncState = {
    localPlayerId: null,
    lastSnapshotAt: 0,
    lastInputAt: 0,
    inputRateMs: 50,
    lastServerSequence: -1,
  };

  // Remember which player is the local hero so we can apply state checks and future prediction logic.
  public setLocalPlayerId(playerId: string | null) {
    this.state.localPlayerId = playerId;
  }

  // Every server snapshot updates our last-seen state timestamp.
  // This is the hook where future code can reconcile the local prediction against the authoritative state.
  public applySnapshot(players: ArenaPlayer[], at = Date.now()) {
    this.state.lastSnapshotAt = at;
    this.state.lastServerSequence = Math.max(this.state.lastServerSequence, 0);
    return players;
  }

  // We currently throttle input updates to a fixed cadence so we are not flooding the socket.
  public shouldSendInput(now = Date.now()) {
    return now - this.state.lastInputAt >= this.state.inputRateMs;
  }

  // Build a small input payload that the server can consume.
  // Later we can add seq/messageId and send this on a stricter rate or only when changed.
  public createInputMessage(input: Partial<InputMessage>, now = Date.now()): InputMessage {
    this.state.lastInputAt = now;
    return {
      type: "input",
      moveX: input.moveX ?? 0,
      moveY: input.moveY ?? 0,
      yaw: input.yaw ?? 0,
    };
  }

  // Useful when debugging or wiring reconnect logic in the future.
  public getState() {
    return { ...this.state };
  }
}
