import { useCallback, useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";
export type ColorSchemePreference = ColorScheme | "system";

const STORAGE_KEY = "ui-color-scheme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function parseColorScheme(value: string | null): ColorSchemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

function getStoredColorScheme(): ColorSchemePreference {
  try {
    return parseColorScheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function useColorScheme() {
  const [preference, setPreference] = useState(getStoredColorScheme);
  const [browserColorScheme, setBrowserColorScheme] = useState<ColorScheme>(() => (window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light"));

  useEffect(() => {
    const mediaQuery = window.matchMedia(MEDIA_QUERY);
    const onBrowserChange = (event: MediaQueryListEvent) => {
      setBrowserColorScheme(event.matches ? "dark" : "light");
    };
    const onStorageChange = (event: StorageEvent) => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === localStorage) {
        setPreference(parseColorScheme(event.newValue));
      }
    };

    setBrowserColorScheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", onBrowserChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      mediaQuery.removeEventListener("change", onBrowserChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  const setColorScheme = useCallback((nextPreference: ColorSchemePreference) => {
    setPreference(nextPreference);
    try {
      if (nextPreference === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, nextPreference);
      }
    } catch {}
  }, []);

  return {
    colorScheme: preference === "system" ? browserColorScheme : preference,
    setColorScheme,
    isDefault: preference === "system",
  };
}
