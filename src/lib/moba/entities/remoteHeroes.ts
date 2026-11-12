import * as BABYLON from "@babylonjs/core";
import { Hero } from "./hero";
import { createHeroConfig } from "./heroConfig";
import type { ArenaBuilder } from "../world/arenaBuilder";
import { getTerrainHeight } from "../world/terrainHeight";

// All players share the same world-space origin. We do not add an extra client-side
// spawn offset here; the authoritative server positions are already in arena coordinates.
export const SPAWN_OFFSET = 0;
export const SERVER_STEP = 0.3;

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
}

export interface MapMarker {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
  pulse?: boolean;
}

const PLAYER_COLORS = [
  "#ff4d4d", "#4da6ff", "#ffd24d", "#c04dff", "#ff8c1a",
  "#1affd5", "#ff4da6", "#ffffff", "#8cff4d", "#9a6b3a",
];
const assignedColors = new Map<string, string>();

/** Each player id gets the next unused palette color the first time it is seen. */
export const playerColor = (id: string) => {
  let color = assignedColors.get(id);
  if (!color) {
    color = PLAYER_COLORS[assignedColors.size % PLAYER_COLORS.length];
    assignedColors.set(id, color);
  }
  return color;
};

export const toMapMarkers = (players: RemotePlayer[], localId: string | null): MapMarker[] =>
  players
    .filter((player) => player.id !== localId)
    .map((player) => ({
      id: player.id,
      name: player.name,
      x: player.x,
      z: player.z,
      color: playerColor(player.id),
    }));

const lerpAngle = (from: number, to: number, amount: number) => {
  const diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  return from + diff * amount;
};

interface RemoteHeroContext {
  getScene: () => BABYLON.Scene | null;
  getArena: () => ArenaBuilder | null;
  getLocalPlayerId: () => string | null;
}

/** Creates, updates and removes heroes that represent other connected players. */
export class RemoteHeroes {
  private heroes = new Map<string, Hero>();
  private localHero: Hero | null = null;
  private loadingIds = new Set<string>();
  private latestPlayers = new Map<string, RemotePlayer>();
  private previousPositions = new Map<string, BABYLON.Vector3>();
  private remoteMotionState = new Map<string, boolean>();

  constructor(private ctx: RemoteHeroContext) {}

  public setLocalHero(hero: Hero | null) {
    this.localHero = hero;
    if (!hero) return;

    hero.mesh?.setEnabled(true);
    hero.updateDisplayName(hero.config.name);
  }

  public sync(players: RemotePlayer[], localId: string | null = this.ctx.getLocalPlayerId()) {
    this.latestPlayers.clear();
    players.forEach((player) => this.latestPlayers.set(player.id, player));

    const activeIds = new Set<string>();
    for (const player of players) {
      if (player.id === localId) {
        if (this.localHero) {
          this.localHero.updateDisplayName(player.name);
          this.localHero.mesh?.setEnabled(true);
        }
        continue;
      }

      activeIds.add(player.id);
      void this.upsert(player);
    }

    if (localId && this.localHero && !players.some((player) => player.id === localId)) {
      this.localHero.mesh?.setEnabled(false);
    }

    this.heroes.forEach((hero, id) => {
      if (!activeIds.has(id)) {
        this.previousPositions.delete(id);
        this.remoteMotionState.delete(id);
        hero.dispose();
        this.heroes.delete(id);
      }
    });
  }

  public clear() {
    this.loadingIds.clear();
    this.latestPlayers.clear();
    this.previousPositions.clear();
    this.remoteMotionState.clear();
    this.localHero?.mesh?.setEnabled(false);
    this.heroes.forEach((hero) => hero.dispose());
    this.heroes.clear();
    this.localHero = null;
  }

  public disposeAll() {
    this.clear();
  }

  private async upsert(player: RemotePlayer) {
    const scene = this.ctx.getScene();
    if (!scene) return;

    let hero = this.heroes.get(player.id);
    if (!hero) {
      if (this.loadingIds.has(player.id)) return;
      this.loadingIds.add(player.id);

      hero = new Hero(
        scene,
        createHeroConfig(player.id, player.name, new BABYLON.Vector3(player.x, 0, player.z)),
      );

      try {
        const lights = this.ctx.getArena()?.lights;
        await hero.load(lights?.shadowGen);
        this.heroes.set(player.id, hero);
        hero.playAnimation("Idle");
      } catch (error) {
        console.error("Failed to load remote hero", player.id, error);
        return;
      } finally {
        this.loadingIds.delete(player.id);
      }
    }

    const resolvedName = this.latestPlayers.get(player.id)?.name ?? player.name;
    if (hero.config.name !== resolvedName) hero.updateDisplayName(resolvedName);

    if (hero.mesh) {
      const rx = player.x;
      const rz = player.z;
      const nextPosition = new BABYLON.Vector3(rx, getTerrainHeight(rx, rz), rz);
      const previousPosition = this.previousPositions.get(player.id);
      const movementDistance = previousPosition ? BABYLON.Vector3.Distance(previousPosition, nextPosition) : 0;
      const currentRunning = this.remoteMotionState.get(player.id) ?? false;

      const currentPosition = hero.mesh.position.clone();
      const distanceToTarget = BABYLON.Vector3.Distance(currentPosition, nextPosition);
      const followStrength = distanceToTarget > 24 ? 0.5 : distanceToTarget > 10 ? 0.3 : distanceToTarget > 2 ? 0.2 : 0.14;

      if (distanceToTarget > 0.15) {
        const eased = currentPosition.add(nextPosition.subtract(currentPosition).scale(followStrength));
        hero.mesh.position.copyFrom(eased);
        hero.mesh.position.y = getTerrainHeight(hero.mesh.position.x, hero.mesh.position.z);
      } else {
        hero.mesh.position.copyFrom(nextPosition);
      }

      const targetYaw = player.yaw ?? 0;
      hero.mesh.rotation.y = lerpAngle(hero.mesh.rotation.y, targetYaw, 0.2);

      const nextRunning = movementDistance > 0.35 || distanceToTarget > 0.6;
      if (nextRunning !== currentRunning) {
        this.remoteMotionState.set(player.id, nextRunning);
        hero.playAnimation(nextRunning ? "Walking" : "Idle");
      }

      this.previousPositions.set(player.id, nextPosition.clone());
    }
  }
}
