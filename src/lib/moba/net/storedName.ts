const PLAYER_NAME_KEY = "cyberpurok:playerName";

export const readStoredName = () => {
  if (typeof localStorage === "undefined") {
    return "";
  }

  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

export const writeStoredName = (name: string) => {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // storage unavailable (private mode); name just won't persist
  }
};
