import React from "react";
import { interpolate } from "remotion";
import { FONT } from "../fonts";

export type Word = { t: number; text: string; hl: boolean };
export type CaptionLine = { from: number; to: number; words: Word[] };

// "این *صدا* از صبح" → کلمه‌ی بین ستاره طلایی میشه؛ زمان کلمه‌ها یکنواخت پخش میشه.
// (بعداً زمان واقعی از روی ویس میاد)
export const makeLine = (from: number, to: number, text: string): CaptionLine => {
  const raw = text.split(/\s+/);
  const span = Math.max(1, to - from - 26);
  return {
    from,
    to,
    words: raw.map((w, i) => ({
      t: from + 6 + Math.round((i * span) / raw.length),
      text: w.replace(/\*/g, ""),
      hl: w.includes("*"),
    })),
  };
};

export const Captions: React.FC<{ frame: number; lines: CaptionLine[]; top?: number; gold?: string }> = ({
  frame, lines, top = 1180, gold = "#f2c230",
}) => {
  const line = lines.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;
  const out = interpolate(frame, [line.to - 8, line.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        width: 940,
        top,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        direction: "rtl",
        gap: "6px 22px",
        opacity: out,
      }}
    >
      {line.words.map((w, i) => {
        const p = interpolate(frame, [w.t, w.t + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span
            key={i}
            style={{
              fontFamily: `${FONT}, sans-serif`,
              fontWeight: 800,
              fontSize: 86,
              lineHeight: 1.35,
              color: w.hl ? gold : "#fff",
              WebkitTextStroke: "11px #000",
              paintOrder: "stroke fill",
              opacity: p,
              transform: `scale(${0.75 + 0.25 * p})`,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
