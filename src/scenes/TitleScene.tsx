import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../config";
import { Fade } from "../components/Fade";

export const TitleScene: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const lineWidth = spring({ frame: frame - 15, fps, config: { damping: 20 } });

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
            color: COLORS.text,
            fontSize: 130,
            fontWeight: 700,
            transform: `scale(${scale})`,
            fontFamily: "sans-serif",
          }}
        >
          {title}
        </div>
        <div
          style={{
            height: 8,
            width: 400 * lineWidth,
            backgroundColor: COLORS.accent,
            borderRadius: 4,
            marginTop: 50,
            marginBottom: 50,
          }}
        />
        <div style={{ color: COLORS.accent, fontSize: 64, fontFamily: "sans-serif" }}>
          {subtitle}
        </div>
      </AbsoluteFill>
    </Fade>
  );
};
