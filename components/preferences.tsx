"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  copy,
  LOCALE_STORAGE_KEY,
  parseLocale,
  parseThemePreference,
  THEME_STORAGE_KEY,
  type Copy,
  type Locale,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/i18n";

interface PreferencesContextValue {
  locale: Locale;
  t: Copy;
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const defaultPreferences: PreferencesContextValue = {
  locale: "zh-CN",
  t: copy["zh-CN"],
  theme: "system",
  resolvedTheme: "light",
  setLocale: () => {},
  toggleLocale: () => {},
  setTheme: () => {},
  toggleTheme: () => {},
};

const PreferencesContext = createContext<PreferencesContextValue>(defaultPreferences);

const listeners = new Set<() => void>();
const memoryStorage = new Map<string, string | null>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function readStorage(key: string): string | null {
  if (memoryStorage.has(key)) return memoryStorage.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    memoryStorage.delete(key);
  } catch {
    memoryStorage.set(key, value);
  }
}

function getLocaleSnapshot(): Locale {
  return parseLocale(readStorage(LOCALE_STORAGE_KEY));
}

function getThemeSnapshot(): ThemePreference {
  return parseThemePreference(readStorage(THEME_STORAGE_KEY));
}

function getSystemThemeSnapshot(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeStorage(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === LOCALE_STORAGE_KEY ||
      event.key === THEME_STORAGE_KEY
    ) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeSystemTheme(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function applyLocaleToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.title = copy[locale].documentTitle;
}

function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribeStorage,
    getLocaleSnapshot,
    () => "zh-CN",
  );
  const theme = useSyncExternalStore<ThemePreference>(
    subscribeStorage,
    getThemeSnapshot,
    () => "system",
  );
  const systemTheme = useSyncExternalStore<ResolvedTheme>(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    () => "light",
  );

  useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  const setLocale = useCallback((next: Locale) => {
    writeStorage(LOCALE_STORAGE_KEY, next);
    applyLocaleToDocument(next);
    notifyListeners();
  }, []);

  const toggleLocale = useCallback(() => {
    const next: Locale = getLocaleSnapshot() === "zh-CN" ? "en" : "zh-CN";
    writeStorage(LOCALE_STORAGE_KEY, next);
    applyLocaleToDocument(next);
    notifyListeners();
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    writeStorage(THEME_STORAGE_KEY, next === "system" ? null : next);
    applyThemeToDocument(next);
    notifyListeners();
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getThemeSnapshot();
    const effective: ResolvedTheme =
      current === "system" ? getSystemThemeSnapshot() : current;
    const next: ResolvedTheme = effective === "dark" ? "light" : "dark";
    writeStorage(THEME_STORAGE_KEY, next);
    applyThemeToDocument(next);
    notifyListeners();
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        locale,
        t: copy[locale],
        theme,
        resolvedTheme,
        setLocale,
        toggleLocale,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

export function DisplayControls({
  variant,
  compact = false,
}: {
  variant: "landing" | "sidebar";
  compact?: boolean;
}) {
  const { locale, t, resolvedTheme, toggleLocale, toggleTheme } = usePreferences();
  const isDark = resolvedTheme === "dark";
  const langAria =
    locale === "zh-CN" ? t.controls.switchToEnglish : t.controls.switchToChinese;
  const themeAria = isDark ? t.controls.switchToLight : t.controls.switchToDark;
  const themeLabel = isDark ? t.controls.lightLabel : t.controls.darkLabel;

  const buttonClass =
    variant === "sidebar" ? "sidebar-control-button" : "display-control-button";

  return (
    <div
      className={`display-controls ${variant === "sidebar" ? "sidebar-controls" : "landing-controls"}`}
      role="group"
      aria-label={t.controls.groupLabel}
    >
      <button
        type="button"
        className={buttonClass}
        aria-label={langAria}
        title={langAria}
        onClick={toggleLocale}
      >
        <svg
          className="ui-icon"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8" />
          <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        {!compact && (
          <span className="control-label">
            <span className={locale === "zh-CN" ? "pref-active" : undefined}>中文</span>
            {" / "}
            <span className={locale === "en" ? "pref-active" : undefined}>EN</span>
          </span>
        )}
      </button>
      <button
        type="button"
        className={buttonClass}
        aria-label={themeAria}
        title={themeAria}
        onClick={toggleTheme}
      >
        <svg
          className="ui-icon"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {isDark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
            </>
          ) : (
            <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
          )}
        </svg>
        {!compact && <span className="control-label">{themeLabel}</span>}
      </button>
    </div>
  );
}
