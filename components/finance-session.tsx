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
import type { Store } from "../shared/finance";

function useSession() {
  const auth = useRef<PublicClientApplication | null>(null);
  const initialization = useRef<Promise<boolean> | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const generation = useRef(0);
  const loadedAt = useRef(0);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (afterSave = false) => {
    const client = auth.current;
    if (!client) throw new Error("登录尚未就绪");
    if (pending.current && !afterSave) return pending.current;
    if (afterSave) generation.current++;
    const currentGeneration = generation.current;
    const load = (async () => {
      try {
        const response = await request(client, "bootstrap");
        const raw: unknown = await response.json();
        const value = storeSchema.parse(raw);
        if (generation.current === currentGeneration) {
          setStore(value);
          loadedAt.current = Date.now();
          setError("");
        }
      } catch (error) {
        if (
          generation.current === currentGeneration &&
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          setStore(null);
        throw error;
      }
    })();
    pending.current = load;
    try {
      await load;
    } finally {
      if (pending.current === load) pending.current = null;
    }
  }, []);

  const refreshIfStale = useCallback(async () => {
    if (!loadedAt.current || Date.now() - loadedAt.current < 60_000) return;
    loadedAt.current = 0;
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
        if (active) setError(error instanceof Error ? error.message : "操作失败，请重试");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const signOut = async () => {
    generation.current++;
    pending.current = null;
    loadedAt.current = 0;
    setStore(null);
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
    refresh,
    refreshIfStale,
    signOut,
  };
}

const FinanceSession = createContext<ReturnType<typeof useSession> | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  return <FinanceSession.Provider value={session}>{children}</FinanceSession.Provider>;
}

export function useFinanceSession() {
  const session = useContext(FinanceSession);
  const refreshIfStale = session?.refreshIfStale;
  const setError = session?.setError;
  useEffect(() => {
    void refreshIfStale?.().catch((error: unknown) =>
      setError?.(error instanceof Error ? error.message : "操作失败，请重试"),
    );
  }, [refreshIfStale, setError]);
  if (!session) throw new Error("FinanceProvider is required");
  return session;
}
