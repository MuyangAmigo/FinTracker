"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PublicClientApplication } from "@azure/msal-browser";
import { ApiError, configured, createAuth, request, storeSchema } from "../lib/client";
import { copy, getDocumentLocale } from "../lib/i18n";
import type { Store } from "../shared/finance";
import { PreferencesProvider } from "./preferences";

function useSession() {
  const auth = useRef<PublicClientApplication | null>(null);
  const initialization = useRef<Promise<boolean> | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const generation = useRef(0);
  const loadedAt = useRef(0);
  const storeRef = useRef<Store | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const invalidate = useCallback(() => {
    generation.current++;
    pending.current = null;
    loadedAt.current = 0;
    storeRef.current = null;
    setStore(null);
    setLoading(false);
  }, []);

  const apiRequest = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const client = auth.current;
      if (!client) throw new Error(copy[getDocumentLocale()].auth.notReady);
      try {
        return await request(client, path, method, body);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403))
          invalidate();
        throw error;
      }
    },
    [invalidate],
  );

  const refresh = useCallback(
    async (afterSave = false) => {
      if (pending.current && !afterSave) return pending.current;
      if (afterSave) generation.current++;
      const currentGeneration = generation.current;
      const coldLoad = !storeRef.current;
      if (coldLoad) {
        setLoading(true);
        setError("");
      }
      const load = (async () => {
        const response = await apiRequest("bootstrap");
        const raw: unknown = await response.json();
        const value = storeSchema.parse(raw);
        if (generation.current === currentGeneration) {
          storeRef.current = value;
          setStore(value);
          loadedAt.current = Date.now();
          setError("");
        }
      })();
      pending.current = load;
      try {
        await load;
      } finally {
        if (pending.current === load) pending.current = null;
        if (coldLoad && generation.current === currentGeneration) setLoading(false);
      }
    },
    [apiRequest],
  );

  const refreshIfStale = useCallback(async () => {
    if (!loadedAt.current || Date.now() - loadedAt.current < 60_000) return;
    storeRef.current = null;
    setStore(null);
    setLoading(true);
    try {
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const client = (auth.current ??= createAuth());
    initialization.current ??= (async () => {
      await client.initialize();
      const result = await client.handleRedirectPromise();
      const account = result?.account ?? client.getAllAccounts()[0];
      if (!account) return false;
      client.setActiveAccount(account);
      return true;
    })();
    void (async () => {
      try {
        if ((await initialization.current) && active) {
          setSignedIn(true);
          await refresh();
        }
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : copy[getDocumentLocale()].auth.genericError,
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const signOut = async () => {
    invalidate();
    setSignedIn(false);
    setError("");
    await auth.current?.logoutRedirect();
  };

  return {
    auth,
    signedIn,
    loading,
    store,
    error,
    setError,
    apiRequest,
    refresh,
    refreshIfStale,
    signOut,
    sidebarCollapsed,
    setSidebarCollapsed,
  };
}

const FinanceSession = createContext<ReturnType<typeof useSession> | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  return (
    <PreferencesProvider>
      <FinanceSession.Provider value={session}>{children}</FinanceSession.Provider>
    </PreferencesProvider>
  );
}

export function useFinanceSession() {
  const session = useContext(FinanceSession);
  const refreshIfStale = session?.refreshIfStale;
  const setError = session?.setError;
  useEffect(() => {
    void refreshIfStale?.().catch((error: unknown) =>
      setError?.(
        error instanceof Error
          ? error.message
          : copy[getDocumentLocale()].auth.genericError,
      ),
    );
  }, [refreshIfStale, setError]);
  if (!session) throw new Error("FinanceProvider is required");
  return session;
}
