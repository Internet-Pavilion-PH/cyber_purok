import { NETWORK_SEND_INTERVAL_MS } from "../constants";
import { SERVER_STEP } from "../entities/remoteHeroes";

type Pos = { x: number; z: number };
type MoveSocket = { connected: boolean; sendMove: (dx: number, dz: number, yaw: number) => void };

/** Sends movement deltas (in server steps) at most every NETWORK_SEND_INTERVAL_MS. */
export function createMovementSender(getSocket: () => MoveSocket | null) {
  let lastSentAt = 0;
  let lastSentPos: Pos | null = null;
  let lastSentYaw = 0;

  return (position: Pos, yaw: number) => {
    const socket = getSocket();
    const now = performance.now();
    if (!socket?.connected || now - lastSentAt <= NETWORK_SEND_INTERVAL_MS) return;

    const prev = lastSentPos ?? position;
    const dx = position.x - prev.x;
    const dz = position.z - prev.z;

    if (dx !== 0 || dz !== 0 || yaw !== lastSentYaw) {
      socket.sendMove(dx / SERVER_STEP, dz / SERVER_STEP, yaw);
    }
    lastSentPos = { x: position.x, z: position.z };
    lastSentYaw = yaw;
    lastSentAt = now;
  };
}
