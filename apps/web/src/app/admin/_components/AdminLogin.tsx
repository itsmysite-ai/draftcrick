"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DraftPlayLogoSVG } from "@/components/DraftPlayLogoSVG";

export function AdminLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          padding: 32,
          backgroundColor: "var(--bg-surface)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <DraftPlayLogoSVG size={28} animate={false} />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>DraftPlay Admin</h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
          Sign in with your admin account
        </p>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              marginBottom: 16,
              backgroundColor: "rgba(229, 72, 77, 0.1)",
              border: "1px solid var(--red)",
              borderRadius: 6,
              color: "var(--red)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: 16,
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 14,
            backgroundColor: "var(--bg)",
            color: "var(--text-primary)",
          }}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: 24,
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 14,
            backgroundColor: "var(--bg)",
            color: "var(--text-primary)",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
