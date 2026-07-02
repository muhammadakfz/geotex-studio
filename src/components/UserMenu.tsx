"use client";

import { LogOut, UserRound } from "lucide-react";

interface UserMenuProps {
  user: { email?: string | null };
  onSignOut: () => void;
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
      <UserRound className="h-4 w-4 text-stone-600" aria-hidden />
      <span className="user-email max-w-[160px] truncate text-stone-700">{user.email}</span>
      <button
        type="button"
        onClick={onSignOut}
        title="Sign out"
        className="rounded-full p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
