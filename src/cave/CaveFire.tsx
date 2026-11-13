import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene1, Scene2, Scene3, Scene4, Scene5, Scene6 } from "./scenes";
import { CAVE_CAPTIONS, CAVE_FRAMES, CAVE_STARTS } from "./timeline";

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6];

const CrossFade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inn = spring({ frame: frame - 10, fps, config: { damping: 18 } });
  const out = interpolate(frame, [durationInFrames - 14, durationInFrames - 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 190 }}>
      <div
        style={{
          direction: "rtl",
          textAlign: "center",
          maxWidth: 900,
          padding: "30px 44px",
          borderRadius: 36,
          background: "rgba(0,0,0,0.58)",
          color: "#fff",
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.55,
          fontFamily: "sans-serif",
          opacity: Math.min(1, inn) * out,
          transform: `translateY(${(1 - Math.min(1, inn)) * 40}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const CaveFire: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#05070f" }}>
    <Audio src={staticFile("soundtrack.wav")} volume={1} />
    {SCENES.map((Scene, i) => (
      <Sequence key={i} from={CAVE_STARTS[i]} durationInFrames={CAVE_FRAMES[i]}>
        <CrossFade>
          <Scene />
        </CrossFade>
        {CAVE_CAPTIONS[i] ? <Caption text={CAVE_CAPTIONS[i]} /> : null}
      </Sequence>
    ))}
  </AbsoluteFill>
);
