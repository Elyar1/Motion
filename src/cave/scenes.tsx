import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Caveman, CaveMouth, Defs, Flame, Glow, Ground, Logs, Moon, Mountains, Rain, Snow, Sparks, Stars, Tree,
} from "./art";
import { CAVE_TITLE } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Base: React.FC<{
  top: string;
  bottom: string;
  frame: number;
  jolt?: number;
  stars?: boolean;
  moon?: boolean;
  children: React.ReactNode;
}> = ({ top, bottom, frame, jolt = 0, stars = true, moon = true, children }) => {
  const { durationInFrames } = useVideoConfig();
  const zoom = 1 + 0.05 * (frame / durationInFrames);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Defs />
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={top} />
            <stop offset="70%" stopColor={bottom} />
          </linearGradient>
        </defs>
        <g transform={`translate(${jolt * Math.sin(frame * 3.1)},${jolt * Math.cos(frame * 4.3)})`}>
          <rect x={-60} y={-60} width={1200} height={2040} fill="url(#sky)" />
          {stars && <Stars frame={frame} />}
          {moon && <Moon />}
          <Mountains />
          {children}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ۱) شب سرد و برفی
export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Base top="#070b1c" bottom="#1c2347" frame={frame}>
      <Ground color="#1a2040" snow />
      <CaveMouth />
      <Caveman x={680} y={1275} frame={frame} armL={-62} armR={62} shake={4} tunic="#9a6b3a" />
      <Snow frame={frame} />
    </Base>
  );
};

// ۲) رعد و برق، درخت آتش می‌گیره (صاعقه در ثانیه ۸ فیلم = فریم ۶۰ این صحنه)
export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const hit = 60;
  const burn = interpolate(frame, [hit + 3, hit + 40, 180], [0, 0.7, 1], clamp);
  const flash = interpolate(frame, [hit, hit + 2, hit + 16], [0.9, 0.7, 0], clamp);
  const bolt = frame >= hit && frame <= hit + 8 && frame !== hit + 3;
  const jolt = frame >= hit && frame < hit + 20 ? 14 * (1 - (frame - hit) / 20) : 0;
  const up = interpolate(frame, [hit, hit + 10], [0, 1], clamp);
  return (
    <Base top="#05070f" bottom="#1d1b3a" frame={frame} jolt={jolt} moon={false}>
      <Ground color="#171b33" />
      <Tree x={790} y={1262} burn={burn} frame={frame} />
      <Caveman
        x={270}
        y={1275}
        frame={frame}
        scared={frame >= hit}
        armL={10 + 140 * up}
        armR={-10 - 140 * up}
        shake={frame >= hit ? 5 : 0}
      />
      <Sparks x={790} y={900} frame={frame} count={burn > 0.2 ? 20 : 0} spread={260} rise={500} />
      <Rain frame={frame} />
      {bolt && (
        <polyline
          points="720,0 660,230 745,270 665,500 770,545 790,760"
          fill="none"
          stroke="#fff"
          strokeWidth={14}
          strokeLinejoin="round"
        />
      )}
      <rect x={-60} y={-60} width={1200} height={2040} fill="#fff" opacity={flash} />
    </Base>
  );
};

// ۳) نزدیک میشه، اول می‌ترسه بعد کنجکاو میشه
export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 150], [130, 470], clamp);
  const walking = frame < 150;
  const walk = walking ? 22 * Math.sin(frame * 0.4) : 0;
  const bob = walking ? -Math.abs(Math.sin(frame * 0.4)) * 10 : 0;
  const reach = interpolate(frame, [150, 195], [0, 1], clamp);
  return (
    <Base top="#0a0714" bottom="#3a1d2a" frame={frame} jolt={0} moon={false}>
      <Ground color="#201a2e" />
      <Tree x={820} y={1262} burn={1} frame={frame} />
      <Glow x={470} y={1000} r={600} opacity={0.35} />
      <Caveman
        x={x}
        y={1275}
        frame={frame}
        walk={walk}
        bob={bob}
        scared={frame < 90}
        armL={12 + 10 * Math.sin(frame / 6)}
        armR={-12 - 70 * reach}
      />
      <Sparks x={820} y={900} frame={frame} count={22} spread={280} rise={520} />
    </Base>
  );
};

// ۴) چوب شعله‌ور برمی‌داره و می‌دوه به سمت غار
export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const torch = interpolate(frame, [12, 45], [0, 110], clamp);
  const raise = interpolate(frame, [0, 30], [-80, -150], clamp);
  const x = interpolate(frame, [40, 170], [540, 230], clamp);
  const running = frame >= 40 && frame < 170;
  const walk = running ? 30 * Math.sin(frame * 0.55) : 0;
  const bob = running ? -Math.abs(Math.sin(frame * 0.55)) * 16 : 0;
  return (
    <Base top="#0a0714" bottom="#2a1a30" frame={frame} moon={false}>
      <Ground color="#201a2e" />
      <CaveMouth />
      <g transform="translate(0,0)">
        <Tree x={900} y={1262} burn={0.9} frame={frame} />
      </g>
      <Glow x={x} y={1000} r={420} opacity={torch / 110} />
      <Caveman
        x={x}
        y={1275}
        frame={frame}
        flip={frame >= 40}
        walk={walk}
        bob={bob}
        armL={20}
        armR={raise}
        torchSize={torch}
      />
      <Sparks x={x} y={950} frame={frame} count={torch > 50 ? 10 : 0} spread={60} rise={200} />
    </Base>
  );
};

// ۵) دور آتش، جشن و رقص با ضرب طبل (هر ضرب = ۱۸ فریم)
export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const beat = Math.abs(Math.sin((Math.PI * frame) / 18));
  const sw = Math.sin((Math.PI * frame) / 18);
  const dance = (phase: number) => ({
    armL: 120 + 40 * Math.sin((Math.PI * frame) / 18 + phase),
    armR: -(120 + 40 * Math.sin((Math.PI * frame) / 18 + phase + Math.PI)),
    bob: -beat * 30,
  });
  const fireIn = interpolate(frame, [0, 25], [0.4, 1], clamp);
  return (
    <Base top="#080612" bottom="#3b1c22" frame={frame}>
      <Ground color="#231a24" />
      <Glow x={540} y={1130} r={900} opacity={0.55 * fireIn} />
      <Logs x={540} y={1262} />
      <Flame x={540} y={1250} size={300 * fireIn} frame={frame} seed={1} />
      <Flame x={450} y={1252} size={190 * fireIn} frame={frame} seed={4} />
      <Flame x={630} y={1252} size={200 * fireIn} frame={frame} seed={8} />
      <Sparks x={540} y={1000} frame={frame} count={26} spread={200} rise={560} />
      <g>
        <line x1={420} y1={1262} x2={410} y2={1090} stroke="#5d3a1e" strokeWidth={12} strokeLinecap="round" />
        <line x1={660} y1={1262} x2={670} y2={1090} stroke="#5d3a1e" strokeWidth={12} strokeLinecap="round" />
        <line x1={400} y1={1100} x2={680} y2={1100} stroke="#6b4423" strokeWidth={10} strokeLinecap="round" />
        <ellipse cx={500} cy={1100} rx={46} ry={30} fill="#a0522d" />
        <ellipse cx={590} cy={1100} rx={46} ry={30} fill="#8b4513" />
        <ellipse cx={490} cy={1090} rx={16} ry={8} fill="#cd853f" opacity={0.7} />
      </g>
      <Caveman x={190} y={1290} frame={frame} {...dance(0)} tunic="#9a6b3a" />
      <Caveman x={900} y={1290} frame={frame} flip {...dance(1.5)} tunic="#6f8a3d" hair="#2a1a10" />
      <Caveman x={745} y={1300} frame={frame} scale={0.6} flip {...dance(3)} tunic="#b0493b" />
      <Caveman x={350} y={1300} frame={frame} scale={0.6} {...dance(4.5)} tunic="#4f6d8f" hair="#5a3b22" />
      <rect x={0} y={0} width={1080} height={1920} fill="#ff7a00" opacity={0.04 + 0.04 * sw * sw} />
    </Base>
  );
};

// ۶) تایتل پایانی
export const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const sub = interpolate(frame, [25, 50], [0, 1], clamp);
  const line = spring({ frame: frame - 15, fps, config: { damping: 20 } });
  return (
    <Base top="#05060d" bottom="#2a1418" frame={frame} moon={false}>
      <Ground color="#1a1220" />
      <Glow x={540} y={1100} r={800} opacity={0.5} />
      <Flame x={540} y={1260} size={420 * Math.min(1, pop)} frame={frame} seed={2} />
      <Sparks x={540} y={950} frame={frame} count={26} spread={220} rise={650} />
      <foreignObject x={0} y={380} width={1080} height={500}>
        <div
          style={{
            direction: "rtl",
            textAlign: "center",
            color: "#fff",
            fontFamily: "sans-serif",
            transform: `scale(${pop})`,
          }}
        >
          <div style={{ fontSize: 220, fontWeight: 700 }}>{CAVE_TITLE.title}</div>
          <div
            style={{
              height: 8,
              width: 360 * Math.max(0, line),
              background: "#ffa800",
              borderRadius: 4,
              margin: "10px auto 30px",
            }}
          />
          <div style={{ fontSize: 70, color: "#ffc766", opacity: sub }}>{CAVE_TITLE.subtitle}</div>
        </div>
      </foreignObject>
    </Base>
  );
};
