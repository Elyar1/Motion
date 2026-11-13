import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../config";
import { Fade } from "../components/Fade";

export const HabitScene: React.FC<{
  index: number;
  total: number;
  title: string;
  text: string;
}> = ({ index, total, title, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numScale = spring({ frame, fps, config: { damping: 10 } });
  const titleX = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 15 } }),
    [0, 1],
    [200, 0]
  );
  const textOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Fade>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          direction: "rtl",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: COLORS.accent,
            color: COLORS.background,
            fontSize: 170,
            fontWeight: 700,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${numScale})`,
            fontFamily: "sans-serif",
          }}
        >
          {String(index + 1).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])}
        </div>

        <div
          style={{
            color: COLORS.text,
            fontSize: 110,
            fontWeight: 700,
            marginTop: 70,
            transform: `translateX(${titleX}px)`,
            fontFamily: "sans-serif",
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: COLORS.muted,
            fontSize: 56,
            lineHeight: 1.6,
            marginTop: 40,
            opacity: textOpacity,
            fontFamily: "sans-serif",
          }}
        >
          {text}
        </div>

        <div style={{ position: "absolute", bottom: 160, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 60 : 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: i === index ? COLORS.accent : COLORS.card,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </Fade>
  );
};
