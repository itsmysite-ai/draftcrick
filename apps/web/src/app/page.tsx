import Link from "next/link";
import { DraftPlayLogoSVG } from "@/components/DraftPlayLogoSVG";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0A0B09" }}>
      {/* Header — Logo only */}
      <header
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "16px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DraftPlayLogoSVG size={40} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-data)", color: "#F7F5F0" }}>
              DraftPlay<span style={{ color: "#5DB882" }}>.ai</span>
            </span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "#9A9894", letterSpacing: 1.5, marginTop: 2 }}>
              All Thrill. Pure Skill.
            </span>
          </div>
        </div>
      </header>

      {/* Sticky Subheader — Tagline left, App buttons + CTA right */}
      <div
        className="landing-subheader"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 32px",
          background: "rgba(15, 17, 14, 0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Left: Day Pass highlight */}
        <span
          className="landing-subheader-tagline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-data)",
            fontSize: 12,
            letterSpacing: 0.5,
          }}
        >
          <span style={{ color: "#D4A43D", fontWeight: 700 }}>Day Pass — ₹69/24hr</span>
          <span style={{ color: "#5E5D5A" }}>|</span>
          <span style={{ color: "#9A9894" }}>Full Elite access, no subscription needed</span>
        </span>

        {/* Right: buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <a
          href="#"
          aria-label="Download on the App Store"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "6px 14px",
            borderRadius: 8,
            textDecoration: "none",
            color: "#F7F5F0",
          }}
        >
          <svg width="14" height="17" viewBox="0 0 14 17" fill="none">
            <path d="M11.53 8.94c-.01-1.5.8-2.22.83-2.25-.9-1.32-2.3-1.5-2.8-1.52-1.2-.12-2.33.7-2.94.7-.61 0-1.55-.69-2.55-.67-1.31.02-2.52.76-3.2 1.94-1.36 2.37-.35 5.87.98 7.8.65.94 1.42 1.99 2.44 1.95.98-.04 1.35-.63 2.53-.63 1.18 0 1.52.63 2.56.61 1.05-.01 1.73-.96 2.37-1.9.75-1.09 1.06-2.14 1.08-2.2-.02-.01-2.06-.79-2.08-3.13l.08-.7z" fill="#F7F5F0"/>
            <path d="M9.58 3.6c.54-.66.9-1.56.8-2.47-.78.03-1.72.52-2.27 1.17-.5.57-.93 1.49-.81 2.37.87.07 1.75-.44 2.28-1.07z" fill="#F7F5F0"/>
          </svg>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontSize: 7, fontFamily: "var(--font-body)", opacity: 0.6 }}>Download on</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-data)" }}>App Store</span>
          </span>
        </a>

        <a
          href="#"
          aria-label="Get it on Google Play"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "6px 14px",
            borderRadius: 8,
            textDecoration: "none",
            color: "#F7F5F0",
          }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
            <path d="M0.5 0.8L6.5 7 0.5 13.2V0.8z" fill="#5DB882"/>
            <path d="M9.2 5.5L6.5 7l2.7 1.5 2-1.1c.4-.2.4-.6 0-.8l-2-1.1z" fill="#FBBC04"/>
            <path d="M6.5 7L0.5 0.8l5.2 3.5L6.5 7z" fill="#EA4335"/>
            <path d="M6.5 7l-.8 2.7L0.5 13.2 6.5 7z" fill="#4285F4"/>
          </svg>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontSize: 7, fontFamily: "var(--font-body)", opacity: 0.6 }}>Get it on</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-data)" }}>Google Play</span>
          </span>
        </a>

        <Link
          href="/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#5DB882",
            color: "#0A0B09",
            padding: "6px 14px",
            borderRadius: 8,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="#0A0B09" stroke="#0A0B09" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontSize: 7, fontFamily: "var(--font-body)", opacity: 0.7 }}>Start Free</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-data)" }}>Trial</span>
          </span>
        </Link>
        </div>
      </div>

      {/* Hero */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 32px 40px",
        }}
      >
        {/* Anti-gambling badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(93, 184, 130, 0.1)",
            border: "1px solid rgba(93, 184, 130, 0.2)",
            padding: "6px 16px",
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-data)",
            color: "#5DB882",
            marginBottom: 32,
            letterSpacing: 0.5,
          }}
        >
          Proudly Anti-Gambling
        </div>

        {/* Tagline — green Gaming, red not Gambling */}
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(40px, 7vw, 80px)",
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: 900,
            marginBottom: 32,
            color: "#F7F5F0",
          }}
        >
          Fantasy Gaming.
          <br />
          <span style={{ color: "#E5484D" }}>Not Gambling.</span>
          <br />
          <a
            href="#"
            style={{
              display: "inline-block",
              color: "#F7F5F0",
              fontSize: "0.35em",
              fontFamily: "var(--font-data)",
              letterSpacing: 1,
              background: "linear-gradient(135deg, #D4A43D 0%, #C4942D 100%)",
              padding: "10px 28px",
              borderRadius: 24,
              marginTop: 12,
              textDecoration: "none",
              fontWeight: 700,
              boxShadow: "0 0 20px rgba(212, 164, 61, 0.35)",
            }}
          >
            ⚡ Day Pass — ₹69 for 24hr Elite Access
          </a>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#9A9894",
            maxWidth: 640,
            lineHeight: 1.7,
            marginBottom: 40,
            fontFamily: "var(--font-body)",
          }}
        >
          The fantasy sports platform where your knowledge wins — not your wallet.
          No deposits. No withdrawals. No state bans. Legal everywhere. Safe for everyone.
        </p>

        {/* CTA */}
        <div className="landing-hero-cta" style={{ marginBottom: 16 }}>
          <Link
            href="/register"
            style={{
              backgroundColor: "#5DB882",
              color: "#0A0B09",
              padding: "16px 36px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              fontFamily: "var(--font-data)",
            }}
          >
            Start 7-Day Free Trial
          </Link>
          <Link
            href="#pricing"
            style={{
              backgroundColor: "transparent",
              color: "#F7F5F0",
              padding: "16px 36px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 16,
              fontFamily: "var(--font-data)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            See Pricing
          </Link>
        </div>
        <p style={{ fontSize: 13, color: "#5E5D5A", fontFamily: "var(--font-data)" }}>
          No credit card required. Cancel anytime.
        </p>
      </main>

      {/* Manifesto Section */}
      <section
        style={{
          padding: "80px 32px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "linear-gradient(180deg, #0A0B09 0%, #0F110E 100%)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 13,
            fontWeight: 700,
            color: "#5DB882",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          Our Promise
        </h3>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(18px, 3vw, 24px)",
            color: "#F7F5F0",
            maxWidth: 720,
            margin: "0 auto",
            lineHeight: 1.7,
            fontWeight: 400,
          }}
        >
          Millions of sports fans have been told that fantasy gaming means risking real money.{" "}
          <span style={{ color: "#5DB882", fontWeight: 700 }}>We disagree.</span>{" "}
          DraftPlay exists because we believe the smartest mind should win — not the deepest pocket.
          We built tools that make you a better fantasy player, not a better gambler.
        </p>
      </section>

      {/* Why DraftPlay > Others */}
      <section
        style={{
          padding: "80px 32px",
          background: "#0F110E",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 13,
            fontWeight: 700,
            color: "#5DB882",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          The DraftPlay Difference
        </h3>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 800,
            color: "#F7F5F0",
            textAlign: "center",
            marginBottom: 56,
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          The fantasy app your parents{" "}
          <span style={{ color: "#5DB882" }}>won&apos;t</span> worry about.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: "🧠",
              title: "Smart Tools, Better Decisions",
              desc: "Team solver, projected points, captain picks, head-to-head analysis — everything you need to play smarter.",
            },
            {
              icon: "🛡️",
              title: "No Deposits. No Withdrawals.",
              desc: "Pop Coins are earned by playing, never bought with real money. You can\u2019t lose what you never deposit.",
            },
            {
              icon: "🗺️",
              title: "Legal in Every Indian State",
              desc: "No gambling = no state bans. Play from Andhra Pradesh, Telangana, Assam, or anywhere else. Zero restrictions.",
            },
            {
              icon: "💰",
              title: "\u20B90.79/Day, Not \u20B9500/Match",
              desc: "One affordable subscription. No surprise charges, no entry fees in rupees, no \"just one more contest\" trap.",
            },
            {
              icon: "🏆",
              title: "Prove You Know the Game",
              desc: "Compete on leaderboards, climb tiers, build streaks. Bragging rights > gambling receipts.",
            },
            {
              icon: "👨\u200D👩\u200D👧\u200D👦",
              title: "Safe for All Ages",
              desc: "No real-money risk means students, families, and casual sports fans can play without guilt or financial anxiety.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                padding: 28,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.06)",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{feature.icon}</div>
              <h4
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "#F7F5F0",
                }}
              >
                {feature.title}
              </h4>
              <p style={{ color: "#9A9894", fontSize: 14, lineHeight: 1.6, fontFamily: "var(--font-body)" }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Strip */}
      <section
        style={{
          padding: "64px 32px",
          background: "#0A0B09",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 13,
            fontWeight: 700,
            color: "#5DB882",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 40,
            textAlign: "center",
          }}
        >
          Typical Fantasy Apps vs DraftPlay
        </h3>
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {[
            { them: "Deposit \u20B9500 to play", us: "Earn coins by playing" },
            { them: "Lose real money every match", us: "Zero financial risk" },
            { them: "Banned in 6+ states", us: "Legal in every state" },
            { them: "You pick blindly", us: "Smart tools tell you who to pick and why" },
            { them: "Pay per contest entry", us: "One subscription, unlimited play" },
            { them: "Addictive cash loops", us: "Healthy competition & bragging rights" },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <div
                className="landing-comparison-cell"
                style={{
                  color: "#E5484D",
                  fontFamily: "var(--font-body)",
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(229, 72, 77, 0.3)",
                  opacity: 0.7,
                }}
              >
                {row.them}
              </div>
              <div
                className="landing-comparison-cell"
                style={{
                  color: "#5DB882",
                  fontWeight: 600,
                  fontFamily: "var(--font-data)",
                }}
              >
                {row.us}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        style={{
          padding: "80px 32px",
          textAlign: "center",
          background: "linear-gradient(180deg, #0A0B09 0%, #0F110E 100%)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 13,
            fontWeight: 700,
            color: "#5DB882",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Simple Pricing
        </h3>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 800,
            color: "#F7F5F0",
            marginBottom: 16,
          }}
        >
          Less than a cup of chai per day.
        </h2>
        <p style={{ fontSize: 16, color: "#9A9894", marginBottom: 48, fontFamily: "var(--font-body)" }}>
          Start with a 7-day free trial. No credit card required.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 20,
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          {[
            {
              tier: "Basic",
              price: "\u20B9289",
              period: "/year",
              perDay: "\u20B90.79/day",
              features: ["Guru (5 questions/day)", "1 team per match", "Daily coin rewards", "Full match coverage"],
              accent: false,
            },
            {
              tier: "Pro",
              price: "\u20B9889",
              period: "/year",
              perDay: "\u20B92.43/day",
              features: ["Guru (25 questions/day)", "3 teams per match", "Team Solver", "Captain Picks", "50 coins/day"],
              accent: true,
            },
            {
              tier: "Elite",
              price: "\u20B91,899",
              period: "/year",
              perDay: "\u20B95.20/day",
              features: ["Unlimited Guru", "5 teams per match", "All smart tools", "Priority features", "100 coins/day"],
              accent: false,
            },
          ].map((plan) => (
            <div
              key={plan.tier}
              style={{
                backgroundColor: plan.accent ? "rgba(93, 184, 130, 0.08)" : "rgba(255,255,255,0.03)",
                padding: 28,
                borderRadius: 16,
                border: plan.accent ? "1px solid rgba(93, 184, 130, 0.3)" : "1px solid rgba(255,255,255,0.06)",
                textAlign: "left",
                position: "relative",
              }}
            >
              {plan.accent && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#5DB882",
                    color: "#0A0B09",
                    padding: "4px 12px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "var(--font-data)",
                  }}
                >
                  MOST POPULAR
                </div>
              )}
              <p style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: "#5DB882", marginBottom: 4 }}>
                {plan.tier}
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 32, fontWeight: 800, color: "#F7F5F0" }}>
                  {plan.price}
                </span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#5E5D5A" }}>
                  {plan.period}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#5E5D5A", marginBottom: 20 }}>
                That&apos;s just {plan.perDay}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontSize: 13,
                      color: "#9A9894",
                      fontFamily: "var(--font-body)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "#5DB882", fontSize: 14 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Day Pass */}
        <div
          style={{
            marginTop: 32,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "12px 24px",
            borderRadius: 12,
          }}
        >
          <span style={{ fontSize: 14, color: "#9A9894", fontFamily: "var(--font-body)" }}>
            Need Elite for a big game day?
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#5DB882", fontFamily: "var(--font-data)" }}>
            Day Pass — ₹69 for 24 hours
          </span>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          padding: "80px 32px",
          textAlign: "center",
          background: "#0F110E",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(28px, 5vw, 52px)",
            fontWeight: 800,
            color: "#F7F5F0",
            marginBottom: 16,
            maxWidth: 700,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Ready to play <span style={{ color: "#5DB882" }}>smarter</span>?
        </h2>
        <p style={{ fontSize: 16, color: "#9A9894", marginBottom: 32, fontFamily: "var(--font-body)" }}>
          Join thousands of sports fans who chose intelligence over gambling.
        </p>
        <Link
          href="/register"
          style={{
            backgroundColor: "#5DB882",
            color: "#0A0B09",
            padding: "16px 40px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 16,
            fontFamily: "var(--font-data)",
            display: "inline-block",
          }}
        >
          Start 7-Day Free Trial
        </Link>
        <p style={{ fontSize: 13, color: "#5E5D5A", marginTop: 12, fontFamily: "var(--font-data)" }}>
          No deposits. No withdrawals. No regrets.
        </p>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "24px 32px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
          color: "#5E5D5A",
          fontSize: 13,
          fontFamily: "var(--font-data)",
          background: "#0A0B09",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 8 }}>
          <Link href="/legal/terms" style={{ color: "#5E5D5A", fontSize: 13 }}>
            Terms of Service
          </Link>
          <Link href="/legal/privacy" style={{ color: "#5E5D5A", fontSize: 13 }}>
            Privacy Policy
          </Link>
        </div>
        &copy; {new Date().getFullYear()} DraftPlay.ai. All rights reserved.
      </footer>
    </div>
  );
}
