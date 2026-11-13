import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, TITLE, SUBTITLE } from "./config";

export const MainComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });
  const subOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        direction: "rtl",
      }}
    >
      <div
        style={{
          color: COLORS.text,
          fontSize: 120,
          fontWeight: 800,
          transform: `scale(${scale})`,
          fontFamily: "sans-serif",
        }}
      >
        {TITLE}
      </div>
      <div
        style={{
          color: COLORS.accent,
          fontSize: 64,
          marginTop: 40,
          opacity: subOpacity,
          fontFamily: "sans-serif",
        }}
      >
        {SUBTITLE}
      </div>
    </AbsoluteFill>
  );
};
