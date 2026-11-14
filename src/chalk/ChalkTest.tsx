import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { FONT } from "../fonts";
import { Board, ChalkDefs, Dust } from "./board";
import { Figure, LOTUS, POINT, STAND, headPos } from "./Figure";
import { Cone, DeskSet, Floor } from "./props";
import { Captions, makeLine } from "./Captions";

const GOLD = "#e8b830";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

const S = 1.5;
const FIG_A = { x: 540, y: 1080 };
const FIG_B = { x: 1300, y: 1080 };
const FLOOR_Y = 1380;
const headB = headPos(POINT.lean ?? 0);
const HEAD = { x: FIG_B.x + headB[0] * S, y: FIG_B.y + headB[1] * S };

const LINES = [
  makeLine(8, 100, "این *صدا* از صبح داره حرف می‌زنه"),
  makeLine(112, 205, "پس داره با *کی* حرف می‌زنه؟"),
  makeLine(268, 358, "*کی* این رو گفت؟"),
];

// دوربین: شات ۱ زوم آرام ← کات ← شات ۲ پن ← زوم عمیق داخل سر
const camera = (f: number) => {
  if (f < 105) {
    const t = f / 105;
    return { x: 540, y: 880 - 20 * t, z: 0.95 + 0.2 * ease(t) };
  }
  if (f < 195) {
    const t = (f - 105) / 90;
    return { x: 1480 + 40 * t, y: 900, z: 0.82 + 0.08 * t };
  }
  const t = ease(Math.min(1, (f - 195) / 150));
  const z = Math.exp(Math.log(0.9) + (Math.log(11) - Math.log(0.9)) * t);
  const m = Math.min(1, t * 2);
  return { x: 1520 + (HEAD.x - 1520) * m, y: 900 + (HEAD.y - 900) * m, z };
};

export const ChalkTest: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 3) % 12;
  const cam = camera(frame);
  const jx = Math.sin(Math.floor(frame / 3) * 1.7) * 2;
  const jy = Math.cos(Math.floor(frame / 3) * 2.3) * 2;
  const innerIn = interpolate(frame, [105, 140], [0, 1], clamp);
  const sIn = 0.36;
  const inner = { x: HEAD.x, y: HEAD.y + 52 };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0c" }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <ChalkDefs seed={seed} />
        <Board />
        <g filter="url(#chalk)">
          <g transform={`translate(${540 + jx},${960 + jy}) scale(${cam.z}) translate(${-cam.x},${-cam.y})`}>
            {/* شات ۱ */}
            <Cone x={FIG_A.x} y={FLOOR_Y} h={1500} />
            <Floor x={FIG_A.x} y={FLOOR_Y} w={900} ring />
            <Figure x={FIG_A.x} y={FIG_A.y} s={S} pose={STAND} frame={frame} />

            {/* شات ۲ و ۳ */}
            <Floor x={1500} y={FLOOR_Y} w={1500} />
            <DeskSet x={1790} y={FLOOR_Y - 495} s={1.5} frame={frame} />
            <Figure x={FIG_B.x} y={FIG_B.y} s={S} pose={POINT} frame={frame} look={6} />

            {/* دنیای داخل سر: آدم‌چوبی طلایی در حال مدیتیشن */}
            <g opacity={innerIn}>
              <path
                d={`M ${inner.x - 44} ${inner.y + 18} Q ${inner.x} ${inner.y + 12} ${inner.x + 44} ${inner.y + 18}`}
                fill="none"
                stroke={GOLD}
                strokeWidth={2.4}
                strokeLinecap="round"
                opacity={0.7}
              />
              <Figure x={inner.x} y={inner.y} s={sIn} pose={LOTUS} frame={frame} color={GOLD} sw={9} />
            </g>
          </g>
        </g>
        <rect width={1080} height={1920} filter="url(#grain)" />
        <rect width={1080} height={1920} fill="url(#vig)" />
        <Dust frame={frame} />
      </svg>

      <Captions frame={frame} lines={LINES} />

      <div
        style={{
          position: "absolute",
          top: 86,
          right: 56,
          textAlign: "right",
          direction: "rtl",
          fontFamily: `${FONT}, sans-serif`,
          color: "#fff",
          opacity: 0.9,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700 }}>مرد گچی</div>
        <div style={{ fontSize: 26, opacity: 0.75, direction: "ltr" }}>@mardegachi</div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 70,
          width: "100%",
          textAlign: "center",
          fontFamily: `${FONT}, sans-serif`,
          fontSize: 34,
          color: "#fff",
          opacity: 0.16,
        }}
      >
        @mardegachi
      </div>
    </AbsoluteFill>
  );
};
