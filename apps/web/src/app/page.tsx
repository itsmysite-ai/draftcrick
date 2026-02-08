import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hero Section */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 32px",
          borderBottom: "1px solid #1A2332",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-heading)" }}>
            DraftCrick
          </span>
        </div>
        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Link href="/features" style={{ color: "#ADB5BD", fontSize: 14 }}>
            Features
          </Link>
          <Link href="/comfort-mode" style={{ color: "#ADB5BD", fontSize: 14 }}>
            Comfort Mode
          </Link>
          <Link
            href="/login"
            style={{
              backgroundColor: "#00F5A0",
              color: "#0A1628",
              padding: "8px 20px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 32px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            backgroundColor: "rgba(0, 245, 160, 0.1)",
            color: "#00F5A0",
            padding: "4px 12px",
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          Fantasy Cricket, Reimagined
        </div>

        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(36px, 6vw, 72px)",
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 800,
            marginBottom: 24,
          }}
        >
          Powerful for experts.{" "}
          <span style={{ color: "#00F5A0" }}>Effortless</span> for everyone.
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#ADB5BD",
            maxWidth: 600,
            lineHeight: 1.6,
            marginBottom: 40,
          }}
        >
          The next-gen fantasy cricket platform with AI-powered Cricket Guru,
          200+ customizable rules, live drafts, auctions, and Comfort Mode for
          everyone in the family.
        </p>

        <div style={{ display: "flex", gap: 16 }}>
          <Link
            href="/register"
            style={{
              backgroundColor: "#00F5A0",
              color: "#0A1628",
              padding: "14px 32px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Start Playing Free
          </Link>
          <Link
            href="/features"
            style={{
              backgroundColor: "transparent",
              color: "white",
              padding: "14px 32px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 16,
              border: "1px solid #243044",
            }}
          >
            Explore Features
          </Link>
        </div>

        {/* Feature highlights */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 24,
            maxWidth: 1000,
            width: "100%",
            marginTop: 80,
          }}
        >
          {[
            {
              title: "4 Fantasy Formats",
              desc: "Salary Cap, Draft, Auction, and Prediction leagues on one platform.",
            },
            {
              title: "AI Cricket Guru",
              desc: 'Ask "Who should I captain?" and get data-driven answers instantly.',
            },
            {
              title: "Live Drafts & Auctions",
              desc: "Real-time draft rooms with voice chat and animated pick reveals.",
            },
            {
              title: "Comfort Mode",
              desc: "Large text, voice guidance, plain English. Cricket made simple.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                backgroundColor: "#1A2332",
                padding: 24,
                borderRadius: 12,
                border: "1px solid #243044",
                textAlign: "left",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {feature.title}
              </h3>
              <p style={{ color: "#ADB5BD", fontSize: 14, lineHeight: 1.5 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: "24px 32px",
          borderTop: "1px solid #1A2332",
          textAlign: "center",
          color: "#6C757D",
          fontSize: 13,
        }}
      >
        &copy; {new Date().getFullYear()} DraftCrick. All rights reserved.
      </footer>
    </div>
  );
}
