import React from "react";

export type Pose = {
  aL: [number, number];
  aR: [number, number];
  lL: [number, number];
  lR: [number, number];
  lotus: number;
  lean?: number;
};

export const STAND: Pose = { aL: [-21, -11], aR: [21, 11], lL: [-8, -3], lR: [8, 3], lotus: 0 };
export const POINT: Pose = { aL: [-21, -11], aR: [78, 84], lL: [-8, -3], lR: [8, 3], lotus: 0, lean: 3 };
export const LOTUS: Pose = { aL: [-20, -5], aR: [20, 5], lL: [0, 0], lR: [0, 0], lotus: 1 };

export const TORSO = 180;
export const NECK = 18;
export const HEAD_R = 55;
const UA = 95;
const FA = 90;
const TH = 100;
const SH = 100;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (x: number, y: number, len: number, ang: number): [number, number] => [
  x + len * Math.sin(rad(ang)),
  y + len * Math.cos(rad(ang)),
];

// مرکز سر نسبت به لگن (واحد محلی)
export const headPos = (lean = 0): [number, number] => {
  const d = TORSO + NECK + HEAD_R;
  return [Math.sin(rad(lean)) * d, -Math.cos(rad(lean)) * d];
};

export const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    aL: [l(a.aL[0], b.aL[0]), l(a.aL[1], b.aL[1])],
    aR: [l(a.aR[0], b.aR[0]), l(a.aR[1], b.aR[1])],
    lL: [l(a.lL[0], b.lL[0]), l(a.lL[1], b.lL[1])],
    lR: [l(a.lR[0], b.lR[0]), l(a.lR[1], b.lR[1])],
    lotus: l(a.lotus, b.lotus),
    lean: l(a.lean ?? 0, b.lean ?? 0),
  };
};

type Props = {
  x: number; // موقعیت لگن
  y: number;
  s?: number;
  pose?: Pose;
  frame: number;
  color?: string;
  sw?: number;
  look?: number;
  opacity?: number;
};

export const Figure: React.FC<Props> = ({
  x, y, s = 1, pose = STAND, frame, color = "#f3efe4", sw = 9, look = 0, opacity = 1,
}) => {
  const lean = pose.lean ?? 0;
  const breathe = Math.sin(frame / 18) * 2;
  const T: [number, number] = [Math.sin(rad(lean)) * TORSO, -Math.cos(rad(lean)) * TORSO];
  const ux = Math.sin(rad(lean));
  const uy = -Math.cos(rad(lean));
  const S: [number, number] = [T[0] - ux * 15, T[1] - uy * 15];
  const H = headPos(lean);
  const neckEnd: [number, number] = [T[0] + ux * NECK, T[1] + uy * NECK];

  const arm = (a: [number, number], mirror: number) => {
    const e = pt(S[0], S[1], UA, a[0] + breathe * mirror);
    const w = pt(e[0], e[1], FA, a[1] + breathe * mirror);
    const fingers = [-32, 0, 32].map((o) => pt(w[0], w[1], 17, a[1] + o));
    return { e, w, fingers };
  };
  const L = arm(pose.aL, -1);
  const R = arm(pose.aR, 1);

  const lotus = pose.lotus > 0.5;
  const kneeL = pt(-10, 0, TH, pose.lL[0]);
  const ankL = pt(kneeL[0], kneeL[1], SH, pose.lL[1]);
  const kneeR = pt(10, 0, TH, pose.lR[0]);
  const ankR = pt(kneeR[0], kneeR[1], SH, pose.lR[1]);

  const line = (p: [number, number][], w = sw) => (
    <polyline
      points={p.map((q) => q.join(",")).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  const blink = frame % 96 > 91 ? 0.15 : 1;

  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={opacity}>
      {lotus ? (
        <>
          {line([[-8, 0], [-85, 10], [28, 46]])}
          {line([[8, 0], [85, 10], [-28, 46]])}
        </>
      ) : (
        <>
          {line([[-10, 0], kneeL, ankL, [ankL[0] - 34, ankL[1] + 3]])}
          {line([[10, 0], kneeR, ankR, [ankR[0] + 34, ankR[1] + 3]])}
        </>
      )}
      {line([[0, 0], T])}
      {line([T, neckEnd])}
      {line([S, L.e, L.w])}
      {line([S, R.e, R.w])}
      {L.fingers.map((f, i) => <React.Fragment key={"l" + i}>{line([L.w, f], sw * 0.6)}</React.Fragment>)}
      {R.fingers.map((f, i) => <React.Fragment key={"r" + i}>{line([R.w, f], sw * 0.6)}</React.Fragment>)}
      <circle cx={H[0]} cy={H[1]} r={HEAD_R} fill="none" stroke={color} strokeWidth={sw} />
      <circle cx={H[0]} cy={H[1]} r={HEAD_R - 6} fill="none" stroke={color} strokeWidth={sw * 0.3} opacity={0.45} />
      <ellipse cx={H[0] - 19 + look} cy={H[1] - 4} rx={6.5} ry={6.5 * blink} fill={color} />
      <ellipse cx={H[0] + 19 + look} cy={H[1] - 4} rx={6.5} ry={6.5 * blink} fill={color} />
    </g>
  );
};
