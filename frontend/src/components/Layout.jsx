import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { FlaskConical, History, Home as HomeIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const NavItem = ({ to, label, icon: Icon, testid }) => (
  <NavLink
    to={to}
    end
    data-testid={testid}
    className={({ isActive }) =>
      `group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
        isActive
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`
    }
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </NavLink>
);

export default function Layout() {
  return (
    <div className="min-h-screen bg-[hsl(210_40%_98%)] text-slate-900">
      <header
        data-testid="app-header"
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-rose-700 text-white shadow-sm">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-bold tracking-tight text-slate-900">
                Copper Strip Analyzer
              </div>
              <div className="text-xs text-slate-500">
                ASTM D130 / IP 154 — AI Vision Rating
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1" data-testid="main-nav">
            <NavItem to="/" label="Analyzer" icon={HomeIcon} testid="nav-analyzer" />
            <NavItem to="/history" label="History" icon={History} testid="nav-history" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          Built for laboratory technicians · ASTM D130 / IP 154 · Copper Strip Corrosion Rating.
        </div>
      </footer>

      <Toaster position="top-right" richColors />
    </div>
  );
}
