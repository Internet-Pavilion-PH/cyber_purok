import { NETWORK_SEND_INTERVAL_MS } from "../constants";

type Pos = { x: number; z: number };
type MoveSocket = { connected: boolean; sendMove: (dx: number, dz: number, yaw: number) => void };

/**
 * Send the last world-space drift from the local hero instead of inflating it by the
 * server step. The server step is a network-physics tuning value; if we divide raw
 * deltas by it here, the client can easily overshoot and appear to run too fast.
 */
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
    const magnitude = Math.hypot(dx, dz);

    if (magnitude > 0.01 || yaw !== lastSentYaw) {
      const safeDx = Math.max(-12, Math.min(12, dx));
      const safeDz = Math.max(-12, Math.min(12, dz));
      socket.sendMove(safeDx, safeDz, yaw);
    }

    lastSentPos = { x: position.x, z: position.z };
    lastSentYaw = yaw;
    lastSentAt = now;
  };
}
