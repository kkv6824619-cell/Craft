import React from 'react';

/**
 * Bespoke inline SVG title lockup for Turbo Tumble 3D.
 * Crisp racing-crest silhouette tuned for high readability over the sunlit 3D skyway.
 */
export const TitleLockup: React.FC = () => {
  return (
    <div className="flex flex-col items-center select-none">
      <svg
        viewBox="0 0 560 148"
        className="w-[min(520px,90vw)] h-auto drop-shadow-[0_14px_28px_rgba(15,23,42,0.45)]"
        role="img"
        aria-label="Turbo Tumble 3D"
      >
        <defs>
          <linearGradient id="ttTitleFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="48%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="ttPlate" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.92" />
          </linearGradient>
        </defs>

        {/* Racing speed chevrons flanking emblem */}
        <polygon points="16,46 44,46 32,76 4,76" fill="#f97316" />
        <polygon points="528,46 556,46 544,76 516,76" fill="#38bdf8" />

        {/* Skewed chassis crest backing */}
        <polygon
          points="56,16 522,16 500,126 34,126"
          fill="url(#ttPlate)"
          stroke="#f97316"
          strokeWidth="3.5"
        />
        <polygon
          points="66,24 510,24 506,30 62,30"
          fill="#38bdf8"
          fillOpacity="0.7"
        />

        {/* Primary display title */}
        <text
          x="278"
          y="80"
          textAnchor="middle"
          fill="url(#ttTitleFill)"
          fontFamily="'Bricolage Grotesque', system-ui, sans-serif"
          fontSize="50"
          fontWeight="800"
          fontStyle="italic"
          letterSpacing="1.5"
        >
          TURBO TUMBLE
        </text>

        {/* Sub-brand stripe */}
        <text
          x="278"
          y="110"
          textAnchor="middle"
          fill="#e2e8f0"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize="14"
          fontWeight="700"
          letterSpacing="6.5"
        >
          SKYWAY CHAOS 3D
        </text>
      </svg>
    </div>
  );
};
