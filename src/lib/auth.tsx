import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { AuthSheet } from "@/components/treatme/AuthSheet";

interface OpenOptions {
  /** the lowercase headline at the top of the sheet. */
  headline?: string;
  /** one lowercase line explaining why we're asking. */
  reason?: string;
  /** runs once the user is signed in and set up. */
  onDone?: () => void;
  /** runs when the sheet closes without finishing. */
  onDismiss?: () => void;
}


interface AuthState {
  user: User | null;
  ready: boolean;
  openAuth: (options?: OpenOptions) => void;
  closeAuth: () => void;
  /** runs the action when signed in, otherwise opens the sheet and runs it after. */
  requireAuth: (action: () => void, reason?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OpenOptions>({});

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const openAuth = useCallback((next?: OpenOptions) => {
    setOptions(next ?? {});
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => setOpen(false), []);

  const requireAuth = useCallback(
    (action: () => void, reason?: string) => {
      if (user) {
        action();
        return;
      }
      openAuth({ reason, onDone: action });
    },
    [openAuth, user],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, openAuth, closeAuth, requireAuth, signOut }),
    [user, ready, openAuth, closeAuth, requireAuth, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthSheet
        open={open}
        reason={options.reason}
        onClose={() => {
          setOpen(false);
          const dismissed = options.onDismiss;
          setOptions({});
          dismissed?.();
        }}

        onDone={() => {
          setOpen(false);
          const done = options.onDone;
          setOptions({});
          done?.();
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
