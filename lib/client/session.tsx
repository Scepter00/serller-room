"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/client/api";
import { connectWallet, signMessageForAuth } from "@/lib/client/wallet";

export interface SessionProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarCid: string | null;
  moderationStatus: string;
}

export interface SessionUser {
  id: string;
  walletAddress: string;
  profile: SessionProfile | null;
}

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: SessionUser | null }>("/api/auth/me");
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ user, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

/**
 * Full wallet authentication flow:
 * connect → challenge → wallet signs → server verifies → session established.
 */
export async function authenticateWithWallet(): Promise<{
  user: SessionUser;
  isNewUser: boolean;
}> {
  const address = await connectWallet();

  const { nonce, message } = await api<{ nonce: string; message: string }>(
    "/api/auth/challenge",
    { method: "POST", body: { publicKey: address } }
  );

  const signature = await signMessageForAuth(message, address);

  const result = await api<{ user: SessionUser; isNewUser: boolean }>(
    "/api/auth/verify",
    { method: "POST", body: { publicKey: address, nonce, signature } }
  );

  return result;
}

export async function logout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore — local state is cleared regardless
  }
}

export { ApiError };
