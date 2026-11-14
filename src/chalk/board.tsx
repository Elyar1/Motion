import React from "react";

export const seeded = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// فیلتر گچ: زبری لبه، دانه‌دانه شدن و هاله‌ی گرد. seed هر ۳ فریم عوض میشه (خط «نفس می‌کشه»)
export const ChalkDefs: React.FC<{ seed: number }> = ({ seed }) => (
  <defs>
    <filter id="chalk" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed} result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="8" xChannelSelector="R" yChannelSelector="G" result="wob" />
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed={seed + 11} result="grain" />
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  4 0 0 0 -1.05" result="speck" />
      <feComposite in="wob" in2="speck" operator="in" result="rough" />
      <feGaussianBlur in="rough" stdDeviation="0.6" result="soft" />
      <feGaussianBlur in="rough" stdDeviation="7" result="halo0" />
      <feColorMatrix in="halo0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.35 0" result="halo" />
      <feMerge>
        <feMergeNode in="halo" />
        <feMergeNode in="soft" />
      </feMerge>
    </filter>
    <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={seed + 5} />
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" />
    </filter>
    <filter id="blur40" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="40" />
    </filter>
    <radialGradient id="vig" cx="50%" cy="50%" r="75%">
      <stop offset="45%" stopColor="#000" stopOpacity="0" />
      <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
    </radialGradient>
    <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fff" stopOpacity="0.02" />
      <stop offset="100%" stopColor="#fff" stopOpacity="0.2" />
    </linearGradient>
  </defs>
);

// تخته: زمینه‌ی تیره، لکه‌های گچ پاک‌شده، دانه
export const Board: React.FC = () => (
  <g>
    <rect width={1080} height={1920} fill="#0b0b0c" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <ellipse
        key={i}
        cx={seeded(i + 40) * 1080}
        cy={seeded(i + 50) * 1920}
        rx={160 + seeded(i + 60) * 220}
        ry={60 + seeded(i + 70) * 120}
        fill="#fff"
        opacity={0.03 + seeded(i + 80) * 0.025}
        filter="url(#blur40)"
        transform={`rotate(${seeded(i + 90) * 60 - 30} 540 960)`}
      />
    ))}
  </g>
);

export const Dust: React.FC<{ frame: number }> = ({ frame }) => (
  <g fill="#fff">
    {Array.from({ length: 45 }).map((_, i) => {
      const y = (seeded(i + 1) * 1920 - frame * (0.3 + seeded(i + 2) * 0.6) + 1920 * 4) % 1920;
      const x = seeded(i + 3) * 1080 + Math.sin(frame / 40 + i) * 14;
      return <circle key={i} cx={x} cy={y} r={1.2 + seeded(i + 4) * 2.4} opacity={0.12 + seeded(i + 5) * 0.28} />;
    })}
  </g>
);
