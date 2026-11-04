const PLAYER_NAME_KEY = "cyberpurok:playerName";

export const readStoredName = () => {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

export const writeStoredName = (name: string) => {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // storage unavailable (private mode); name just won't persist
  }
};
