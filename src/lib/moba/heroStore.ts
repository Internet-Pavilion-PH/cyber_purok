import { writable, derived } from "svelte/store";

export interface HeroState {
  level: number;
  str: number;
  agi: number;
  int: number;
  currentHp: number;
  currentMana: number;
}

export const heroState = writable<HeroState>({
  level: 1,
  str: 22,
  agi: 15,
  int: 18,
  currentHp: 684,
  currentMana: 291,
});

// Derived Dota 2 scaling stats
export const maxHp = derived(heroState, ($h: HeroState) => 200 + $h.str * 22);
export const maxMana = derived(heroState, ($h: HeroState) => 75 + $h.int * 12);
export const hpRegen = derived(heroState, ($h: HeroState) => 1.0 + $h.str * 0.1);
export const manaRegen = derived(heroState, ($h: HeroState) => 0.5 + $h.int * 0.05);