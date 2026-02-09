import { useState, useEffect, createContext, useContext } from "react";

// ─── Theme tokens matching themes.ts ───
const themes = {
  light: {
    bg: "#F7F5F0",
    surface: "#FFFFFF",
    surfaceAlt: "#EFECEA",
    border: "#E5E1DA",
    borderHover: "#D0CBC2",
    textPrimary: "#1A1A1A",
    textSecondary: "#8A8580",
    textMuted: "#B5B0A8",
    accent: "#3D9968",
    accentHover: "#5DB882",
    accentLight: "#E8F5EE",
    accentBadge: "#2A7A5A",
    cricket: "#B8862D",
    cricketLight: "#FDF5E6",
    hatch: "#C25A3A",
    shadow: "rgba(0,0,0,0.06)",
    overlay: "rgba(0,0,0,0.35)",
    roles: {
      BAT:  { bg: "#B8862D", text: "#FDF5E6", lightBg: "#FDF5E6", lightText: "#B8862D" },
      BOWL: { bg: "#3D9968", text: "#E8F5EE", lightBg: "#E8F5EE", lightText: "#3D9968" },
      AR:   { bg: "#4A5DB5", text: "#E8ECF8", lightBg: "#EEF0F8", lightText: "#4A5DB5" },
      WK:   { bg: "#7B5EA7", text: "#F0ECF8", lightBg: "#F0EEF5", lightText: "#7B5EA7" },
    },
  },
  dark: {
    bg: "#111210",
    surface: "#1C1D1B",
    surfaceAlt: "#252624",
    border: "#333432",
    borderHover: "#444543",
    textPrimary: "#EDECEA",
    textSecondary: "#9A9894",
    textMuted: "#5E5D5A",
    accent: "#5DB882",
    accentHover: "#7BCFA0",
    accentLight: "#1A2E22",
    accentBadge: "#5DB882",
    cricket: "#D4A43D",
    cricketLight: "#2A2210",
    hatch: "#E08060",
    shadow: "rgba(0,0,0,0.3)",
    overlay: "rgba(0,0,0,0.55)",
    roles: {
      BAT:  { bg: "#9A7225", text: "#FDF5E6", lightBg: "#2A2210", lightText: "#D4A43D" },
      BOWL: { bg: "#2E7A52", text: "#E8F5EE", lightBg: "#1A2E22", lightText: "#5DB882" },
      AR:   { bg: "#3A4A95", text: "#D8DEF5", lightBg: "#1A1E30", lightText: "#8090D0" },
      WK:   { bg: "#634A8A", text: "#E8DEF5", lightBg: "#221A30", lightText: "#A088CC" },
    },
  },
};

const ThemeContext = createContext(themes.light);

const players = [
  { id: 1, name: "Virat Kohli", role: "BAT", team: "IND", ovr: 97, stats: { avg: 53.4, sr: 93.2, runs: 13848 } },
  { id: 2, name: "Jasprit Bumrah", role: "BOWL", team: "IND", ovr: 96, stats: { wkts: 178, econ: 4.2, avg: 21.7 } },
  { id: 3, name: "Pat Cummins", role: "BOWL", team: "AUS", ovr: 95, stats: { wkts: 196, econ: 4.8, avg: 22.1 } },
  { id: 4, name: "Joe Root", role: "BAT", team: "ENG", ovr: 95, stats: { avg: 50.6, sr: 56.2, runs: 12402 } },
  { id: 5, name: "Rashid Khan", role: "BOWL", team: "AFG", ovr: 94, stats: { wkts: 172, econ: 4.1, avg: 19.8 } },
  { id: 6, name: "Ben Stokes", role: "AR", team: "ENG", ovr: 94, stats: { avg: 36.7, sr: 71.4, wkts: 104 } },
  { id: 7, name: "Kane Williamson", role: "BAT", team: "NZ", ovr: 93, stats: { avg: 54.3, sr: 52.1, runs: 8889 } },
  { id: 8, name: "Shakib Al Hasan", role: "AR", team: "BAN", ovr: 93, stats: { avg: 34.8, sr: 68.3, wkts: 237 } },
  { id: 9, name: "Rishabh Pant", role: "WK", team: "IND", ovr: 92, stats: { avg: 44.1, sr: 73.9, runs: 2648 } },
  { id: 10, name: "Kagiso Rabada", role: "BOWL", team: "SA", ovr: 92, stats: { wkts: 168, econ: 5.1, avg: 23.4 } },
  { id: 11, name: "Travis Head", role: "BAT", team: "AUS", ovr: 91, stats: { avg: 42.8, sr: 68.5, runs: 3210 } },
  { id: 12, name: "Quinton de Kock", role: "WK", team: "SA", ovr: 91, stats: { avg: 38.6, sr: 71.2, runs: 5765 } },
];

const getInitials = (name) => {
  const parts = name.split(" ");
  return parts.length === 1 ? parts[0].substring(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const InitialsAvatar = ({ name, role, ovr, size = 46, active = false }) => {
  const t = useContext(ThemeContext);
  const rs = t.roles[role];
  return (
    <div style={{
      width: size, height: size, borderRadius: 14,
      background: rs.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1)",
      transform: active ? "scale(1.12)" : "scale(1)",
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: size * 0.36, fontWeight: 500, color: rs.text,
        letterSpacing: 1, lineHeight: 1,
      }}>{getInitials(name)}</span>
      <div style={{
        position: "absolute", bottom: -5, right: -5,
        background: t.textPrimary, color: t.bg,
        fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace",
        padding: "1px 5px", borderRadius: 6, lineHeight: "16px",
      }}>{ovr}</div>
    </div>
  );
};

const HatchModal = ({ player, onClose }) => {
  const t = useContext(ThemeContext);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [600, 500, 500, 900];
    if (stage < 4) {
      const to = setTimeout(() => setStage(s => s + 1), timers[stage]);
      return () => clearTimeout(to);
    }
  }, [stage]);

  const rs = t.roles[player.role];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: t.overlay, backdropFilter: "blur(8px)",
    }} onClick={stage >= 4 ? onClose : undefined}>
      <div style={{
        background: t.surface, borderRadius: 24, padding: "44px 40px 36px",
        textAlign: "center", minWidth: 300,
        boxShadow: `0 24px 80px ${t.shadow}`,
        animation: "modalIn 0.3s ease-out",
        border: `1px solid ${t.border}`,
      }}>
        <div style={{
          width: 96, height: 96, margin: "0 auto 20px",
          transition: "all 0.4s cubic-bezier(.34,1.56,.64,1)",
          transform: stage === 1 ? "rotate(-12deg) scale(1.05)"
            : stage === 2 ? "rotate(12deg) scale(1.05)"
            : stage === 3 ? "rotate(-6deg) scale(1.1)"
            : "rotate(0) scale(1)",
        }}>
          {stage < 4 ? (
            <div style={{ fontSize: 64, lineHeight: "96px" }}>🥚</div>
          ) : (
            <div style={{
              width: 96, height: 96, borderRadius: 22, background: rs.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "fadeIn 0.3s ease-out",
            }}>
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 34, fontWeight: 500, color: rs.text, letterSpacing: 2,
              }}>{getInitials(player.name)}</span>
            </div>
          )}
        </div>
        {stage < 4 ? (
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: 13, color: t.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <span style={{ animation: "blink 1s steps(1) infinite" }}>hatching</span>
            <span>{"·".repeat(Math.min(stage + 1, 3))}</span>
          </div>
        ) : (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, marginBottom: 6 }}>{player.name}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                padding: "2px 8px", borderRadius: 5, background: rs.lightBg, color: rs.lightText,
                fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600,
              }}>{player.role}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: t.textSecondary }}>{player.team}</span>
            </div>
            <div style={{
              display: "inline-block", padding: "4px 12px", borderRadius: 8,
              background: t.accentLight, color: t.accent,
              fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600,
            }}>joined your squad! 🏏</div>
            <div style={{ marginTop: 20, fontFamily: "'DM Mono', monospace", fontSize: 10, color: t.textMuted }}>tap to continue</div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatLabel = ({ label, value }) => {
  const t = useContext(ThemeContext);
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
      <span style={{ color: t.textPrimary, fontWeight: 500 }}>{value}</span>
      {" "}<span style={{ color: t.textMuted, fontSize: 10 }}>{label}</span>
    </span>
  );
};

export default function TamiDraft() {
  const [mode, setMode] = useState("light");
  const [myTeam, setMyTeam] = useState([]);
  const [allDrafted, setAllDrafted] = useState([]);
  const [round, setRound] = useState(1);
  const [pick, setPick] = useState(1);
  const [hatchPlayer, setHatchPlayer] = useState(null);
  const [tab, setTab] = useState("draft");
  const [roleFilter, setRoleFilter] = useState("all");
  const [clock, setClock] = useState(90);
  const [hoveredId, setHoveredId] = useState(null);

  const t = themes[mode];

  useEffect(() => {
    const iv = setInterval(() => setClock(c => c <= 0 ? 90 : c - 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const handleDraft = (player) => { setHatchPlayer(player); setClock(90); };

  const handleHatchDone = () => {
    if (hatchPlayer) {
      setMyTeam(prev => [...prev, hatchPlayer]);
      setAllDrafted(prev => [...prev, hatchPlayer.id]);
      setPick(p => p + 1);
      if (pick % 4 === 0) setRound(r => r + 1);
    }
    setHatchPlayer(null);
  };

  const available = players.filter(p => !allDrafted.includes(p.id));
  const filtered = roleFilter === "all" ? available : available.filter(p => p.role === roleFilter);
  const happiness = Math.min(100, Math.round((myTeam.length / 6) * 100));

  return (
    <ThemeContext.Provider value={t}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,700&display=swap');
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
      `}</style>

      {hatchPlayer && <HatchModal player={hatchPlayer} onClose={handleHatchDone} />}

      <div style={{
        maxWidth: 520, margin: "0 auto", minHeight: "100vh",
        fontFamily: "'DM Sans', sans-serif", padding: "0 16px 40px",
        background: t.bg, transition: "background 0.4s ease, color 0.4s ease",
      }}>
        {/* ── Header ── */}
        <div style={{ padding: "24px 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>🥚</span>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 500,
                color: t.textPrimary, letterSpacing: -0.5,
              }}>tami·draft</span>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 9, color: t.accent,
                background: t.accentLight, padding: "2px 7px", borderRadius: 5, fontWeight: 600,
              }}>🏏 cricket</span>
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, color: t.textMuted,
              marginTop: 3, marginLeft: 30,
            }}>fantasy cricket companion</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Mode Toggle */}
            <button
              onClick={() => setMode(m => m === "light" ? "dark" : "light")}
              style={{
                width: 44, height: 24, borderRadius: 12, border: "none",
                background: mode === "dark" ? t.accent : t.surfaceAlt,
                position: "relative", cursor: "pointer",
                transition: "background 0.3s ease",
                boxShadow: `inset 0 1px 3px ${t.shadow}`,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 9,
                background: mode === "dark" ? t.surface : "#fff",
                position: "absolute", top: 3,
                left: mode === "dark" ? 23 : 3,
                transition: "left 0.3s cubic-bezier(.34,1.2,.64,1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, boxShadow: `0 1px 3px ${t.shadow}`,
              }}>
                {mode === "dark" ? "🌙" : "☀️"}
              </div>
            </button>

            {/* Clock */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: t.textMuted }}>
                rd {round} · pick {pick}
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500,
                color: clock < 15 ? t.hatch : t.textPrimary,
                letterSpacing: 1, lineHeight: 1.2, transition: "color 0.3s",
              }}>
                {String(Math.floor(clock / 60))}:{String(clock % 60).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Happiness ── */}
        <div style={{
          background: t.surface, borderRadius: 14, padding: "12px 16px",
          marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
          border: `1px solid ${t.border}`, transition: "all 0.4s ease",
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>
            {happiness >= 80 ? "😄" : happiness >= 50 ? "🙂" : happiness >= 20 ? "😐" : "🥺"}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: t.textMuted }}>team happiness</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: t.textMuted }}>{myTeam.length}/6 drafted</span>
            </div>
            <div style={{ width: "100%", height: 6, background: t.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3, width: `${happiness}%`,
                background: happiness >= 60 ? `linear-gradient(90deg, ${t.accent}, ${t.accentHover})`
                  : happiness >= 30 ? `linear-gradient(90deg, ${t.cricket}, #D4A43D)`
                  : `linear-gradient(90deg, ${t.hatch}, #E8836A)`,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 14,
          background: t.surfaceAlt, borderRadius: 12, padding: 4,
          transition: "all 0.4s ease",
        }}>
          {[
            { key: "draft", label: "Available", count: available.length },
            { key: "team", label: "My Squad", count: myTeam.length },
          ].map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 10,
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              background: tab === tb.key ? t.surface : "transparent",
              color: tab === tb.key ? t.textPrimary : t.textMuted,
              boxShadow: tab === tb.key ? `0 1px 4px ${t.shadow}` : "none",
            }}>
              {tb.label}
              <span style={{
                marginLeft: 6, fontFamily: "'DM Mono', monospace", fontSize: 11,
                color: tab === tb.key ? t.textSecondary : t.textMuted,
              }}>{tb.count}</span>
            </button>
          ))}
        </div>

        {/* ── Role Filter ── */}
        {tab === "draft" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
            {[
              { key: "all", label: "All" },
              { key: "BAT", label: "🏏 Batsmen" },
              { key: "BOWL", label: "🎯 Bowlers" },
              { key: "AR", label: "⚡ All-Round" },
              { key: "WK", label: "🧤 Keepers" },
            ].map(s => (
              <button key={s.key} onClick={() => setRoleFilter(s.key)} style={{
                padding: "6px 14px", borderRadius: 20,
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                background: roleFilter === s.key ? t.textPrimary : t.surface,
                color: roleFilter === s.key ? t.bg : t.textSecondary,
                border: `1px solid ${roleFilter === s.key ? t.textPrimary : t.border}`,
              }}>{s.label}</button>
            ))}
          </div>
        )}

        {/* ── Player List ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tab === "draft" ? (
            filtered.length > 0 ? filtered.map((p, i) => {
              const rs = t.roles[p.role];
              const isHovered = hoveredId === p.id;
              return (
                <div key={p.id}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: t.surface, borderRadius: 16, padding: 14,
                    display: "flex", alignItems: "center", gap: 14,
                    border: `1px solid ${isHovered ? t.accent + "35" : t.border}`,
                    transition: "all 0.2s", cursor: "default",
                    animation: `slideUp 0.3s ease-out ${i * 0.04}s both`,
                  }}>
                  <InitialsAvatar name={p.name} ovr={p.ovr} role={p.role} active={isHovered} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{p.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{
                        background: rs.lightBg, color: rs.lightText,
                        padding: "1px 7px", borderRadius: 4,
                        fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 10,
                      }}>{p.role}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: t.textMuted }}>{p.team}</span>
                      <span style={{ color: t.border }}>·</span>
                      {Object.entries(p.stats).map(([k, v]) => (
                        <StatLabel key={k} label={k} value={v} />
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleDraft(p)} style={{
                    padding: "8px 18px", border: "none", borderRadius: 10,
                    fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500,
                    cursor: "pointer", transition: "all 0.2s",
                    background: isHovered ? t.accent : t.surfaceAlt,
                    color: isHovered ? "#fff" : t.textMuted,
                  }}>draft</button>
                </div>
              );
            }) : (
              <div style={{ textAlign: "center", padding: 48, color: t.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏏</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>no players in this role</div>
              </div>
            )
          ) : (
            myTeam.length > 0 ? myTeam.map((p, i) => {
              const rs = t.roles[p.role];
              return (
                <div key={p.id} style={{
                  background: t.surface, borderRadius: 16, padding: 14,
                  display: "flex", alignItems: "center", gap: 14,
                  border: `1px solid ${t.border}`, transition: "all 0.4s ease",
                  animation: `slideUp 0.3s ease-out ${i * 0.04}s both`,
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 11, color: t.textMuted,
                    width: 20, textAlign: "center", flexShrink: 0,
                  }}>{i + 1}</div>
                  <InitialsAvatar name={p.name} ovr={p.ovr} role={p.role} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        background: rs.lightBg, color: rs.lightText,
                        padding: "1px 7px", borderRadius: 4,
                        fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 10,
                      }}>{p.role}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: t.textMuted }}>{p.team}</span>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: "center", padding: 60, color: t.textMuted }}>
                <div style={{ fontSize: 48, marginBottom: 16, animation: "slideUp 0.5s ease-out" }}>🥚</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.8 }}>
                  draft cricketers to hatch your squad
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
