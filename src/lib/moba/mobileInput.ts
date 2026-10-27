import { MOBILE_DEAD_ZONE, MOBILE_SPEED_MULTIPLIER } from "$lib/moba/constants";

export const detectMobile = () =>
  typeof window !== "undefined" &&
  ((typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) ||
    (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches));

/** Converts a joystick vector to a world move direction, or null inside the dead zone. */
export function joystickToMoveDirection(input: { x: number; y: number }) {
  const magnitude = Math.hypot(input.x, input.y);
  if (magnitude === 0) return null;

  const eased = magnitude < MOBILE_DEAD_ZONE ? 0 : (magnitude - MOBILE_DEAD_ZONE) / (1 - MOBILE_DEAD_ZONE);
  if (eased <= 0) return null;

  const scale = (eased * MOBILE_SPEED_MULTIPLIER) / magnitude;
  return { x: input.x * scale, z: input.y * scale };
}
