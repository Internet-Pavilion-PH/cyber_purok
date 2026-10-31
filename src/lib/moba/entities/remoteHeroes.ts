import * as BABYLON from "@babylonjs/core";
import { Hero } from "./hero";
import { createHeroConfig } from "../heroConfig";
import type { ArenaBuilder } from "../world/arenaBuilder";

// Server spawns everyone at (0,0) and integrates moveX*SERVER_STEP, so clients send deltas
// and offset positions by their own start.
export const SPAWN_OFFSET = -380;
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
      x: player.x + SPAWN_OFFSET,
      z: player.z + SPAWN_OFFSET,
      color: playerColor(player.id),
    }));

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
        hero.dispose();
        this.heroes.delete(id);
      }
    });
  }

  public clear() {
    this.loadingIds.clear();
    this.latestPlayers.clear();
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
        createHeroConfig(
          player.id,
          player.name,
          new BABYLON.Vector3(player.x + SPAWN_OFFSET, 0, player.z + SPAWN_OFFSET),
        ),
      );

      try {
        const lights = this.ctx.getArena()?.lights;
        await hero.load(lights?.shadowGen);
        if (lights && hero.mesh) lights.addShadowCaster(hero.mesh);
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
      hero.mesh.position.set(player.x + SPAWN_OFFSET, 0, player.z + SPAWN_OFFSET);
      hero.mesh.rotation.y = player.yaw;
    }
  }
}
