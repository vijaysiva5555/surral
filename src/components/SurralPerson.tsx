/** An animated 3D-style character in the Surral uniform – navy polo with blue collar and piping, the SSCPL logo on the
    chest, "SURRAL" print, a name tag with the user's first name and a Surral cap. It floats, breathes, blinks, nods and
    waves. Drawn in SVG with light and shade, so it needs no image files or 3D library; every movement stops for people
    who ask for reduced motion (see globals.css, .sp-*). */
export default function SurralPerson({ name = "", className = "" }: { name?: string; className?: string }) {
  const first = (name.trim().split(/\s+/)[0] ?? "").slice(0, 9);
  return (
    <svg viewBox="0 0 200 270" className={`surral-person ${className}`} role="img" aria-label={`Animated Surral team member${first ? ` with the name tag ${first}` : ""}`}>
      <defs>
        <radialGradient id="sp-skin" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stopColor="#f3c99b" /><stop offset="0.6" stopColor="#d99c66" /><stop offset="1" stopColor="#b97a45" /></radialGradient>
        <linearGradient id="sp-shirt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#24689f" /><stop offset="0.45" stopColor="#0f3a62" /><stop offset="1" stopColor="#071c31" /></linearGradient>
        <linearGradient id="sp-sleeve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1b5687" /><stop offset="1" stopColor="#0a2a49" /></linearGradient>
        <linearGradient id="sp-pants" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1f2f45" /><stop offset="1" stopColor="#0c1726" /></linearGradient>
        <linearGradient id="sp-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5cc8f5" /><stop offset="1" stopColor="#0789c4" /></linearGradient>
        <linearGradient id="sp-cap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a74b0" /><stop offset="1" stopColor="#0b2c4d" /></linearGradient>
        <radialGradient id="sp-pad" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#7ec9f0" stopOpacity="0.85" /><stop offset="0.55" stopColor="#0aa5e8" stopOpacity="0.35" /><stop offset="1" stopColor="#0aa5e8" stopOpacity="0" /></radialGradient>
      </defs>

      {/* glowing pedestal and the shadow under the feet */}
      <ellipse cx="100" cy="252" rx="78" ry="14" fill="url(#sp-pad)" className="sp-pad" />
      <ellipse cx="100" cy="252" rx="62" ry="9" fill="none" stroke="#7ec9f0" strokeOpacity="0.55" strokeWidth="1.2" />
      <ellipse cx="100" cy="250" rx="44" ry="6" fill="#020c1b" opacity="0.45" className="sp-shadow" />

      <g className="sp-float">
        {/* legs and shoes */}
        <rect x="77" y="192" width="21" height="48" rx="9" fill="url(#sp-pants)" />
        <rect x="102" y="192" width="21" height="48" rx="9" fill="url(#sp-pants)" />
        <ellipse cx="86" cy="242" rx="15" ry="6.5" fill="#151b26" /><ellipse cx="114" cy="242" rx="15" ry="6.5" fill="#151b26" />
        <ellipse cx="82" cy="239.5" rx="6" ry="1.6" fill="#fff" opacity="0.18" /><ellipse cx="110" cy="239.5" rx="6" ry="1.6" fill="#fff" opacity="0.18" />

        {/* arm at the side (behind the body) */}
        <path d="M67 130 Q55 150 53 184" stroke="url(#sp-sleeve)" strokeWidth="17" strokeLinecap="round" fill="none" />
        <circle cx="53" cy="186" r="8.6" fill="url(#sp-blue)" />
        <circle cx="53" cy="195" r="8.4" fill="url(#sp-skin)" />

        <g className="sp-breathe">
          {/* neck, then the polo shirt */}
          <rect x="92" y="106" width="16" height="20" rx="6" fill="url(#sp-skin)" />
          <path d="M61 126 Q100 112 139 126 L135 197 Q100 204 65 197 Z" fill="url(#sp-shirt)" />
          <path d="M67 132 Q73 162 70 194" stroke="#fff" strokeOpacity="0.13" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M131 134 Q127 166 130 194" stroke="#000" strokeOpacity="0.18" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* blue piping down the sides */}
          <path d="M64 142 L67 196" stroke="url(#sp-blue)" strokeWidth="2.6" /><path d="M136 142 L133 196" stroke="url(#sp-blue)" strokeWidth="2.6" />
          {/* open collar */}
          <path d="M89 121 L100 136 L111 121 Z" fill="#c98a55" />
          <path d="M83 118 L100 129 L91 139 Z" fill="url(#sp-blue)" /><path d="M117 118 L100 129 L109 139 Z" fill="url(#sp-blue)" />
          <circle cx="100" cy="146" r="1.7" fill="#fff" opacity="0.85" /><circle cx="100" cy="157" r="1.7" fill="#fff" opacity="0.85" />
          {/* SSCPL logo patch, SURRAL print and the name tag */}
          <rect x="71" y="145" width="22" height="18" rx="3.5" fill="#fff" />
          <image href="/sscpl-logo.png" x="73" y="146.5" width="18" height="15" preserveAspectRatio="xMidYMid meet" />
          <text x="119.5" y="155.5" textAnchor="middle" fontSize="7.2" fontWeight="800" letterSpacing="0.5" fill="#fff" fontFamily="Arial, Helvetica, sans-serif">SURRAL</text>
          {first && (
            <>
              <rect x="103" y="161" width="28" height="10" rx="2.2" fill="#fff" />
              <rect x="103" y="161" width="3" height="10" rx="1" fill="#0aa5e8" />
              <text x="118.5" y="168.2" textAnchor="middle" fontSize="5.6" fontWeight="700" fill="#0b2c4d" fontFamily="Arial, Helvetica, sans-serif">{first}</text>
            </>
          )}
          {/* belt */}
          <rect x="65" y="189" width="70" height="8" rx="3" fill="#0a1626" />
          <rect x="95" y="189.5" width="10" height="7" rx="1.6" fill="url(#sp-blue)" />
        </g>

        {/* head: nods gently; the eyes blink */}
        <g className="sp-head">
          <circle cx="70" cy="90" r="6.2" fill="url(#sp-skin)" /><circle cx="130" cy="90" r="6.2" fill="url(#sp-skin)" />
          <circle cx="100" cy="87" r="30.5" fill="url(#sp-skin)" />
          <path d="M120 68 Q134 88 122 110" stroke="#000" strokeOpacity="0.07" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M71 86 Q70 70 79 63 L80 84 Z" fill="#2b1d16" /><path d="M129 86 Q130 70 121 63 L120 84 Z" fill="#2b1d16" />
          {/* Surral cap */}
          <path d="M68 77 Q69 45 100 45 Q131 45 132 77 Z" fill="url(#sp-cap)" />
          <path d="M66 77 Q100 69 143 75 Q146 83 133 83 Q100 79 68 83 Q61 81 66 77 Z" fill="url(#sp-blue)" />
          <path d="M78 60 Q86 50 99 48" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="62" r="6.5" fill="#fff" />
          <text x="100" y="65.4" textAnchor="middle" fontSize="9" fontWeight="900" fill="#0aa5e8" fontFamily="Arial, Helvetica, sans-serif">S</text>
          {/* face */}
          <path d="M81 85 Q87 81 93 85" stroke="#2b1d16" strokeWidth="2.3" fill="none" strokeLinecap="round" />
          <path d="M107 85 Q113 81 119 85" stroke="#2b1d16" strokeWidth="2.3" fill="none" strokeLinecap="round" />
          <g className="sp-blink">
            <ellipse cx="88" cy="93" rx="3.5" ry="4.3" fill="#1b1b24" /><ellipse cx="112" cy="93" rx="3.5" ry="4.3" fill="#1b1b24" />
            <circle cx="89.3" cy="91.4" r="1.2" fill="#fff" /><circle cx="113.3" cy="91.4" r="1.2" fill="#fff" />
          </g>
          <ellipse cx="79" cy="103" rx="5" ry="3" fill="#ef6f6f" opacity="0.35" /><ellipse cx="121" cy="103" rx="5" ry="3" fill="#ef6f6f" opacity="0.35" />
          <path d="M100 96 Q98 101 101 103" stroke="#a5683a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M89 107 Q100 117 111 107 Q100 111 89 107 Z" fill="#7a2e1d" />
          <path d="M93 109.5 Q100 113 107 109.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
        </g>

        {/* the waving arm, turning at the shoulder */}
        <g className="sp-wave">
          <path d="M133 131 Q153 120 161 94" stroke="url(#sp-sleeve)" strokeWidth="17" strokeLinecap="round" fill="none" />
          <circle cx="162" cy="90" r="8.8" fill="url(#sp-blue)" />
          <ellipse cx="160" cy="70" rx="3.3" ry="7" fill="url(#sp-skin)" transform="rotate(-14 160 70)" />
          <ellipse cx="166" cy="69" rx="3.3" ry="7.6" fill="url(#sp-skin)" />
          <ellipse cx="172" cy="71" rx="3.2" ry="7" fill="url(#sp-skin)" transform="rotate(14 172 71)" />
          <circle cx="165" cy="80" r="9.4" fill="url(#sp-skin)" />
          <ellipse cx="155.5" cy="82" rx="3.2" ry="5" fill="url(#sp-skin)" transform="rotate(-40 155.5 82)" />
        </g>
      </g>
    </svg>
  );
}
