"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DraftPlayLogoSVG } from "@/components/DraftPlayLogoSVG";

const NAV_ITEMS: { href: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: "~", adminOnly: true },
  { href: "/admin/tournaments", label: "Tournaments", icon: "T", adminOnly: true },
  { href: "/admin/matches", label: "Matches", icon: "M", adminOnly: true },
  { href: "/admin/players", label: "Players", icon: "P", adminOnly: true },
  { href: "/admin/contests", label: "Contests", icon: "C", adminOnly: true },
  { href: "/admin/leagues", label: "Admin Leagues", icon: "G", adminOnly: true },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "★", adminOnly: true },
  { href: "/admin/config", label: "Config", icon: "#", adminOnly: true },
  { href: "/admin/league-config", label: "League Config", icon: "L", adminOnly: true },
  { href: "/admin/users", label: "Users", icon: "U" },
  { href: "/admin/system", label: "System", icon: "S", adminOnly: true },
  { href: "/admin/revenue", label: "Revenue", icon: "$", adminOnly: true },
  { href: "/admin/pricing-calculator", label: "Pricing Calc", icon: "%", adminOnly: true },
  { href: "/admin/docs", label: "Docs", icon: "?" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, signOut, staffRole } = useAuth();
  const isSupport = staffRole === "support";
  const visibleItems = isSupport ? NAV_ITEMS.filter((item) => !item.adminOnly) : NAV_ITEMS;

  return (
    <aside
      style={{
        width: 220,
        backgroundColor: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 0",
      }}
    >
      <div style={{ padding: "0 16px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <DraftPlayLogoSVG size={24} animate={false} />
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>DraftPlay Admin</h2>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {user?.email}
        </p>
      </div>

      <nav style={{ flex: 1, padding: "8px 0" }}>
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                fontSize: 14,
                color: isActive ? "var(--accent)" : "var(--text-primary)",
                backgroundColor: isActive ? "var(--bg)" : "transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span style={{ fontFamily: "var(--font-data)", width: 20, textAlign: "center" }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={signOut}
          style={{
            width: "100%",
            padding: "8px",
            fontSize: 13,
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
