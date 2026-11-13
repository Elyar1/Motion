import React from "react";

export const seeded = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const Defs: React.FC = () => (
  <defs>
    <radialGradient id="glow">
      <stop offset="0%" stopColor="#ffb347" stopOpacity="0.7" />
      <stop offset="100%" stopColor="#ff6a00" stopOpacity="0" />
    </radialGradient>
  </defs>
);

export const Glow: React.FC<{ x: number; y: number; r: number; opacity?: number }> = ({
  x, y, r, opacity = 1,
}) => <circle cx={x} cy={y} r={r} fill="url(#glow)" opacity={opacity} />;

export const Stars: React.FC<{ frame: number; count?: number; height?: number }> = ({
  frame, count = 70, height = 1000,
}) => (
  <g>
    {Array.from({ length: count }).map((_, i) => {
      const tw = 0.5 + 0.5 * Math.sin(frame / 8 + i * 1.7);
      return (
        <circle
          key={i}
          cx={seeded(i) * 1080}
          cy={seeded(i + 99) * height}
          r={2 + seeded(i + 7) * 3.5}
          fill="#fff"
          opacity={0.3 + 0.7 * tw}
        />
      );
    })}
  </g>
);

export const Moon: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <g opacity={opacity}>
    <circle cx={850} cy={260} r={150} fill="#cfd8ff" opacity={0.1} />
    <circle cx={850} cy={260} r={90} fill="#f3f0d8" />
    <circle cx={820} cy={235} r={14} fill="#d9d4b4" />
    <circle cx={880} cy={290} r={20} fill="#d9d4b4" />
    <circle cx={865} cy={225} r={9} fill="#d9d4b4" />
  </g>
);

export const Mountains: React.FC<{ color?: string }> = ({ color = "#151a33" }) => (
  <g>
    <path
      d="M0 1120 L180 800 L330 980 L520 700 L760 1010 L900 850 L1080 1060 L1080 1320 L0 1320 Z"
      fill={color}
    />
    <path
      d="M0 1200 L230 980 L400 1120 L640 930 L860 1140 L1080 1000 L1080 1320 L0 1320 Z"
      fill="#10142a"
    />
  </g>
);

export const Ground: React.FC<{ color?: string; snow?: boolean }> = ({
  color = "#1b2038", snow = false,
}) => (
  <g>
    <path d="M0 1260 Q270 1215 540 1250 T1080 1235 L1080 1920 L0 1920 Z" fill={color} />
    {snow && (
      <path
        d="M0 1262 Q270 1217 540 1252 T1080 1237 L1080 1285 Q800 1300 540 1285 T0 1295 Z"
        fill="#dfe8ff"
        opacity={0.85}
      />
    )}
  </g>
);

export const Snow: React.FC<{ frame: number }> = ({ frame }) => (
  <g fill="#fff">
    {Array.from({ length: 45 }).map((_, i) => {
      const speed = 3 + seeded(i + 1) * 4;
      const y = (frame * speed + seeded(i + 2) * 1920) % 1920;
      const x = seeded(i + 3) * 1080 + Math.sin(frame / 20 + i) * 30;
      return <circle key={i} cx={x} cy={y} r={3 + seeded(i + 4) * 5} opacity={0.8} />;
    })}
  </g>
);

export const Rain: React.FC<{ frame: number }> = ({ frame }) => (
  <g stroke="#9fb4ff" strokeWidth={3} opacity={0.5}>
    {Array.from({ length: 70 }).map((_, i) => {
      const y = (frame * 45 + seeded(i + 1) * 1920) % 1920;
      const x = seeded(i + 2) * 1200;
      return <line key={i} x1={x} y1={y} x2={x - 14} y2={y + 46} />;
    })}
  </g>
);

export const Flame: React.FC<{ x: number; y: number; size: number; frame: number; seed?: number }> = ({
  x, y, size, frame, seed = 0,
}) => {
  if (size <= 1) return null;
  const f1 = 1 + 0.1 * Math.sin(frame * 0.9 + seed) + 0.05 * Math.sin(frame * 2.1 + seed * 2);
  const f2 = 1 + 0.18 * Math.sin(frame * 1.3 + seed * 3);
  const lean = 2.5 * Math.sin(frame * 0.5 + seed);
  const body = "M0,0 C-0.5,0 -0.55,-0.5 -0.14,-1 C-0.12,-0.72 0.02,-0.66 0.1,-0.82 C0.5,-0.5 0.5,0 0,0 Z";
  return (
    <g transform={`translate(${x},${y}) skewX(${lean})`}>
      <g transform={`scale(${size * f1},${size * f2})`}>
        <path d={body} fill="#ff5a00" />
        <path d={body} fill="#ffa800" transform="scale(0.72,0.78)" />
        <path d={body} fill="#fff1a8" transform="scale(0.4,0.5)" />
      </g>
    </g>
  );
};

export const Sparks: React.FC<{
  x: number; y: number; frame: number; count?: number; spread?: number; rise?: number;
}> = ({ x, y, frame, count = 18, spread = 120, rise = 420 }) => (
  <g>
    {Array.from({ length: count }).map((_, i) => {
      const period = 50 + seeded(i) * 40;
      const p = ((frame + seeded(i + 5) * period) % period) / period;
      const sx = x + (seeded(i + 11) - 0.5) * spread + Math.sin(frame / 10 + i) * 25 * p;
      const sy = y - p * rise * (0.5 + seeded(i + 3) * 0.7);
      return (
        <circle
          key={i}
          cx={sx}
          cy={sy}
          r={Math.max(0.5, 3 + seeded(i + 2) * 4 * (1 - p))}
          fill={i % 2 ? "#ffd54a" : "#ff8a1f"}
          opacity={1 - p}
        />
      );
    })}
  </g>
);

export const Tree: React.FC<{ x: number; y: number; burn: number; frame: number }> = ({
  x, y, burn, frame,
}) => {
  const branches: [number, number, number, number, number][] = [
    [-20, -330, -190, -480, 22],
    [-190, -480, -250, -570, 13],
    [20, -300, 170, -450, 22],
    [170, -450, 245, -525, 13],
    [0, -410, -35, -580, 20],
    [-35, -580, 25, -660, 11],
  ];
  const tips: [number, number][] = [[-250, -570], [245, -525], [25, -660], [-190, -480], [170, -450]];
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M -44 0 L -26 -430 L 26 -430 L 44 0 Z" fill="#4a2f1b" />
      {branches.map(([x1, y1, x2, y2, w], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4a2f1b" strokeWidth={w} strokeLinecap="round" />
      ))}
      <Glow x={0} y={-420} r={560 * burn} opacity={burn} />
      <Flame x={0} y={-180} size={300 * burn} frame={frame} seed={1} />
      {tips.map(([tx, ty], i) => (
        <Flame key={i} x={tx} y={ty + 30} size={170 * burn} frame={frame} seed={i * 2 + 3} />
      ))}
    </g>
  );
};

export const CaveMouth: React.FC = () => (
  <g>
    <path d="M-20 1275 L-20 760 Q150 640 390 740 Q490 860 475 1275 Z" fill="#2b2533" />
    <path d="M40 1275 L40 830 Q170 730 360 810 Q430 900 420 1275 Z" fill="#0b0912" />
    <circle cx={150} cy={1130} r={6} fill="#ffd54a" opacity={0.0} />
  </g>
);

export const Logs: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <line x1={x - 150} y1={y + 12} x2={x + 150} y2={y - 10} stroke="#4b2e17" strokeWidth={34} strokeLinecap="round" />
    <line x1={x + 150} y1={y + 12} x2={x - 150} y2={y - 10} stroke="#5d3a1e" strokeWidth={34} strokeLinecap="round" />
    {[-210, -150, 150, 210].map((dx, i) => (
      <ellipse key={i} cx={x + dx} cy={y + 18} rx={34} ry={24} fill="#7b7f8f" />
    ))}
  </g>
);

export type CavemanProps = {
  x: number;
  y: number;
  frame: number;
  scale?: number;
  flip?: boolean;
  armL?: number;
  armR?: number;
  walk?: number;
  bob?: number;
  scared?: boolean;
  tunic?: string;
  hair?: string;
  torchSize?: number;
  shake?: number;
};

export const Caveman: React.FC<CavemanProps> = ({
  x, y, frame, scale = 1, flip = false, armL = 10, armR = -10, walk = 0, bob = 0,
  scared = false, tunic = "#9a6b3a", hair = "#3a2314", torchSize = 0, shake = 0,
}) => {
  const skin = "#e0a878";
  const dx = shake * Math.sin(frame * 2.3);
  const arm = (sx: number, ang: number, withTorch: boolean) => (
    <g transform={`translate(${sx},-322) rotate(${ang})`}>
      <line x1={0} y1={0} x2={0} y2={125} stroke={skin} strokeWidth={24} strokeLinecap="round" />
      <circle cx={0} cy={125} r={17} fill={skin} />
      {withTorch && (
        <g transform={`translate(0,125) rotate(${-ang})`}>
          <line x1={0} y1={50} x2={0} y2={-120} stroke="#6b4423" strokeWidth={14} strokeLinecap="round" />
          <Flame x={0} y={-112} size={torchSize} frame={frame} seed={7} />
        </g>
      )}
    </g>
  );
  return (
    <g transform={`translate(${x + dx},${y + bob}) scale(${flip ? -scale : scale},${scale})`}>
      <line x1={-28} y1={-170} x2={-30 + walk} y2={0} stroke={skin} strokeWidth={28} strokeLinecap="round" />
      <line x1={28} y1={-170} x2={30 - walk} y2={0} stroke={skin} strokeWidth={28} strokeLinecap="round" />
      <path
        d="M -66 -335 L 66 -335 L 78 -150 L 56 -165 L 38 -145 L 18 -165 L 0 -142 L -18 -165 L -38 -145 L -56 -165 L -78 -150 Z"
        fill={tunic}
      />
      <circle cx={-25} cy={-260} r={9} fill="#00000022" />
      <circle cx={30} cy={-220} r={11} fill="#00000022" />
      <circle cx={-5} cy={-190} r={8} fill="#00000022" />
      {arm(-62, armL, false)}
      {arm(62, armR, torchSize > 1)}
      <circle cx={0} cy={-385} r={58} fill={skin} />
      <path d="M -60 -385 Q -78 -470 0 -455 Q 78 -470 60 -385 Q 42 -420 0 -418 Q -42 -420 -60 -385 Z" fill={hair} />
      <path d="M -46 -365 Q 0 -300 46 -365 Q 0 -342 -46 -365 Z" fill={hair} />
      <circle cx={0} cy={-372} r={9} fill="#cf9366" />
      <circle cx={-21} cy={-390} r={scared ? 14 : 10} fill="#fff" />
      <circle cx={21} cy={-390} r={scared ? 14 : 10} fill="#fff" />
      <circle cx={-21} cy={-390} r={scared ? 4 : 5} fill="#1a1a1a" />
      <circle cx={21} cy={-390} r={scared ? 4 : 5} fill="#1a1a1a" />
      {scared ? (
        <>
          <path d="M -36 -416 Q -21 -430 -8 -416" stroke={hair} strokeWidth={5} fill="none" />
          <path d="M 8 -416 Q 21 -430 36 -416" stroke={hair} strokeWidth={5} fill="none" />
          <ellipse cx={0} cy={-348} rx={13} ry={17} fill="#8b1e1e" />
        </>
      ) : (
        <>
          <path d="M -36 -410 L -8 -406" stroke={hair} strokeWidth={6} />
          <path d="M 8 -406 L 36 -410" stroke={hair} strokeWidth={6} />
          <path d="M -14 -350 Q 0 -342 14 -350" stroke="#8b1e1e" strokeWidth={5} fill="none" />
        </>
      )}
    </g>
  );
};
