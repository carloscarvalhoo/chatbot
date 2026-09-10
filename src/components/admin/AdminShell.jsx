"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useAdminLogout } from "@/features/admin/auth/hooks/useAdminLogout";

const NAV = [
  { href: "/admin/files", label: "Base de conhecimento", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/admin/search", label: "Testar resposta", icon: "M9 3a6 6 0 104.5 10.5L18 18" },
  {
    href: "/admin/prompt",
    label: "Prompt do assistente",
    icon: "M4 5h12M4 9h12M4 13h8M4 17h6",
  },
  {
    href: "/admin/settings",
    label: "Configurações",
    icon: "M10 3v2m0 10v2M3 10h2m10 0h2M6 6l1.5 1.5M13 13l1.5 1.5",
  },
];

function NavList({ pathname, onNavigate }) {
  return (
    <nav className="space-y-1">
      {NAV.map(({ href, label, icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
              active
                ? "glass text-zinc-100"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ botName, children }) {
  const pathname = usePathname();
  const { logout } = useAdminLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen text-zinc-100">
      {/* Sidebar desktop */}
      <aside className="glass-subtle fixed inset-y-0 left-0 hidden w-60 flex-col border-y-0 border-l-0 px-4 py-6 lg:flex">
        <div className="flex items-center gap-2 px-3">
          <span className="text-sm font-semibold tracking-wide">{botName}</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
            Admin
          </span>
        </div>

        <div className="mt-8 flex-1">
          <NavList pathname={pathname} />
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path
              d="M8 4H4v12h4M14 10H8m6 0l-2.5-2.5M14 10l-2.5 2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sair
        </button>
      </aside>

      {/* Topbar mobile */}
      <header className="glass-subtle sticky top-0 z-40 flex items-center justify-between border-x-0 border-t-0 px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold">{botName} · Admin</span>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d={menuOpen ? "M5 5l10 10M15 5L5 15" : "M4 6h12M4 10h12M4 14h12"}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="glass-strong border-x-0 border-t-0 px-4 py-3 lg:hidden">
          <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-white/[0.03]"
          >
            Sair
          </button>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">{children}</div>
      </main>
    </div>
  );
}
