import { HERO_PRESETS, type HeroPresetName } from "$lib/moba/entities/heroConfig";

const HERO_PRESET_KEY = "cyberpurok:playerHeroPreset";
const DEFAULT_HERO_PRESET: HeroPresetName = "jfk2";

export const readStoredHeroPreset = (): HeroPresetName => {
  if (typeof localStorage === "undefined") {
    return DEFAULT_HERO_PRESET;
  }

  try {
    const value = localStorage.getItem(HERO_PRESET_KEY);
    if (value && value in HERO_PRESETS) {
      return value as HeroPresetName;
    }
  } catch {
    // storage unavailable; fall back to default
  }

  return DEFAULT_HERO_PRESET;
};

export const writeStoredHeroPreset = (preset: HeroPresetName) => {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(HERO_PRESET_KEY, preset);
  } catch {
    // storage unavailable; hero selection just won't persist
  }
};
