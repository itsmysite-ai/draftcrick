"use client";

import Link from "next/link";
import { DraftPlayLogoSVG } from "@/components/DraftPlayLogoSVG";
import { useEffect, useRef, useState } from "react";

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", stagger = false }: { children: React.ReactNode; className?: string; stagger?: boolean }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`${stagger ? "reveal-stagger" : "reveal"} ${className}`}>
      {children}
    </div>
  );
}

const APP_URL = "https://app.draftplay.ai";

/* Particle constellation background */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number; y: number;
      vx: number; vy: number;
      radius: number;
      opacity: number;
      pulseSpeed: number;
      pulseOffset: number;
    }> = [];

    const PARTICLE_COUNT = 140;
    const CONNECTION_DISTANCE = 180;
    const MOUSE_RADIUS = 250;
    let mouse = { x: -1000, y: -1000 };

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function initParticles() {
      if (!canvas) return;
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 0.8,
          opacity: Math.random() * 0.5 + 0.35,
          pulseSpeed: Math.random() * 0.02 + 0.01,
          pulseOffset: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw(time: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      const particleColor = isDark ? "93, 184, 130" : "35, 120, 70";
      const lineColor = isDark ? "93, 184, 130" : "35, 120, 70";

      const w = canvas.width;
      const h = canvas.height;

      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Subtle mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.02;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Dampen velocity
        p.vx *= 0.999;
        p.vy *= 0.999;

        // Pulsing opacity
        const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.3 + 0.7;
        const alpha = p.opacity * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleColor}, ${alpha})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j]!;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.25;
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.strokeStyle = `rgba(${lineColor}, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }

        // Connect to mouse
        const dx = pi.x - mouse.x;
        const dy = pi.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const alpha = (1 - dist / MOUSE_RADIUS) * 0.35;
          ctx.beginPath();
          ctx.moveTo(pi.x, pi.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${particleColor}, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    function handleMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function handleMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    resize();
    initParticles();
    animationId = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

/* Reusable App Store buttons */
function StoreButtons({ size = "normal" }: { size?: "normal" | "large" }) {
  const isLarge = size === "large";
  return (
    <div style={{ display: "flex", gap: isLarge ? 12 : 10, flexWrap: "wrap", justifyContent: "center" }}>
      <a href="#" className="store-btn" aria-label="Download on App Store" style={isLarge ? { padding: "12px 20px" } : {}}>
        <svg width={isLarge ? 18 : 14} height={isLarge ? 21 : 17} viewBox="0 0 14 17" fill="none">
          <path d="M11.53 8.94c-.01-1.5.8-2.22.83-2.25-.9-1.32-2.3-1.5-2.8-1.52-1.2-.12-2.33.7-2.94.7-.61 0-1.55-.69-2.55-.67-1.31.02-2.52.76-3.2 1.94-1.36 2.37-.35 5.87.98 7.8.65.94 1.42 1.99 2.44 1.95.98-.04 1.35-.63 2.53-.63 1.18 0 1.52.63 2.56.61 1.05-.01 1.73-.96 2.37-1.9.75-1.09 1.06-2.14 1.08-2.2-.02-.01-2.06-.79-2.08-3.13l.08-.7z" fill="currentColor"/>
          <path d="M9.58 3.6c.54-.66.9-1.56.8-2.47-.78.03-1.72.52-2.27 1.17-.5.57-.93 1.49-.81 2.37.87.07 1.75-.44 2.28-1.07z" fill="currentColor"/>
        </svg>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: isLarge ? 9 : 7, fontFamily: "var(--font-body)", opacity: 0.6 }}>Download on</span>
          <span style={{ fontSize: isLarge ? 14 : 11, fontWeight: 700, fontFamily: "var(--font-data)" }}>App Store</span>
        </span>
      </a>
      <a href="#" className="store-btn" aria-label="Get it on Google Play" style={isLarge ? { padding: "12px 20px" } : {}}>
        <svg width={isLarge ? 16 : 12} height={isLarge ? 18 : 14} viewBox="0 0 505 584" fill="none">
          <path d="M18.9 4.2c-7.3 4-12.5 12-12.5 22v531.6c0 10 5.2 18 12.5 22l1.3.7L295 292.7v-1.4L20.2 3.5l-1.3.7z" fill="#4285F4"/>
          <path d="M386.8 384.5L295 292.7v-1.4l91.8-91.8.7.4 108.8 61.8c31.1 17.7 31.1 46.6 0 64.3L387.5 384.1l-.7.4z" fill="#FBBC04"/>
          <path d="M387.5 384.1L295 291.6 18.9 567.8c10.2 10.8 27.1 12.2 46.1 1.3l322.5-185z" fill="#EA4335"/>
          <path d="M387.5 199.9L65 14.9C46.1 3.8 29.1 5.2 18.9 16l276 275.7 92.6-91.8z" fill="#34A853"/>
        </svg>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: isLarge ? 9 : 7, fontFamily: "var(--font-body)", opacity: 0.6 }}>Get it on</span>
          <span style={{ fontSize: isLarge ? 14 : 11, fontWeight: 700, fontFamily: "var(--font-data)" }}>Google Play</span>
        </span>
      </a>
    </div>
  );
}

/* Theme toggle */
function ThemeToggle({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="theme-toggle"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 980,
        padding: "6px 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 16,
        transition: "background 0.2s ease",
        color: "var(--text-primary)",
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export default function HomePage() {
  const navRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("dp-theme");
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dp-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current) {
        navRef.current.classList.toggle("visible", window.scrollY > 400);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="landing-root" style={{ minHeight: "100vh" }}>
      {/* Particle constellation background */}
      <ParticleCanvas />

      <div className="landing-content">
      {/* Floating frosted-glass nav — appears on scroll */}
      <div ref={navRef} className="nav-sticky">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DraftPlayLogoSVG size={28} />
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
            DraftPlay<span style={{ color: "var(--lp-accent)" }}>.ai</span>
          </span>
        </div>
        <span className="nav-tagline" style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--lp-gold)", fontWeight: 600 }}>
          Day Pass — ₹69/24hr
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <StoreButtons />
          <Link href={`${APP_URL}/auth/login`} className="btn-primary" style={{ padding: "10px 20px", fontSize: 13, borderRadius: 980 }}>
            Start Free Trial
          </Link>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
      </div>

      {/* Hero — full viewport */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 32px",
          position: "relative",
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, var(--lp-glow) 0%, transparent 70%)",
        }}
      >
        {/* Hero glow */}
        <div className="hero-glow" />

        {/* Theme toggle in top-right */}
        <div style={{ position: "absolute", top: 20, right: 24, zIndex: 2 }}>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48, animation: "fadeIn 1s ease" }}>
          <DraftPlayLogoSVG size={48} />
          <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
            <span style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
              DraftPlay<span style={{ color: "var(--lp-accent)" }}>.ai</span>
            </span>
            <span style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--lp-muted)", letterSpacing: 2 }}>
              ALL THRILL. PURE SKILL.
            </span>
          </div>
        </div>

        {/* Badge */}
        <div className="badge-pill" style={{ marginBottom: 40, animation: "fadeInUp 0.8s ease 0.2s both" }}>
          Proudly Anti-Betting
        </div>

        {/* Main heading */}
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(44px, 8vw, 96px)",
            fontWeight: 800,
            lineHeight: 1.0,
            maxWidth: 900,
            marginBottom: 24,
            color: "var(--text-primary)",
            animation: "fadeInUp 0.8s ease 0.3s both",
          }}
        >
          Fantasy Gaming.
          <br />
          <span style={{ color: "var(--lp-red)" }}>Not Betting.</span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "var(--lp-secondary)",
            maxWidth: 580,
            lineHeight: 1.7,
            marginBottom: 48,
            fontFamily: "var(--font-body)",
            animation: "fadeInUp 0.8s ease 0.5s both",
          }}
        >
          The fantasy sports platform where your knowledge wins — not your wallet.
          No deposits. No withdrawals. Legal everywhere.
        </p>

        {/* CTAs */}
        <div className="landing-hero-cta" style={{ display: "flex", gap: 16, marginBottom: 16, animation: "fadeInUp 0.8s ease 0.6s both" }}>
          <Link href={`${APP_URL}/auth/login`} className="btn-primary">
            Start 7-Day Free Trial
          </Link>
          <a href="#pricing" className="btn-secondary">
            See Pricing
          </a>
        </div>

        {/* Day Pass */}
        <div style={{ animation: "fadeInUp 0.8s ease 0.7s both", marginBottom: 24 }}>
          <a href={`${APP_URL}/subscription`} className="btn-gold">
            ⚡ Day Pass — ₹69 for 24hr Elite Access
          </a>
        </div>

        {/* App Store buttons — prominent in hero */}
        <div style={{ animation: "fadeInUp 0.8s ease 0.8s both", marginBottom: 16 }}>
          <StoreButtons size="large" />
        </div>

        <p style={{ fontSize: 13, color: "var(--lp-muted)", fontFamily: "var(--font-data)", animation: "fadeIn 1s ease 0.9s both" }}>
          No credit card required. Cancel anytime.
        </p>

      </section>

      {/* Manifesto — editorial 2-col */}
      <section className="section-spacing" style={{ background: "var(--lp-bg-alt)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div className="editorial-grid">
              <div>
                <p className="section-label" style={{ textAlign: "left" }}>Our Promise</p>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "clamp(20px, 2.5vw, 28px)",
                  color: "var(--text-primary)",
                  lineHeight: 1.7,
                  fontWeight: 400,
                }}
              >
                Millions of sports fans have been told that fantasy gaming means risking real money.{" "}
                <span style={{ color: "var(--lp-accent)", fontWeight: 700 }}>We disagree.</span>{" "}
                DraftPlay exists because we believe the smartest mind should win — not the deepest pocket.
                We built tools that make you a better fantasy player, not a better bettor.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features — left-aligned, full-width grid */}
      <section className="section-spacing" style={{ background: "var(--lp-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal>
            <p className="section-label" style={{ textAlign: "left" }}>The DraftPlay Difference</p>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(28px, 4.5vw, 52px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                textAlign: "left",
                marginBottom: 72,
                maxWidth: 650,
              }}
            >
              The fantasy app your parents{" "}
              <span style={{ color: "var(--lp-accent)" }}>won&apos;t</span> worry about.
            </h2>
          </Reveal>

          <Reveal stagger>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
              {[
                { icon: "🧠", title: "Smart Tools, Better Decisions", desc: "Team solver, projected points, captain picks, head-to-head analysis — everything you need to play smarter." },
                { icon: "🛡️", title: "No Deposits. No Withdrawals.", desc: "Pop Coins are earned by playing, never bought with real money. You can\u2019t lose what you never deposit." },
                { icon: "🗺️", title: "Legal in Every Indian State", desc: "No betting = no state bans. Play from Andhra Pradesh, Telangana, Assam, or anywhere else. Zero restrictions." },
                { icon: "💰", title: "\u20B90.79/Day, Not \u20B9500/Match", desc: "One affordable subscription. No surprise charges, no entry fees, no \"just one more contest\" trap." },
                { icon: "🏆", title: "Prove You Know the Game", desc: "Compete on leaderboards, climb tiers, build streaks. Bragging rights > betting receipts." },
                { icon: "👨\u200D👩\u200D👧\u200D👦", title: "Safe for All Ages", desc: "No real-money risk means students, families, and casual sports fans can play without guilt or financial anxiety." },
              ].map((feature) => (
                <div key={feature.title} className="feature-card reveal-child">
                  <div style={{ fontSize: 32, marginBottom: 16 }}>{feature.icon}</div>
                  <h4 style={{ fontFamily: "var(--font-data)", fontSize: 17, fontWeight: 700, marginBottom: 10, color: "var(--text-primary)" }}>
                    {feature.title}
                  </h4>
                  <p style={{ color: "var(--lp-secondary)", fontSize: 14, lineHeight: 1.7, fontFamily: "var(--font-body)" }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Comparison — editorial header, full-width table */}
      <section className="section-spacing" style={{ background: "var(--lp-bg-alt)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div className="editorial-grid" style={{ marginBottom: 56 }}>
              <div>
                <p className="section-label" style={{ textAlign: "left" }}>Why Switch?</p>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, color: "var(--text-primary)", textAlign: "left" }}>
                  See the difference.
                </h2>
              </div>
              <p style={{ fontSize: 17, color: "var(--lp-secondary)", lineHeight: 1.7, fontFamily: "var(--font-body)", paddingTop: 32 }}>
                Traditional fantasy apps are built around real-money betting loops. DraftPlay is built around making you smarter.
              </p>
            </div>
          </Reveal>
          <Reveal stagger>
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--lp-border)" }}>
              {[
                { them: "Deposit \u20B9500 to play", us: "Earn coins by playing" },
                { them: "Lose real money every match", us: "Zero financial risk" },
                { them: "Banned in 6+ states", us: "Legal in every state" },
                { them: "You pick blindly", us: "Smart tools tell you who to pick and why" },
                { them: "Pay per contest entry", us: "One subscription, unlimited play" },
                { them: "Addictive cash loops", us: "Healthy competition & bragging rights" },
              ].map((row, i) => (
                <div key={i} className="comparison-row reveal-child" style={{ borderBottom: i < 5 ? "1px solid var(--lp-border)" : "none" }}>
                  <div className="comparison-cell" style={{ color: "var(--lp-red)", fontFamily: "var(--font-body)", textDecoration: "line-through", textDecorationColor: "rgba(229, 72, 77, 0.3)", opacity: 0.7 }}>
                    {row.them}
                  </div>
                  <div className="comparison-cell" style={{ color: "var(--lp-accent)", fontWeight: 600, fontFamily: "var(--font-data)" }}>
                    {row.us}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section-spacing" style={{ textAlign: "center", background: "var(--lp-bg)" }}>
        <Reveal>
          <p className="section-label">Simple Pricing</p>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>
            Less than a cup of chai per day.
          </h2>
          <p style={{ fontSize: 17, color: "var(--lp-secondary)", marginBottom: 64, fontFamily: "var(--font-body)" }}>
            Start with a 7-day free trial. No credit card required.
          </p>
        </Reveal>

        <Reveal stagger>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, maxWidth: 860, margin: "0 auto" }}>
            {[
              { tier: "Basic", price: "\u20B9289", period: "/year", perDay: "\u20B90.79/day", features: ["Guru (5 questions/day)", "1 team per match", "Daily coin rewards", "Full match coverage"], accent: false },
              { tier: "Pro", price: "\u20B9889", period: "/year", perDay: "\u20B92.43/day", features: ["Guru (25 questions/day)", "3 teams per match", "Team Solver", "Captain Picks", "50 coins/day"], accent: true },
              { tier: "Elite", price: "\u20B91,899", period: "/year", perDay: "\u20B95.20/day", features: ["Unlimited Guru", "5 teams per match", "All smart tools", "Priority features", "100 coins/day"], accent: false },
            ].map((plan) => (
              <div key={plan.tier} className={`pricing-card reveal-child ${plan.accent ? "accent" : ""}`}>
                {plan.accent && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--lp-accent)", color: "#0A0B09", padding: "5px 16px", borderRadius: 980, fontSize: 11, fontWeight: 700, fontFamily: "var(--font-data)", letterSpacing: 1 }}>
                    MOST POPULAR
                  </div>
                )}
                <p style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: "var(--lp-accent)", marginBottom: 8 }}>{plan.tier}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 36, fontWeight: 800, color: "var(--text-primary)" }}>{plan.price}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "var(--lp-muted)" }}>{plan.period}</span>
                </div>
                <p style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--lp-muted)", marginBottom: 24 }}>That&apos;s just {plan.perDay}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: "var(--lp-secondary)", fontFamily: "var(--font-body)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "var(--lp-accent)", fontSize: 14 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div style={{ marginTop: 48, display: "inline-flex", alignItems: "center", gap: 16, backgroundColor: "var(--lp-card-bg)", border: "1px solid var(--lp-border)", padding: "16px 28px", borderRadius: 16 }}>
            <span style={{ fontSize: 15, color: "var(--lp-secondary)", fontFamily: "var(--font-body)" }}>Need Elite for a big game day?</span>
            <a href={`${APP_URL}/subscription`} style={{ fontSize: 15, fontWeight: 700, color: "var(--lp-gold)", fontFamily: "var(--font-data)", textDecoration: "none" }}>
              Day Pass — ₹69 for 24 hours →
            </a>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="section-spacing" style={{ textAlign: "center", background: "var(--lp-bg-alt)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, background: "radial-gradient(circle, var(--lp-glow) 0%, transparent 70%)", pointerEvents: "none" }} />

        <Reveal>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(32px, 6vw, 64px)",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 20,
              maxWidth: 700,
              marginLeft: "auto",
              marginRight: "auto",
              position: "relative",
            }}
          >
            Ready to play <span style={{ color: "var(--lp-accent)" }}>smarter</span>?
          </h2>
          <p style={{ fontSize: 17, color: "var(--lp-secondary)", marginBottom: 40, fontFamily: "var(--font-body)", position: "relative" }}>
            Join thousands of sports fans who chose intelligence over betting.
          </p>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <Link href={`${APP_URL}/auth/login`} className="btn-primary" style={{ fontSize: 18, padding: "18px 48px" }}>
              Start 7-Day Free Trial
            </Link>
          </div>
          {/* App Store buttons in final CTA */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <StoreButtons size="large" />
          </div>
          <p style={{ fontSize: 13, color: "var(--lp-muted)", marginTop: 8, fontFamily: "var(--font-data)", position: "relative" }}>
            No deposits. No withdrawals. No regrets.
          </p>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ padding: "32px", borderTop: "1px solid var(--lp-border)", textAlign: "center", color: "var(--lp-muted)", fontSize: 13, fontFamily: "var(--font-data)", background: "var(--lp-bg)" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 12 }}>
          <a href={`${APP_URL}/legal/terms`} className="footer-link">Terms of Service</a>
          <a href={`${APP_URL}/legal/privacy`} className="footer-link">Privacy Policy</a>
          <a href="mailto:support@playorparty.com" className="footer-link">Contact</a>
        </div>
        &copy; {new Date().getFullYear()} DraftPlay.ai — A PlayOrParty Company. All rights reserved.
      </footer>
      </div>{/* end landing-content */}
    </div>
  );
}
