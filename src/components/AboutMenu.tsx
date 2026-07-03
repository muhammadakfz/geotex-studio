"use client";

import { Code2, ExternalLink, GitFork, Info, KeyRound, Keyboard, QrCode, UserRound, X } from "lucide-react";
import { useState } from "react";
import type { StudioSession } from "@/components/AccessGate";
import { getSupabaseClient } from "@/lib/supabase/client";

interface AboutMenuProps {
  user: StudioSession;
  cloudEnabled: boolean;
  onMessage: (message: string) => void;
}

const shortcuts = [
  ["V", "Select"],
  ["H", "Pan"],
  ["P", "Point"],
  ["B", "Pen"],
  ["S", "Line tools"],
  ["C", "Shape tools"],
  ["Q", "Angle"],
  ["Cmd/Ctrl Z", "Undo"],
  ["Cmd/Ctrl A", "Select all"],
];

export function AboutMenu({ user, cloudEnabled, onMessage }: AboutMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendResetLink() {
    const client = getSupabaseClient();
    const resetEmail = user.email?.trim();
    if (!client || !cloudEnabled || user.isGuest || !resetEmail) {
      onMessage("Password reset needs a signed-in cloud account.");
      return;
    }

    setBusy(true);
    const { error } = await client.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    onMessage(error ? error.message : "Password reset link sent.");
  }

  return (
    <div className="about-menu">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="About"
        className="icon-button-secondary shrink-0"
        aria-expanded={open}
      >
        <Info className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">About</span>
      </button>

      {open ? (
        <section className="about-card" aria-label="About GeoTeX Studio">
          <div className="about-card-header">
            <div>
              <p className="gate-eyebrow">GeoTeX Studio</p>
              <h2 className="about-title">Workspace info</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} title="Close" className="mini-icon-button">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="about-section">
            <div className="about-section-title">
              <Keyboard className="h-4 w-4" aria-hidden />
              Shortcuts
            </div>
            <div className="shortcut-grid">
              {shortcuts.map(([key, label]) => (
                <div key={key} className="shortcut-row">
                  <kbd>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="about-section">
            <div className="about-section-title">
              <UserRound className="h-4 w-4" aria-hidden />
              User
            </div>
            <div className="about-copy">{user.email}</div>
            <button
              type="button"
              onClick={() => void sendResetLink()}
              disabled={busy || !cloudEnabled || user.isGuest}
              className="icon-button-secondary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-45"
            >
              <KeyRound className="h-4 w-4" aria-hidden />
              Reset password
            </button>
          </div>

          <div className="about-section about-developer-section">
            <div className="about-section-title">
              <Code2 className="h-4 w-4" aria-hidden />
              Developer
            </div>
            <div className="developer-link-grid">
              <a
                href="https://github.com/muhammadakfz"
                target="_blank"
                rel="noreferrer"
                className="developer-link"
              >
                <span className="developer-link-icon">
                  <GitFork className="h-4 w-4" aria-hidden />
                </span>
                <span className="developer-link-copy">
                  <strong>GitHub</strong>
                  <small>@muhammadakfz</small>
                </span>
                <ExternalLink className="developer-link-arrow h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://saweria.co/widgets/qr?streamKey=9bb55869a41172809fe68250f80742d6"
                target="_blank"
                rel="noreferrer"
                className="developer-link"
              >
                <span className="developer-link-icon">
                  <QrCode className="h-4 w-4" aria-hidden />
                </span>
                <span className="developer-link-copy">
                  <strong>Donate</strong>
                  <small>Support via QR</small>
                </span>
                <ExternalLink className="developer-link-arrow h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
