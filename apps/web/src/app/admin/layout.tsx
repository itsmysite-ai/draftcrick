"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "./_components/AdminSidebar";
import { AdminLogin } from "./_components/AdminLogin";

/** Pages that support role can access */
const SUPPORT_ALLOWED_PATHS = ["/admin/users", "/admin/docs"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin, staffRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  // Not logged in or not admin/support — show login
  if (!user || !isAdmin) {
    return <AdminLogin />;
  }

  // Support role — restrict to allowed pages only
  const isSupport = staffRole === "support";
  if (isSupport && !SUPPORT_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
    // Redirect support users to users page
    if (typeof window !== "undefined") {
      router.replace("/admin/users");
    }
    return null;
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
