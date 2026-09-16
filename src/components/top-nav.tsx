"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function TopNav({ userName }: { userName: string }) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <Link href="/" className="text-lg font-bold text-[var(--brand-dark)]">
        المعلم X
      </Link>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-[var(--foreground)]/70">
          أهلًا، <span className="font-medium text-[var(--foreground)]">{userName}</span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
        >
          تسجيل الخروج
        </button>
      </div>
    </header>
  );
}
