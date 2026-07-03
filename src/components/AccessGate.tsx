"use client";

import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, Mail, UserRound, UserPlus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface StudioSession {
  email: string;
  isGuest?: boolean;
  signOut: () => Promise<void> | void;
}

interface AccessGateProps {
  children: (session: StudioSession) => ReactNode;
}

const localSessionKey = "geotex-studio-local-session";
const guestSessionValue = "Guest";

export function AccessGate({ children }: AccessGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restoreLocalSession = () => {
      if (cancelled) return;
      const localSession = window.localStorage.getItem(localSessionKey);
      if (localSession) setSessionEmail(localSession);
    };

    window.queueMicrotask(restoreLocalSession);

    const client = getSupabaseClient();

    if (!client) {
      return () => {
        cancelled = true;
      };
    }

    client.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setSessionEmail(data.user?.email ?? window.localStorage.getItem(localSessionKey));
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSessionEmail(session?.user.email ?? window.localStorage.getItem(localSessionKey));
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    window.localStorage.removeItem(localSessionKey);
    setSessionEmail(null);
  }

  function continueAsGuest() {
    window.localStorage.setItem(localSessionKey, guestSessionValue);
    setSessionEmail(guestSessionValue);
    setMessage("");
  }

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage("Enter email and password.");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      window.localStorage.setItem(localSessionKey, normalizedEmail);
      setSessionEmail(normalizedEmail);
      return;
    }

    const { error } =
      mode === "register"
        ? await client.auth.signUp({ email: normalizedEmail, password })
        : await client.auth.signInWithPassword({ email: normalizedEmail, password });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSessionEmail(normalizedEmail);
  }

  async function sendLink() {
    const normalizedEmail = email.trim().toLowerCase();
    const client = getSupabaseClient();
    if (!client || !normalizedEmail) {
      setMessage("Enter email and password.");
      return;
    }

    const { error } = await client.auth.signInWithOtp({ email: normalizedEmail });
    setMessage(error ? error.message : "Check your inbox.");
  }

  if (sessionEmail) {
    return children({ email: sessionEmail, isGuest: sessionEmail === guestSessionValue, signOut });
  }

  return (
    <div className="gate-overlay-shell">
      <div className="gate-workspace-backdrop" aria-hidden="true" inert>
        {children({ email: "login-required", signOut: () => undefined })}
      </div>

      <form
        className="gate-card gate-modal-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="gate-brand-strip">
          <div>
            <p className="gate-eyebrow">GeoTeX Studio</p>
            <h1 className="gate-title">Open your figure workspace.</h1>
          </div>
        </div>

        <div className="gate-segmented">
          <button
            type="button"
            onClick={() => setMode("login")}
            aria-pressed={mode === "login"}
            className={mode === "login" ? "auth-tab-active" : "auth-tab"}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            aria-pressed={mode === "register"}
            className={mode === "register" ? "auth-tab-active" : "auth-tab"}
          >
            Register
          </button>
        </div>

        <label className="gate-field">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            className="gate-input"
          />
        </label>

        <label className="gate-field">
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="gate-input"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <button type="submit" className="icon-button h-11">
            {mode === "register" ? <UserPlus className="h-4 w-4" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
            {mode === "register" ? "Create account" : "Open Studio"}
          </button>

          <button type="button" onClick={() => void sendLink()} className="icon-button-secondary h-11">
            <Mail className="h-4 w-4" aria-hidden />
            Email link
          </button>
        </div>

        <button type="button" onClick={continueAsGuest} className="icon-button-secondary h-11 w-full">
          <UserRound className="h-4 w-4" aria-hidden />
          Continue as Guest
        </button>

        {message ? <p className="text-sm font-medium text-stone-600">{message}</p> : null}
      </form>
    </div>
  );
}
