import React from "react";

const C = "#f3efe4";
const P: React.FC<{ d: string; w?: number; c?: string; o?: number }> = ({ d, w = 8, c = C, o = 1 }) => (
  <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />
);

// خط زمین با هاشور و دایره‌ی گچی زیر پا
export const Floor: React.FC<{ x: number; y: number; w: number; ring?: boolean }> = ({ x, y, w, ring }) => (
  <g transform={`translate(${x},${y})`}>
    <P d={`M ${-w / 2} 0 Q ${-w / 6} -7 0 0 T ${w / 2} -2`} w={6} />
    {Array.from({ length: Math.floor(w / 60) }).map((_, i) => (
      <P key={i} d={`M ${-w / 2 + i * 60 + 10} 14 l 26 20`} w={4} o={0.5} />
    ))}
    {ring && (
      <>
        <ellipse cx={0} cy={6} rx={250} ry={26} fill="none" stroke={C} strokeWidth={5} opacity={0.6} />
        <ellipse cx={0} cy={10} rx={285} ry={34} fill="none" stroke={C} strokeWidth={3} opacity={0.3} />
      </>
    )}
  </g>
);

// مخروط نور اسپات
export const Cone: React.FC<{ x: number; y: number; h: number }> = ({ x, y, h }) => (
  <polygon points={`${x - 120},${y - h} ${x + 120},${y - h} ${x + 430},${y} ${x - 430},${y}`} fill="url(#cone)" />
);

// میز با مانیتور، کیبورد و لیوان. مبدأ = وسط لبه‌ی روی میز
export const DeskSet: React.FC<{ x: number; y: number; s?: number; frame: number }> = ({ x, y, s = 1, frame }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <P d="M -270 0 L 270 0" w={9} />
    <P d="M -270 24 L 270 24" w={6} />
    <P d="M -235 24 L -235 330" w={8} />
    <P d="M 235 24 L 235 330" w={8} />
    <P d="M -95 -235 L 95 -235 L 95 -60 L -95 -60 Z" w={8} />
    <P d="M -78 -218 L 78 -218 L 78 -77 L -78 -77 Z" w={3} o={0.45} />
    <P d="M 0 -60 L 0 -8" w={8} />
    <P d="M -48 -8 L 48 -8" w={8} />
    <P d="M -150 -14 L -10 -14" w={7} />
    <P d="M 150 -75 L 150 -8 L 208 -8 L 208 -75" w={7} />
    <ellipse cx={179} cy={-75} rx={29} ry={7} fill="none" stroke={C} strokeWidth={5} />
    <P d="M 208 -58 C 246 -58 246 -24 208 -24" w={6} />
    {[0, 1].map((i) => (
      <P
        key={i}
        d={`M ${168 + i * 22} -92 q ${6 + 3 * Math.sin(frame / 7 + i)} -18 0 -36 q -6 -18 0 -34`}
        w={4}
        c="#e0b030"
        o={0.7}
      />
    ))}
  </g>
);
