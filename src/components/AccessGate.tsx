"use client";

import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, Mail, UserPlus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface StudioSession {
  email: string;
  signOut: () => Promise<void> | void;
}

interface AccessGateProps {
  children: (session: StudioSession) => ReactNode;
}

const localSessionKey = "geotex-studio-local-session";

export function AccessGate({ children }: AccessGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [sessionEmail, setSessionEmail] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(localSessionKey),
  );

  useEffect(() => {
    const client = getSupabaseClient();

    if (!client) return;

    client.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    window.localStorage.removeItem(localSessionKey);
    setSessionEmail(null);
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
    return children({ email: sessionEmail, signOut });
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
          <span className="gate-chip">TikZ-ready</span>
        </div>

        <div className="grid grid-cols-2 rounded-md border border-white/45 bg-white/20 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={mode === "login" ? "segmented-active" : "segmented-item"}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={mode === "register" ? "segmented-active" : "segmented-item"}
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

        {message ? <p className="text-sm font-medium text-stone-600">{message}</p> : null}
      </form>
    </div>
  );
}
