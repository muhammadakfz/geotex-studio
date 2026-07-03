"use client";

import { LogOut, UserRound } from "lucide-react";

interface UserMenuProps {
  user: { email?: string | null };
  onSignOut: () => void;
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  return (
    <div className="user-menu">
      <UserRound className="h-4 w-4" aria-hidden />
      <span className="user-email">{user.email}</span>
      <button
        type="button"
        onClick={onSignOut}
        title="Sign out"
        className="user-menu-button"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
