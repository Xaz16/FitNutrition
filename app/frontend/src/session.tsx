import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from './api/client';
import type { AuthResponse, SessionUser } from './api/types';

interface Session {
  user: SessionUser | null;
  ready: boolean;
  signIn: (mode: 'login' | 'register', email: string, password: string) => Promise<SessionUser>;
  signOut: () => void;
  markProfileFilled: () => void;
}

const SessionContext = createContext<Session | null>(null);

const CURRENT_PLAN_KEY = 'fns.currentPlan';

export const currentPlan = {
  get(): string | null {
    try {
      return localStorage.getItem(CURRENT_PLAN_KEY);
    } catch {
      return null;
    }
  },
  set(id: string | null) {
    try {
      if (id) {
        localStorage.setItem(CURRENT_PLAN_KEY, id);
      } else {
        localStorage.removeItem(CURRENT_PLAN_KEY);
      }
    } catch {
      return;
    }
  },
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(() => tokenStore.get() === null);

  const signOut = useCallback(() => {
    tokenStore.set(null);
    currentPlan.set(null);
    setUser(null);
    client.clear();
  }, [client]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) {
      return;
    }
    api<SessionUser>('/auth/me')
      .then(setUser)
      .catch(() => signOut())
      .finally(() => setReady(true));
  }, [signOut]);

  const signIn = useCallback(async (mode: 'login' | 'register', email: string, password: string) => {
    const result = await api<AuthResponse>(`/auth/${mode}`, { method: 'POST', body: { email, password } });
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const markProfileFilled = useCallback(() => setUser((u) => (u ? { ...u, hasProfile: true } : u)), []);

  const value = useMemo(() => ({ user, ready, signIn, signOut, markProfileFilled }), [user, ready, signIn, signOut, markProfileFilled]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return session;
}
