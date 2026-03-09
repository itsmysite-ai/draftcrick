"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { AdminSidebar } from "./_components/AdminSidebar";
import { AdminLogin } from "./_components/AdminLogin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  // Not logged in or not admin — show login
  if (!user) {
    return <AdminLogin />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: "24px 32px", overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
