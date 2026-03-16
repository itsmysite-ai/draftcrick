/**
 * DraftPlayLogoSVG — Web-only SVG recreation of the DraftPlayLogo component.
 * Lowercase mirrored d + play triangle sharing one vertical bar.
 * Drop-shadow filter for subtle depth. Bar extends to cover arc endpoints.
 *
 * Uses CSS class `.dp-logo-click-group` for the play-bounce animation (defined in globals.css).
 */

interface DraftPlayLogoSVGProps {
  size?: number;
  animate?: boolean;
}

export function DraftPlayLogoSVG({ size = 36, animate = true }: DraftPlayLogoSVGProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DraftPlay logo"
    >
      <defs>
        <filter id="dp-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0.8" dy="1.1" stdDeviation="0.7" floodColor="#1a4a30" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter="url(#dp-shadow)">
        {/* Bowl arc */}
        <path
          d="M18.1 17.7 A8.35 8.35 0 0 0 18.1 34.4"
          stroke="#3D9968"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Vertical bar — extends past arc endpoints to cover round caps */}
        <rect x="18.1" y="5.6" width="2.8" height="30.2" fill="#3D9968" />
      </g>

      {/* Play triangle — animated */}
      <g className={animate ? "dp-logo-click-group" : undefined} filter="url(#dp-shadow)">
        <polygon points="20.9,5.6 30.26,12.8 20.9,20.0" fill="#3D9968" />
      </g>

      {/* Highlight: top half of bowl arc — subtle shine */}
      <path
        d="M17.8 17.4 A8.35 8.35 0 0 0 9.5 25.4"
        stroke="#5BBF8A"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
