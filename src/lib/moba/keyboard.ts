export const HERO_SKILL_KEYS = {
  q: "q",
  w: "w",
  e: "e",
  r: "r",
} as const;

export type HeroSkillKey = keyof typeof HERO_SKILL_KEYS;
export type KeyboardAction = (key: string, isPressed: boolean) => void;

export interface KeyboardController {
  isPressed: (key: string) => boolean;
  isSkillPressed: (key: HeroSkillKey) => boolean;
  dispose: () => void;
}

export function isSkillKey(key: string): key is HeroSkillKey {
  return key in HERO_SKILL_KEYS;
}

export function createKeyboardController(onAction?: KeyboardAction): KeyboardController {
  const pressed = new Set<string>();

  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (pressed.has(key)) return;

    pressed.add(key);
    onAction?.(key, true);
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    pressed.delete(key);
    onAction?.(key, false);
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return {
    isPressed: (key: string) => pressed.has(key.toLowerCase()),
    isSkillPressed: (key: HeroSkillKey) => pressed.has(HERO_SKILL_KEYS[key]),
    dispose: () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    },
  };
}
