"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#hero-scenarios", label: "Try a scenario" },
];

export function AppShell({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("risk-copilot-theme");
    return stored === "light" ? "light" : "dark";
  });

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("risk-copilot-theme", theme);
  }, [theme]);

  return (
    <div className="appShell">
      <a href="#main-content" className="skipLink">
        Skip to content
      </a>
      <header className="appHeader">
        <div className="topbar">
          <div className="brandBlock">
            <Link href="/">
              <h1>Binance Risk Copilot</h1>
            </Link>
            <p>OpenClaw Futures risk review</p>
          </div>
          <nav id="main-nav" className={`navLinks ${isOpen ? "open" : ""}`} aria-label="Primary">
            {navItems.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`navLink ${item.href === "/#hero-scenarios" ? "navLinkDesktopOnly" : ""}`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              className="navUtility mobileThemeToggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                setIsOpen(false);
              }}
            >
              Theme: {theme}
            </button>
          </nav>
          <div className="headerActions">
            <Link href="/#hero-scenarios" className="quickActionLink" onClick={() => setIsOpen(false)}>
              Try a scenario
            </Link>
            <button
              type="button"
              className="themeToggle desktopThemeToggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme}
            </button>
            <button
              type="button"
              className="menuButton"
              aria-expanded={isOpen}
              aria-controls="main-nav"
              aria-label="Toggle navigation menu"
              onClick={() => setIsOpen((v) => !v)}
            >
              {isOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
